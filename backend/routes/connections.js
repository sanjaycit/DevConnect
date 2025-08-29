const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');

const router = express.Router();

// Helper function to validate ObjectId
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// Test endpoint to verify route is working
router.get('/test', (req, res) => {
  res.json({ message: 'Connections route is working!', timestamp: new Date().toISOString() });
});

// @route   POST /api/connections/request/:id
// @desc    Send connection request
// @access  Private
router.post('/request/:id', auth, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    console.log('Connection request - Target User ID:', targetUserId);
    console.log('Current User ID:', req.user._id);
    console.log('Current User:', req.user.name);

    // Validate ObjectId
    if (!isValidObjectId(targetUserId)) {
      console.log('Invalid ObjectId format:', targetUserId);
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    if (req.user._id.toString() === targetUserId) {
      console.log('User trying to connect with themselves');
      return res.status(400).json({ message: 'Cannot send connection request to yourself' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      console.log('Target user not found:', targetUserId);
      return res.status(404).json({ message: 'User not found' });
    }
    console.log('Target user found:', targetUser.name);

    // Check if already connected
    if (req.user.connections.includes(targetUserId)) {
      console.log('Users already connected');
      return res.status(400).json({ message: 'Already connected with this user' });
    }

    // Check if request already exists
    const existingRequest = targetUser.connectionRequests.find(
      request => request.from.toString() === req.user._id.toString() && request.status === 'pending'
    );

    if (existingRequest) {
      console.log('Connection request already exists');
      return res.status(400).json({ message: 'Connection request already sent' });
    }

    // Check if current user has already received a request from target user
    const incomingRequest = req.user.connectionRequests.find(
      request => request.from.toString() === targetUserId && request.status === 'pending'
    );

    if (incomingRequest) {
      console.log('Incoming request already exists');
      return res.status(400).json({ message: 'This user has already sent you a connection request' });
    }

    // Add connection request
    console.log('Adding connection request to target user');
    targetUser.connectionRequests.push({
      from: req.user._id,
      status: 'pending'
    });

    await targetUser.save();
    console.log('Connection request saved successfully');

    // Send real-time notification
    const io = req.app.get('io');
    if (io) {
      console.log('Sending Socket.io notification');
      io.to(`user_${targetUserId}`).emit('connectionRequest', {
        type: 'new_request',
        from: {
          id: req.user._id,
          name: req.user.name,
          profilePicture: req.user.profilePicture
        },
        message: `${req.user.name} sent you a connection request`
      });
    }

    console.log('Connection request completed successfully');
    res.json({ message: 'Connection request sent successfully' });
  } catch (error) {
    console.error('Error sending connection request:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/connections/accept/:id
// @desc    Accept connection request
// @access  Private
router.post('/accept/:id', auth, async (req, res) => {
  try {
    const fromUserId = req.params.id;

    // Validate ObjectId
    if (!isValidObjectId(fromUserId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    // Find the pending request
    const requestIndex = req.user.connectionRequests.findIndex(
      request => request.from.toString() === fromUserId && request.status === 'pending'
    );

    if (requestIndex === -1) {
      return res.status(404).json({ message: 'Connection request not found' });
    }

    // Update request status
    req.user.connectionRequests[requestIndex].status = 'accepted';

    // Add to connections for both users
    req.user.connections.push(fromUserId);
    
    const fromUser = await User.findById(fromUserId);
    if (fromUser) {
      fromUser.connections.push(req.user._id);
      await fromUser.save();
    }

    await req.user.save();

    // Send real-time notification
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${fromUserId}`).emit('connectionRequest', {
        type: 'request_accepted',
        from: {
          id: req.user._id,
          name: req.user.name,
          profilePicture: req.user.profilePicture
        },
        message: `${req.user.name} accepted your connection request`
      });
    }

    res.json({ message: 'Connection request accepted successfully' });
  } catch (error) {
    console.error('Error accepting connection request:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/connections/reject/:id
// @desc    Reject connection request
// @access  Private
router.post('/reject/:id', auth, async (req, res) => {
  try {
    const fromUserId = req.params.id;

    // Validate ObjectId
    if (!isValidObjectId(fromUserId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    // Find the pending request
    const requestIndex = req.user.connectionRequests.findIndex(
      request => request.from.toString() === fromUserId && request.status === 'pending'
    );

    if (requestIndex === -1) {
      return res.status(404).json({ message: 'Connection request not found' });
    }

    // Update request status
    req.user.connectionRequests[requestIndex].status = 'rejected';
    await req.user.save();

    res.json({ message: 'Connection request rejected successfully' });
  } catch (error) {
    console.error('Error rejecting connection request:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/connections/suggestions
// @desc    Get connection suggestions sorted by priority
// @access  Private
router.get('/suggestions', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id).populate('connections');
    
    // Get all users except current user
    const allUsers = await User.find({ _id: { $ne: req.user._id } })
      .select('name email bio skills profilePicture connections connectionRequests')
      .populate('connections', 'name');

    // Categorize users with enhanced scoring
    const suggestions = allUsers.map(user => {
      const isDirectConnection = currentUser.connections.some(conn => conn._id.equals(user._id));
      
      const isPendingRequest = user.connectionRequests.some(
        request => request.from.toString() === req.user._id.toString() && request.status === 'pending'
      );
      const hasIncomingRequest = currentUser.connectionRequests.some(
        request => request.from.toString() === user._id.toString() && request.status === 'pending'
      );

      // Calculate mutual connections
      const mutualConnections = user.connections.filter(connId => 
        currentUser.connections.some(c => c._id.equals(connId._id))
      );

      // Calculate skill compatibility score
      let skillScore = 0;
      if (currentUser.skills && user.skills) {
        const userSkills = currentUser.skills.map(s => s.toLowerCase());
        const targetSkills = user.skills.map(s => s.toLowerCase());
        const commonSkills = userSkills.filter(skill => targetSkills.includes(skill));
        skillScore = (commonSkills.length / Math.max(userSkills.length, targetSkills.length)) * 10;
      }

      // Calculate connection strength score
      const connectionStrengthScore = mutualConnections.length * 2;

      // Calculate total recommendation score
      const totalScore = skillScore + connectionStrengthScore;

      let priority = 3; // Default priority (others)
      let status = 'connect';
      let recommendationReason = '';

      if (isDirectConnection) {
        priority = 1; // Direct connections
        status = 'connected';
        recommendationReason = 'Already connected';
      } else if (mutualConnections.length > 0) {
        priority = 2; // Mutual connections
        status = 'mutual';
        recommendationReason = `${mutualConnections.length} mutual connection${mutualConnections.length !== 1 ? 's' : ''}`;
      } else if (skillScore > 5) {
        priority = 2; // High skill compatibility
        recommendationReason = 'High skill compatibility';
      } else if (skillScore > 2) {
        priority = 2; // Medium skill compatibility
        recommendationReason = 'Good skill match';
      }

      if (isPendingRequest) {
        status = 'pending_sent';
        recommendationReason = 'Request already sent';
      } else if (hasIncomingRequest) {
        status = 'pending_received';
        recommendationReason = 'Has sent you a request';
      }

      return {
        ...user.toObject(),
        priority,
        status,
        mutualConnectionsCount: mutualConnections.length,
        mutualConnections: mutualConnections.map(conn => ({
          id: conn._id,
          name: conn.name
        })),
        skillScore: Math.round(skillScore * 10) / 10,
        connectionStrengthScore,
        totalScore: Math.round(totalScore * 10) / 10,
        recommendationReason
      };
    });

    // Enhanced sorting: priority first, then by total score, then by mutual connections
    suggestions.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      if (a.totalScore !== b.totalScore) {
        return b.totalScore - a.totalScore; // Higher score first
      }
      if (a.priority === 2) { // For mutual connections, sort by count
        return b.mutualConnectionsCount - a.mutualConnectionsCount;
      }
      return 0;
    });

    res.json(suggestions);
  } catch (error) {
    console.error('Error fetching connection suggestions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/connections/my-connections
// @desc    Get current user's connections
// @access  Private
router.get('/my-connections', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('connections', 'name email profilePicture bio skills');

    res.json(user.connections);
  } catch (error) {
    console.error('Error fetching connections:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/connections/pending
// @desc    Get pending connection requests for current user
// @access  Private
router.get('/pending', auth, async (req, res) => {
  try {
    const pendingRequests = await User.find({
      _id: { $in: req.user.connectionRequests.filter(req => req.status === 'pending').map(req => req.from) }
    }).select('name email profilePicture bio skills');

    res.json(pendingRequests);
  } catch (error) {
    console.error('Error fetching pending connections:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/connections/:id
// @desc    Remove connection
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const userIdToRemove = req.params.id;

    // Validate ObjectId
    if (!isValidObjectId(userIdToRemove)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    // Remove from current user's connections
    req.user.connections = req.user.connections.filter(
      connId => connId.toString() !== userIdToRemove
    );

    // Remove from other user's connections
    const otherUser = await User.findById(userIdToRemove);
    if (otherUser) {
      otherUser.connections = otherUser.connections.filter(
        connId => connId.toString() !== req.user._id.toString()
      );
      await otherUser.save();
    }

    await req.user.save();

    res.json({ message: 'Connection removed successfully' });
  } catch (error) {
    console.error('Error removing connection:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/connections/analytics
// @desc    Get connection analytics for current user
// @access  Private
router.get('/analytics', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('connections', 'name skills')
      .populate('connectionRequests.from', 'name skills');

    const totalConnections = user.connections.length;
    const pendingRequests = user.connectionRequests.filter(req => req.status === 'pending').length;
    const acceptedRequests = user.connectionRequests.filter(req => req.status === 'accepted').length;
    const rejectedRequests = user.connectionRequests.filter(req => req.status === 'rejected').length;

    // Calculate connection strength based on mutual connections
    const connectionStrengths = user.connections.map(connection => {
      const mutualConnections = connection.connections ? 
        connection.connections.filter(connId => 
          user.connections.some(c => c._id.equals(connId))
        ).length : 0;
      
      return {
        userId: connection._id,
        name: connection.name,
        mutualConnections: mutualConnections,
        strength: mutualConnections > 0 ? 'strong' : 'weak'
      };
    });

    // Get top skills from connections
    const allSkills = user.connections.reduce((skills, connection) => {
      if (connection.skills) {
        skills.push(...connection.skills);
      }
      return skills;
    }, []);

    const skillFrequency = {};
    allSkills.forEach(skill => {
      skillFrequency[skill] = (skillFrequency[skill] || 0) + 1;
    });

    const topSkills = Object.entries(skillFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([skill, count]) => ({ skill, count }));

    res.json({
      totalConnections,
      pendingRequests,
      acceptedRequests,
      rejectedRequests,
      connectionStrengths,
      topSkills,
      networkGrowth: {
        thisMonth: user.connections.filter(conn => {
          const connDate = new Date(conn.createdAt || Date.now());
          const monthAgo = new Date();
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return connDate > monthAgo;
        }).length
      }
    });
  } catch (error) {
    console.error('Error fetching connection analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/connections/search
// @desc    Search users by name, skills, or company
// @access  Private
router.get('/search', auth, async (req, res) => {
  try {
    const { q, skills, location } = req.query;
    
    let searchQuery = { _id: { $ne: req.user._id } };
    
    if (q) {
      searchQuery.$or = [
        { name: { $regex: q, $options: 'i' } },
        { bio: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ];
    }
    
    if (skills) {
      const skillArray = skills.split(',').map(s => s.trim());
      searchQuery.skills = { $in: skillArray };
    }
    
    if (location) {
      searchQuery.bio = { $regex: location, $options: 'i' };
    }

    const users = await User.find(searchQuery)
      .select('name email bio skills profilePicture connections connectionRequests')
      .populate('connections', 'name')
      .limit(20);

    // Add connection status and priority
    const results = users.map(user => {
      const isDirectConnection = req.user.connections.includes(user._id);
      const isPendingRequest = user.connectionRequests.some(
        request => request.from.toString() === req.user._id.toString() && request.status === 'pending'
      );
      const hasIncomingRequest = req.user.connectionRequests.some(
        request => request.from.toString() === user._id.toString() && request.status === 'pending'
      );

      let priority = 3;
      let status = 'connect';

      if (isDirectConnection) {
        priority = 1;
        status = 'connected';
      } else if (isPendingRequest) {
        status = 'pending_sent';
      } else if (hasIncomingRequest) {
        status = 'pending_received';
      }

      return {
        ...user.toObject(),
        priority,
        status
      };
    });

    // Sort by priority and relevance
    results.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return 0;
    });

    res.json(results);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/connections/bulk-request
// @desc    Send connection requests to multiple users
// @access  Private
router.post('/bulk-request', auth, async (req, res) => {
  try {
    const { userIds } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'User IDs array is required' });
    }

    if (userIds.length > 10) {
      return res.status(400).json({ message: 'Maximum 10 users allowed per bulk request' });
    }

    const results = [];
    const io = req.app.get('io');

    for (const userId of userIds) {
      try {
        if (!isValidObjectId(userId)) {
          results.push({ userId, success: false, message: 'Invalid user ID format' });
          continue;
        }

        if (req.user._id.toString() === userId) {
          results.push({ userId, success: false, message: 'Cannot send connection request to yourself' });
          continue;
        }

        const targetUser = await User.findById(userId);
        if (!targetUser) {
          results.push({ userId, success: false, message: 'User not found' });
          continue;
        }

        // Check if already connected
        if (req.user.connections.includes(userId)) {
          results.push({ userId, success: false, message: 'Already connected with this user' });
          continue;
        }

        // Check if request already exists
        const existingRequest = targetUser.connectionRequests.find(
          request => request.from.toString() === req.user._id.toString() && request.status === 'pending'
        );

        if (existingRequest) {
          results.push({ userId, success: false, message: 'Connection request already sent' });
          continue;
        }

        // Add connection request
        targetUser.connectionRequests.push({
          from: req.user._id,
          status: 'pending'
        });

        await targetUser.save();

        // Send real-time notification
        if (io) {
          io.to(`user_${userId}`).emit('connectionRequest', {
            type: 'new_request',
            from: {
              id: req.user._id,
              name: req.user.name,
              profilePicture: req.user.profilePicture
            },
            message: `${req.user.name} sent you a connection request`
          });
        }

        results.push({ userId, success: true, message: 'Connection request sent successfully' });
      } catch (error) {
        results.push({ userId, success: false, message: 'Server error' });
      }
    }

    res.json({ results });
  } catch (error) {
    console.error('Error sending bulk connection requests:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/connections/export
// @desc    Export user's connections data
// @access  Private
router.get('/export', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('connections', 'name email bio skills profilePicture github linkedin')
      .populate('connectionRequests.from', 'name email bio skills profilePicture');

    const exportData = {
      exportDate: new Date().toISOString(),
      user: {
        name: user.name,
        email: user.email,
        bio: user.bio,
        skills: user.skills
      },
      connections: {
        total: user.connections.length,
        list: user.connections.map(conn => ({
          name: conn.name,
          email: conn.email,
          bio: conn.bio,
          skills: conn.skills,
          profilePicture: conn.profilePicture,
          github: conn.github,
          linkedin: conn.linkedin,
          connectedAt: conn.createdAt || new Date().toISOString()
        }))
      },
      connectionRequests: {
        pending: user.connectionRequests.filter(req => req.status === 'pending').length,
        accepted: user.connectionRequests.filter(req => req.status === 'accepted').length,
        rejected: user.connectionRequests.filter(req => req.status === 'rejected').length,
        details: user.connectionRequests.map(req => ({
          from: {
            name: req.from.name,
            email: req.from.email,
            bio: req.from.bio,
            skills: req.from.skills,
            profilePicture: req.from.profilePicture
          },
          status: req.status,
          createdAt: req.createdAt
        }))
      },
      networkStats: {
        totalConnections: user.connections.length,
        pendingRequests: user.connectionRequests.filter(req => req.status === 'pending').length,
        networkGrowth: {
          thisMonth: user.connections.filter(conn => {
            const connDate = new Date(conn.createdAt || Date.now());
            const monthAgo = new Date();
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return connDate > monthAgo;
          }).length
        }
      }
    };

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="devconnect-connections-${new Date().toISOString().split('T')[0]}.json"`);
    
    res.json(exportData);
  } catch (error) {
    console.error('Error exporting connections:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
