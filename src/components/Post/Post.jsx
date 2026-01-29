// src/components/Post/Post.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import './Post.css';

export default function Post({ post, onDelete, onUpdate }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.reaction_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [commenting, setCommenting] = useState(false);
  
  const { user } = useAuth();
  const isOwner = user?.walletAddress === post.author_address;

  async function handleLike() {
    try {
      if (liked) {
        await api.removeReaction(post.id);
        setLiked(false);
        setLikeCount(likeCount - 1);
      } else {
        await api.reactToPost(post.id, 0); // 0 = like
        setLiked(true);
        setLikeCount(likeCount + 1);
      }
    } catch (error) {
      console.error('React error:', error);
      alert('Failed to react to post');
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
      await api.deletePost(post.id);
      onDelete(post.id);
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete post');
    }
  }

  async function loadComments() {
    if (comments.length > 0) {
      setShowComments(!showComments);
      return;
    }

    setLoadingComments(true);
    try {
      const data = await api.getComments(post.id);
      setComments(data.comments || []);
      setShowComments(true);
    } catch (error) {
      console.error('Load comments error:', error);
    } finally {
      setLoadingComments(false);
    }
  }

  async function handleAddComment(e) {
    e.preventDefault();
    if (!newComment.trim()) return;

    setCommenting(true);
    try {
      const data = await api.addComment(post.id, newComment.trim());
      const commentWithUser = {
        ...data.comment,
        username: user.username,
        profile_image: user.profileImage
      };
      setComments([...comments, commentWithUser]);
      setNewComment('');
      
      // Update post comment count
      if (onUpdate) {
        onUpdate({
          ...post,
          comment_count: (post.comment_count || 0) + 1
        });
      }
    } catch (error) {
      console.error('Add comment error:', error);
      alert('Failed to add comment');
    } finally {
      setCommenting(false);
    }
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // seconds

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    
    return date.toLocaleDateString();
  }

  return (
    <div className="post-card">
      <div className="post-header">
        <Link to={`/profile/${post.author_address}`} className="post-author">
          <div className="author-avatar">
            {post.username?.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="author-info">
            <div className="author-name">{post.username || 'Anonymous'}</div>
            <div className="post-time">{formatDate(post.created_at)}</div>
          </div>
        </Link>

        {isOwner && (
          <button onClick={handleDelete} className="delete-button" title="Delete post">
            🗑️
          </button>
        )}
      </div>

      <div className="post-content">
        {post.content}
      </div>

      {post.image_url && (
        <div className="post-image">
          <img src={post.image_url} alt="Post" />
        </div>
      )}

      <div className="post-stats">
        <span>{likeCount} {likeCount === 1 ? 'like' : 'likes'}</span>
        <span>{post.comment_count || 0} {post.comment_count === 1 ? 'comment' : 'comments'}</span>
      </div>

      <div className="post-actions">
        <button 
          onClick={handleLike}
          className={`action-button ${liked ? 'liked' : ''}`}
        >
          👍 {liked ? 'Liked' : 'Like'}
        </button>
        
        <button 
          onClick={loadComments}
          className="action-button"
        >
          💬 Comment
        </button>
        
        <button className="action-button">
          🔄 Share
        </button>
      </div>

      {showComments && (
        <div className="comments-section">
          {loadingComments ? (
            <div className="loading-comments">Loading comments...</div>
          ) : (
            <>
              <div className="comments-list">
                {comments.length === 0 ? (
                  <p className="no-comments">No comments yet. Be the first!</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="comment">
                      <div className="comment-avatar">
                        {comment.username?.charAt(0).toUpperCase() || '?'}
                      </div>
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
              </div>

              <form onSubmit={handleAddComment} className="add-comment">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  disabled={commenting}
                />
                <button type="submit" disabled={commenting || !newComment.trim()}>
                  {commenting ? '...' : 'Post'}
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
