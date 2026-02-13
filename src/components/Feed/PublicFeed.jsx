// src/components/Feed/PublicFeed.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import CreatePost from './CreatePost';
import Post from '../Post/Post';
import { compressImage } from '../../utils/imageCompression';
import './Feed.css';

export default function PublicFeed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Stories state
  const [stories, setStories] = useState([]);
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [storyFile, setStoryFile] = useState(null);
  const [storyPreview, setStoryPreview] = useState('');
  const [storyText, setStoryText] = useState('');
  const [storyPosting, setStoryPosting] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [activeStory, setActiveStory] = useState(null);
  // Story editor state
  const [storyFilter, setStoryFilter] = useState(null);
  const [storyShowFilters, setStoryShowFilters] = useState(false);
  const [storyOverlays, setStoryOverlays] = useState([]);
  const [storyShowText, setStoryShowText] = useState(false);
  const [storyShowEmoji, setStoryShowEmoji] = useState(false);
  const [storyTextInput, setStoryTextInput] = useState('');
  const [storyTextColor, setStoryTextColor] = useState('#ffffff');
  const [storyTextSize, setStoryTextSize] = useState(28);
  const [storyDraggingId, setStoryDraggingId] = useState(null);
  const [storyDragOffset, setStoryDragOffset] = useState({ x: 0, y: 0 });
  const [storyLivePos, setStoryLivePos] = useState({ x: 50, y: 50 });
  const [storyDraggingLive, setStoryDraggingLive] = useState(false);
  const storyPreviewRef = useRef(null);
  const storyFileInputRef = useRef(null);

  const MAX_STORY_IMAGE_MB = 20;
  const CACHE_KEY = 'public_feed_cache';

  // ── Story filter & overlay presets ──
  const STORY_FILTERS = [
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
  const storyOverlayEmojis = ['😀','😂','😍','🥳','😎','🔥','❤️','⭐','💯','👑','🎉','💀','🙏','💪','👀','🤔','✨','🌈','🦋','🐱'];
  const storyTextColors = ['#ffffff','#000000','#f6d365','#ef4444','#3b82f6','#22c55e','#a855f7','#ec4899','#f97316','#06b6d4'];

  // ── Load posts & stories ──
  useEffect(() => {
    let hasCache = false;
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPosts(parsed);
          setLoading(false);
          hasCache = true;
        }
      }
    } catch (_) {}

    loadPosts({ silent: hasCache });
    loadStories();
  }, []);

  async function loadPosts({ silent = false } = {}) {
    try {
      if (!silent) setLoading(true);
      const data = await api.getPublicPosts({ limit: 50, offset: 0 });
      const loaded = data.posts || [];
      setPosts(loaded);
      try {
        const stripped = loaded.slice(0, 30).map(p => {
          const c = { ...p };
          if (c.image_url && c.image_url.startsWith('data:')) c.image_url = '';
          return c;
        });
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(stripped));
      } catch (_) {}
    } catch (err) {
      console.error('Load public posts error:', err);
      if (!silent) setPosts([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function loadStories() {
    try {
      if (!api.getPublicStories) return;
      const data = await api.getPublicStories();
      setStories(data.stories || data || []);
    } catch (error) {
      console.error('Load public stories error:', error);
      setStories([]);
    }
  }

  // ── Story overlay helpers ──
  function addStoryTextOverlay() {
    if (!storyTextInput.trim()) return;
    setStoryOverlays(prev => [...prev, {
      id: Date.now(), type: 'text', content: storyTextInput.trim(),
      x: storyLivePos.x, y: storyLivePos.y, color: storyTextColor, size: storyTextSize,
    }]);
    setStoryTextInput('');
    setStoryLivePos({ x: 50, y: 70 });
  }

  function addStoryEmojiOverlay(emoji) {
    setStoryOverlays(prev => [...prev, {
      id: Date.now(), type: 'emoji', content: emoji, x: 50, y: 50, size: 40,
    }]);
    setStoryShowEmoji(false);
  }

  function removeStoryOverlay(id) {
    setStoryOverlays(prev => prev.filter(o => o.id !== id));
  }

  // ── Story drag handlers ──
  const handleStoryPointerDown = useCallback((e, id) => {
    e.preventDefault(); e.stopPropagation();
    const rect = storyPreviewRef.current?.getBoundingClientRect();
    if (!rect) return;
    const overlay = document.getElementById(`story-overlay-${id}`);
    if (!overlay) return;
    const oRect = overlay.getBoundingClientRect();
    setStoryDraggingId(id);
    setStoryDragOffset({ x: e.clientX - oRect.left, y: e.clientY - oRect.top });
    overlay.setPointerCapture(e.pointerId);
  }, []);

  const handleStoryPointerMove = useCallback((e) => {
    const rect = storyPreviewRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (storyDraggingLive) {
      const x = ((e.clientX - storyDragOffset.x - rect.left + 16) / rect.width) * 100;
      const y = ((e.clientY - storyDragOffset.y - rect.top + 16) / rect.height) * 100;
      setStoryLivePos({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
      return;
    }
    if (storyDraggingId === null) return;
    const x = ((e.clientX - storyDragOffset.x - rect.left + 16) / rect.width) * 100;
    const y = ((e.clientY - storyDragOffset.y - rect.top + 16) / rect.height) * 100;
    setStoryOverlays(prev => prev.map(o =>
      o.id === storyDraggingId ? { ...o, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) } : o
    ));
  }, [storyDraggingId, storyDraggingLive, storyDragOffset]);

  const handleStoryPointerUp = useCallback(() => {
    setStoryDraggingId(null);
    setStoryDraggingLive(false);
  }, []);

  const handleStoryLivePreviewPointerDown = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    const rect = storyPreviewRef.current?.getBoundingClientRect();
    if (!rect) return;
    const oRect = e.currentTarget.getBoundingClientRect();
    setStoryDraggingLive(true);
    setStoryDragOffset({ x: e.clientX - oRect.left, y: e.clientY - oRect.top });
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  async function applyStoryFilter(imgFile) {
    if (!storyFilter) return imgFile;
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        const filterCss = STORY_FILTERS.find(f => f.id === storyFilter)?.css || 'none';
        ctx.filter = filterCss;
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          resolve(new File([blob], 'filtered.jpg', { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.95);
      };
      img.src = URL.createObjectURL(imgFile);
    });
  }

  // ── Story CRUD ──
  async function handleCreateStory() {
    if (!storyFile) { alert('Please select a story photo'); return; }
    try {
      setStoryPosting(true);
      let finalOverlays = storyOverlays;
      if (storyTextInput.trim()) {
        finalOverlays = [...storyOverlays, {
          id: Date.now(), type: 'text', content: storyTextInput.trim(),
          x: storyLivePos.x, y: storyLivePos.y, color: storyTextColor, size: storyTextSize,
        }];
      }
      let uploadFile = storyFile;
      if (storyFilter) uploadFile = await applyStoryFilter(storyFile);
      const compressed = await compressImage(uploadFile, 2, 1920);
      const data = await api.createStory({
        file: compressed, mediaType: compressed.type || 'image',
        text: storyText.trim(), isPublic: true,
      });
      const newStory = data.story || data;
      const enrichedStory = {
        ...newStory,
        username: newStory.username || user?.username,
        profile_image: newStory.profile_image || user?.profileImage,
      };
      setStories((prev) => [enrichedStory, ...prev]);
      closeStoryModal();
      loadStories();
    } catch (error) {
      console.error('Create story error:', error);
      alert(error?.message || 'Failed to create story');
    } finally {
      setStoryPosting(false);
    }
  }

  function closeStoryModal() {
    setShowStoryModal(false);
    setStoryFile(null);
    setStoryPreview('');
    setStoryText('');
    setStoryFilter(null);
    setStoryShowFilters(false);
    setStoryOverlays([]);
    setStoryShowText(false);
    setStoryShowEmoji(false);
    setStoryTextInput('');
    setStoryTextColor('#ffffff');
    setStoryTextSize(28);
    setStoryLivePos({ x: 50, y: 50 });
  }

  async function handleDeleteStory(storyId) {
    if (!confirm('Delete your story?')) return;
    try {
      await api.deleteStory(storyId);
      setStories((prev) => prev.filter((s) => s.id !== storyId));
      if (activeStory?.id === storyId) { setActiveStory(null); setShowStoryViewer(false); }
    } catch (error) {
      console.error('Delete story error:', error);
      alert('Failed to delete story');
    }
  }

  function openStoryViewer(story) { setActiveStory(story); setShowStoryViewer(true); }

  // ── Post handlers ──
  const handlePostCreated = useCallback((newPost) => {
    const publicPost = { ...newPost, is_public: true, isPublic: true };
    setPosts((prev) => [publicPost, ...prev]);
  }, []);

  function handlePostDeleted(postId) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  function handlePostUpdated(updatedPost) {
    setPosts((prev) => prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
  }

  if (loading) {
    return (
      <div className="feed-container">
        <div className="feed-loading">Loading public posts...</div>
      </div>
    );
  }

  return (
    <div className="feed-container">
      <div className="public-feed-header">
        <h2 className="public-feed-title">🌐 Public Feed</h2>
        <p className="public-feed-subtitle">Posts and stories from everyone on Hyve Social</p>
      </div>

      {/* ── Stories row ── */}
      <div className="stories-row">
        <button className="story-card create-story" onClick={() => setShowStoryModal(true)}>
          <div className="story-avatar">
            {user?.profileImage ? (
              <img src={user.profileImage} alt={user.username} />
            ) : (
              <div className="story-avatar-placeholder">
                {user?.username?.charAt(0).toUpperCase() || '?'}
              </div>
            )}
          </div>
          <button className="story-add">+</button>
          <span>Create Story</span>
        </button>
        {(stories || []).map((story, index) => {
          const ownerName = story.user?.username || story.username || 'User';
          const ownerAvatar = story.user?.profileImage || story.user?.profile_image || story.profile_image || '';
          const imageUrl = story.media_url || story.mediaUrl || story.image_url || story.imageUrl || '';
          const isOwner = ownerName === user?.username;
          const fallbackColor = [
            'linear-gradient(135deg, #fbbf24, #f59e0b)',
            'linear-gradient(135deg, #06b6d4, #0891b2)',
            'linear-gradient(135deg, #a855f7, #7c3aed)',
            'linear-gradient(135deg, #10b981, #059669)',
            'linear-gradient(135deg, #ef4444, #b91c1c)',
          ][index % 5];
          return (
            <div key={story.id || `story-${index}`} className="story-card"
              style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : { background: fallbackColor }}
              role="button" tabIndex={0}
              onClick={() => openStoryViewer(story)}
              onKeyDown={(e) => { if (e.key === 'Enter') openStoryViewer(story); }}
            >
              <div className="story-initials">
                {ownerAvatar ? (
                  <img src={ownerAvatar} alt={ownerName} />
                ) : (
                  ownerName.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
                )}
              </div>
              <span className="story-name">{ownerName}</span>
              {(story.text || story.caption) && (
                <span className="story-text">{story.text || story.caption}</span>
              )}
              {isOwner && (
                <div className="story-actions">
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteStory(story.id); }}>
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Story create modal ── */}
      {showStoryModal && (
        <div className="story-modal" onClick={closeStoryModal}>
          <div className="story-modal-content story-editor" onClick={(e) => e.stopPropagation()}>
            <div className="story-editor-header">
              <h3>Create Public Story</h3>
              <button className="story-editor-close" onClick={closeStoryModal}>✕</button>
            </div>

            {storyPreview ? (
              <div className="story-editor-preview" ref={storyPreviewRef}
                onPointerMove={handleStoryPointerMove}
                onPointerUp={handleStoryPointerUp}
                onPointerLeave={handleStoryPointerUp}
              >
                <img src={storyPreview} alt="Story preview" className="story-editor-img"
                  style={storyFilter ? { filter: STORY_FILTERS.find(f => f.id === storyFilter)?.css || 'none' } : {}}
                  draggable={false}
                />
                {storyOverlays.map(o => (
                  <div key={o.id} id={`story-overlay-${o.id}`}
                    className={`photo-overlay ${o.type === 'text' ? 'photo-overlay-text' : 'photo-overlay-emoji'}${storyDraggingId === o.id ? ' dragging' : ''}`}
                    style={{
                      left: `${o.x}%`, top: `${o.y}%`,
                      fontSize: `${o.size}px`, color: o.color || '#fff',
                      touchAction: 'none', userSelect: 'none',
                    }}
                    onPointerDown={(e) => handleStoryPointerDown(e, o.id)}
                  >
                    {o.content}
                    <button type="button" className="overlay-remove"
                      onClick={(e) => { e.stopPropagation(); removeStoryOverlay(o.id); }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >✕</button>
                  </div>
                ))}
                {storyTextInput && (
                  <div className={`photo-overlay photo-overlay-text live-text-preview${storyDraggingLive ? ' dragging' : ''}`}
                    style={{
                      left: `${storyLivePos.x}%`, top: `${storyLivePos.y}%`,
                      fontSize: `${storyTextSize}px`, color: storyTextColor,
                      touchAction: 'none', userSelect: 'none', cursor: 'grab',
                    }}
                    onPointerDown={handleStoryLivePreviewPointerDown}
                  >
                    {storyTextInput}
                  </div>
                )}
                <button type="button" className="story-preview-remove"
                  onClick={() => { setStoryFile(null); setStoryPreview(''); setStoryFilter(null); setStoryOverlays([]); }}
                >✕</button>
              </div>
            ) : (
              <div className="story-editor-upload" onClick={() => storyFileInputRef.current?.click()}>
                <div className="story-upload-icon">📷</div>
                <span>Click to add a photo</span>
              </div>
            )}

            {storyPreview && (
              <div className="story-editor-tools">
                <div className="story-tools-bar">
                  <button type="button" className={`option-button${storyShowFilters ? ' active' : ''}`}
                    onClick={() => { setStoryShowFilters(p => !p); setStoryShowText(false); setStoryShowEmoji(false); }}
                  >🎨 Filters</button>
                  <button type="button" className={`option-button${storyShowText ? ' active' : ''}`}
                    onClick={() => { setStoryShowText(p => !p); setStoryShowFilters(false); setStoryShowEmoji(false); }}
                  >✏️ Text</button>
                  <button type="button" className={`option-button${storyShowEmoji ? ' active' : ''}`}
                    onClick={() => { setStoryShowEmoji(p => !p); setStoryShowFilters(false); setStoryShowText(false); }}
                  >😀 Emoji</button>
                </div>

                {storyShowFilters && (
                  <div className="filter-strip">
                    {STORY_FILTERS.map(f => (
                      <button key={f.id || 'none'} type="button"
                        className={`filter-thumb${storyFilter === f.id ? ' selected' : ''}`}
                        onClick={() => setStoryFilter(f.id)}
                      >
                        <img src={storyPreview} alt={f.label} style={{ filter: f.css }} />
                        <span>{f.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {storyShowText && (
                  <div className="overlay-text-panel">
                    <input type="text" value={storyTextInput} onChange={e => setStoryTextInput(e.target.value)}
                      placeholder="Type text to add..." className="overlay-text-input" maxLength={80}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addStoryTextOverlay(); } }}
                    />
                    <div className="overlay-text-options">
                      <div className="overlay-color-row">
                        {storyTextColors.map(c => (
                          <button key={c} type="button" className={`color-dot${storyTextColor === c ? ' selected' : ''}`}
                            style={{ background: c }} onClick={() => setStoryTextColor(c)} />
                        ))}
                      </div>
                      <div className="overlay-size-row">
                        <label>Size</label>
                        <input type="range" min="16" max="56" value={storyTextSize}
                          onChange={e => setStoryTextSize(Number(e.target.value))} className="size-slider" />
                        <span className="size-label">{storyTextSize}px</span>
                      </div>
                      <button type="button" className="overlay-add-btn" onClick={addStoryTextOverlay}
                        disabled={!storyTextInput.trim()}>Add Text</button>
                    </div>
                    {storyOverlays.length > 0 && (
                      <div className="overlay-list">
                        <div className="overlay-list-title">Added overlays ({storyOverlays.length})</div>
                        {storyOverlays.map((o) => (
                          <div key={o.id} className="overlay-list-item">
                            <span className="overlay-list-icon">{o.type === 'text' ? '✏️' : '😀'}</span>
                            <span className="overlay-list-content" style={o.type === 'text' ? { color: o.color } : {}}>
                              {o.content.length > 25 ? o.content.slice(0, 25) + '…' : o.content}
                            </span>
                            <button type="button" className="overlay-list-remove" onClick={() => removeStoryOverlay(o.id)}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {storyShowEmoji && (
                  <div className="overlay-emoji-panel">
                    {storyOverlayEmojis.map(em => (
                      <button key={em} type="button" className="overlay-emoji-btn" onClick={() => addStoryEmojiOverlay(em)}>
                        {em}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <textarea rows={2} placeholder="Add a caption..." value={storyText}
              onChange={(e) => setStoryText(e.target.value)} className="story-caption-input" />

            <div className="story-modal-actions">
              <button className="btn-secondary" onClick={closeStoryModal}>Cancel</button>
              <button className="btn-primary" onClick={handleCreateStory} disabled={storyPosting || !storyFile}>
                {storyPosting ? 'Posting...' : 'Post Public Story'}
              </button>
            </div>

            <input ref={storyFileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > MAX_STORY_IMAGE_MB * 1024 * 1024) {
                  alert(`Image too large. Max ${MAX_STORY_IMAGE_MB}MB.`);
                  return;
                }
                const { checkImageNSFW } = await import('../../utils/nsfwCheck');
                const nsfwResult = await checkImageNSFW(file);
                if (!nsfwResult.safe) {
                  alert(nsfwResult.reason);
                  e.target.value = '';
                  return;
                }
                setStoryFile(file);
                setStoryPreview(URL.createObjectURL(file));
                setStoryOverlays([]);
                setStoryFilter(null);
              }}
            />
          </div>
        </div>
      )}

      {/* ── Story viewer ── */}
      {showStoryViewer && activeStory && (
        <div className="story-viewer" onClick={() => setShowStoryViewer(false)}>
          <div className="story-viewer-content" onClick={(e) => e.stopPropagation()}>
            <div className="story-viewer-header">
              <div className="story-viewer-user">
                {activeStory.profile_image || activeStory.user?.profile_image ? (
                  <img
                    src={activeStory.profile_image || activeStory.user?.profile_image}
                    alt={activeStory.username || activeStory.user?.username || 'User'}
                  />
                ) : (
                  <div className="story-viewer-avatar">
                    {(activeStory.username || activeStory.user?.username || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <span>{activeStory.username || activeStory.user?.username || 'User'}</span>
              </div>
              <button className="story-viewer-close" onClick={() => setShowStoryViewer(false)}>✕</button>
            </div>
            <div className="story-viewer-media">
              <img src={activeStory.media_url || activeStory.mediaUrl || activeStory.image_url || activeStory.imageUrl || ''} alt="Story" />
            </div>
            {(activeStory.text || activeStory.caption) && (
              <div className="story-viewer-text">{activeStory.text || activeStory.caption}</div>
            )}
            {(activeStory.user?.username || activeStory.username) === user?.username && (
              <div className="story-viewer-actions">
                <button type="button" onClick={() => handleDeleteStory(activeStory.id)}>Delete Story</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Create post ── */}
      <CreatePost onPostCreated={handlePostCreated} isPublic />

      {/* ── Posts list ── */}
      <div className="posts-list">
        {posts.length === 0 ? (
          <div className="no-posts">
            <p>No public posts yet. Be the first to post!</p>
          </div>
        ) : (
          posts.map((post) => (
            <Post
              key={post.id}
              post={post}
              onDelete={handlePostDeleted}
              onUpdate={handlePostUpdated}
              onShare={handlePostCreated}
            />
          ))
        )}
      </div>
    </div>
  );
}
