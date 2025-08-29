import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import SimpleTextEditor from './SimpleTextEditor';

const NewPostForm = ({ onNewPost }) => {
  const { user } = useAuth();
  const [richContent, setRichContent] = useState('');
  const [media, setMedia] = useState([]);
  const [tags, setTags] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!richContent && media.length === 0) {
      alert('Please add some content or media to your post.');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      let uploadedMedia = [];

      if (media.length > 0) {
        // Only upload items that have a File object
        const filesToUpload = media.filter(item => item.file);

        if (filesToUpload.length === 0) {
          // There are media entries but none with an attached File
          throw new Error('No files to upload. Please attach files before submitting.');
        }

        const formData = new FormData();
        filesToUpload.forEach((item) => {
          formData.append('media', item.file);
        });

        // Let the browser set the multipart boundary header. Manually setting
        // Content-Type without the boundary can break uploads.
        const uploadRes = await axios.post('http://localhost:5000/api/posts/upload-media', formData, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        uploadedMedia = uploadRes.data.files || [];

        // Basic sanity-check: ensure server returned the same number of uploaded files
        if (uploadedMedia.length !== filesToUpload.length) {
          console.error('Upload mismatch: client sent', filesToUpload.length, 'files but server returned', uploadedMedia.length);
          throw new Error('Some files failed to upload. Please try again.');
        }
      }

      const postData = {
        richContent: richContent.trim(),
        media: uploadedMedia,
        tags: tags
          .split(',')
          .map(t => t.trim())
          .filter(Boolean),
        visibility: visibility
      };

      const response = await axios.post('http://localhost:5000/api/posts/create', postData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // Reset form
      setRichContent('');
      setMedia([]);
      setTags('');
      setVisibility('public');

      // Notify parent component
      if (onNewPost) {
        onNewPost(response.data);
      }

      alert('Post created successfully!');
    } catch (error) {
    console.error('Error creating post:', error, error.response?.data);
    const serverMessage = error.response?.data?.message || error.response?.data || error.message;
    alert(`Failed to create post. ${serverMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
      {/* User Info Header */}
      <div className="flex items-center space-x-4 pb-4 border-b border-gray-200">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
          {user?.name?.charAt(0)?.toUpperCase() || 'U'}
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">{user?.name || 'User'}</h3>
          <p className="text-sm text-gray-500">Share your thoughts with the community</p>
        </div>
      </div>

      {/* Content Input */}
      <SimpleTextEditor
        value={richContent}
        onChange={setRichContent}
        placeholder="What's on your mind?"
        maxLength={2000}
        onMediaChange={setMedia}
      />

      {/* Post Options */}
      <div className="flex flex-wrap gap-4 items-center justify-between p-4 bg-gray-50 rounded-xl">
        <div className="flex items-center space-x-4">
          {/* Tags Input */}
          <div className="flex-1">
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Add tags (comma separated)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Visibility Selector */}
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="public">🌍 Public</option>
            <option value="connections">👥 Connections</option>
            <option value="private">🔒 Private</option>
          </select>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-500">
          {richContent.length} characters
          {media.length > 0 && ` • ${media.length} media file${media.length !== 1 ? 's' : ''}`}
        </div>
        
        <button
          type="submit"
          disabled={isSubmitting || (!richContent && media.length === 0)}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          {isSubmitting ? 'Creating...' : 'Create Post'}
        </button>
      </div>
    </form>
  );
};

export default NewPostForm;
