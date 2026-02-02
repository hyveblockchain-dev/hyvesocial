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
  const [videoUrl, setVideoUrl] = useState('');
  const [showVideoInput, setShowVideoInput] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef(null);
  const { user } = useAuth();

  const emojiOptions = ['😀','😄','😁','😅','😂','😍','🥳','😎','😮','😢','😡','👍','❤️'];

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!content.trim() && !imageFile && !videoUrl.trim()) {
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

      const data = await api.createPost(content.trim(), uploadImage, videoUrl.trim());

      // Inject user data for immediate display
      const postWithUser = {
        ...data.post,
        username: user.username,
        profile_image: user.profileImage,
        reaction_count: 0,
        comment_count: 0,
        image_url: data.post?.image_url || imagePreview,
        video_url: data.post?.video_url || data.post?.videoUrl || videoUrl.trim()
      };

      // ✨ THIS IS THE MAGIC - NO PAGE REFRESH! ✨
      onPostCreated(postWithUser);

      // Clear form
      setContent('');
      setImageFile(null);
      setImagePreview('');
      setVideoUrl('');
      setShowVideoInput(false);
      setShowEmojiPicker(false);
      
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
          {user?.username?.charAt(0).toUpperCase() || '?'}
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
              onClick={() => {
                setVideoUrl('');
                setShowVideoInput(false);
              }}
            >
              Remove
            </button>
          </div>
        )}

        {error && <div className="error-text">{error}</div>}

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
            disabled={posting || !content.trim()}
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
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
          }}
        />
      </form>
    </div>
  );
}
