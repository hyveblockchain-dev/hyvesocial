// src/components/Feed/CreatePost.jsx
import { useState, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import { compressImage } from '../../utils/imageCompression';
import { CameraIcon, SmileIcon, CloseIcon } from '../Icons/Icons';
import './CreatePost.css';

// ── Text background presets (Facebook-style) ──────────────────────
const TEXT_BACKGROUNDS = [
  { id: null, label: 'None', style: {} },
  { id: 'gradient-gold', label: 'Gold', style: { background: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)' } },
  { id: 'gradient-ocean', label: 'Ocean', style: { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' } },
  { id: 'gradient-sunset', label: 'Sunset', style: { background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' } },
  { id: 'gradient-forest', label: 'Forest', style: { background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' } },
  { id: 'gradient-night', label: 'Night', style: { background: 'linear-gradient(135deg, #0c0c1d 0%, #1a1a4e 50%, #2d1b69 100%)' } },
  { id: 'gradient-fire', label: 'Fire', style: { background: 'linear-gradient(135deg, #f12711 0%, #f5af19 100%)' } },
  { id: 'gradient-arctic', label: 'Arctic', style: { background: 'linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)' } },
  { id: 'gradient-berry', label: 'Berry', style: { background: 'linear-gradient(135deg, #7028e4 0%, #e5b2ca 100%)' } },
  { id: 'solid-black', label: 'Black', style: { background: '#0a0a0a' } },
  { id: 'solid-red', label: 'Red', style: { background: '#dc2626' } },
  { id: 'solid-blue', label: 'Blue', style: { background: '#2563eb' } },
];

// ── Photo filter presets ──────────────────────────────────────────
const PHOTO_FILTERS = [
  { id: null, label: 'Normal', css: 'none' },
  { id: 'vivid', label: 'Vivid', css: 'saturate(1.4) contrast(1.1)' },
  { id: 'warm', label: 'Warm', css: 'sepia(0.25) saturate(1.3) brightness(1.05)' },
  { id: 'cool', label: 'Cool', css: 'saturate(0.9) brightness(1.05) hue-rotate(15deg)' },
  { id: 'bw', label: 'B&W', css: 'grayscale(1)' },
  { id: 'sepia', label: 'Sepia', css: 'sepia(0.7)' },
  { id: 'dramatic', label: 'Drama', css: 'contrast(1.4) saturate(1.2) brightness(0.9)' },
  { id: 'fade', label: 'Fade', css: 'contrast(0.85) brightness(1.1) saturate(0.7)' },
  { id: 'vintage', label: 'Vintage', css: 'sepia(0.35) contrast(1.1) brightness(0.95) saturate(1.2)' },
];

export default function CreatePost({ onPostCreated, groupId = null, contextLabel = '' }) {
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [allowShare, setAllowShare] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [selectedBg, setSelectedBg] = useState(null);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState(null);
  const [showFilterPicker, setShowFilterPicker] = useState(false);
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

      const metadata = {};
      if (!imageFile && selectedBg) {
        metadata.textBackground = selectedBg;
      }
      if (imageFile && selectedFilter) {
        metadata.imageFilter = selectedFilter;
      }

      const data = await api.createPost({
        content: content.trim(),
        imageFile: uploadImage,
        allowShare,
        groupId,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined
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
        groupId: groupId ?? data.post?.group_id,
        metadata: data.post?.metadata || (Object.keys(metadata).length > 0 ? metadata : {})
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
      setSelectedBg(null);
      setShowBgPicker(false);
      setSelectedFilter(null);
      setShowFilterPicker(false);
      
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
        {/* Text area with live background preview (text-only posts) */}
        {!imageFile && selectedBg ? (
          <div
            className="textarea-bg-wrapper"
            style={TEXT_BACKGROUNDS.find(b => b.id === selectedBg)?.style || {}}
          >
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your thoughts..."
              rows="4"
              disabled={posting}
              maxLength="300"
              className="textarea-styled"
            />
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share your thoughts..."
            rows="3"
            disabled={posting}
            maxLength="5000"
          />
        )}

        {/* Image preview with live filter */}
        {imagePreview && (
          <div className="media-preview">
            <img
              src={imagePreview}
              alt="Preview"
              style={selectedFilter ? {
                filter: PHOTO_FILTERS.find(f => f.id === selectedFilter)?.css || 'none'
              } : {}}
            />
            <button
              type="button"
              className="remove-media"
              onClick={() => {
                setImageFile(null);
                setImagePreview('');
                setSelectedFilter(null);
                setShowFilterPicker(false);
              }}
            >
              <CloseIcon size={14} />
            </button>
          </div>
        )}

        {/* Photo filter picker (only when image is attached) */}
        {imagePreview && (
          <div className="filter-picker-section">
            <button
              type="button"
              className={`option-button${showFilterPicker ? ' active' : ''}`}
              onClick={() => setShowFilterPicker(prev => !prev)}
            >
              🎨 Filters
            </button>
            {showFilterPicker && (
              <div className="filter-strip">
                {PHOTO_FILTERS.map(f => (
                  <button
                    key={f.id || 'none'}
                    type="button"
                    className={`filter-thumb${selectedFilter === f.id ? ' selected' : ''}`}
                    onClick={() => setSelectedFilter(f.id)}
                  >
                    <img
                      src={imagePreview}
                      alt={f.label}
                      style={{ filter: f.css }}
                    />
                    <span>{f.label}</span>
                  </button>
                ))}
              </div>
            )}
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

            {/* Text background button (only for text-only posts) */}
            {!imageFile && (
              <button
                type="button"
                className={`option-button${showBgPicker ? ' active' : ''}`}
                onClick={() => {
                  setShowBgPicker(prev => !prev);
                  setShowEmojiPicker(false);
                }}
              >
                🎨 Background
              </button>
            )}

            <button
              type="button"
              className="option-button"
              onClick={() => {
                setShowEmojiPicker((prev) => !prev);
                setShowBgPicker(false);
              }}
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

            {/* Background picker dropdown */}
            {showBgPicker && !imageFile && (
              <div className="bg-picker" role="menu">
                {TEXT_BACKGROUNDS.map(bg => (
                  <button
                    key={bg.id || 'none'}
                    type="button"
                    className={`bg-swatch${selectedBg === bg.id ? ' selected' : ''}`}
                    style={bg.id ? bg.style : { background: 'var(--bg-card)', border: '2px dashed var(--text-tertiary)' }}
                    onClick={() => {
                      setSelectedBg(bg.id);
                      setShowBgPicker(false);
                    }}
                    title={bg.label}
                  >
                    {!bg.id && <span style={{fontSize:'10px',color:'var(--text-tertiary)'}}>✕</span>}
                  </button>
                ))}
              </div>
            )}

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
            // Clear text background when image is added
            setSelectedBg(null);
            setShowBgPicker(false);
          }}
        />
      </form>
    </div>
  );
}
