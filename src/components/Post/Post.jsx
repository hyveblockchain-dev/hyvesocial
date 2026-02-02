// src/components/Post/Post.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import './Post.css';

// Helper function to render avatar
function getAvatar(imageUrl, username, className) {
  if (imageUrl) {
    return <img src={imageUrl} alt={username} className={className} />;
  }
  return (
    <div className={className}>
      {username?.charAt(0).toUpperCase() || '?'}
    </div>
  );
}

export default function Post({ post, onDelete, onUpdate }) {
  const { user } = useAuth();
  const initialReaction = Number.isFinite(Number(post.user_reaction))
    ? Number(post.user_reaction)
    : Number.isFinite(Number(post.reaction_type))
    ? Number(post.reaction_type)
    : null;
  const [reactionType, setReactionType] = useState(initialReaction);
  const [likeCount, setLikeCount] = useState(Number(post.reaction_count) || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  const isOwner = user?.walletAddress === post.author_address;

  function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  const reactionOptions = [
    { type: 0, label: 'Like', emoji: '👍' },
    { type: 1, label: 'Love', emoji: '❤️' },
    { type: 2, label: 'Haha', emoji: '😂' },
    { type: 3, label: 'Wow', emoji: '😮' },
    { type: 4, label: 'Sad', emoji: '😢' },
    { type: 5, label: 'Angry', emoji: '😡' }
  ];

  function getReactionDisplay(type) {
    const reaction = reactionOptions.find((option) => option.type === type);
    return reaction || { label: 'Like', emoji: '👍' };
  }

  async function handleReact(type) {
    try {
      if (reactionType === type) {
        await api.removeReaction(post.id);
        setReactionType(null);
        setLikeCount((prev) => Math.max(0, Number(prev) - 1));
        return;
      }

      const data = await api.reactToPost(post.id, type);
      setReactionType(type);

      const serverCount = Number(
        data?.reaction_count ??
        data?.post?.reaction_count ??
        data?.reactions ??
        data?.count
      );

      if (!Number.isNaN(serverCount)) {
        setLikeCount(serverCount);
      } else {
        setLikeCount((prev) => {
          const current = Number(prev) || 0;
          if (reactionType === null) return current + 1;
          return current;
        });
      }
    } catch (error) {
      console.error('Like error:', error);
    }
  }

  async function handleLikeToggle() {
    if (reactionType !== null) {
      return handleReact(reactionType);
    }
    return handleReact(0);
  }

  async function loadComments() {
    if (comments.length > 0) {
      setShowComments(!showComments);
      return;
    }

    try {
      setLoadingComments(true);
      const data = await api.getComments(post.id);
      setComments(data.comments);
      setShowComments(true);
    } catch (error) {
      console.error('Load comments error:', error);
    } finally {
      setLoadingComments(false);
    }
  }

  async function handleAddComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;

    try {
      const data = await api.addComment(post.id, commentText);
      const newComment = {
        ...data.comment,
        username: user.username,
        profile_image: user.profileImage
      };
      setComments([...comments, newComment]);
      setCommentText('');
    } catch (error) {
      console.error('Add comment error:', error);
    }
  }

  async function handleDelete() {
    if (confirm('Delete this post?')) {
      try {
        await api.deletePost(post.id);
        if (onDelete) onDelete(post.id);
      } catch (error) {
        console.error('Delete error:', error);
      }
    }
  }

  return (
    <div className="post-card">
      <div className="post-header">
        <Link to={`/profile/${encodeURIComponent(post.username || 'unknown')}`} className="post-author">
          {getAvatar(post.profile_image, post.username, 'author-avatar')}
          <div className="author-info">
            <div className="author-name">{post.username || 'Anonymous'}</div>
            <div className="post-time">{formatDate(post.created_at)}</div>
          </div>
        </Link>
        {isOwner && (
          <button className="delete-button" onClick={handleDelete}>🗑️</button>
        )}
      </div>

      <div className="post-content">{post.content}</div>

      {post.image_url && (
        <div className="post-image">
          <img src={post.image_url} alt="Post" />
        </div>
      )}

      <div className="post-stats">
        <span>{likeCount} likes</span>
        <span>{post.comment_count || comments.length} comments</span>
      </div>

      <div className="post-actions">
        <div className="reaction-wrapper">
          <button
            className={`action-button ${reactionType !== null ? 'liked' : ''}`}
            onClick={handleLikeToggle}
          >
            {reactionType !== null ? (
              <>
                {getReactionDisplay(reactionType).emoji} {getReactionDisplay(reactionType).label}
              </>
            ) : (
              <>👍 Like</>
            )}
          </button>
          <div className="reaction-menu">
            {reactionOptions.map((option) => (
              <button
                key={option.type}
                className="reaction-item"
                onClick={() => handleReact(option.type)}
                title={option.label}
              >
                {option.emoji}
              </button>
            ))}
          </div>
        </div>
        <button className="action-button" onClick={loadComments}>
          💬 Comment
        </button>
        <button className="action-button">
          📤 Share
        </button>
      </div>

      {showComments && (
        <div className="comments-section">
          {loadingComments ? (
            <div className="loading-comments">Loading comments...</div>
          ) : comments.length === 0 ? (
            <div className="no-comments">No comments yet. Be the first!</div>
          ) : (
            comments.map(comment => (
              <div key={comment.id} className="comment">
                {getAvatar(comment.profile_image, comment.username, 'comment-avatar')}
                <div className="comment-content">
                  <div className="comment-header">
                    <span className="comment-author">{comment.username}</span>
                    <span className="comment-time">{formatDate(comment.created_at)}</span>
                  </div>
                  <p>{comment.content}</p>
                </div>
              </div>
            ))
          )}

          <form className="add-comment" onSubmit={handleAddComment}>
            <input
              type="text"
              placeholder="Write a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
            <button type="submit" disabled={!commentText.trim()}>
              Post
            </button>
          </form>
        </div>
      )}
    </div>
  );
}