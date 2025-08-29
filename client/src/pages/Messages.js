import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { io } from 'socket.io-client';
import { MessageCircle, Send, Search, ArrowLeft } from 'lucide-react';

const Messages = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [connections, setConnections] = useState([]);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [recentContacts, setRecentContacts] = useState([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }

    // Mark messages as read when viewing conversation
    if (selectedConversation && messages.length > 0) {
      const unreadMessages = messages.filter(
        m => !m.isRead && m.sender._id !== user._id
      );
      
      if (unreadMessages.length > 0) {
        const messageIds = unreadMessages.map(m => m._id);
        socketRef.current?.emit('message:read', {
          messageIds,
          senderId: selectedConversation.otherUser._id
        });
      }
    }
  };

  // Re-run fetchConnections when conversations change to ensure merged list is complete
  useEffect(() => {
    console.debug('[Messages] useEffect[conversations]:', { 
      conversationsLength: conversations.length,
      hasUser: !!user
    });
    // Always fetch connections, even if there are no conversations
    if (user) {
      fetchConnections();
    }
  }, [conversations, user]);

  useEffect(() => {
    if (user) {
      fetchConversations();
      fetchConnections();

      // load recent contacts for this user from localStorage
      try {
        const key = `recentContacts_${user._id}`;
        const raw = localStorage.getItem(key);
        if (raw) setRecentContacts(JSON.parse(raw));
      } catch (e) {
        console.error('Failed to load recent contacts', e);
      }

      // init socket
      if (!socketRef.current) {
        const socket = io('http://localhost:5000', { 
          withCredentials: true,
          query: { userId: user._id }
        });
        socketRef.current = socket;
        
        socket.on('connect', () => {
          socket.emit('join', user._id || user.id);
        });

        // Listen for user status changes
        socket.on('user:status', (data) => {
          setConversations(prev => prev.map(conv => {
            if (conv.otherUser._id === data.userId) {
              return {
                ...conv,
                otherUser: {
                  ...conv.otherUser,
                  isOnline: data.isOnline,
                  lastSeen: data.lastSeen
                }
              };
            }
            return conv;
          }));
        });

        // Listen for message read status updates
        socket.on('message:read:update', (data) => {
          setMessages(prev => prev.map(message => {
            if (data.messageIds.includes(message._id)) {
              return { ...message, isRead: true };
            }
            return message;
          }));
        });
        socket.on('message:new', (msg) => {
          // If message belongs to the open conversation, append and mark as read
          if (selectedConversation && msg.conversationId === selectedConversation._id) {
            setMessages(prev => [...prev, msg]);
            scrollToBottom();
          }
          // Refresh conversations list for last message/unread counts
          fetchConversations();
        });
      }

      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedConversation]);

  const fetchConversations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/messages/conversations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setConversations(response.data);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchConnections = async () => {
    try {
      console.debug('[Messages] fetchConnections: start');
      setLoadingConnections(true);
      
      // Check if user is logged in
      if (!user) {
        console.error('[Messages] fetchConnections: No user in context');
        return;
      }
      
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('[Messages] fetchConnections: No token found');
        return;
      }
      console.debug('[Messages] fetchConnections:', {
        userId: user._id,
        hasToken: !!token,
        tokenValue: token
      });
      
      // First try a raw fetch to debug
      const rawResponse = await fetch('http://localhost:5000/api/messages/connections', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.debug('[Messages] Raw fetch response:', {
        status: rawResponse.status,
        statusText: rawResponse.statusText
      });
      
      const response = await axios.get('http://localhost:5000/api/messages/connections', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      console.debug('[Messages] fetchConnections response:', {
        status: response.status,
        statusText: response.statusText,
        dataLength: response.data?.length,
        data: response.data
      });
      // Handle the API response
      if (!response.data) {
        console.error('[Messages] No data received from connections API');
        return;
      }

      const connections = Array.isArray(response.data) ? response.data : [];
      console.debug('[Messages] Connections from API:', {
        count: connections.length,
        isArray: Array.isArray(response.data),
        connections: connections.map(c => ({
          id: c._id,
          name: c.name,
          hasProfilePic: !!c.profilePicture
        }))
      });

      setConnections(connections);
    } catch (error) {
      console.error('Error fetching connections:', error, error.response?.status, error.response?.data);
    }
    finally {
      setLoadingConnections(false);
    }
  };

  const fetchMessages = async (conversationId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/messages/${conversationId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setMessages(response.data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:5000/api/messages', {
        receiverId: selectedConversation.otherUser._id,
        content: newMessage.trim()
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setMessages(prev => [...prev, response.data]);
      setNewMessage('');
      // ensure selected conversation uses proper conversationId from backend
      if (!selectedConversation._id || selectedConversation._id !== response.data.conversationId) {
        setSelectedConversation(prev => ({
          ...prev,
          _id: response.data.conversationId
        }));
      }
      
      // Update conversations list
      fetchConversations();
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const startNewConversation = async (connection) => {
    setSelectedConnection(connection);
    setShowNewMessage(false);
    
    // Check if conversation already exists
    const existingConversation = conversations.find(conv => {
      const a = conv.otherUser._id ? conv.otherUser._id.toString() : (conv.otherUser.id || '');
      const b = connection._id ? connection._id.toString() : (connection.id || '');
      return a === b;
    });
    
    if (existingConversation) {
      setSelectedConversation(existingConversation);
      fetchMessages(existingConversation._id);
    } else {
      // Create new conversation object
      const newConversation = {
        // backend uses sorted join of ObjectIds, but we don't know order yet
        // leave placeholder until first message returns real conversationId
        _id: null,
        otherUser: connection,
        lastMessage: null,
        unreadCount: 0
      };
      setSelectedConversation(newConversation);
      setMessages([]);
    }
    // persist recent contacts (keep last 10)
    try {
      if (user && user._id) {
        const key = `recentContacts_${user._id}`;
        const raw = localStorage.getItem(key);
        const arr = raw ? JSON.parse(raw) : [];
        const id = connection._id ? connection._id.toString() : connection.id;
        const filtered = [connection, ...arr.filter(c => (c._id ? c._id.toString() : c.id) !== id)].slice(0, 10);
        localStorage.setItem(key, JSON.stringify(filtered));
        setRecentContacts(filtered);
      }
    } catch (e) {
      console.error('Failed to save recent contact', e);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="text-gray-600">Please log in to view messages</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-120px)]">
      <div className="bg-white rounded-lg shadow-lg h-full flex">
        {/* Conversations Sidebar */}
        <div className="w-1/3 border-r border-gray-200 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-semibold text-gray-900">Messages</h1>
              <button
                onClick={async () => { 
                  try {
                    setLoadingConnections(true);
                    const token = localStorage.getItem('token');
                    console.debug('[Messages] New Message click - token:', token ? 'present' : 'missing');
                    await fetchConnections(); 
                    setSearchTerm(''); 
                    setShowNewMessage(true);
                  } catch (error) {
                    console.error('[Messages] Error fetching connections:', error.response?.data || error.message);
                  } finally {
                    setLoadingConnections(false);
                  }
                }}
                className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
                type="button"
              >
                <MessageCircle size={20} />
              </button>
            </div>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center items-center h-32">
                <div className="text-gray-500">Loading conversations...</div>
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                <MessageCircle size={48} className="mb-2 opacity-50" />
                <p>No conversations yet</p>
                <p className="text-sm">Start a conversation with your connections</p>
              </div>
            ) : (
              conversations.map((conversation) => (
                <div
                  key={conversation._id}
                  onClick={() => {
                    setSelectedConversation(conversation);
                    fetchMessages(conversation._id);
                  }}
                  className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedConversation?._id === conversation._id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {conversation.otherUser.profilePicture ? (
                      <img
                        src={conversation.otherUser.profilePicture}
                        alt={conversation.otherUser.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                        {conversation.otherUser.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-gray-900 truncate">
                          {conversation.otherUser.name}
                        </h3>
                        {conversation.unreadCount > 0 && (
                          <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                            {conversation.unreadCount}
                          </span>
                        )}
                      </div>
                      {conversation.lastMessage && (
                        <p className="text-sm text-gray-600 truncate">
                          {conversation.lastMessage.content}
                        </p>
                      )}
                      {conversation.lastMessage && (
                        <p className="text-xs text-gray-400">
                          {formatTime(conversation.lastMessage.createdAt)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200 flex items-center space-x-3">
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="md:hidden p-2 hover:bg-gray-100 rounded-full"
                >
                  <ArrowLeft size={20} />
                </button>
                {selectedConversation.otherUser.profilePicture ? (
                  <img
                    src={selectedConversation.otherUser.profilePicture}
                    alt={selectedConversation.otherUser.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                    {selectedConversation.otherUser.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h2 className="font-semibold text-gray-900">
                    {selectedConversation.otherUser.name}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {selectedConversation.otherUser.isOnline ? (
                      <span className="flex items-center">
                        <span className="h-2 w-2 bg-green-500 rounded-full mr-1"></span>
                        Online
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <span className="h-2 w-2 bg-gray-300 rounded-full mr-1"></span>
                        {selectedConversation.otherUser.lastSeen ? (
                          `Last seen ${formatTime(selectedConversation.otherUser.lastSeen)}`
                        ) : (
                          'Offline'
                        )}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <MessageCircle size={48} className="mb-2 opacity-50" />
                    <p>No messages yet</p>
                    <p className="text-sm">Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message._id}
                      className={`flex ${message.sender._id === user._id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                          message.sender._id === user._id
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-900'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <div className="flex items-center justify-between">
                          <p className={`text-xs ${
                            message.sender._id === user._id ? 'text-blue-100' : 'text-gray-500'
                          }`}>
                            {formatTime(message.createdAt)}
                          </p>
                          {message.sender._id === user._id && (
                            <span className="ml-2">
                              {message.isRead ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-100" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M9.707 7.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L12 8.586l-2.293-2.293z" />
                                  <path d="M9.707 12.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L12 13.586l-2.293-2.293z" />
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-100" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M9.707 7.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L12 8.586l-2.293-2.293z" />
                                </svg>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-gray-200">
                <form onSubmit={sendMessage} className="flex items-center space-x-3">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={sending}
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send size={20} />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <MessageCircle size={64} className="mx-auto mb-4 opacity-50" />
                <h2 className="text-xl font-semibold mb-2">Select a conversation</h2>
                <p>Choose a conversation from the sidebar to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Message Modal */}
      {showNewMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">New Message</h2>
              <button 
                onClick={() => setShowNewMessage(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="mb-3 sticky top-0 bg-white z-10">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search connections..."
                  className="w-full px-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
              {recentContacts && recentContacts.length > 0 && (
                <div className="mb-2">
                  <div className="text-xs text-gray-500 mb-1">Recent</div>
                  {recentContacts.filter(c => !searchTerm || (c.name || '').toLowerCase().includes(searchTerm.toLowerCase())).map((connection) => (
                    <div
                      key={`recent-${connection._id || connection.id}`}
                      onClick={() => startNewConversation(connection)}
                      className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                    >
                      {connection.profilePicture ? (
                        <img src={connection.profilePicture} alt={connection.name} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">{(connection.name || '?').charAt(0).toUpperCase()}</div>
                      )}
                      <span className="text-sm">{connection.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {loadingConnections ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : connections.length === 0 ? (
                <div className="text-center py-8">
                  <MessageCircle size={32} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-500">No connections found (Total: {connections.length})</p>
                  <p className="text-sm text-gray-400 mt-1">Debug info:</p>
                  <pre className="text-xs text-left bg-gray-50 p-2 mt-2 rounded overflow-auto">
                    {JSON.stringify({
                      user: user ? { id: user._id, name: user.name } : null,
                      loadingConnections,
                      searchTerm,
                      token: !!localStorage.getItem('token')
                    }, null, 2)}
                  </pre>
                  {/* Debug button to test API directly */}
                  <button
                    onClick={async () => {
                      try {
                        const token = localStorage.getItem('token');
                        console.debug('[Messages] Testing direct API call...');
                        const response = await fetch('http://localhost:5000/api/messages/connections', {
                          headers: {
                            'Authorization': `Bearer ${token}`
                          }
                        });
                        const data = await response.json();
                        console.debug('[Messages] Direct API response:', {
                          status: response.status,
                          data
                        });
                      } catch (error) {
                        console.error('[Messages] Direct API test failed:', error);
                      }
                    }}
                    className="mt-4 text-xs text-blue-500 hover:underline"
                  >
                    Test API Directly
                  </button>
                </div>
              ) : (
                connections.filter(c => !searchTerm || (c.name || '').toLowerCase().includes(searchTerm.toLowerCase())).map((connection) => (
                  <div
                    key={connection._id}
                    onClick={() => startNewConversation(connection)}
                    className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                  >
                    {connection.profilePicture ? (
                      <img
                        src={connection.profilePicture}
                        alt={connection.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                        {(connection.name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="font-medium">{connection.name}</span>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={() => setShowNewMessage(false)}
              className="mt-4 w-full py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;

