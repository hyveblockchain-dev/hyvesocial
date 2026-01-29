// src/components/Feed/CreatePost.jsx
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import './CreatePost.css';

export default function CreatePost({ onPostCreated }) {
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!content.trim()) {
      setError('Please write something!');
      return;
    }

    setPosting(true);
    setError('');

    try {
      const data = await api.createPost({ 
        content: content.trim(), 
        imageUrl: '', 
        privacy: 0 
      });

      // Inject user data for immediate display
      const postWithUser = {
        ...data.post,
        username: user.username,
        profile_image: user.profileImage,
        reaction_count: 0,
        comment_count: 0
      };

      // ✨ THIS IS THE MAGIC - NO PAGE REFRESH! ✨
      onPostCreated(postWithUser);

      // Clear form
      setContent('');
      
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
          {user?.username?.charAt(0).toUpperCase() || '?'}
        </div>
        <h3>What's on your mind, {user?.username}?</h3>
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

        {error && <div className="error-text">{error}</div>}

        <div className="create-post-actions">
          <div className="post-options">
            <button type="button" className="option-button" title="Coming soon">
              📷 Photo
            </button>
            <button type="button" className="option-button" title="Coming soon">
              🎥 Video
            </button>
            <button type="button" className="option-button" title="Coming soon">
              😊 Emoji
            </button>
          </div>

          <button 
            type="submit" 
            className="post-button"
            disabled={posting || !content.trim()}
          >
            {posting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </form>
    </div>
  );
}
