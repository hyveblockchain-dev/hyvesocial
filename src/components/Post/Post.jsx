// At the top of Post component, add helper function:
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

// Then in the JSX, replace the avatar sections:

// Post author avatar:
<Link to={`/profile/${post.author_address}`} className="post-author">
  {getAvatar(post.profile_image, post.username, 'author-avatar')}
  <div className="author-info">
    <div className="author-name">{post.username || 'Anonymous'}</div>
    <div className="post-time">{formatDate(post.created_at)}</div>
  </div>
</Link>

// Comment avatar:
{comments.map(comment => (
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
))}