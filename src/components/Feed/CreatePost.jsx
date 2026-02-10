// src/components/Feed/CreatePost.jsx
import { useState, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import { compressImage } from '../../utils/imageCompression';
import { CameraIcon, SmileIcon, CloseIcon } from '../Icons/Icons';
import './CreatePost.css';

export default function CreatePost({ onPostCreated, groupId = null, contextLabel = '' }) {
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [allowShare, setAllowShare] = useState(true);
  const [scanning, setScanning] = useState(false);
  const fileInputRef = useRef(null);
  const { user } = useAuth();
  const displayName = user?.username || 'there';

  const MAX_IMAGE_MB = 5;

  const emojiOptions = ['😀','😄','😁','😅','😂','😍','🥳','😎','😮','😢','😡','👍','❤️'];

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!content.trim() && !imageFile) {
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
        allowShare,
        groupId
      });

      // Inject user data for immediate display
      const postWithUser = {
        ...data.post,
        username: user?.username,
        profile_image: user?.profileImage,
        reaction_count: 0,
        comment_count: 0,
        image_url: data.post?.image_url || imagePreview,
        allow_share: allowShare,
        group_id: groupId ?? data.post?.group_id,
        groupId: groupId ?? data.post?.group_id
      };

      // ✨ THIS IS THE MAGIC - NO PAGE REFRESH! ✨
      if (typeof onPostCreated === 'function') {
        onPostCreated(postWithUser);
      }

      // Clear form
      setContent('');
      setImageFile(null);
      setImagePreview('');
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
        <h3>
          {contextLabel
            ? `Share something in ${contextLabel}, ${displayName}?`
            : `What's on your mind, ${displayName}?`}
        </h3>
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
              <CloseIcon size={14} />
            </button>
          </div>
        )}

        {scanning && <div className="inline-info" style={{color:'var(--gold-primary)',padding:'8px',fontSize:'13px'}}>Scanning image for safety...</div>}
        {error && <div className="inline-error">{error}</div>}

        <div className="create-post-actions">
          <div className="post-options">
            <button
              type="button"
              className="option-button"
              onClick={() => fileInputRef.current?.click()}
            >
              <CameraIcon size={16} /> Photo
            </button>
            <button
              type="button"
              className="option-button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
            >
              <SmileIcon size={16} /> Emoji
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
            disabled={posting || (!content.trim() && !imageFile)}
          >
            {posting ? 'Posting...' : 'Post'}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
              setError(`Image too large. Max ${MAX_IMAGE_MB}MB.`);
              return;
            }
            setScanning(true);
            setError('');
            try {
              const { checkImageNSFW } = await import('../../utils/nsfwCheck');
              const result = await checkImageNSFW(file);
              if (!result.safe) {
                setError(result.reason);
                e.target.value = '';
                return;
              }
            } finally {
              setScanning(false);
            }
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
          }}
        />
      </form>
    </div>
  );
}
