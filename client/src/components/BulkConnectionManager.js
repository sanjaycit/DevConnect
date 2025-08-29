import React, { useState } from 'react';
import axios from 'axios';

const BulkConnectionManager = ({ suggestions, onBulkRequestComplete }) => {
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleUserToggle = (userId) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleBulkRequest = async () => {
    if (selectedUsers.size === 0) return;

    try {
      setLoading(true);
      const response = await axios.post('http://localhost:5000/api/connections/bulk-request', {
        userIds: Array.from(selectedUsers)
      });

      // Update local state based on results
      const results = response.data.results;
      const successfulRequests = results.filter(r => r.success).map(r => r.userId);
      
      // Update suggestions to show pending status for successful requests
      onBulkRequestComplete(successfulRequests);
      
      // Clear selection
      setSelectedUsers(new Set());
      setIsOpen(false);
      
      // Show success message
      alert(`Successfully sent ${successfulRequests.length} connection requests!`);
    } catch (error) {
      console.error('Error sending bulk connection requests:', error);
      alert('Failed to send some connection requests. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const eligibleUsers = suggestions.filter(user => 
    user.status === 'connect' && 
    !user.status.includes('pending') && 
    user.status !== 'connected'
  );

  if (eligibleUsers.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors font-medium"
      >
        Bulk Connect ({selectedUsers.size} selected)
      </button>

      {isOpen && (
        <div className="mt-4 bg-white rounded-lg shadow-md border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Select users to connect with
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {eligibleUsers.map((user) => (
                <div
                  key={user._id}
                  className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedUsers.has(user._id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleUserToggle(user._id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedUsers.has(user._id)}
                    onChange={() => handleUserToggle(user._id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="flex items-center space-x-2">
                    {user.profilePicture ? (
                      <img
                        src={user.profilePicture}
                        alt={user.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {selectedUsers.size} user{selectedUsers.size !== 1 ? 's' : ''} selected
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setSelectedUsers(new Set());
                  setIsOpen(false);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkRequest}
                disabled={selectedUsers.size === 0 || loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Sending...' : `Send ${selectedUsers.size} Request${selectedUsers.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkConnectionManager;
