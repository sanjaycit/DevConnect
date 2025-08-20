import React from 'react';

const PostCard = ({ post }) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
            {post.userId?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">
              {post.userId?.name || 'Unknown User'}
            </h3>
            <span className="text-sm text-gray-500">
              {formatDate(post.createdAt)}
            </span>
          </div>
          
          {post.userId?.skills && post.userId.skills.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {post.userId.skills.slice(0, 3).map((skill, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                >
                  {skill}
                </span>
              ))}
              {post.userId.skills.length > 3 && (
                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                  +{post.userId.skills.length - 3} more
                </span>
              )}
            </div>
          )}
          
          <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
            {post.content}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PostCard;
