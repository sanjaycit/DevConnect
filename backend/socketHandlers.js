const User = require('./models/User');

const socketHandlers = (io) => {
  const userSockets = new Map();

  io.on('connection', async (socket) => {
    const userId = socket.handshake.query.userId;
    if (userId) {
      // Store socket mapping
      userSockets.set(userId, socket.id);
      
      // Update user's online status
      await User.findByIdAndUpdate(userId, {
        isOnline: true,
        lastSeen: new Date()
      });

      // Notify user's connections that they're online
      const user = await User.findById(userId).populate('connections');
      if (user && user.connections) {
        user.connections.forEach(connection => {
          const connectionSocketId = userSockets.get(connection._id.toString());
          if (connectionSocketId) {
            io.to(connectionSocketId).emit('user:status', {
              userId: userId,
              isOnline: true
            });
          }
        });
      }
    }

    // Handle disconnect
    socket.on('disconnect', async () => {
      if (userId) {
        // Remove socket mapping
        userSockets.delete(userId);
        
        // Update user's offline status and last seen
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastSeen: new Date()
        });

        // Notify user's connections that they're offline
        const user = await User.findById(userId).populate('connections');
        if (user && user.connections) {
          user.connections.forEach(connection => {
            const connectionSocketId = userSockets.get(connection._id.toString());
            if (connectionSocketId) {
              io.to(connectionSocketId).emit('user:status', {
                userId: userId,
                isOnline: false,
                lastSeen: new Date()
              });
            }
          });
        }
      }
    });

    // Handle message read status
    socket.on('message:read', async (data) => {
      const { messageIds, senderId } = data;
      
      // Update messages as read
      await Message.updateMany(
        { _id: { $in: messageIds } },
        { isRead: true }
      );

      // Notify sender that messages were read
      const senderSocketId = userSockets.get(senderId);
      if (senderSocketId) {
        io.to(senderSocketId).emit('message:read:update', {
          messageIds,
          readBy: userId
        });
      }
    });
  });
};

module.exports = socketHandlers;
