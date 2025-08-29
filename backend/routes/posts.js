const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Post = require('../models/Post');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Allow images and videos
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image and video files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// @route   POST /api/posts/upload-media
// @desc    Upload media files for posts
// @access  Private
router.post('/upload-media', auth, upload.array('media', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const mediaFiles = req.files.map(file => {
      const fileType = file.mimetype.startsWith('image/') ? 'image' : 'video';
      return {
        type: fileType,
        url: `/uploads/${file.filename}`,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype
      };
    });

    res.json({ 
      message: 'Media uploaded successfully',
      files: mediaFiles
    });
  } catch (error) {
    console.error('Media upload error:', error);
    res.status(500).json({ message: 'Server error during upload' });
  }
});

// @route   POST /api/posts/create
// @desc    Create a new post
// @access  Private
router.post('/create', auth, async (req, res) => {
  try {
    const { content, richContent, media, tags, visibility } = req.body;

    if (!content && !richContent && (!media || media.length === 0)) {
      return res.status(400).json({ message: 'Post must have content, rich content, or media' });
    }

    // If plain `content` isn't provided but `richContent` is, use richContent
    // as a fallback for the required `content` field so Mongoose validation
    // doesn't fail when users submit rich text only.
    const newPost = new Post({
      userId: req.user._id,
      content: content || richContent || '',
      richContent: richContent || '',
      media: media || [],
      tags: tags || [],
      visibility: visibility || 'public'
    });

    const post = await newPost.save();
    
    // Populate user info for response
    await post.populate('userId', 'name profilePicture');

    res.json(post);
  } catch (error) {
    console.error('Error creating post:', error);
    // If validation error, send details to client for better debugging
    if (error.name === 'ValidationError') {
      const details = Object.keys(error.errors).reduce((acc, key) => {
        acc[key] = error.errors[key].message || error.errors[key].kind;
        return acc;
      }, {});
      return res.status(400).json({ message: 'Validation error', details });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/posts/feed
// @desc    Get all posts for feed
// @access  Private
router.get('/feed', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get user's connections
    const currentUser = await User.findById(req.user._id);
    const userConnections = currentUser.connections || [];

    // Build visibility filter
    const visibilityFilter = {
      $or: [
        { visibility: 'public' },
        { userId: req.user._id },
        { 
          visibility: 'connections',
          userId: { $in: userConnections }
        }
      ]
    };

    const posts = await Post.find(visibilityFilter)
      .populate('userId', 'name profilePicture')
      .populate('likes', 'name profilePicture')
      .populate('comments.userId', 'name profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments(visibilityFilter);

    res.json({
      posts,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalPosts: total,
      hasMore: page * limit < total
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/posts/user/:userId
// @desc    Get posts by specific user
// @access  Private
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Check if viewing own posts or public posts
    const isOwnPosts = req.user._id.toString() === userId;
    const visibilityFilter = isOwnPosts 
      ? { userId }
      : { userId, visibility: 'public' };

    const posts = await Post.find(visibilityFilter)
      .populate('userId', 'name profilePicture')
      .populate('likes', 'name profilePicture')
      .populate('comments.userId', 'name profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments(visibilityFilter);

    res.json({
      posts,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalPosts: total,
      hasMore: page * limit < total
    });
  } catch (error) {
    console.error('Error fetching user posts:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/posts/:id/like
// @desc    Like/unlike a post
// @access  Private
router.put('/:id/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const likeIndex = post.likes.indexOf(req.user._id);
    
    if (likeIndex > -1) {
      // Unlike
      post.likes.splice(likeIndex, 1);
    } else {
      // Like
      post.likes.push(req.user._id);
    }

    await post.save();
    await post.populate('userId', 'name profilePicture');
    res.json(post);
  } catch (error) {
    console.error('Error updating like:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/posts/:id/save
// @desc    Toggle save/unsave a post for the current user
// @access  Private
router.put('/:id/save', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const idx = (post.savedBy || []).findIndex(u => u.toString() === req.user._id.toString());
    if (idx > -1) {
      post.savedBy.splice(idx, 1);
    } else {
      post.savedBy.push(req.user._id);
    }

    await post.save();
    await post.populate('userId', 'name profilePicture');
    res.json(post);
  } catch (error) {
    console.error('Error toggling save:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/posts/:id/share
// @desc    Increment share count for a post
// @access  Private
router.post('/:id/share', auth, async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { $inc: { shareCount: 1 } },
      { new: true }
    ).populate('userId', 'name profilePicture');

    if (!post) return res.status(404).json({ message: 'Post not found' });

    res.json(post);
  } catch (error) {
    console.error('Error incrementing share count:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/posts/:id/comment
// @desc    Add comment to a post
// @access  Private
router.post('/:id/comment', auth, async (req, res) => {
  try {
    const { content, richContent } = req.body;
    
    if (!content && !richContent) {
      return res.status(400).json({ message: 'Comment must have content' });
    }

    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    post.comments.push({
      userId: req.user._id,
      // Use richContent as fallback for comments as well
      content: content || richContent || '',
      richContent: richContent || ''
    });

    await post.save();
    
    // Populate the new comment's user info
    await post.populate('comments.userId', 'name profilePicture');
    await post.populate('comments.replies.userId', 'name profilePicture');
    
    res.json(post);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/posts/:postId/comments/:commentId/reply
// @desc    Reply to a specific comment
// @access  Private
router.post('/:postId/comments/:commentId/reply', auth, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Reply must have content' });
    }

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const targetComment = post.comments.id(commentId);
    if (!targetComment) return res.status(404).json({ message: 'Comment not found' });

    targetComment.replies = targetComment.replies || [];
    targetComment.replies.push({
      userId: req.user._id,
      content: content.trim()
    });

    await post.save();

    await post.populate('comments.userId', 'name profilePicture');
    await post.populate('comments.replies.userId', 'name profilePicture');

    res.json(post);
  } catch (error) {
    console.error('Error adding reply:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete route removed: post deletion is disabled in this deployment.

module.exports = router;
