// src/components/Feed/CreatePost.jsx
import { useState, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import { compressImage } from '../../utils/imageCompression';
import './CreatePost.css';

export default function CreatePost({ onPostCreated }) {
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [showVideoInput, setShowVideoInput] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [allowShare, setAllowShare] = useState(true);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const { user } = useAuth();

  const MAX_IMAGE_MB = 5;
  const MAX_VIDEO_MB = 25;

  const emojiOptions = ['😀','😄','😁','😅','😂','😍','🥳','😎','😮','😢','😡','👍','❤️'];

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!content.trim() && !imageFile && !videoUrl.trim() && !videoFile) {
      setError('Please write something!');
      return;
    }

    setPosting(true);
    setError('');

    try {
      let uploadImage = imageFile;
      if (imageFile) {
        uploadImage = await compressImage(imageFile, 2, 1920);
      }

      const data = await api.createPost({
        content: content.trim(),
        imageFile: uploadImage,
        videoUrl: videoUrl.trim(),
        videoFile,
        allowShare
      });

      // Inject user data for immediate display
      const postWithUser = {
        ...data.post,
        username: user.username,
        profile_image: user.profileImage,
        reaction_count: 0,
        comment_count: 0,
        image_url: data.post?.image_url || imagePreview,
        video_url: data.post?.video_url || data.post?.videoUrl || videoUrl.trim() || videoPreview,
        allow_share: allowShare
      };

      // ✨ THIS IS THE MAGIC - NO PAGE REFRESH! ✨
      onPostCreated(postWithUser);

      // Clear form
      setContent('');
      setImageFile(null);
      setImagePreview('');
      setVideoFile(null);
      setVideoPreview('');
      setVideoUrl('');
      setShowVideoInput(false);
      setShowEmojiPicker(false);
      setAllowShare(true);
      
      // Show success (optional)
      console.log('Post created successfully!');
    } catch (error) {
      console.error('Create post error:', error);
      setError(error.message || 'Failed to create post');
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="create-post-box">
      <div className="create-post-header">
        <div className="user-avatar">
          {user?.profileImage ? (
            <img src={user.profileImage} alt={user.username || 'User'} />
          ) : (
            user?.username?.charAt(0).toUpperCase() || '?'
          )}
        </div>
        <h3>What's on your mind, {user?.username}?</h3>
      </div>

      <form onSubmit={handleSubmit}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share your thoughts..."
          rows="3"
          disabled={posting}
          maxLength="5000"
        />

        {imagePreview && (
          <div className="media-preview">
            <img src={imagePreview} alt="Preview" />
            <button
              type="button"
              className="remove-media"
              onClick={() => {
                setImageFile(null);
                setImagePreview('');
              }}
            >
              ✕
            </button>
          </div>
        )}

        {videoPreview && (
          <div className="media-preview">
            <video src={videoPreview} controls />
            <button
              type="button"
              className="remove-media"
              onClick={() => {
                setVideoFile(null);
                setVideoPreview('');
              }}
            >
              ✕
            </button>
          </div>
        )}

        {showVideoInput && (
          <div className="video-input">
            <input
              type="url"
              placeholder="Paste a video URL (mp4/webm)"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => videoInputRef.current?.click()}
            >
              Upload Video
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setVideoUrl('');
                setVideoFile(null);
                setVideoPreview('');
                setShowVideoInput(false);
              }}
            >
              Remove
            </button>
          </div>
        )}

        {error && <div className="inline-error">{error}</div>}

        <div className="create-post-actions">
          <div className="post-options">
            <button
              type="button"
              className="option-button"
              onClick={() => fileInputRef.current?.click()}
            >
              📷 Photo
            </button>
            <button
              type="button"
              className="option-button"
              onClick={() => setShowVideoInput((prev) => !prev)}
            >
              🎥 Video
            </button>
            <button
              type="button"
              className="option-button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
            >
              😊 Emoji
            </button>

            <label className="option-toggle">
              <input
                type="checkbox"
                checked={allowShare}
                onChange={(e) => setAllowShare(e.target.checked)}
              />
              <span>Allow Sharing</span>
            </label>

            {showEmojiPicker && (
              <div className="emoji-picker" role="menu">
                {emojiOptions.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="emoji-btn"
                    onClick={() => {
                      setContent((prev) => `${prev}${emoji}`);
                      setShowEmojiPicker(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button 
            type="submit" 
            className="post-button"
            disabled={posting || (!content.trim() && !imageFile && !videoUrl.trim() && !videoFile)}
          >
            {posting ? 'Posting...' : 'Post'}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
              setError(`Image too large. Max ${MAX_IMAGE_MB}MB.`);
              return;
            }
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
          }}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
              setError(`Video too large. Max ${MAX_VIDEO_MB}MB.`);
              return;
            }
            setVideoFile(file);
            setVideoPreview(URL.createObjectURL(file));
            setVideoUrl('');
          }}
        />
      </form>
    </div>
  );
}
