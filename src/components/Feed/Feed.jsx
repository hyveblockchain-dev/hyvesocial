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
  const [friends, setFriends] = useState([]);
  const [myStoryTitle, setMyStoryTitle] = useState('Your Story');
  const [showMyStory, setShowMyStory] = useState(true);

  useEffect(() => {
    loadPosts();
    loadFriends();
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

  function handleEditStory() {
    const nextTitle = prompt('Update your story title', myStoryTitle);
    if (nextTitle === null) return;
    setMyStoryTitle(nextTitle.trim() || 'Your Story');
  }

  function handleDeleteStory() {
    if (!confirm('Delete your story?')) return;
    setShowMyStory(false);
  }

  const friendStories = friends.slice(0, 8).map((friend, index) => ({
    id: friend.id || friend.wallet_address || friend.username || `friend-${index}`,
    name: friend.username || 'Friend',
    profileImage: friend.profile_image || friend.profileImage || '',
    color: friend.cover_image
      ? undefined
      : [
          'linear-gradient(135deg, #fbbf24, #f59e0b)',
          'linear-gradient(135deg, #06b6d4, #0891b2)',
          'linear-gradient(135deg, #a855f7, #7c3aed)',
          'linear-gradient(135deg, #10b981, #059669)',
          'linear-gradient(135deg, #ef4444, #b91c1c)'
        ][index % 5]
  }));

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
      <div className="stories-row">
        <div className="story-card create-story">
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
        </div>
        {showMyStory && (
          <div className="story-card" style={{ background: 'linear-gradient(135deg, #111827, #1f2937)' }}>
            <div className="story-initials">
              {user?.username?.charAt(0).toUpperCase() || '?'}
            </div>
            <span className="story-name">{myStoryTitle}</span>
            <div className="story-actions">
              <button type="button" onClick={handleEditStory}>Edit</button>
              <button type="button" onClick={handleDeleteStory}>Delete</button>
            </div>
          </div>
        )}
        {friendStories.map((story) => (
          <div key={story.id} className="story-card" style={story.color ? { background: story.color } : undefined}>
            <div className="story-initials">
              {story.profileImage ? (
                <img src={story.profileImage} alt={story.name} />
              ) : (
                story.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
              )}
            </div>
            <span className="story-name">{story.name}</span>
          </div>
        ))}
      </div>
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