// src/components/Feed/Feed.jsx
import { useState, useEffect } from 'react';
import api from '../../services/api';
import CreatePost from './CreatePost';
import Post from '../Post/Post';
import './Feed.css';

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPosts();
  }, []);

  async function loadPosts() {
    try {
      setLoading(true);
      const data = await api.getPosts(50, 0);
      setPosts(data.posts || []);
    } catch (error) {
      console.error('Load posts error:', error);
      setError('Failed to load posts');
    } finally {
      setLoading(false);
    }
  }

  function handlePostCreated(newPost) {
    // Add new post to top of feed instantly - NO PAGE REFRESH! ✅
    setPosts([newPost, ...posts]);
  }

  function handlePostDeleted(postId) {
    setPosts(posts.filter(p => p.id !== postId));
  }

  function handlePostUpdated(updatedPost) {
    setPosts(posts.map(p => p.id === updatedPost.id ? updatedPost : p));
  }

  if (loading) {
    return (
      <div className="feed">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading feed...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="feed">
      <CreatePost onPostCreated={handlePostCreated} />

      {error && <div className="error-message">{error}</div>}

      <div className="posts-list">
        {posts.length === 0 ? (
          <div className="empty-feed">
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
