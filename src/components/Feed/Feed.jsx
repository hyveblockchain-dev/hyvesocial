// src/components/Feed/Feed.jsx
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import CreatePost from './CreatePost';
import Post from '../Post/Post';
import { compressImage } from '../../utils/imageCompression';
import './Feed.css';

export default function Feed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState([]);
  const [stories, setStories] = useState([]);
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [storyFile, setStoryFile] = useState(null);
  const [storyPreview, setStoryPreview] = useState('');
  const [storyText, setStoryText] = useState('');
  const [storyPosting, setStoryPosting] = useState(false);

  const FEED_CACHE_KEY = 'feed_posts_cache';
  const FEED_CACHE_TS_KEY = 'feed_posts_cache_ts';

  useEffect(() => {
    const cached = sessionStorage.getItem(FEED_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPosts(parsed);
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to parse feed cache:', error);
      }
    }

    loadPosts({ silent: true });
    loadFriends();
    loadStories();
  }, []);

  async function loadFriends() {
    try {
      if (!api.getFriends) return;
      const data = await api.getFriends();
      setFriends(data.friends || data || []);
    } catch (error) {
      console.error('Load friends error:', error);
      setFriends([]);
    }
  }

  async function loadStories() {
    try {
      if (!api.getStories) return;
      const data = await api.getStories();
      setStories(data.stories || data || []);
    } catch (error) {
      console.error('Load stories error:', error);
      setStories([]);
    }
  }

  const friendAddressSet = useMemo(() => {
    return new Set(
      friends
        .map((friend) => friend.wallet_address || friend.walletAddress || friend.address)
        .filter(Boolean)
    );
  }, [friends]);

  const visibleStories = useMemo(() => {
    return (stories || []).filter((story) => {
      const ownerAddress =
        story.user?.walletAddress ||
        story.user?.wallet_address ||
        story.owner_address ||
        story.wallet_address ||
        story.address;
      const ownerUsername = story.user?.username || story.username || '';
      if (ownerUsername && ownerUsername === user?.username) return true;
      if (ownerAddress && ownerAddress === user?.walletAddress) return true;
      if (ownerAddress && friendAddressSet.has(ownerAddress)) return true;
      return false;
    });
  }, [stories, friendAddressSet, user]);

  async function handleCreateStory() {
    if (!storyFile) {
      alert('Please select a story photo');
      return;
    }

    try {
      setStoryPosting(true);
      const compressed = await compressImage(storyFile, 2, 1920);
      const data = await api.createStory({
        file: compressed,
        mediaType: compressed.type || 'image',
        text: storyText.trim()
      });
      const newStory = data.story || data;
      const enrichedStory = {
        ...newStory,
        username: newStory.username || user?.username,
        profile_image: newStory.profile_image || user?.profileImage
      };
      setStories((prev) => [enrichedStory, ...prev]);
      setShowStoryModal(false);
      setStoryFile(null);
      setStoryPreview('');
      setStoryText('');
      loadStories();
    } catch (error) {
      console.error('Create story error:', error);
      alert(error?.message || 'Failed to create story');
    } finally {
      setStoryPosting(false);
    }
  }

  async function handleDeleteStory(storyId) {
    if (!confirm('Delete your story?')) return;
    try {
      await api.deleteStory(storyId);
      setStories((prev) => prev.filter((story) => story.id !== storyId));
    } catch (error) {
      console.error('Delete story error:', error);
      alert('Failed to delete story');
    }
  }

  async function loadPosts({ silent = false } = {}) {
    try {
      if (!silent) setLoading(true);
      const data = await api.getPosts({ limit: 50, offset: 0 });
      const loadedPosts = data.posts || [];
      setPosts(loadedPosts);
      sessionStorage.setItem(FEED_CACHE_KEY, JSON.stringify(loadedPosts));
      sessionStorage.setItem(FEED_CACHE_TS_KEY, Date.now().toString());
    } catch (error) {
      console.error('Load posts error:', error);
      if (!silent) setPosts([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  function handlePostCreated(newPost) {
    setPosts((prev) => {
      const updated = [newPost, ...prev];
      sessionStorage.setItem(FEED_CACHE_KEY, JSON.stringify(updated));
      sessionStorage.setItem(FEED_CACHE_TS_KEY, Date.now().toString());
      return updated;
    });
  }

  function handlePostDeleted(postId) {
    setPosts((prev) => {
      const updated = prev.filter((p) => p.id !== postId);
      sessionStorage.setItem(FEED_CACHE_KEY, JSON.stringify(updated));
      sessionStorage.setItem(FEED_CACHE_TS_KEY, Date.now().toString());
      return updated;
    });
  }

  function handlePostUpdated(updatedPost) {
    setPosts((prev) => {
      const updated = prev.map((p) => (p.id === updatedPost.id ? updatedPost : p));
      sessionStorage.setItem(FEED_CACHE_KEY, JSON.stringify(updated));
      sessionStorage.setItem(FEED_CACHE_TS_KEY, Date.now().toString());
      return updated;
    });
  }

  if (loading) {
    return (
      <div className="feed-container">
        <div className="feed-loading">Loading posts...</div>
      </div>
    );
  }

  return (
    <div className="feed-container">
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
        {visibleStories.map((story, index) => {
          const ownerName = story.user?.username || story.username || 'User';
          const ownerAvatar = story.user?.profileImage || story.user?.profile_image || story.profile_image || '';
          const imageUrl = story.media_url || story.mediaUrl || story.image_url || story.imageUrl || '';
          const ownerAddress =
            story.user?.walletAddress ||
            story.user?.wallet_address ||
            story.owner_address ||
            story.wallet_address ||
            story.address;
          const isOwner = ownerAddress ? ownerAddress === user?.walletAddress : ownerName === user?.username;
          const fallbackColor = [
            'linear-gradient(135deg, #fbbf24, #f59e0b)',
            'linear-gradient(135deg, #06b6d4, #0891b2)',
            'linear-gradient(135deg, #a855f7, #7c3aed)',
            'linear-gradient(135deg, #10b981, #059669)',
            'linear-gradient(135deg, #ef4444, #b91c1c)'
          ][index % 5];

          return (
            <div
              key={story.id || `story-${index}`}
              className="story-card"
              style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : { background: fallbackColor }}
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
                  <button type="button" onClick={() => handleDeleteStory(story.id)}>Delete</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {showStoryModal && (
        <div className="story-modal" onClick={() => setShowStoryModal(false)}>
          <div className="story-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Create Story</h3>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setStoryFile(file);
                setStoryPreview(URL.createObjectURL(file));
              }}
            />
            {storyPreview && <img className="story-preview" src={storyPreview} alt="Story preview" />}
            <textarea
              rows={3}
              placeholder="Add a caption..."
              value={storyText}
              onChange={(e) => setStoryText(e.target.value)}
            />
            <div className="story-modal-actions">
              <button className="btn-secondary" onClick={() => setShowStoryModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreateStory} disabled={storyPosting}>
                {storyPosting ? 'Posting...' : 'Post Story'}
              </button>
            </div>
          </div>
        </div>
      )}
      <CreatePost onPostCreated={handlePostCreated} />

      <div className="posts-list">
        {posts.length === 0 ? (
          <div className="no-posts">
            <p>No posts yet. Be the first to post!</p>
          </div>
        ) : (
          posts.map(post => (
            <Post
              key={post.id}
              post={post}
              onDelete={handlePostDeleted}
              onUpdate={handlePostUpdated}
            />
          ))
        )}
      </div>
    </div>
  );
}