// src/components/Feed/CreatePost.jsx
import { useState, useRef, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import { compressImage } from '../../utils/imageCompression';
import { CameraIcon, SmileIcon, CloseIcon } from '../Icons/Icons';
import GifPicker from '../GifPicker/GifPicker';
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
  // ── Photo overlay state ──
  const [overlays, setOverlays] = useState([]);
  const [showOverlayText, setShowOverlayText] = useState(false);
  const [showOverlayEmoji, setShowOverlayEmoji] = useState(false);
  const [overlayTextInput, setOverlayTextInput] = useState('');
  const [overlayTextColor, setOverlayTextColor] = useState('#ffffff');
  const [overlayTextSize, setOverlayTextSize] = useState(28);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [livePreviewPos, setLivePreviewPos] = useState({ x: 50, y: 50 });
  const [draggingLive, setDraggingLive] = useState(false);
  // ── GIF state ──
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [selectedGif, setSelectedGif] = useState(null);
  // ── @mention / tagging state ──
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionResults, setMentionResults] = useState([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [taggedUsers, setTaggedUsers] = useState([]);
  const [mentionCursorPos, setMentionCursorPos] = useState(0);
  const [mentionSearching, setMentionSearching] = useState(false);
  const previewRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const mentionSearchTimeout = useRef(null);
  const { user } = useAuth();
  const displayName = user?.username || 'there';

  const MAX_IMAGE_MB = 20;

  const emojiOptions = ['😀','😄','😁','😅','😂','😍','🥳','😎','😮','😢','😡','👍','❤️'];

  const overlayEmojis = ['😀','😂','😍','🥳','😎','🔥','❤️','⭐','💯','👑','🎉','💀','🙏','💪','👀','🤔','✨','🌈','🦋','🐱'];
  const textColors = ['#ffffff','#000000','#f6d365','#ef4444','#3b82f6','#22c55e','#a855f7','#ec4899','#f97316','#06b6d4'];

  // ── @mention detection in textarea ──
  function handleContentChange(e) {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    setContent(value);

    // Find @mention pattern at cursor position
    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w{0,30})$/);

    if (mentionMatch) {
      const query = mentionMatch[1];
      setMentionQuery(query);
      setMentionCursorPos(cursorPos);
      setShowMentionDropdown(true);

      // Search users after at least 1 character
      if (query.length >= 1) {
        clearTimeout(mentionSearchTimeout.current);
        mentionSearchTimeout.current = setTimeout(async () => {
          setMentionSearching(true);
          try {
            const data = await api.searchUsers(query);
            const users = data.users || data || [];
            // Filter out current user and already-tagged users
            const filtered = users.filter(u =>
              u.username !== user?.username &&
              !taggedUsers.some(t => t.username === u.username)
            );
            setMentionResults(filtered.slice(0, 6));
          } catch (err) {
            console.error('Mention search error:', err);
            setMentionResults([]);
          } finally {
            setMentionSearching(false);
          }
        }, 300);
      } else {
        setMentionResults([]);
      }
    } else {
      setShowMentionDropdown(false);
      setMentionQuery('');
      setMentionResults([]);
    }
  }

  function selectMention(selectedUser) {
    const textBeforeCursor = content.slice(0, mentionCursorPos);
    const mentionStart = textBeforeCursor.lastIndexOf('@');
    const textAfterCursor = content.slice(mentionCursorPos);
    const newContent = content.slice(0, mentionStart) + `@${selectedUser.username} ` + textAfterCursor;
    setContent(newContent);

    // Add to tagged users if not already tagged
    if (!taggedUsers.some(t => t.username === selectedUser.username)) {
      setTaggedUsers(prev => [...prev, {
        username: selectedUser.username,
        address: selectedUser.address || selectedUser.wallet_address,
        profileImage: selectedUser.profile_image || selectedUser.profileImage,
      }]);
    }

    setShowMentionDropdown(false);
    setMentionQuery('');
    setMentionResults([]);

    // Refocus textarea
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = mentionStart + selectedUser.username.length + 2; // @username + space
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  }

  function removeTaggedUser(username) {
    setTaggedUsers(prev => prev.filter(t => t.username !== username));
  }

  // ── Add a text overlay ──
  function addTextOverlay() {
    if (!overlayTextInput.trim()) return;
    setOverlays(prev => [...prev, {
      id: Date.now(),
      type: 'text',
      content: overlayTextInput.trim(),
      x: livePreviewPos.x, y: livePreviewPos.y,
      color: overlayTextColor,
      size: overlayTextSize,
    }]);
    setOverlayTextInput('');
    // Keep panel open so user can add more lines; reset position for next line
    setLivePreviewPos({ x: 50, y: 70 });
  }

  // ── Add an emoji overlay ──
  function addEmojiOverlay(emoji) {
    setOverlays(prev => [...prev, {
      id: Date.now(),
      type: 'emoji',
      content: emoji,
      x: 50, y: 50,
      size: 40,
    }]);
    setShowOverlayEmoji(false);
  }

  // ── Remove an overlay ──
  function removeOverlay(id) {
    setOverlays(prev => prev.filter(o => o.id !== id));
  }

  // ── Drag handlers (pointer-based for touch + mouse) ──
  const handlePointerDown = useCallback((e, id) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    const overlay = document.getElementById(`overlay-${id}`);
    if (!overlay) return;
    const oRect = overlay.getBoundingClientRect();
    setDraggingId(id);
    setDragOffset({
      x: e.clientX - oRect.left,
      y: e.clientY - oRect.top,
    });
    overlay.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e) => {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (draggingLive) {
      const x = ((e.clientX - dragOffset.x - rect.left + 16) / rect.width) * 100;
      const y = ((e.clientY - dragOffset.y - rect.top + 16) / rect.height) * 100;
      setLivePreviewPos({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
      return;
    }
    if (draggingId === null) return;
    const x = ((e.clientX - dragOffset.x - rect.left + 16) / rect.width) * 100;
    const y = ((e.clientY - dragOffset.y - rect.top + 16) / rect.height) * 100;
    setOverlays(prev => prev.map(o =>
      o.id === draggingId ? { ...o, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) } : o
    ));
  }, [draggingId, draggingLive, dragOffset]);

  const handlePointerUp = useCallback(() => {
    setDraggingId(null);
    setDraggingLive(false);
  }, []);

  // ── Drag handler for live text preview ──
  const handleLivePreviewPointerDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    const el = e.currentTarget;
    const oRect = el.getBoundingClientRect();
    setDraggingLive(true);
    setDragOffset({ x: e.clientX - oRect.left, y: e.clientY - oRect.top });
    el.setPointerCapture(e.pointerId);
  }, []);

  // ── Apply filter only (text/emoji stored as metadata, not baked) ──
  async function applyFilter(imgFile) {
    if (!selectedFilter) return imgFile;
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        const filterCss = PHOTO_FILTERS.find(f => f.id === selectedFilter)?.css || 'none';
        ctx.filter = filterCss;
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          resolve(new File([blob], 'filtered.jpg', { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.95);
      };
      img.src = URL.createObjectURL(imgFile);
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!content.trim() && !imageFile && !selectedGif) {
      setError('Please write something!');
      return;
    }

    setPosting(true);
    setError('');

    try {
      // Auto-commit any pending live preview text as an overlay before flattening
      let finalOverlays = overlays;
      if (imageFile && overlayTextInput.trim()) {
        finalOverlays = [...overlays, {
          id: Date.now(),
          type: 'text',
          content: overlayTextInput.trim(),
          x: livePreviewPos.x,
          y: livePreviewPos.y,
          color: overlayTextColor,
          size: overlayTextSize,
        }];
        setOverlays(finalOverlays);
        setOverlayTextInput('');
      }

      let uploadImage = imageFile;
      if (imageFile) {
        // Apply filter if selected
        if (selectedFilter) {
          uploadImage = await applyFilter(imageFile);
        } else {
          uploadImage = await compressImage(uploadImage, 2, 1920);
        }
      }

      const metadata = {};
      if (!imageFile && selectedBg) {
        metadata.textBackground = selectedBg;
      }
      if (imageFile && selectedFilter) {
        metadata.imageFilter = selectedFilter;
      }
      // Store overlays as metadata — rendered with CSS for crystal-clear text
      if (imageFile && finalOverlays.length > 0) {
        metadata.overlays = finalOverlays.map(o => ({
          type: o.type,
          content: o.content,
          x: o.x,
          y: o.y,
          color: o.color,
          size: o.size,
        }));
      }

      // If a GIF is selected, store URL as imageUrl (no file upload needed)
      if (selectedGif) {
        metadata.isGif = true;
      }

      // Store tagged users in metadata
      if (taggedUsers.length > 0) {
        metadata.taggedUsers = taggedUsers.map(t => ({
          username: t.username,
          address: t.address,
        }));
      }

      const data = await api.createPost({
        content: content.trim(),
        imageFile: uploadImage,
        imageUrl: selectedGif ? selectedGif.url : undefined,
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
        image_url: data.post?.image_url || selectedGif?.url || imagePreview,
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
      setOverlays([]);
      setShowOverlayText(false);
      setShowOverlayEmoji(false);
      setOverlayTextInput('');
      setSelectedGif(null);
      setShowGifPicker(false);
      setTaggedUsers([]);
      setShowMentionDropdown(false);
      setMentionResults([]);
      
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
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              placeholder="Share your thoughts..."
              rows="4"
              disabled={posting}
              maxLength="300"
              className="textarea-styled"
            />
            {/* @mention dropdown */}
            {showMentionDropdown && mentionResults.length > 0 && (
              <div className="mention-dropdown">
                {mentionResults.map(u => (
                  <button key={u.username} type="button" className="mention-option" onClick={() => selectMention(u)}>
                    <div className="mention-avatar">
                      {u.profile_image ? <img src={u.profile_image} alt={u.username} /> : u.username?.charAt(0).toUpperCase()}
                    </div>
                    <span className="mention-username">@{u.username}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="textarea-mention-wrapper">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              placeholder="Share your thoughts..."
              rows="3"
              disabled={posting}
              maxLength="5000"
            />
            {/* @mention dropdown */}
            {showMentionDropdown && mentionResults.length > 0 && (
              <div className="mention-dropdown">
                {mentionResults.map(u => (
                  <button key={u.username} type="button" className="mention-option" onClick={() => selectMention(u)}>
                    <div className="mention-avatar">
                      {u.profile_image ? <img src={u.profile_image} alt={u.username} /> : u.username?.charAt(0).toUpperCase()}
                    </div>
                    <span className="mention-username">@{u.username}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tagged users display */}
        {taggedUsers.length > 0 && (
          <div className="tagged-users-bar">
            <span className="tagged-label">Tagging:</span>
            {taggedUsers.map(t => (
              <span key={t.username} className="tagged-user-chip">
                @{t.username}
                <button type="button" onClick={() => removeTaggedUser(t.username)} className="tagged-remove">✕</button>
              </span>
            ))}
          </div>
        )}

        {/* Image preview with live filter + draggable overlays */}
        {imagePreview && (
          <div
            className="media-preview"
            ref={previewRef}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <img
              src={imagePreview}
              alt="Preview"
              style={selectedFilter ? {
                filter: PHOTO_FILTERS.find(f => f.id === selectedFilter)?.css || 'none'
              } : {}}
              draggable={false}
            />
            {/* Rendered overlays */}
            {overlays.map(o => (
              <div
                key={o.id}
                id={`overlay-${o.id}`}
                className={`photo-overlay ${o.type === 'text' ? 'photo-overlay-text' : 'photo-overlay-emoji'}${draggingId === o.id ? ' dragging' : ''}`}
                style={{
                  left: `${o.x}%`,
                  top: `${o.y}%`,
                  fontSize: `${o.size}px`,
                  color: o.color || '#fff',
                  touchAction: 'none',
                  userSelect: 'none',
                }}
                onPointerDown={(e) => handlePointerDown(e, o.id)}
              >
                {o.content}
                <button
                  type="button"
                  className="overlay-remove"
                  onClick={(e) => { e.stopPropagation(); removeOverlay(o.id); }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  ✕
                </button>
              </div>
            ))}
            {/* Live text preview while typing — stays visible across panel switches */}
            {overlayTextInput && (
              <div
                className={`photo-overlay photo-overlay-text live-text-preview${draggingLive ? ' dragging' : ''}`}
                style={{
                  left: `${livePreviewPos.x}%`,
                  top: `${livePreviewPos.y}%`,
                  fontSize: `${overlayTextSize}px`,
                  color: overlayTextColor,
                  touchAction: 'none',
                  userSelect: 'none',
                  cursor: 'grab',
                }}
                onPointerDown={handleLivePreviewPointerDown}
              >
                {overlayTextInput}
              </div>
            )}
            <button
              type="button"
              className="remove-media"
              onClick={() => {
                setImageFile(null);
                setImagePreview('');
                setSelectedFilter(null);
                setShowFilterPicker(false);
                setOverlays([]);
              }}
            >
              <CloseIcon size={14} />
            </button>
          </div>
        )}

        {/* GIF preview */}
        {selectedGif && !imagePreview && (
          <div className="gif-preview-wrap">
            <img src={selectedGif.url} alt={selectedGif.title || 'GIF'} />
            <button
              type="button"
              className="remove-media"
              onClick={() => setSelectedGif(null)}
            >
              <CloseIcon size={14} />
            </button>
          </div>
        )}

        {/* Photo tools: Filters, Add Text, Add Emoji (only when image is attached) */}
        {imagePreview && (
          <div className="filter-picker-section">
            <div className="photo-tools-bar">
              <button
                type="button"
                className={`option-button${showFilterPicker ? ' active' : ''}`}
                onClick={() => { setShowFilterPicker(prev => !prev); setShowOverlayEmoji(false); setShowOverlayText(false); }}
              >
                🎨 Filters
              </button>
              <button
                type="button"
                className={`option-button${showOverlayText ? ' active' : ''}`}
                onClick={() => { setShowOverlayText(prev => !prev); setShowOverlayEmoji(false); setShowFilterPicker(false); }}
              >
                ✏️ Add Text
              </button>
              <button
                type="button"
                className={`option-button${showOverlayEmoji ? ' active' : ''}`}
                onClick={() => { setShowOverlayEmoji(prev => !prev); setShowFilterPicker(false); setShowOverlayText(false); }}
              >
                😀 Add Emoji
              </button>
            </div>

            {/* Filter strip */}
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

            {/* Text overlay panel */}
            {showOverlayText && (
              <div className="overlay-text-panel">
                <input
                  type="text"
                  value={overlayTextInput}
                  onChange={e => setOverlayTextInput(e.target.value)}
                  placeholder="Type text to add..."
                  className="overlay-text-input"
                  maxLength={80}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTextOverlay(); } }}
                />
                <div className="overlay-text-options">
                  <div className="overlay-color-row">
                    {textColors.map(c => (
                      <button
                        key={c}
                        type="button"
                        className={`color-dot${overlayTextColor === c ? ' selected' : ''}`}
                        style={{ background: c }}
                        onClick={() => setOverlayTextColor(c)}
                      />
                    ))}
                  </div>
                  <div className="overlay-size-row">
                    <label>Size</label>
                    <input
                      type="range"
                      min="16"
                      max="56"
                      value={overlayTextSize}
                      onChange={e => setOverlayTextSize(Number(e.target.value))}
                      className="size-slider"
                    />
                    <span className="size-label">{overlayTextSize}px</span>
                  </div>
                  <button type="button" className="overlay-add-btn" onClick={addTextOverlay} disabled={!overlayTextInput.trim()}>
                    Add Text
                  </button>
                </div>
                {/* List of existing overlays with remove buttons */}
                {overlays.length > 0 && (
                  <div className="overlay-list">
                    <div className="overlay-list-title">Added overlays ({overlays.length})</div>
                    {overlays.map((o, i) => (
                      <div key={o.id} className="overlay-list-item">
                        <span className="overlay-list-icon">{o.type === 'text' ? '✏️' : '😀'}</span>
                        <span className="overlay-list-content" style={o.type === 'text' ? { color: o.color } : {}}>
                          {o.content.length > 25 ? o.content.slice(0, 25) + '…' : o.content}
                        </span>
                        <button type="button" className="overlay-list-remove" onClick={() => removeOverlay(o.id)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Emoji overlay picker */}
            {showOverlayEmoji && (
              <div className="overlay-emoji-panel">
                {overlayEmojis.map(em => (
                  <button
                    key={em}
                    type="button"
                    className="overlay-emoji-btn"
                    onClick={() => addEmojiOverlay(em)}
                  >
                    {em}
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
              className={`option-button${showGifPicker ? ' active' : ''}`}
              onClick={() => {
                setShowGifPicker(prev => !prev);
                setShowEmojiPicker(false);
                setShowBgPicker(false);
              }}
              disabled={!!imageFile}
            >
              GIF
            </button>

            <button
              type="button"
              className="option-button"
              onClick={() => {
                // Insert @ at cursor position to trigger mention
                if (textareaRef.current) {
                  const pos = textareaRef.current.selectionStart || content.length;
                  const before = content.slice(0, pos);
                  const after = content.slice(pos);
                  const needsSpace = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n');
                  const newContent = before + (needsSpace ? ' @' : '@') + after;
                  setContent(newContent);
                  const newPos = pos + (needsSpace ? 2 : 1);
                  setMentionCursorPos(newPos);
                  setShowMentionDropdown(true);
                  setMentionQuery('');
                  setTimeout(() => {
                    textareaRef.current.focus();
                    textareaRef.current.setSelectionRange(newPos, newPos);
                  }, 0);
                }
              }}
            >
              👤 Tag
            </button>

            <button
              type="button"
              className="option-button"
              onClick={() => {
                setShowEmojiPicker((prev) => !prev);
                setShowBgPicker(false);
                setShowGifPicker(false);
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
          </div>

          <button 
            type="submit" 
            className="post-button"
            disabled={posting || (!content.trim() && !imageFile && !selectedGif)}
          >
            {posting ? 'Posting...' : 'Post'}
          </button>
        </div>

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

        {/* GIF picker */}
        {showGifPicker && !imageFile && (
          <GifPicker
            onSelect={(gif) => {
              setSelectedGif(gif);
              setShowGifPicker(false);
              setImageFile(null);
              setImagePreview('');
            }}
            onClose={() => setShowGifPicker(false)}
          />
        )}

        {/* Emoji picker */}
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
            // Clear text background and GIF when image is added
            setSelectedBg(null);
            setShowBgPicker(false);
            setOverlays([]);
            setSelectedGif(null);
            setShowGifPicker(false);
          }}
        />
      </form>
    </div>
  );
}
