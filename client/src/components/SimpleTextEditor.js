import React, { useState, useRef } from 'react';

const SimpleTextEditor = ({ value, onChange, placeholder = "What's on your mind?", maxLength = 2000, onMediaChange }) => {
  const [isFocused, setIsFocused] = useState(false);
  const [media, setMedia] = useState([]);
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);

  // Simple editor: text + media (images and videos)

  const handleTextChange = (e) => {
    if (onChange) {
      onChange(e.target.value);
    }
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    const newImages = files.map(file => ({
      type: 'image',
      file,
      url: URL.createObjectURL(file),
      name: file.name
    }));
    
    const updatedMedia = [...media, ...newImages];
    setMedia(updatedMedia);
    if (onMediaChange) {
      onMediaChange(updatedMedia);
    }
  };

  const handleVideoUpload = (e) => {
    const files = Array.from(e.target.files);
    const newVideos = files.map(file => ({
      type: 'video',
      file,
      url: URL.createObjectURL(file),
      name: file.name,
      size: file.size
    }));

    const updatedMedia = [...media, ...newVideos];
    setMedia(updatedMedia);
    if (onMediaChange) {
      onMediaChange(updatedMedia);
    }
  };

  // file uploads are handled via image/video inputs for now

  const removeMedia = (index) => {
    const updatedMedia = media.filter((_, i) => i !== index);
    setMedia(updatedMedia);
    if (onMediaChange) {
      onMediaChange(updatedMedia);
    }
  };

  // Removed emoji, mention, and hashtag features for simplicity

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getCharacterCount = () => value.length;
  const getRemainingChars = () => maxLength - getCharacterCount();

  return (
    <div className="relative">
      {/* Modern Editor Container */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
        {/* Text Input Area */}
        <div className="relative">
          <textarea
            value={value}
            onChange={handleTextChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            className={`w-full p-4 pr-12 border-0 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 ${
              isFocused ? 'bg-white' : 'bg-gray-50'
            }`}
            rows={4}
            maxLength={maxLength}
          />
          
          {/* Character Counter */}
          <div className="absolute bottom-3 right-3">
            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
              getRemainingChars() < 100 ? 'text-orange-500 bg-orange-100' : 'text-gray-400 bg-gray-100'
            }`}>
              {getCharacterCount()}/{maxLength}
            </div>
          </div>
        </div>

        {/* Media Preview */
        }
        {media.length > 0 && (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {media.map((item, index) => (
                <div key={index} className="relative group">
                  {item.type === 'image' ? (
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                      <img
                        src={item.url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeMedia(index)}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600"
                        aria-label="Remove attachment"
                      >
                        {/* simple X icon */}
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  ) : item.type === 'video' ? (
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                      <video
                        src={item.url}
                        className="w-full h-full object-cover"
                        controls
                      />
                      <button
                        type="button"
                        onClick={() => removeMedia(index)}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600"
                        aria-label="Remove attachment"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className="relative aspect-square rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center p-3">
                      {/* file icon */}
                      <svg className="w-8 h-8 text-gray-400 mb-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <p className="text-xs text-gray-600 text-center font-medium truncate w-full">
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatFileSize(item.size)}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeMedia(index)}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600"
                        aria-label="Remove attachment"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Bar */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <div className="flex items-center justify-between">
            {/* Left Actions */}
            <div className="flex items-center space-x-2">
              {/* Image Upload */}
                <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all duration-200 group"
                title="Add image"
              >
                {/* image icon */}
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M21 15l-5-5-4 4-3-3-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                  Add image
                </div>
              </button>

              {/* Video Upload */}
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 group"
                title="Add video"
              >
                {/* video icon */}
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M16 8l6-4v16l-6-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                  Add video
                </div>
              </button>
            </div>

            {/* Right Actions */}
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500">
                {media.length > 0 && `${media.length} attachment${media.length !== 1 ? 's' : ''}`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden File Inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleImageUpload}
        className="hidden"
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        multiple
        onChange={handleVideoUpload}
        className="hidden"
      />
      
    </div>
  );
};

export default SimpleTextEditor;
