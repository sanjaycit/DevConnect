import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Heart, MessageCircle, Share2, Bookmark, X, Send } from 'lucide-react';

const PostCard = ({ post, onPostUpdate }) => {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState(''); // inline composer text
  const [isLiking, setIsLiking] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);

  // Local optimistic state for a smoother, modern UX
  const [likesState, setLikesState] = useState(post.likes || []);
  const [likedState, setLikedState] = useState(() => (post.likes || []).some(like => like._id === (user && user._id)));
  const [commentsState, setCommentsState] = useState(post.comments || []);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [replyInputs, setReplyInputs] = useState({}); // { [commentId]: string }
  const [replySubmitting, setReplySubmitting] = useState({}); // { [commentId]: boolean }
  const [shareCountState, setShareCountState] = useState(() => (post.shareCount || (Array.isArray(post.shares) ? post.shares.length : Number(post.shareCount || 0))));
  const [savedState, setSavedState] = useState(() => {
    if (!user) return false;
    if (Array.isArray(post.savedBy)) return post.savedBy.some(u => u === user._id || (u && u._id === user._id));
    return !!post.savedBy;
  });
  const [saveCountState, setSaveCountState] = useState(() => (Array.isArray(post.savedBy) ? post.savedBy.length : (post.saveCount || 0)));
  const shareCount = post.shareCount || post.shares || 0;
  const saveCount = post.saveCount || (post.savedBy ? post.savedBy.length : 0) || 0;

  
  const isLiked = likedState;
  const likeCount = likesState?.length || 0;
  const commentCount = commentsState?.length || 0;

  const handleLike = async () => {
  if (isLiking) return;
  if (!user || !user._id) return; // safety guard

    // Optimistic UI update
    setIsLiking(true);
    const prevLiked = likedState;
    const prevLikes = likesState;

    if (prevLiked) {
      setLikedState(false);
      setLikesState(prevLikes.filter(l => l._id !== user._id));
    } else {
      setLikedState(true);
      setLikesState([{ _id: user._id, userId: user }, ...prevLikes]);
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(`http://localhost:5000/api/posts/${post._id}/like`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // sync with server response
      if (response.data) {
        setLikesState(response.data.likes || []);
        setLikedState((response.data.likes || []).some(l => l._id === user._id));
        if (onPostUpdate) onPostUpdate(response.data);
      }
    } catch (error) {
      // rollback on error
      console.error('Error updating like:', error);
      setLikedState(prevLiked);
      setLikesState(prevLikes);
    } finally {
      setIsLiking(false);
    }
  };

  const handleShare = async () => {
    // optimistic increment
    const prev = shareCountState;
    setShareCountState(prev + 1);

    try {
      const shareData = {
        title: post.userId?.name || 'Post',
        text: post.content || (post.richContent ? 'View this post' : ''),
        url: `${window.location.origin}/posts/${post._id}`
      };

      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareData.url);
        // simple feedback
        // eslint-disable-next-line no-alert
        alert('Post link copied to clipboard');
      } else {
        // fallback: open new window
        window.open(shareData.url, '_blank');
      }

      // notify backend (best-effort)
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:5000/api/posts/${post._id}/share`, {}, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      console.error('Share failed:', err);
      setShareCountState(prev);
    }
  };

  const handleSave = async () => {
    if (!user || !user._id) return;
    const prevSaved = savedState;
    const prevSaveCount = saveCountState;
    // optimistic toggle
    setSavedState(!prevSaved);
    setSaveCountState(prevSaved ? Math.max(0, prevSaveCount - 1) : prevSaveCount + 1);

    try {
      const token = localStorage.getItem('token');
      // best-effort API; backend may implement save toggle at this endpoint
      const res = await axios.put(`http://localhost:5000/api/posts/${post._id}/save`, {}, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data && res.data.savedBy) {
        setSaveCountState(Array.isArray(res.data.savedBy) ? res.data.savedBy.length : (res.data.saveCount || saveCountState));
        setSavedState(Array.isArray(res.data.savedBy) ? res.data.savedBy.some(u => u === user._id || (u && u._id === user._id)) : !!res.data.savedBy);
      }
    } catch (err) {
      console.error('Save failed:', err);
      // rollback
      setSavedState(prevSaved);
      setSaveCountState(prevSaveCount);
    }
  };

  const handleComment = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
  if (!newComment.trim() || isCommenting) return;
  if (!user || !user._id) return; // safety guard

    // Optimistic comment append
    setIsCommenting(true);
    const content = newComment.trim();
    const tempId = `tmp-${Date.now()}`;
    const tempComment = {
      _id: tempId,
      content,
      createdAt: new Date().toISOString(),
      userId: {
        _id: user._id,
        name: user.name,
        profilePicture: user.profilePicture || null
      }
    };

    const prevComments = commentsState;
    setCommentsState([tempComment, ...prevComments]);
    setNewComment('');

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`http://localhost:5000/api/posts/${post._id}/comment`, {
        content
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.data) {
        setCommentsState(response.data.comments || []);
        if (onPostUpdate) onPostUpdate(response.data);
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      // rollback optimistic comment
      setCommentsState(prevComments);
    } finally {
      setIsCommenting(false);
    }
  };

  // delete functionality removed

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  const renderMedia = () => {
    if (!post.media || post.media.length === 0) return null;

    if (post.media.length === 1) {
      const media = post.media[0];
      return (
        <div className="mt-3 rounded-lg overflow-hidden">
          {media.type === 'image' ? (
            <button type="button" onClick={() => openLightbox(media)} className="w-full">
              <img
                src={`http://localhost:5000${media.url}`}
                alt={media.caption || 'Post media'}
                className="w-full max-h-96 object-cover"
              />
            </button>
          ) : (
            <button type="button" onClick={() => openLightbox(media)} className="w-full">
              <video
                src={`http://localhost:5000${media.url}`}
                controls
                className="w-full max-h-96"
                preload="metadata"
              />
            </button>
          )}
          {media.caption && (
            <p className="text-sm text-gray-600 mt-2 px-3">{media.caption}</p>
          )}
        </div>
      );
    }

    return (
      <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg overflow-hidden">
        {post.media.slice(0, 4).map((media, index) => (
          <div key={index} className="relative">
            {media.type === 'image' ? (
              <button type="button" onClick={() => openLightbox(media)} className="w-full">
                <img
                  src={`http://localhost:5000${media.url}`}
                  alt={media.caption || 'Post media'}
                  className="w-full h-32 object-cover"
                />
              </button>
            ) : (
              <button type="button" onClick={() => openLightbox(media)} className="w-full">
                <video
                  src={`http://localhost:5000${media.url}`}
                  className="w-full h-32 object-cover"
                  preload="metadata"
                />
              </button>
            )}
            {index === 3 && post.media.length > 4 && (
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <span className="text-white font-bold text-lg">+{post.media.length - 4}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Lightbox state and helpers
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxMedia, setLightboxMedia] = useState(null);

  const openLightbox = (media) => {
    setLightboxMedia(media);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    setLightboxMedia(null);
  };

  // Manage keyboard navigation (Esc, ArrowLeft, ArrowRight) and cleanup
  useEffect(() => {
    const onKey = (e) => {
      if (!lightboxOpen) return;
      if (e.key === 'Escape') return closeLightbox();
      if (e.key === 'ArrowRight') return goNext();
      if (e.key === 'ArrowLeft') return goPrev();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxOpen, lightboxMedia]);

  // helpers to go to prev/next based on current media index
  const getCurrentIndex = () => {
    if (!lightboxMedia || !post.media) return -1;
    return post.media.findIndex(m => m.url === lightboxMedia.url && m.type === lightboxMedia.type);
  };

  const goNext = useCallback(() => {
    const idx = getCurrentIndex();
    if (idx < 0) return;
    const next = post.media[(idx + 1) % post.media.length];
    setLightboxMedia(next);
  }, [lightboxMedia, post.media]);

  const goPrev = useCallback(() => {
    const idx = getCurrentIndex();
    if (idx < 0) return;
    const prev = post.media[(idx - 1 + post.media.length) % post.media.length];
    setLightboxMedia(prev);
  }, [lightboxMedia, post.media]);

  // Basic swipe detection for touch devices
  const [touchStartX, setTouchStartX] = useState(null);
  const onTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX);
  };
  const onTouchEnd = (e) => {
    if (touchStartX == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const threshold = 50; // px
    if (dx > threshold) {
      goPrev();
    } else if (dx < -threshold) {
      goNext();
    }
    setTouchStartX(null);
  };

  const renderContent = () => {
    if (post.richContent) {
      return (
        <div 
          className="mt-3 text-gray-800"
          dangerouslySetInnerHTML={{ __html: post.richContent }}
        />
      );
    }
    
    if (post.content) {
      return (
        <p className="mt-3 text-gray-800 whitespace-pre-wrap">{post.content}</p>
      );
    }
    
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      {/* Post Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          {post.userId.profilePicture ? (
            <img
              src={post.userId.profilePicture}
              alt={post.userId.name}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
              {post.userId?.name ? post.userId.name.charAt(0).toUpperCase() : '?'}
            </div>
          )}
          
          <div>
            <h3 className="font-semibold text-gray-900">{post.userId.name}</h3>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <span>{formatDate(post.createdAt)}</span>
              {post.visibility !== 'public' && (
                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                  {post.visibility === 'connections' ? 'Connections' : 'Private'}
                </span>
              )}
            </div>
          </div>
        </div>
        
  {/* delete functionality removed */}
      </div>

      {/* Post Content */}
      {renderContent()}

      {/* Media */}
      {renderMedia()}

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {post.tags.map((tag, index) => (
            <span
              key={index}
              className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full hover:bg-blue-200 transition-colors duration-200 cursor-pointer"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Removed separate stats row for a cleaner UI */}

      {/* Action Bar (LinkedIn style) */}
      <div className="mt-1 border-t border-gray-200">
        <div className="grid grid-cols-4 gap-1 pt-1">
          <button
            onClick={handleLike}
            disabled={isLiking}
            aria-pressed={isLiked}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-full hover:bg-gray-50 text-sm ${isLiked ? 'bg-blue-50 text-blue-600' : 'text-gray-600'}`}
            title={isLiked ? 'You liked this' : 'Like'}
          >
            <Heart size={18} className={isLiked ? 'fill-current' : ''} />
            <span className="text-sm font-medium">{likeCount}</span>
          </button>

          <button
            onClick={() => { setShowComments(!showComments); setShowCommentInput(true); }}
            className="flex items-center justify-center gap-2 py-2 rounded hover:bg-gray-50 text-sm text-gray-600"
            title="Comments"
          >
            <MessageCircle size={18} />
            <span className="text-sm font-medium">{commentCount}</span>
          </button>

          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 py-2 rounded hover:bg-gray-50 text-sm text-gray-600"
            title="Share"
          >
            <Share2 size={18} />
            <span className="text-sm font-medium">{shareCountState}</span>
          </button>

          <button
            onClick={handleSave}
            className={`flex items-center justify-center gap-2 py-2 rounded hover:bg-gray-50 text-sm ${savedState ? 'text-yellow-600' : 'text-gray-600'}`}
            title={savedState ? 'Saved' : 'Save'}
          >
            <Bookmark size={18} className={savedState ? 'fill-current' : ''} />
            <span className="text-sm font-medium">{saveCountState}</span>
          </button>
        </div>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          {/* Comments header with Close icon */}
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-800">Comments</h4>
            <button
              type="button"
              aria-label="Close comments"
              onClick={() => setShowComments(false)}
              className="p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            >
              <X size={18} />
            </button>
          </div>
          {/* Compact single-line composer with send button */}
          <form onSubmit={handleComment} className="mb-4">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                {user?.profilePicture ? (
                  <img src={user.profilePicture} alt={user?.name || 'User'} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">{user?.name ? user.name.charAt(0).toUpperCase() : '?'}</div>
                )}
              </div>

              <div className="flex-1 flex items-center bg-gray-50 px-3 py-2 rounded-full">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
                  placeholder="Write your comment.."
                  className="flex-1 bg-transparent outline-none text-sm"
                  disabled={isCommenting}
                />

                <button
                  type="button"
                  onClick={() => handleComment()}
                  disabled={!newComment.trim() || isCommenting}
                  aria-label="Send comment"
                  className={`ml-2 inline-flex items-center justify-center w-9 h-9 rounded-full ${(!newComment.trim() || isCommenting) ? 'bg-gray-300 text-gray-600' : 'bg-blue-600 text-white'}`}
                >
                  {isCommenting ? (
                    <svg className="w-4 h-4 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth="2" /></svg>
                  ) : (
                    <Send size={16} />
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Comments List */}
          {commentsState && commentsState.length > 0 ? (
            <div className="space-y-3">
              {commentsState.map((comment) => (
                <div key={comment._id} className="flex space-x-3">
                  {comment.userId?.profilePicture ? (
                    <img src={comment.userId.profilePicture} alt={comment.userId.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {comment.userId?.name ? comment.userId.name.charAt(0).toUpperCase() : '?'}
                    </div>
                  )}

                  <div className="flex-1">
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-medium text-sm text-gray-900">{comment.userId?.name || 'Unknown'}</span>
                        <span className="text-xs text-gray-500">{formatDate(comment.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-800">{comment.content}</p>
                      {/* Comment actions */}
                      <div className="mt-2 flex items-center space-x-3 text-xs text-gray-500">
                        <button
                          type="button"
                          className="flex items-center space-x-1 hover:text-gray-700"
                          onClick={() => {
                            setReplyInputs(prev => ({ ...prev, [comment._id]: prev[comment._id] || '' }));
                          }}
                          aria-label="Reply to comment"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h11M9 21V3m12 7l-4-4m4 4l-4 4" />
                          </svg>
                          <span>Reply</span>
                        </button>
                      </div>
                    </div>

                    {/* Replies list */}
                    {comment.replies && comment.replies.length > 0 && (
                      <div className="mt-2 space-y-2 ml-8">
                        {comment.replies.map((reply) => (
                          <div key={reply._id || `${comment._id}-r`} className="flex space-x-2">
                            {reply.userId?.profilePicture ? (
                              <img src={reply.userId.profilePicture} alt={reply.userId.name} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                                {reply.userId?.name ? reply.userId.name.charAt(0).toUpperCase() : '?'}
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="bg-gray-50 rounded px-3 py-2">
                                <div className="flex items-center space-x-2 mb-1">
                                  <span className="font-medium text-xs text-gray-900">{reply.userId?.name || 'Unknown'}</span>
                                  <span className="text-[10px] text-gray-500">{formatDate(reply.createdAt)}</span>
                                </div>
                                <p className="text-sm text-gray-800">{reply.content}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply input */}
                    {replyInputs[comment._id] !== undefined && (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const text = (replyInputs[comment._id] || '').trim();
                          if (!text) return;
                          if (replySubmitting[comment._id]) return;
                          setReplySubmitting(prev => ({ ...prev, [comment._id]: true }));

                          // Optimistic UI: append reply
                          const prev = commentsState;
                          const optimistic = prev.map(c => {
                            if (c._id !== comment._id) return c;
                            const newReply = {
                              _id: `tmp-${Date.now()}`,
                              content: text,
                              createdAt: new Date().toISOString(),
                              userId: { _id: user._id, name: user.name, profilePicture: user.profilePicture || null }
                            };
                            return { ...c, replies: [...(c.replies || []), newReply] };
                          });
                          setCommentsState(optimistic);
                          setReplyInputs(prevInputs => ({ ...prevInputs, [comment._id]: '' }));

                          try {
                            const token = localStorage.getItem('token');
                            const res = await axios.post(`http://localhost:5000/api/posts/${post._id}/comments/${comment._id}/reply`, { content: text }, {
                              headers: { 'Authorization': `Bearer ${token}` }
                            });
                            if (res.data) {
                              setCommentsState(res.data.comments || []);
                              if (onPostUpdate) onPostUpdate(res.data);
                            }
                          } catch (err) {
                            console.error('Error adding reply:', err);
                            setCommentsState(prev);
                          } finally {
                            setReplySubmitting(prev => ({ ...prev, [comment._id]: false }));
                          }
                        }}
                        className="mt-2 ml-8"
                      >
                        <div className="relative flex items-center space-x-2">
                          <textarea
                            value={replyInputs[comment._id]}
                            onChange={(e) => setReplyInputs(prev => ({ ...prev, [comment._id]: e.target.value }))}
                            placeholder={`Write a reply...`}
                            className="flex-1 pl-4 pr-10 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            rows={1}
                            disabled={!!replySubmitting[comment._id]}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                if (e.currentTarget.form && e.currentTarget.form.requestSubmit) {
                                  e.currentTarget.form.requestSubmit();
                                }
                              }
                            }}
                          />
                          <button
                            type="submit"
                            disabled={!replyInputs[comment._id]?.trim() || !!replySubmitting[comment._id]}
                            aria-label="Send reply"
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-full disabled:opacity-50 hover:bg-blue-700"
                          >
                            {replySubmitting[comment._id] ? (
                              <svg className="w-5 h-5 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                              </svg>
                            ) : (
                              <Send size={16} />
                            )}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm text-center py-4">No comments yet. Be the first to comment!</p>
          )}
        </div>
      )}
      {/* Lightbox Modal */}
      {lightboxOpen && lightboxMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80" onClick={closeLightbox}>
          <div className="max-w-5xl w-full max-h-[90vh] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-white text-sm">{getCurrentIndex() + 1} / {post.media.length}</div>
              <div className="flex items-center space-x-2">
                <button type="button" onClick={goPrev} className="text-white px-3 py-1 bg-black bg-opacity-30 rounded">Prev</button>
                <button type="button" onClick={closeLightbox} className="text-white px-3 py-1 bg-black bg-opacity-30 rounded">Close</button>
                <button type="button" onClick={goNext} className="text-white px-3 py-1 bg-black bg-opacity-30 rounded">Next</button>
              </div>
            </div>
            <div className="bg-black rounded overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
              {lightboxMedia.type === 'image' ? (
                <img loading="lazy" src={`http://localhost:5000${lightboxMedia.url}`} alt={lightboxMedia.caption || 'Media'} className="w-full h-auto max-h-[80vh] object-contain" />
              ) : (
                <video controls className="w-full h-auto max-h-[80vh] object-contain">
                  <source src={`http://localhost:5000${lightboxMedia.url}`} />
                </video>
              )}
              {lightboxMedia.caption && <p className="text-white text-sm p-2">{lightboxMedia.caption}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostCard;
