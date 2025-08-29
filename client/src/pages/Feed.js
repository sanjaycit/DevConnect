import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import NewPostForm from '../components/NewPostForm';
import PostCard from '../components/PostCard';

const Feed = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (user) {
      fetchPosts();
    }
  }, [user, currentPage]);

  const fetchPosts = async (page = 1) => {
    try {
      setLoading(page === 1);
      setError('');
      
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/posts/feed?page=${page}&limit=10`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (page === 1) {
        setPosts(response.data.posts);
      } else {
        setPosts(prev => [...prev, ...response.data.posts]);
      }
      
      setHasMore(response.data.hasMore);
      setCurrentPage(response.data.currentPage);
    } catch (error) {
      console.error('Error fetching posts:', error);
      setError('Failed to fetch posts. Please try again.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleNewPost = (newPost) => {
    setPosts(prev => [newPost, ...prev]);
    setCurrentPage(1);
    setHasMore(true);
  };

  const handlePostUpdateById = (updatedPost) => {
    if (updatedPost === null) {
      // Post was deleted - we need to find it by ID
      // Since we don't have the post ID here, we'll need to refresh the posts
      fetchPosts(1);
    } else {
      // Post was updated (liked, commented, etc.)
      setPosts(prev => prev.map(post => 
        post._id === updatedPost._id ? updatedPost : post
      ));
    }
  };

  const loadMorePosts = () => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    fetchPosts(currentPage + 1);
  };

  const retryFetch = () => {
    setError('');
    fetchPosts(1);
  };

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="text-gray-600">Please log in to view the feed</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* New Post Form */}
      <NewPostForm onNewPost={handleNewPost} />

      {/* Feed Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Feed</h1>
        <p className="text-gray-600">Stay updated with your network</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={retryFetch}
              className="text-red-700 hover:text-red-900 font-medium underline"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Posts */}
      {loading ? (
        <div className="space-y-6">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="bg-white rounded-lg shadow-md p-6 animate-pulse">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-300 rounded w-32"></div>
                  <div className="h-3 bg-gray-300 rounded w-24"></div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-300 rounded w-full"></div>
                <div className="h-4 bg-gray-300 rounded w-5/6"></div>
                <div className="h-4 bg-gray-300 rounded w-4/6"></div>
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg mb-2">No posts yet</div>
          <p className="text-gray-400">Be the first to share something with your network!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {posts.map((post, index) => (
            <PostCard
              key={post._id}
              post={post}
              onPostUpdate={handlePostUpdateById}
            />
          ))}
        </div>
      )}

      {/* Load More Button */}
      {hasMore && !loading && (
        <div className="text-center mt-8">
          <button
            onClick={loadMorePosts}
            disabled={loadingMore}
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {loadingMore ? 'Loading...' : 'Load More Posts'}
          </button>
        </div>
      )}

      {/* End of Feed */}
      {!hasMore && posts.length > 0 && (
        <div className="text-center py-8">
          <div className="text-gray-500 text-sm">You've reached the end of your feed</div>
          <p className="text-gray-400 text-xs mt-1">Check back later for more updates</p>
        </div>
      )}
    </div>
  );
};

export default Feed;
