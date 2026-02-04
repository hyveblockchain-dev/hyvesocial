// src/components/Post/Post.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { parseDateValue, formatDate } from '../../utils/date';
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

export default function Post({ post, onDelete, onUpdate, onShare }) {
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
  const [commentImage, setCommentImage] = useState(null);
  const [commentPreview, setCommentPreview] = useState('');
  const [showCommentEmoji, setShowCommentEmoji] = useState(false);
  const [replyOpen, setReplyOpen] = useState({});
  const [replyText, setReplyText] = useState({});
  const [replyImage, setReplyImage] = useState({});
  const [replyPreview, setReplyPreview] = useState({});
  const [replyEmojiOpen, setReplyEmojiOpen] = useState({});
  const [commentReactions, setCommentReactions] = useState({});
  const [commentReactionCounts, setCommentReactionCounts] = useState({});
  const [showReactionMenu, setShowReactionMenu] = useState(false);

  const MAX_COMMENT_IMAGE_MB = 5;

  const isOwner = (post.username || post.author_username || post.user?.username) === user?.username;

  function extractTimestamp(item) {
    if (!item) return null;
    return (
      item.created_at ||
      item.createdAt ||
      item.created ||
      item.created_on ||
      item.createdOn ||
      item.updated_at ||
      item.updatedAt ||
      item.updated_on ||
      item.updatedOn ||
      item.posted_at ||
      item.postedAt ||
      item.published_at ||
      item.publishedAt ||
      item.timestamp ||
      item.time ||
      item.date ||
      item._id ||
      item.id
    );
  }

  function formatRelativeTime(value) {
    const date = parseDateValue(value);
    if (!date) return '';
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return formatDate(date);
  }

  const reactionOptions = [
    { type: 0, label: 'Like', emoji: '👍' },
    { type: 1, label: 'Love', emoji: '❤️' },
    { type: 2, label: 'Haha', emoji: '😂' },
    { type: 3, label: 'Wow', emoji: '😮' },
    { type: 4, label: 'Sad', emoji: '😢' },
    { type: 5, label: 'Angry', emoji: '😡' }
  ];

  const emojiOptions = ['😀','😄','😁','😅','😂','😍','🥳','😎','😮','😢','😡','👍','❤️'];

  function getReactionDisplay(type) {
    const reaction = reactionOptions.find((option) => option.type === type);
    return reaction || { label: 'Like', emoji: '👍' };
  }

  async function handleReact(type, options = {}) {
    try {
      if (reactionType === type) {
        await api.removeReaction(post.id);
        setReactionType(null);
        setLikeCount((prev) => Math.max(0, Number(prev) - 1));
        if (options.closeMenu) {
          setShowReactionMenu(false);
        }
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

      if (options.closeMenu) {
        setShowReactionMenu(false);
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
      const loadedComments = data.comments || [];
      setComments(loadedComments);
      const loadedReactions = {};
      const loadedCounts = {};
      loadedComments.forEach((comment) => {
        if (comment.user_reaction !== undefined && comment.user_reaction !== null) {
          loadedReactions[comment.id] = Number(comment.user_reaction);
        }
        if (comment.reaction_count !== undefined && comment.reaction_count !== null) {
          loadedCounts[comment.id] = Number(comment.reaction_count);
        }
      });
      setCommentReactions(loadedReactions);
      setCommentReactionCounts(loadedCounts);
      setShowComments(true);
    } catch (error) {
      console.error('Load comments error:', error);
    } finally {
      setLoadingComments(false);
    }
  }

  async function handleAddComment(e) {
    e.preventDefault();
    if (!commentText.trim() && !commentImage) return;

    try {
      const contentToSend = commentText.trim() ? commentText : (commentImage ? ' ' : '');
      const data = await api.addComment(post.id, contentToSend, { imageFile: commentImage });
      const newComment = {
        ...data.comment,
        username: user.username,
        profile_image: user.profileImage
      };
      setComments([...comments, newComment]);
      setCommentText('');
      setCommentImage(null);
      setCommentPreview('');
      setShowCommentEmoji(false);
    } catch (error) {
      console.error('Add comment error:', error);
    }
  }

  async function handleReply(commentId) {
    const text = replyText[commentId] || '';
    const imageFile = replyImage[commentId] || null;
    if (!text.trim() && !imageFile) return;

    try {
      const contentToSend = text.trim() ? text : (imageFile ? ' ' : '');
      const data = await api.addComment(post.id, contentToSend, { parentCommentId: commentId, imageFile });
      const newReply = {
        ...data.comment,
        username: user.username,
        profile_image: user.profileImage
      };
      setComments((prev) => [...prev, newReply]);
      setReplyText((prev) => ({ ...prev, [commentId]: '' }));
      setReplyImage((prev) => ({ ...prev, [commentId]: null }));
      setReplyPreview((prev) => ({ ...prev, [commentId]: '' }));
      setReplyEmojiOpen((prev) => ({ ...prev, [commentId]: false }));
    } catch (error) {
      console.error('Add reply error:', error);
    }
  }

  async function handleCommentReact(commentId, type) {
    try {
      const current = commentReactions[commentId];
      if (current === type) {
        await api.removeCommentReaction(commentId);
        setCommentReactions((prev) => ({ ...prev, [commentId]: null }));
        setCommentReactionCounts((prev) => ({
          ...prev,
          [commentId]: Math.max(0, Number(prev[commentId] || 0) - 1)
        }));
        return;
      }

      const data = await api.reactToComment(commentId, type);
      setCommentReactions((prev) => ({ ...prev, [commentId]: type }));
      const serverCount = Number(
        data?.reaction_count ??
        data?.comment?.reaction_count ??
        data?.count
      );
      if (!Number.isNaN(serverCount)) {
        setCommentReactionCounts((prev) => ({ ...prev, [commentId]: serverCount }));
      } else if (current == null) {
        setCommentReactionCounts((prev) => ({
          ...prev,
          [commentId]: Number(prev[commentId] || 0) + 1
        }));
      }
    } catch (error) {
      console.error('Comment reaction error:', error);
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

  const rawShareFlag =
    post.allow_share ??
    post.allowShare ??
    post.shareable ??
    post.is_shareable;
  const isShareable = rawShareFlag !== false;

  async function handleShare() {
    if (!isShareable) {
      alert('Sharing is disabled for this post.');
      return;
    }

    try {
      const baseText = post.content?.trim();
      const sharedContent = baseText
        ? `Shared from @${post.username || 'user'}: ${baseText}`
        : `Shared a post from @${post.username || 'user'}`;
      const data = await api.createPost({
        content: sharedContent,
        imageUrl: post.image_url || null,
        videoUrl: post.video_url || '',
        allowShare: false
      });

      if (onShare && data?.post) {
        onShare({
          ...data.post,
          username: user?.username,
          profile_image: user?.profileImage,
          reaction_count: 0,
          comment_count: 0,
          image_url: data.post?.image_url || post.image_url || '',
          video_url: data.post?.video_url || post.video_url || ''
        });
      }
    } catch (error) {
      console.error('Share post error:', error);
      alert('Failed to share post');
    }
  }

  function renderReplies(parentId, depth) {
    return comments
      .filter((reply) => reply.parent_comment_id === parentId)
      .map((reply) => renderCommentItem(reply, depth));
  }

  function renderCommentItem(comment, depth = 0) {
    const isReply = depth > 0;
    const indentStyle = depth > 1 ? { marginLeft: depth * 24 } : undefined;
    const contentText = comment?.content?.trim?.() ? comment.content : '';

    return (
      <div key={comment.id} className={`comment${isReply ? ' reply' : ''}`} style={indentStyle}>
        {getAvatar(comment.profile_image, comment.username, 'comment-avatar')}
        <div className="comment-content">
          <div className="comment-header">
            <span className="comment-author">{comment.username}</span>
            <span className="comment-time">{formatRelativeTime(extractTimestamp(comment))}</span>
          </div>
          {contentText && <p>{contentText}</p>}
          {comment.media_url && (
            <div className="comment-media">
              <img src={comment.media_url} alt="Comment media" />
            </div>
          )}
          <div className="comment-actions">
            <div className="reaction-wrapper">
              <button
                className={`action-button ${commentReactions[comment.id] != null ? 'liked' : ''}`}
                onClick={() => handleCommentReact(comment.id, commentReactions[comment.id] ?? 0)}
              >
                {commentReactions[comment.id] != null ? (
                  <>
                    {getReactionDisplay(commentReactions[comment.id]).emoji}{' '}
                    {getReactionDisplay(commentReactions[comment.id]).label}
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
                    onClick={() => handleCommentReact(comment.id, option.type)}
                    title={option.label}
                  >
                    {option.emoji}
                  </button>
                ))}
              </div>
            </div>
            <button
              className="comment-reply-btn"
              onClick={() => setReplyOpen((prev) => ({ ...prev, [comment.id]: !prev[comment.id] }))}
            >
              Reply
            </button>
            {commentReactionCounts[comment.id] > 0 && (
              <span className="comment-reaction-count">
                {commentReactionCounts[comment.id]} reactions
              </span>
            )}
          </div>

          {replyOpen[comment.id] && (
            <div className="reply-box">
              <div className="reply-input">
                <input
                  type="text"
                  placeholder="Write a reply..."
                  value={replyText[comment.id] || ''}
                  onChange={(e) =>
                    setReplyText((prev) => ({ ...prev, [comment.id]: e.target.value }))
                  }
                />
                <div className="reply-actions">
                  <button
                    type="button"
                    className="emoji-btn"
                    onClick={() =>
                      setReplyEmojiOpen((prev) => ({ ...prev, [comment.id]: !prev[comment.id] }))
                    }
                  >
                    😊
                  </button>
                  <label className="upload-btn">
                    📷
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > MAX_COMMENT_IMAGE_MB * 1024 * 1024) {
                          alert(`Image too large. Max ${MAX_COMMENT_IMAGE_MB}MB.`);
                          return;
                        }
                        setReplyImage((prev) => ({ ...prev, [comment.id]: file }));
                        setReplyPreview((prev) => ({
                          ...prev,
                          [comment.id]: URL.createObjectURL(file)
                        }));
                      }}
                      style={{ display: 'none' }}
                    />
                  </label>
                  <button type="button" className="btn-primary" onClick={() => handleReply(comment.id)}>
                    Reply
                  </button>
                </div>
              </div>
              {replyEmojiOpen[comment.id] && (
                <div className="emoji-picker">
                  {emojiOptions.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="emoji-btn"
                      onClick={() => {
                        setReplyText((prev) => ({
                          ...prev,
                          [comment.id]: `${prev[comment.id] || ''}${emoji}`
                        }));
                        setReplyEmojiOpen((prev) => ({ ...prev, [comment.id]: false }));
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
              {replyPreview[comment.id] && (
                <div className="comment-media">
                  <img src={replyPreview[comment.id]} alt="Reply preview" />
                </div>
              )}
            </div>
          )}

          <div className="reply-list">
            {renderReplies(comment.id, depth + 1)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="post-card">
      <div className="post-header">
        <Link to={`/profile/${encodeURIComponent(post.username || 'unknown')}`} className="post-author">
          {getAvatar(post.profile_image, post.username, 'author-avatar')}
          <div className="author-info">
            <div className="author-name">{post.username || 'Anonymous'}</div>
            <div className="post-time">{formatRelativeTime(extractTimestamp(post))}</div>
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

      {post.video_url && (
        <div className="post-video">
          <video controls src={post.video_url} />
        </div>
      )}

      <div className="post-stats">
        <span className="reaction-summary">
          {reactionType !== null && (
            <span className="reaction-emoji">{getReactionDisplay(reactionType).emoji}</span>
          )}
          {likeCount} likes
        </span>
        <span>{post.comment_count || comments.length} comments</span>
      </div>

      <div className="post-actions">
        <div
          className={`reaction-wrapper${showReactionMenu ? ' open' : ''}`}
          onMouseEnter={() => setShowReactionMenu(true)}
          onMouseLeave={() => setShowReactionMenu(false)}
          onFocus={() => setShowReactionMenu(true)}
          onBlur={() => setShowReactionMenu(false)}
        >
          <button
            className={`action-button ${reactionType !== null ? 'liked' : ''}`}
            onClick={() => {
              if (!showReactionMenu) {
                setShowReactionMenu(true);
                return;
              }
              handleLikeToggle();
            }}
          >
            <>👍 Like</>
          </button>
          <div className="reaction-menu">
            {reactionOptions.map((option) => (
              <button
                key={option.type}
                className="reaction-item"
                onClick={() => handleReact(option.type, { closeMenu: true })}
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
        <button
          className="action-button"
          onClick={handleShare}
          disabled={!isShareable}
          title={!isShareable ? 'Sharing disabled' : 'Share post'}
        >
          📤 Share
        </button>
      </div>

      {showComments && (
        <div className="comments-section">
          {loadingComments ? (
            <div className="comments-loading">Loading comments...</div>
          ) : (
            <>
              {comments
                .filter((comment) => !comment.parent_comment_id)
                .map((comment) => renderCommentItem(comment, 0))}
            </>
          )}

          <form className="add-comment" onSubmit={handleAddComment}>
            <div className="comment-input">
              <input
                type="text"
                placeholder="Write a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <div className="comment-actions">
                <button type="button" className="emoji-btn" onClick={() => setShowCommentEmoji((prev) => !prev)}>
                  😊
                </button>
                <label className="upload-btn">
                  📷
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > MAX_COMMENT_IMAGE_MB * 1024 * 1024) {
                        alert(`Image too large. Max ${MAX_COMMENT_IMAGE_MB}MB.`);
                        return;
                      }
                      setCommentImage(file);
                      setCommentPreview(URL.createObjectURL(file));
                    }}
                    style={{ display: 'none' }}
                  />
                </label>
                <button type="submit" disabled={!commentText.trim() && !commentImage}>
                  Post
                </button>
              </div>
            </div>
            {showCommentEmoji && (
              <div className="emoji-picker">
                {emojiOptions.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="emoji-btn"
                    onClick={() => {
                      setCommentText((prev) => `${prev}${emoji}`);
                      setShowCommentEmoji(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
            {commentPreview && (
              <div className="comment-media">
                <img src={commentPreview} alt="Comment preview" />
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
}