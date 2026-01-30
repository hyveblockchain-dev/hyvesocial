// src/components/Feed/Feed.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import CreatePost from './CreatePost';
import Post from '../Post/Post';
import './Feed.css';

export default function Feed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPosts();
  }, []);

  async function loadPosts() {
    try {
      setLoading(true);
      const data = await api.getPosts();
      setPosts(data.posts || []);
    } catch (error) {
      console.error('Load posts error:', error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }

  function handlePostCreated(newPost) {
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
      <div className="feed-container">
        <div className="feed-loading">Loading posts...</div>
      </div>
    );
  }

  return (
    <div className="feed-container">
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