import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ConnectionAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:5000/api/connections/analytics');
      setAnalytics(response.data);
    } catch (error) {
      setError('Failed to fetch analytics');
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Connection Analytics</h3>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{analytics.totalConnections}</div>
          <div className="text-sm text-gray-600">Total Connections</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-600">{analytics.pendingRequests}</div>
          <div className="text-sm text-gray-600">Pending Requests</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{analytics.acceptedRequests}</div>
          <div className="text-sm text-gray-600">Accepted</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">{analytics.networkGrowth.thisMonth}</div>
          <div className="text-sm text-gray-600">This Month</div>
        </div>
      </div>

      {/* Top Skills */}
      {analytics.topSkills && analytics.topSkills.length > 0 && (
        <div className="mb-6">
          <h4 className="text-md font-medium text-gray-900 mb-3">Top Skills in Your Network</h4>
          <div className="flex flex-wrap gap-2">
            {analytics.topSkills.map((skill, index) => (
              <div
                key={index}
                className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full flex items-center space-x-1"
              >
                <span>{skill.skill}</span>
                <span className="text-xs bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded-full">
                  {skill.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connection Strengths */}
      {analytics.connectionStrengths && analytics.connectionStrengths.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-3">Connection Strengths</h4>
          <div className="space-y-2">
            {analytics.connectionStrengths.slice(0, 5).map((connection) => (
              <div key={connection.userId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm font-medium text-gray-900">{connection.name}</span>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-600">
                    {connection.mutualConnections} mutual
                  </span>
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                    connection.strength === 'strong' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {connection.strength}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectionAnalytics;

