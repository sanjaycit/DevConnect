const express = require('express');
const router = express.Router();

// Test endpoints removed
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const User = require('../models/User');

// @route   GET /api/messages/conversations
// @desc    Get all conversations for the current user
// @access  Private
router.get('/conversations', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get all unique conversation IDs for this user
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: userId },
            { receiver: userId }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$receiver', userId] }, { $eq: ['$isRead', false] }] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'lastMessage.sender',
          foreignField: '_id',
          as: 'senderInfo'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'lastMessage.receiver',
          foreignField: '_id',
          as: 'receiverInfo'
        }
      },
      {
        $addFields: {
          otherUser: {
            $cond: [
              { $eq: ['$lastMessage.sender', userId] },
              { $arrayElemAt: ['$receiverInfo', 0] },
              { $arrayElemAt: ['$senderInfo', 0] }
            ]
          }
        }
      },
      {
        $project: {
          _id: 1,
          lastMessage: 1,
          unreadCount: 1,
          otherUser: {
            _id: 1,
            name: 1,
            profilePicture: 1,
            isOnline: 1,
            lastSeen: 1
          }
        }
      },
      {
        $sort: { 'lastMessage.createdAt': -1 }
      }
    ]);

    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/messages/connections
// @desc    Get user's connections for messaging
// @access  Private
router.get('/connections', auth, async (req, res) => {
  try {
    console.log('Fetching connections for user:', req.user._id, req.user.name);
    
    // Get user with populated connections
    const user = await User.findById(req.user._id);
    console.log('Raw user connections:', user.connections);
    
    // Now populate the connections
    const populatedUser = await User.findById(req.user._id).populate('connections', 'name profilePicture email');
    
    if (!populatedUser) {
      console.log('User not found');
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log('User connections count:', populatedUser.connections?.length || 0);
    
    // If user has no recorded connections, also check for users who have this user in their connections
    let connectionsList = populatedUser.connections || [];
    console.log('Direct connections:', connectionsList.map(c => ({ id: c._id, name: c.name })));
    
    if (!connectionsList || connectionsList.length === 0) {
      console.log('No direct connections found for user, checking reverse connections');
      const reverse = await User.find({ connections: req.user._id }).select('name profilePicture email');
      console.log('Reverse connections found:', reverse.map(c => ({ id: c._id, name: c.name })));
      if (reverse && reverse.length > 0) {
        connectionsList = reverse;
      }
    }

    // As a final step, ensure we return a de-duplicated array of connection objects
    const uniq = {};
    const merged = [];
    (connectionsList || []).forEach(c => {
      const id = c._id ? c._id.toString() : (c.id || '');
      if (!uniq[id]) {
        uniq[id] = true;
        merged.push(c);
      }
    });

    console.log('Returning connections:', merged.map(c => ({ id: c._id, name: c.name })));
    return res.json(merged);
  } catch (error) {
    console.error('Error fetching connections:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/messages/:conversationId
// @desc    Get messages for a specific conversation
// @access  Private
router.get('/:conversationId', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;
    
    // Verify user is part of this conversation
    const message = await Message.findOne({ conversationId });
    if (!message) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    const userIdStr = userId.toString();
    if (message.sender.toString() !== userIdStr && message.receiver.toString() !== userIdStr) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const messages = await Message.find({ conversationId })
      .populate('sender', 'name profilePicture')
      .populate('receiver', 'name profilePicture')
      .sort({ createdAt: 1 });

    // Mark messages as read
    await Message.updateMany(
      { conversationId, receiver: userId, isRead: false },
      { isRead: true }
    );

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/messages
// @desc    Send a message
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { receiverId, content } = req.body;
    
    if (!receiverId || !content) {
      return res.status(400).json({ message: 'Receiver ID and content are required' });
    }

    // Check if receiver is in user's connections
    const sender = await User.findById(req.user._id);
    const isConnected = (sender.connections || []).some(id => id.toString() === receiverId.toString());
    if (!isConnected) {
      return res.status(403).json({ message: 'You can only message your connections' });
    }

    // Verify receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    const conversationId = Message.generateConversationId(req.user._id, receiverId);
    
    const message = new Message({
      sender: req.user._id,
      receiver: receiverId,
      content: content.trim(),
      conversationId
    });

    await message.save();
    await message.populate('sender', 'name profilePicture');
    await message.populate('receiver', 'name profilePicture');

    // Emit socket event to sender and receiver rooms
    try {
      const io = req.app.get('io');
      if (io) {
        const senderRoom = `user_${req.user._id}`;
        const receiverRoom = `user_${receiverId}`;
        const payload = {
          _id: message._id,
          sender: message.sender,
          receiver: message.receiver,
          content: message.content,
          conversationId: message.conversationId,
          isRead: message.isRead,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt
        };
        io.to(senderRoom).to(receiverRoom).emit('message:new', payload);
      }
    } catch (e) {
      // Non-fatal: logging only
      console.error('Socket emit failed:', e);
    }

    res.json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/messages/connections
// @desc    Get user's connections for messaging
// @access  Private
router.get('/connections', auth, async (req, res) => {
  try {
    console.log('Fetching connections for user:', req.user._id, req.user.name);
    
    // Get user with populated connections
    const user = await User.findById(req.user._id);
    console.log('Raw user connections:', user.connections);
    
    // Now populate the connections
    const populatedUser = await User.findById(req.user._id).populate('connections', 'name profilePicture email');
    
    if (!populatedUser) {
      console.log('User not found');
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log('User connections count:', populatedUser.connections?.length || 0);
    
    // If user has no recorded connections, also check for users who have this user in their connections
    let connectionsList = populatedUser.connections || [];
    console.log('Direct connections:', connectionsList.map(c => ({ id: c._id, name: c.name })));
    
    if (!connectionsList || connectionsList.length === 0) {
      console.log('No direct connections found for user, checking reverse connections');
      const reverse = await User.find({ connections: req.user._id }).select('name profilePicture email');
      console.log('Reverse connections found:', reverse.map(c => ({ id: c._id, name: c.name })));
      if (reverse && reverse.length > 0) {
        connectionsList = reverse;
      }
    }

    // As a final step, ensure we return a de-duplicated array of connection objects
    const uniq = {};
    const merged = [];
    (connectionsList || []).forEach(c => {
      const id = c._id ? c._id.toString() : (c.id || '');
      if (!uniq[id]) {
        uniq[id] = true;
        merged.push(c);
      }
    });

    console.log('Returning connections:', merged.map(c => ({ id: c._id, name: c.name })));
    return res.json(merged);
  } catch (error) {
    console.error('Error fetching connections:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
