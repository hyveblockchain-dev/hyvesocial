// src/components/Feed/PublicFeed.jsx
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import CreatePost from './CreatePost';
import Post from '../Post/Post';
import './Feed.css';

export default function PublicFeed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const CACHE_KEY = 'public_feed_cache';

  useEffect(() => {
    // Try cache first
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
  }, []);

  async function loadPosts({ silent = false } = {}) {
    try {
      if (!silent) setLoading(true);
      const data = await api.getPublicPosts({ limit: 50, offset: 0 });
      const loaded = data.posts || [];
      setPosts(loaded);
      // Cache (strip large base64)
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

  const handlePostCreated = useCallback((newPost) => {
    // Tag the post as public for immediate display
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
        <p className="public-feed-subtitle">Posts from everyone on Hyve Social</p>
      </div>

      <CreatePost onPostCreated={handlePostCreated} isPublic />

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
