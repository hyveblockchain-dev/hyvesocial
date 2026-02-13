// src/utils/notifications.js

function normalizeType(rawType, payload) {
  const value = String(rawType || '').toLowerCase();
  if (value.includes('friend_request')) return 'friend_request';
  if (value.includes('friend_accepted')) return 'friend_accepted';
  if (value.includes('mention') || value.includes('tagged')) return 'post_mention';
  if (value.includes('reply')) return 'comment_reply';
  if (value.includes('comment')) return 'post_comment';
  if (value.includes('reaction')) return 'reaction';
  if (value.includes('follow')) return 'follow';

  if (
    payload?.parentCommentId ||
    payload?.parent_comment_id ||
    payload?.comment?.parent_comment_id
  ) {
    return 'comment_reply';
  }

  return value || 'notification';
}

function extractActor(payload) {
  const candidate =
    payload.user ||
    payload.fromUser ||
    payload.from ||
    payload.sender ||
    payload.actor ||
    payload.by ||
    payload.author ||
    payload.initiator;

  if (candidate && typeof candidate === 'object') {
    return candidate;
  }

  const username =
    payload.username ||
    payload.fromUsername ||
    payload.from_user ||
    payload.senderUsername ||
    payload.userName ||
    payload.actorUsername;

  const profile_image =
    payload.profile_image ||
    payload.profileImage ||
    payload.avatar ||
    payload.avatarUrl ||
    payload.avatar_url;

  if (username || profile_image) {
    return { username, profile_image, profileImage: payload.profileImage };
  }

  return null;
}

export function normalizeNotification(payload, fallbackType) {
  if (!payload) return null;

  const raw = typeof payload === 'object' ? payload : { message: String(payload) };
  const rawType = raw.type || raw.notificationType || raw.notification_type || raw.event || fallbackType;
  const type = normalizeType(rawType, raw);
  const createdAt =
    raw.createdAt ||
    raw.created_at ||
    raw.timestamp ||
    raw.time ||
    new Date().toISOString();

  const post = raw.post || raw.postData || raw.post_item || {};
  const comment = raw.comment || raw.commentData || raw.comment_item || {};

  const postId =
    raw.postId ||
    raw.post_id ||
    post.id ||
    raw.targetPostId ||
    raw.target_post_id;

  const commentId =
    raw.commentId ||
    raw.comment_id ||
    comment.id ||
    raw.targetCommentId ||
    raw.target_comment_id;

  const parentCommentId =
    raw.parentCommentId ||
    raw.parent_comment_id ||
    comment.parent_comment_id;

  const postContent =
    raw.postContent ||
    raw.post_text ||
    raw.post_body ||
    post.content ||
    null;

  const commentContent =
    raw.commentContent ||
    raw.comment_text ||
    raw.comment_body ||
    raw.replyContent ||
    raw.reply_text ||
    comment.content ||
    ((type === 'post_comment' || type === 'comment_reply') ? raw.content : null) ||
    null;

  const recipient =
    raw.toUsername ||
    raw.to ||
    raw.recipient?.username ||
    raw.recipient ||
    raw.targetUser?.username ||
    raw.target?.username ||
    raw.owner?.username;

  const id =
    raw.id ||
    raw.notificationId ||
    raw.notification_id ||
    raw._id ||
    `${type}-${postId || commentId || 'general'}-${createdAt}`;

  return {
    id: String(id),
    type,
    createdAt,
    user: extractActor(raw),
    postId,
    postContent,
    commentId,
    commentContent,
    parentCommentId,
    recipient,
    raw
  };
}
