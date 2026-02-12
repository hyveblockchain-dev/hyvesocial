// src/components/Feed/CreatePost.jsx
import { useState, useRef, useCallback } from 'react';
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
  const previewRef = useRef(null);
  const fileInputRef = useRef(null);
  const { user } = useAuth();
  const displayName = user?.username || 'there';

  const MAX_IMAGE_MB = 5;

  const emojiOptions = ['😀','😄','😁','😅','😂','😍','🥳','😎','😮','😢','😡','👍','❤️'];

  const overlayEmojis = ['😀','😂','😍','🥳','😎','🔥','❤️','⭐','💯','👑','🎉','💀','🙏','💪','👀','🤔','✨','🌈','🦋','🐱'];
  const textColors = ['#ffffff','#000000','#f6d365','#ef4444','#3b82f6','#22c55e','#a855f7','#ec4899','#f97316','#06b6d4'];

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
    setShowOverlayText(false);
    setLivePreviewPos({ x: 50, y: 50 });
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

  // ── Flatten overlays onto canvas → File ──
  async function flattenOverlays(imgFile, overlayList) {
    const items = overlayList || overlays;
    if (items.length === 0 && !selectedFilter) return imgFile;
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Use 2x resolution for retina-quality text/emoji
        const scale = 2;
        const baseW = img.naturalWidth;
        const baseH = img.naturalHeight;
        const canvas = document.createElement('canvas');
        canvas.width = baseW * scale;
        canvas.height = baseH * scale;
        const ctx = canvas.getContext('2d');

        // High-quality rendering settings
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw the base image with filter, scaled up
        const filterCss = selectedFilter
          ? PHOTO_FILTERS.find(f => f.id === selectedFilter)?.css || 'none'
          : 'none';
        ctx.filter = filterCss;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.filter = 'none';

        // Compute object-fit: cover mapping so overlay positions match the CSS preview
        const containerEl = previewRef.current;
        const contW = containerEl?.offsetWidth || baseW;
        const contH = containerEl?.clientHeight || baseH;
        const contAR = contW / contH;
        const imgAR = baseW / baseH;

        let visibleX = 0, visibleY = 0, visibleW = baseW * scale, visibleH = baseH * scale;
        if (imgAR > contAR) {
          visibleW = (baseH * scale) * contAR;
          visibleX = (canvas.width - visibleW) / 2;
        } else {
          visibleH = (baseW * scale) / contAR;
          visibleY = (canvas.height - visibleH) / 2;
        }

        // Draw overlays with proper coordinate mapping
        ctx.textBaseline = 'top';
        for (const o of items) {
          const px = visibleX + (o.x / 100) * visibleW;
          const py = visibleY + (o.y / 100) * visibleH;
          const scaledSize = (o.size / contH) * (visibleH);
          if (o.type === 'text') {
            ctx.font = `bold ${scaledSize}px -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
            ctx.fillStyle = o.color;
            ctx.lineJoin = 'round';
            ctx.miterLimit = 2;
            // Shadow pass for depth
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = Math.max(6, scaledSize / 6);
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = Math.max(2, scaledSize / 16);
            ctx.fillText(o.content, px, py);
            // Crisp stroke + fill pass (no shadow)
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            ctx.strokeStyle = 'rgba(0,0,0,0.7)';
            ctx.lineWidth = Math.max(2, scaledSize / 14);
            ctx.strokeText(o.content, px, py);
            ctx.fillText(o.content, px, py);
          } else {
            // Emoji rendering
            ctx.font = `${scaledSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif`;
            ctx.shadowColor = 'rgba(0,0,0,0.4)';
            ctx.shadowBlur = Math.max(4, scaledSize / 8);
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = Math.max(2, scaledSize / 16);
            ctx.fillText(o.content, px, py);
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
          }
        }

        // Scale canvas back down to original dimensions for a crisp anti-aliased result
        const outCanvas = document.createElement('canvas');
        outCanvas.width = baseW;
        outCanvas.height = baseH;
        const outCtx = outCanvas.getContext('2d');
        outCtx.imageSmoothingEnabled = true;
        outCtx.imageSmoothingQuality = 'high';
        outCtx.drawImage(canvas, 0, 0, baseW, baseH);

        // Output as PNG for lossless text/emoji quality
        outCanvas.toBlob((pngBlob) => {
          // If PNG is under 5MB, use it directly (crisp text)
          if (pngBlob && pngBlob.size < 5 * 1024 * 1024) {
            resolve(new File([pngBlob], 'edited.png', { type: 'image/png' }));
            return;
          }
          // Fallback: try WebP at high quality
          outCanvas.toBlob((webpBlob) => {
            if (webpBlob && webpBlob.size < pngBlob.size * 0.8) {
              resolve(new File([webpBlob], 'edited.webp', { type: 'image/webp' }));
            } else {
              // Final fallback: JPEG at max quality
              outCanvas.toBlob((jpgBlob) => {
                resolve(new File([jpgBlob], 'edited.jpg', { type: 'image/jpeg' }));
              }, 'image/jpeg', 0.98);
            }
          }, 'image/webp', 0.96);
        }, 'image/png');
      };
      img.src = URL.createObjectURL(imgFile);
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!content.trim() && !imageFile) {
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
        // Flatten any text/emoji overlays onto the image
        const hasOverlays = finalOverlays.length > 0 || selectedFilter;
        uploadImage = await flattenOverlays(imageFile, finalOverlays);
        // Only compress if no overlays (overlays already output high-quality)
        if (!hasOverlays) {
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
      setOverlays([]);
      setShowOverlayText(false);
      setShowOverlayEmoji(false);
      setOverlayTextInput('');
      
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
            setOverlays([]);
          }}
        />
      </form>
    </div>
  );
}
