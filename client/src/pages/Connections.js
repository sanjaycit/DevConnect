import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import ConnectionAnalytics from '../components/ConnectionAnalytics';
import BulkConnectionManager from '../components/BulkConnectionManager';

const Connections = () => {
  const [activeTab, setActiveTab] = useState('suggestions');
  const [suggestions, setSuggestions] = useState([]);
  const [connections, setConnections] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
      return;
    }
    
    if (user) {
      fetchData();
    }
  }, [user, authLoading, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [suggestionsRes, connectionsRes, pendingRes] = await Promise.all([
        axios.get('http://localhost:5000/api/connections/suggestions'),
        axios.get('http://localhost:5000/api/connections/my-connections'),
        axios.get('http://localhost:5000/api/connections/pending')
      ]);
      
      setSuggestions(suggestionsRes.data);
      setConnections(connectionsRes.data);
      setPendingRequests(pendingRes.data);
    } catch (error) {
      setError('Failed to fetch connections');
      console.error('Error fetching connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectionRequest = async (userId) => {
    try {
      console.log('Sending connection request to:', userId); // Debug log
      const response = await axios.post(`http://localhost:5000/api/connections/request/${userId}`);
      console.log('Connection request response:', response.data); // Debug log
      
      // Remove user from suggestions and add to pending requests
      const userToMove = suggestions.find(user => user._id === userId);
      if (userToMove) {
        setSuggestions(prev => prev.filter(user => user._id !== userId));
        setPendingRequests(prev => [...prev, { ...userToMove, status: 'pending_sent' }]);
      }
      
      // Show success message
      alert('Connection request sent successfully!');
    } catch (error) {
      console.error('Error sending connection request:', error);
      const errorMessage = error.response?.data?.message || 'Failed to send connection request';
      alert(errorMessage);
    }
  };

  const handleAcceptRequest = async (userId) => {
    try {
      console.log('Accepting connection request from:', userId); // Debug log
      const response = await axios.post(`http://localhost:5000/api/connections/accept/${userId}`);
      console.log('Accept response:', response.data); // Debug log
      
      // Remove user from suggestions and add to connections
      setSuggestions(prev => prev.filter(user => user._id !== userId));
      setPendingRequests(prev => prev.filter(user => user._id !== userId));
      
      // Add to connections list
      const acceptedUser = pendingRequests.find(user => user._id === userId);
      if (acceptedUser) {
        setConnections(prev => [...prev, { ...acceptedUser, status: 'connected', priority: 1 }]);
      }
      
      // Refresh suggestions to ensure UI is in sync
      setTimeout(() => {
        fetchData();
      }, 100);
      
      // Show success message
      alert('Connection request accepted!');
    } catch (error) {
      console.error('Error accepting connection request:', error);
      const errorMessage = error.response?.data?.message || 'Failed to accept connection request';
      alert(errorMessage);
    }
  };

  const handleRejectRequest = async (userId) => {
    try {
      console.log('Rejecting connection request from:', userId); // Debug log
      const response = await axios.post(`http://localhost:5000/api/connections/reject/${userId}`);
      console.log('Reject response:', response.data); // Debug log
      
      // Remove from pending requests and add back to suggestions
      const rejectedUser = pendingRequests.find(user => user._id === userId);
      if (rejectedUser) {
        setPendingRequests(prev => prev.filter(user => user._id !== userId));
        setSuggestions(prev => [...prev, { ...rejectedUser, status: 'connect', priority: 3 }]);
      }
      
      alert('Connection request rejected!');
    } catch (error) {
      console.error('Error rejecting connection request:', error);
      const errorMessage = error.response?.data?.message || 'Failed to reject connection request';
      alert(errorMessage);
    }
  };

  const handleRemoveConnection = async (userId) => {
    try {
      console.log('Removing connection with:', userId); // Debug log
      const response = await axios.delete(`http://localhost:5000/api/connections/${userId}`);
      console.log('Remove response:', response.data); // Debug log
      
      // Remove from connections and add back to suggestions
      const removedUser = connections.find(user => user._id === userId);
      if (removedUser) {
        setConnections(prev => prev.filter(user => user._id !== userId));
        setSuggestions(prev => [...prev, { ...removedUser, status: 'connect', priority: 3 }]);
      }
      
      alert('Connection removed successfully!');
    } catch (error) {
      console.error('Error removing connection:', error);
      const errorMessage = error.response?.data?.message || 'Failed to remove connection';
      alert(errorMessage);
    }
  };

  const handleBulkRequestComplete = (successfulUserIds) => {
    setSuggestions(prev => 
      prev.map(user => 
        successfulUserIds.includes(user._id)
          ? { ...user, status: 'pending_sent' }
          : user
      )
    );
  };

  const handleExportConnections = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/connections/export', {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `devconnect-connections-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting connections:', error);
      alert('Failed to export connections. Please try again.');
    }
  };

  // Filter suggestions based on search term and exclude connected users
  const filteredSuggestions = suggestions.filter(user =>
    user.status !== 'connected' && // Exclude already connected users
    (user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     user.skills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  const getStatusButton = (user) => {
    switch (user.status) {
      case 'connected':
        return (
          <button
            onClick={() => handleRemoveConnection(user._id)}
            className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors text-sm font-medium"
          >
            Remove Connection
          </button>
        );
      case 'pending_sent':
        return (
          <span className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-md text-sm font-medium">
            Request Sent
          </span>
        );
      case 'pending_received':
        return (
          <div className="flex space-x-2">
            <button
              onClick={() => handleAcceptRequest(user._id)}
              className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition-colors text-sm font-medium"
            >
              Accept
            </button>
            <button
              onClick={() => handleRejectRequest(user._id)}
              className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors text-sm font-medium"
            >
              Reject
            </button>
          </div>
        );
      case 'mutual':
        return (
          <button
            onClick={() => handleConnectionRequest(user._id)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Connect
          </button>
        );
      default:
        return (
          <button
            onClick={() => handleConnectionRequest(user._id)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Connect
          </button>
        );
    }
  };

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 1:
        return { text: 'Direct Connection', color: 'bg-green-100 text-green-800' };
      case 2:
        return { text: 'Mutual Connection', color: 'bg-blue-100 text-blue-800' };
      default:
        return { text: 'Other', color: 'bg-gray-100 text-gray-800' };
    }
  };

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Connections</h1>
            <p className="text-gray-600">Build your professional network</p>
          </div>
          <button
            onClick={handleExportConnections}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors font-medium flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Connection Analytics */}
      <div className="mb-8">
        <ConnectionAnalytics />
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('suggestions')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'suggestions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Suggestions ({suggestions.length})
          </button>
          <button
            onClick={() => setActiveTab('connections')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'connections'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            My Connections ({connections.length})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'pending'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Pending Requests ({pendingRequests.length})
          </button>
        </nav>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="text-gray-600">Loading...</div>
        </div>
      ) : (
        <div>
          {/* Suggestions Tab */}
          {activeTab === 'suggestions' && (
            <div>
              {/* Search Bar */}
              <div className="mb-6">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by name or skills..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <svg
                    className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
              </div>

              {/* Bulk Connection Manager */}
              <BulkConnectionManager 
                suggestions={filteredSuggestions}
                onBulkRequestComplete={handleBulkRequestComplete}
              />

              {filteredSuggestions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-500 text-lg mb-2">No users found</div>
                  <p className="text-gray-400">Try adjusting your search terms</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredSuggestions.map((user) => (
                    <UserCard
                      key={user._id}
                      user={user}
                      getStatusButton={getStatusButton}
                      getPriorityLabel={getPriorityLabel}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Connections Tab */}
          {activeTab === 'connections' && (
            <div>
              {connections.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-500 text-lg mb-2">No connections yet</div>
                  <p className="text-gray-400">Start building your network by connecting with other developers!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {connections.map((connection) => (
                    <UserCard
                      key={connection._id}
                      user={{ ...connection, status: 'connected', priority: 1 }}
                      getStatusButton={getStatusButton}
                      getPriorityLabel={getPriorityLabel}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pending Requests Tab */}
          {activeTab === 'pending' && (
            <div>
              {pendingRequests.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-500 text-lg mb-2">No pending requests</div>
                  <p className="text-gray-400">You're all caught up!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pendingRequests.map((request) => (
                    <UserCard
                      key={request._id}
                      user={{ ...request, status: 'pending_received', priority: 3 }}
                      getStatusButton={getStatusButton}
                      getPriorityLabel={getPriorityLabel}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const UserCard = ({ user, getStatusButton, getPriorityLabel }) => {
  const priorityLabel = getPriorityLabel(user.priority);

  const getConnectionStrength = (user) => {
    if (user.status === 'connected') {
      if (user.mutualConnectionsCount > 2) return { level: 'strong', color: 'bg-green-100 text-green-800', text: 'Strong Connection' };
      if (user.mutualConnectionsCount > 0) return { level: 'medium', color: 'bg-yellow-100 text-yellow-800', text: 'Medium Connection' };
      return { level: 'weak', color: 'bg-gray-100 text-gray-800', text: 'Weak Connection' };
    }
    return null;
  };

  const connectionStrength = getConnectionStrength(user);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          {user.profilePicture ? (
            <img
              src={user.profilePicture}
              alt={user.name}
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">{user.name}</h3>
            <div className="flex flex-col items-end space-y-1">
              <span className={`px-2 py-1 text-xs rounded-full font-medium ${priorityLabel.color}`}>
                {priorityLabel.text}
              </span>
              {connectionStrength && (
                <span className={`px-2 py-1 text-xs rounded-full font-medium ${connectionStrength.color}`}>
                  {connectionStrength.text}
                </span>
              )}
            </div>
          </div>
          
          <p className="text-gray-600 text-sm mb-2">{user.email}</p>
          
          {user.bio && (
            <p className="text-gray-700 text-sm mb-3 line-clamp-2">{user.bio}</p>
          )}
          
          {user.skills && user.skills.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {user.skills.slice(0, 3).map((skill, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                >
                  {skill}
                </span>
              ))}
              {user.skills.length > 3 && (
                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                  +{user.skills.length - 3} more
                </span>
              )}
            </div>
          )}

          {/* Mutual Connections Info */}
          {user.mutualConnectionsCount > 0 && (
            <div className="mb-3">
              <p className="text-sm text-gray-600">
                <span className="font-medium">{user.mutualConnectionsCount}</span> mutual connection{user.mutualConnectionsCount !== 1 ? 's' : ''}
              </p>
              {user.mutualConnections && user.mutualConnections.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {user.mutualConnections.slice(0, 2).map((conn) => (
                    <span
                      key={conn.id}
                      className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                    >
                      {conn.name}
                    </span>
                  ))}
                  {user.mutualConnections.length > 2 && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                      +{user.mutualConnections.length - 2} more
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Recommendation Info */}
          {user.recommendationReason && (
            <div className="mb-3">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{user.recommendationReason}</span>
              </div>
              
              {/* Scores */}
              <div className="flex items-center space-x-4 mt-2 text-xs">
                {user.skillScore > 0 && (
                  <div className="flex items-center space-x-1">
                    <span className="text-gray-500">Skills:</span>
                    <span className="font-medium text-blue-600">{user.skillScore}/10</span>
                  </div>
                )}
                {user.totalScore > 0 && (
                  <div className="flex items-center space-x-1">
                    <span className="text-gray-500">Match:</span>
                    <span className="font-medium text-green-600">{user.totalScore}/10</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Action Button */}
          <div className="mt-3">
            {getStatusButton(user)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Connections;
