import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PostCard from '../components/PostCard';
import axios from 'axios';

const Profile = () => {
  const [userPosts, setUserPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const fetchUserPosts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`http://localhost:5000/api/posts/user/${user._id}`);
      setUserPosts(response.data);
    } catch (error) {
      setError('Failed to fetch your posts');
      console.error('Error fetching user posts:', error);
    } finally {
      setLoading(false);
    }
  }, [user._id]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
      return;
    }
    
    if (user) {
      fetchUserPosts();
    }
  }, [user, authLoading, navigate, fetchUserPosts]);

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
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-8 mb-8">
        <div className="flex items-start space-x-6">
          <div className="flex-shrink-0">
            <div className="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-3xl">
              {user.name.charAt(0).toUpperCase()}
            </div>
          </div>
          
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{user.name}</h1>
            <p className="text-gray-600 mb-4">{user.email}</p>
            
            {user.bio && (
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Bio</h3>
                <p className="text-gray-700">{user.bio}</p>
              </div>
            )}
            
            {user.skills && user.skills.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {user.skills.map((skill, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Posts</h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-gray-600">Loading your posts...</div>
          </div>
        ) : userPosts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg mb-2">No posts yet</div>
            <p className="text-gray-400">Start sharing your thoughts in the feed!</p>
          </div>
        ) : (
          <div>
            {userPosts.map((post) => (
              <PostCard key={post._id} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
