// src/services/api.js
import { API_URL } from '../utils/env';

let friendsByAddressSupported = true;

// Helper function to convert file to base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ========================================
// AUTH FUNCTIONS
// ========================================

export async function register(username, walletAddress, signature) {
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ address: walletAddress, signature, username }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Registration failed');
  return data;
}

export async function login(walletAddress, signature) {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ address: walletAddress, signature }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Login failed');
  return data;
}

export async function getCurrentUser() {
  const token = localStorage.getItem('token');
  if (!token) return null;

  const response = await fetch(`${API_URL}/api/auth/me`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    localStorage.removeItem('token');
    return null;
  }
  
  return response.json();
}

export async function linkEmail(email, emailPassword) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/auth/link-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ email, emailPassword }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to link email');
  return data;
}

export async function linkWallet(walletAddress, signature) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/auth/link-wallet`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ walletAddress, signature }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to link wallet');
  return data;
}

// ========================================
// USER FUNCTIONS
// ========================================

export async function getUsers() {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/search/users?q=`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function searchUsers(query) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/search/users?q=${encodeURIComponent(query)}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function getUserProfile(address) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/profile/${address}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to get profile');
  return data;
}

export async function getUserPosts(address) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/posts/user/${address}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function updateProfile(data) {
  const token = localStorage.getItem('token');
  
  // Convert FormData to JSON with base64 images
  const updates = {};
  
  if (data instanceof FormData) {
    for (let [key, value] of data.entries()) {
      if (value instanceof File) {
        // Convert file to base64
        const base64 = await fileToBase64(value);
        updates[key] = base64;
      } else {
        updates[key] = value;
      }
    }
  } else {
    Object.assign(updates, data);
  }
  
  console.log('updateProfile - sending data:', updates);
  
  const response = await fetch(`${API_URL}/api/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    const text = await response.text();
    console.error('updateProfile - error response:', text);
    throw new Error(text || 'Failed to update profile');
  }

  if (!contentType.includes('application/json')) {
    console.log('updateProfile - non-JSON response, returning success');
    return { success: true };
  }

  const result = await response.json();
  console.log('updateProfile - response:', result);
  return result;
}

// ========================================
// POST FUNCTIONS
// ========================================

export async function getPosts(options = {}) {
  const { limit, offset } = options || {};
  const token = localStorage.getItem('token');
  const params = new URLSearchParams();
  if (limit !== undefined && limit !== null) params.set('limit', String(limit));
  if (offset !== undefined && offset !== null) params.set('offset', String(offset));
  const url = params.toString() ? `${API_URL}/api/posts?${params}` : `${API_URL}/api/posts`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function getPublicPosts(options = {}) {
  const { limit, offset } = options || {};
  const token = localStorage.getItem('token');
  const params = new URLSearchParams();
  if (limit !== undefined && limit !== null) params.set('limit', String(limit));
  if (offset !== undefined && offset !== null) params.set('offset', String(offset));

  // Try dedicated public endpoint first
  try {
    const publicUrl = params.toString()
      ? `${API_URL}/api/posts/public?${params}`
      : `${API_URL}/api/posts/public`;
    const res = await fetch(publicUrl, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.ok) {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const data = await res.json();
        const posts = data.posts || data || [];
        if (Array.isArray(posts) && posts.length > 0) return { posts };
      }
    }
  } catch (_) {}

  // Fallback: fetch all posts and filter for public ones client-side
  const fallbackUrl = params.toString()
    ? `${API_URL}/api/posts?${params}`
    : `${API_URL}/api/posts`;
  const response = await fetch(fallbackUrl, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const data = await response.json();
  const allPosts = data.posts || data || [];
  const publicPosts = allPosts.filter(
    (p) => p.is_public === true || p.isPublic === true
  );
  return { posts: publicPosts };
}

export async function createPost(content, imageFile = null, videoUrl = '') {
  const token = localStorage.getItem('token');

  let normalizedContent = content;
  let normalizedImageFile = imageFile;
  let normalizedVideoUrl = videoUrl;
  let normalizedVideoFile = null;
  let preEncodedImage = null;
  let normalizedAllowShare = undefined;
  let normalizedGroupId = undefined;

  let normalizedMetadata = undefined;
  let normalizedIsPublic = undefined;

  if (typeof content === 'object' && content !== null) {
    normalizedContent = content.content || '';
    normalizedImageFile = content.imageFile || null;
    normalizedVideoUrl = content.videoUrl || content.video_url || '';
    normalizedVideoFile = content.videoFile || null;
    preEncodedImage = content.imageUrl || content.image_url || null;
    normalizedAllowShare =
      content.allowShare ?? content.allow_share ?? content.shareable ?? content.is_shareable;
    normalizedGroupId = content.groupId ?? content.group_id;
    normalizedMetadata = content.metadata || undefined;
    normalizedIsPublic = content.isPublic ?? content.is_public;
  }

  const postData = {
    content: normalizedContent,
  };

  if (normalizedGroupId !== undefined && normalizedGroupId !== null && normalizedGroupId !== '') {
    postData.groupId = normalizedGroupId;
  }
  
  if (preEncodedImage) {
    postData.imageUrl = preEncodedImage;
  } else if (normalizedImageFile) {
    const base64 = await fileToBase64(normalizedImageFile);
    postData.imageUrl = base64;
  }

  if (normalizedVideoUrl) {
    postData.videoUrl = normalizedVideoUrl;
  } else if (normalizedVideoFile) {
    const base64Video = await fileToBase64(normalizedVideoFile);
    postData.videoUrl = base64Video;
  }

  if (typeof normalizedAllowShare === 'boolean') {
    postData.allowShare = normalizedAllowShare;
    postData.allow_share = normalizedAllowShare;
  }

  if (normalizedMetadata && Object.keys(normalizedMetadata).length > 0) {
    postData.metadata = normalizedMetadata;
  }

  if (normalizedIsPublic === true) {
    postData.isPublic = true;
    postData.is_public = true;
  }

  const response = await fetch(`${API_URL}/api/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(postData),
  });
  if (!response.ok) {
    if (response.status === 413) {
      throw new Error('Image too large. Please choose a smaller image.');
    }
    const text = await response.text();
    throw new Error(text || 'Failed to create post');
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Unexpected response from server');
  }
  return response.json();
}

export async function getGroupPosts(groupId, options = {}) {
  const { limit, offset } = options || {};
  const token = localStorage.getItem('token');
  const params = new URLSearchParams();
  if (limit !== undefined && limit !== null) params.set('limit', String(limit));
  if (offset !== undefined && offset !== null) params.set('offset', String(offset));
  const url = params.toString()
    ? `${API_URL}/api/groups/${groupId}/posts?${params}`
    : `${API_URL}/api/groups/${groupId}/posts`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function approveGroupPost(groupId, postId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/groups/${groupId}/posts/${postId}/approve`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
}

export async function rejectGroupPost(groupId, postId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/groups/${groupId}/posts/${postId}/reject`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
}

export async function getGroupModeration(groupId, options = {}) {
  const token = localStorage.getItem('token');
  const params = new URLSearchParams();
  if (options?.status) params.set('status', String(options.status));
  if (options?.limit !== undefined && options?.limit !== null) params.set('limit', String(options.limit));
  if (options?.offset !== undefined && options?.offset !== null) params.set('offset', String(options.offset));
  const url = params.toString()
    ? `${API_URL}/api/groups/${groupId}/moderation?${params}`
    : `${API_URL}/api/groups/${groupId}/moderation`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
}

export async function getGroupActivity(groupId, options = {}) {
  const token = localStorage.getItem('token');
  const params = new URLSearchParams();
  if (options?.type) params.set('type', String(options.type));
  if (options?.limit !== undefined && options?.limit !== null) params.set('limit', String(options.limit));
  if (options?.offset !== undefined && options?.offset !== null) params.set('offset', String(options.offset));
  const url = params.toString()
    ? `${API_URL}/api/groups/${groupId}/activity?${params}`
    : `${API_URL}/api/groups/${groupId}/activity`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
}

export async function deletePost(postId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/posts/${postId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

// ========================================
// REACTION FUNCTIONS
// ========================================

export async function reactToPost(postId, reactionType) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/posts/${postId}/react`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ reactionType }),
  });
  return response.json();
}

export async function removeReaction(postId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/posts/${postId}/react`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

// ========================================
// COMMENT FUNCTIONS
// ========================================

export async function getComments(postId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/posts/${postId}/comments`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function addComment(postId, content, options = {}) {
  const { parentCommentId, imageFile } = options;
  let mediaUrl = null;
  if (imageFile) {
    mediaUrl = await fileToBase64(imageFile);
  }

  const normalizedContent = typeof content === 'string' ? content.trim() : '';
  const contentToSend = normalizedContent || (mediaUrl ? ' ' : '');

  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/posts/${postId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      content: contentToSend,
      parentCommentId,
      mediaUrl
    }),
  });
  return response.json();
}

export async function deleteComment(commentId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/comments/${commentId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function reactToComment(commentId, reactionType) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/comments/${commentId}/reactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ reactionType }),
  });
  return response.json();
}

export async function removeCommentReaction(commentId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/comments/${commentId}/reactions`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}
// ========================================
// FOLLOW FUNCTIONS
// ========================================

export async function followUser(username) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/follow/${username}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function unfollowUser(username) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/follow/${username}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function getFollowing() {
  const token = localStorage.getItem('token');
  
  // Get current user's address from token
  const userResponse = await fetch(`${API_URL}/api/auth/me`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!userResponse.ok) return { following: [] };
  
  const userData = await userResponse.json();
  const username = userData.user?.username;
  
  if (!username) return { following: [] };
  
  const response = await fetch(`${API_URL}/api/following/${username}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function getFollowers(username) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/followers/${username}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

// ========================================
// STORIES FUNCTIONS
// ========================================

export async function getStories() {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/stories`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return { stories: [] };
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return { stories: [] };
  }

  return response.json();
}

export async function getPublicStories() {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/stories/public`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return { stories: [] };
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return { stories: [] };
  }

  return response.json();
}

export async function createStory({ file, mediaType, text, isPublic }) {
  const token = localStorage.getItem('token');
  const base64 = await fileToBase64(file);
  const storyData = { media: base64, mediaType: mediaType || 'image', text };
  if (isPublic) {
    storyData.isPublic = true;
    storyData.is_public = true;
  }
  const response = await fetch(`${API_URL}/api/stories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(storyData),
  });

  if (!response.ok) {
    if (response.status === 413) {
      throw new Error('Story image too large. Please use a smaller image.');
    }
    const textResponse = await response.text();
    throw new Error(textResponse || 'Failed to create story');
  }

  return response.json();
}


export async function deleteStory(storyId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/stories/${storyId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const textResponse = await response.text();
    throw new Error(textResponse || 'Failed to delete story');
  }

  return response.json();
}

// ========================================
// FRIEND REQUEST FUNCTIONS
// ========================================

export async function getFriendRequests() {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/friend-requests`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function acceptFriendRequest(requestId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/friend-request/${requestId}/accept`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function declineFriendRequest(requestId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/friend-request/${requestId}/decline`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function sendFriendRequest(address) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/friend-request/${address}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function getFriendshipStatus(address) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/friendship-status/${address}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function getFriends() {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/friends`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function getGroups() {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/api/groups`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { error: 'Unexpected response from server' };
    }

    const data = await response.json();
    if (!response.ok) {
      return { error: data?.error || 'Failed to load groups' };
    }

    return data;
  } catch (error) {
    return { error: 'Failed to reach server' };
  }
}

export async function createGroup(payload) {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/api/groups`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload || {})
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { error: 'Unexpected response from server' };
    }

    const data = await response.json();
    if (!response.ok) {
      return { error: data?.error || 'Failed to create group' };
    }

    return data;
  } catch (error) {
    return { error: 'Failed to reach server' };
  }
}

export async function joinGroup(groupId) {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/api/groups/${groupId}/join`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { error: 'Unexpected response from server' };
    }

    const data = await response.json();
    if (!response.ok) {
      return { error: data?.error || 'Failed to join group' };
    }

    return data;
  } catch (error) {
    return { error: 'Failed to reach server' };
  }
}

export async function leaveGroup(groupId) {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/api/groups/${groupId}/leave`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { error: 'Unexpected response from server' };
    }

    const data = await response.json();
    if (!response.ok) {
      return { error: data?.error || 'Failed to leave group' };
    }

    return data;
  } catch (error) {
    return { error: 'Failed to reach server' };
  }
}

export async function getGroupMembers(groupId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/groups/${groupId}/members`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return { members: [] };
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return { members: [] };
  }

  try {
    return response.json();
  } catch (error) {
    return { members: [] };
  }
}

export async function getGroupById(groupId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/groups/${groupId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        return await response.json();
      } catch {
        // ignore
      }
    }
    return { error: 'Failed to load group' };
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return { error: 'Unexpected response from server' };
  }
  return response.json();
}

export async function updateGroup(groupId, payload) {
  const token = localStorage.getItem('token');
  const updates = {};

  if (payload instanceof FormData) {
    for (let [key, value] of payload.entries()) {
      if (value instanceof File) {
        const base64 = await fileToBase64(value);
        updates[key] = base64;
      } else {
        updates[key] = value;
      }
    }
  } else if (payload && typeof payload === 'object') {
    Object.assign(updates, payload);
  }

  if (updates.coverImage && !updates.cover_image) updates.cover_image = updates.coverImage;
  if (updates.cover_image && !updates.coverImage) updates.coverImage = updates.cover_image;
  if (updates.avatarImage && !updates.avatar_image) updates.avatar_image = updates.avatarImage;
  if (updates.avatar_image && !updates.avatarImage) updates.avatarImage = updates.avatar_image;

  const response = await fetch(`${API_URL}/api/groups/${groupId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates || {})
  });

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    if (contentType.includes('application/json')) {
      try {
        return await response.json();
      } catch {
        return { error: 'Failed to update group' };
      }
    }
    const text = await response.text();
    return { error: text || 'Failed to update group' };
  }

  if (!contentType.includes('application/json')) {
    return { success: true };
  }
  return response.json();
}

export async function getGroupJoinRequests(groupId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/groups/${groupId}/requests`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
}

export async function approveGroupJoinRequest(groupId, address) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/groups/${groupId}/requests/${address}/approve`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
}

export async function declineGroupJoinRequest(groupId, address) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/groups/${groupId}/requests/${address}/decline`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
}

export async function removeGroupMember(groupId, address) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/groups/${groupId}/members/${address}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
}

export async function setGroupMemberRole(groupId, address, role) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/groups/${groupId}/members/${address}/role`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ role })
  });
  return response.json();
}

export async function banGroupMember(groupId, address) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/groups/${groupId}/members/${address}/ban`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
}

export async function unbanGroupMember(groupId, address) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/groups/${groupId}/members/${address}/unban`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
}

export async function getGroupBans(groupId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/groups/${groupId}/bans`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
}

export async function deleteGroup(groupId) {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/api/groups/${groupId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
      if (contentType.includes('application/json')) {
        try { return await response.json(); } catch { /* fall through */ }
      }
      return { error: `Failed to delete group (${response.status})` };
    }
    if (!contentType.includes('application/json')) return { success: true };
    return response.json();
  } catch (err) {
    console.error('[api] deleteGroup fetch error:', err);
    return { error: err?.message || 'Network error' };
  }
}

export async function inviteToGroup(groupId, username) {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/api/groups/${groupId}/invite`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username })
    });
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
      if (contentType.includes('application/json')) {
        try { return await response.json(); } catch { /* fall through */ }
      }
      return { error: `Failed to invite user (${response.status})` };
    }
    if (!contentType.includes('application/json')) return { success: true };
    return response.json();
  } catch (err) {
    console.error('[api] inviteToGroup fetch error:', err);
    return { error: err?.message || 'Network error' };
  }
}

// ========================================
// DISCORD-LIKE CHANNEL FUNCTIONS
// ========================================

export async function getGroupChannels(groupId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/groups/${groupId}/channels`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!response.ok) return { categories: [], channels: [] };
  return response.json();
}

export async function createChannel(groupId, { name, categoryId, topic, type }) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/groups/${groupId}/channels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ name, categoryId, topic, type })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to create channel');
  return data;
}

export async function updateChannel(groupId, channelId, updates) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/groups/${groupId}/channels/${channelId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(updates)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to update channel');
  return data;
}

export async function deleteChannel(groupId, channelId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/groups/${groupId}/channels/${channelId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to delete channel');
  return data;
}

export async function createCategory(groupId, name) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/groups/${groupId}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ name })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to create category');
  return data;
}

export async function deleteCategory(groupId, catId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/groups/${groupId}/categories/${catId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to delete category');
  return data;
}

export async function getChannelMessages(channelId, { limit, before } = {}) {
  const token = localStorage.getItem('token');
  const params = new URLSearchParams();
  if (limit) params.append('limit', limit);
  if (before) params.append('before', before);
  const qs = params.toString();
  const response = await fetch(`${API_URL}/api/channels/${channelId}/messages${qs ? '?' + qs : ''}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!response.ok) return { messages: [] };
  return response.json();
}

export async function sendChannelMessage(channelId, { content, imageUrl, replyTo }) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ content, imageUrl, replyTo })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to send message');
  return data;
}

export async function editChannelMessage(channelId, messageId, content) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/channels/${channelId}/messages/${messageId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ content })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to edit message');
  return data;
}

export async function deleteChannelMessage(channelId, messageId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/channels/${channelId}/messages/${messageId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to delete message');
  return data;
}

// ========================================
// CUSTOM GROUP ROLES
// ========================================

export async function getGroupRoles(groupId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/groups/${groupId}/roles`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!response.ok) return { roles: [] };
  return response.json();
}

export async function createGroupRole(groupId, { name, color, permissions }) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/groups/${groupId}/roles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ name, color, permissions })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to create role');
  return data;
}

export async function updateGroupRole(groupId, roleId, updates) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/groups/${groupId}/roles/${roleId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(updates)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to update role');
  return data;
}

export async function deleteGroupRole(groupId, roleId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/groups/${groupId}/roles/${roleId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to delete role');
  return data;
}

export async function assignMemberRole(groupId, address, roleId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/groups/${groupId}/members/${address}/roles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ roleId })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to assign role');
  return data;
}

export async function removeMemberRole(groupId, address, roleId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/groups/${groupId}/members/${address}/roles/${roleId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to remove role');
  return data;
}

export async function getMembersWithRoles(groupId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/groups/${groupId}/members-with-roles`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!response.ok) return { members: [] };
  return response.json();
}

export async function getGroupOnlineMembers(groupId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/groups/${groupId}/online`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!response.ok) return { online: [], offline: [], onlineCount: 0, totalCount: 0 };
  return response.json();
}

export async function deleteAccount() {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/api/account`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
      if (contentType.includes('application/json')) {
        try { return await response.json(); } catch { /* fall through */ }
      }
      return { error: `Failed to delete account (${response.status})` };
    }
    if (!contentType.includes('application/json')) return { success: true };
    return response.json();
  } catch (err) {
    console.error('[api] deleteAccount fetch error:', err);
    return { error: err?.message || 'Network error' };
  }
}

export async function getPresence() {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/presence`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return { presence: [] };
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return { presence: [] };
  }

  try {
    return response.json();
  } catch (error) {
    return { presence: [] };
  }
}

export async function getFriendsByAddress(address) {
  if (!friendsByAddressSupported) {
    return { friends: [] };
  }
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/friends/${address}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (response.status === 404) {
    friendsByAddressSupported = false;
    return { friends: [] };
  }
  if (!response.ok) {
    return { friends: [] };
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return { friends: [] };
  }
  try {
    return response.json();
  } catch (error) {
    return { friends: [] };
  }
}

export async function removeFriend(address) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/friend/${address}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function blockUser(address) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/block/${address}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function unblockUser(address) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/block/${address}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function getBlockedUsers() {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${API_URL}/api/blocks`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return { blocked: [] };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { blocked: [] };
    }

    return response.json();
  } catch (error) {
    // Silently return empty if endpoint doesn't exist
    return { blocked: [] };
  }
}

// ========================================
// ALBUM FUNCTIONS
// ========================================

export async function getAlbums(identifier) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/albums/user/${identifier}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function createAlbum(name) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/albums`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ title: name }),
  });
  return response.json();
}

export async function getAlbumPhotos(albumId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/albums/${albumId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  const data = await response.json();
  return { photos: data.album?.photos || [] };
}

export async function uploadToAlbum(formData) {
  const token = localStorage.getItem('token');
  const albumId = formData.get('albumId');
  const image = formData.get('image');
  
  // Convert image to base64
  const base64 = await fileToBase64(image);
  
  const response = await fetch(`${API_URL}/api/albums/${albumId}/photos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ 
      photoUrl: base64,
      caption: ''
    }),
  });
  return response.json();
}

export async function deleteAlbumPhoto(albumId, photoId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/albums/${albumId}/photos/${photoId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function updateAlbumPhotoCaption(albumId, photoId, caption) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/albums/${albumId}/photos/${photoId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ caption }),
  });
  return response.json();
}

export async function deleteAlbum(albumId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/albums/${albumId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

// ========================================
// CHAT/MESSAGES FUNCTIONS
// ========================================

export async function setPublicKey(publicKey, encryptedPrivateKey, encryptedPrivateKeyNonce) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ publicKey, encryptedPrivateKey, encryptedPrivateKeyNonce }),
  });
  return response.json();
}

export async function getUserKey(username) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/keys/${encodeURIComponent(username)}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function getMyKey() {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/keys/self`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function getConversations() {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/conversations`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function getMessages(address) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/messages/${address}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function sendMessage(toAddress, content, imageUrl) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ toAddress, content, imageUrl }),
  });
  return response.json();
}

export async function editDmMessage(messageId, content) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/messages/${messageId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ content }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to edit message');
  return data;
}

export async function deleteDmMessage(messageId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/messages/${messageId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to delete message');
  return data;
}

// ========================================
// REPORTS & MODERATION
// ========================================

export async function submitReport({ contentType, contentId, reason, details }) {
  const response = await fetch(`${API_URL}/api/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
    body: JSON.stringify({ contentType, contentId, reason, details }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to submit report');
  return data;
}

export async function checkIsAdmin() {
  const response = await fetch(`${API_URL}/api/admin/check`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  const data = await response.json();
  return data.isAdmin;
}

export async function getReports(status = 'pending', limit = 50, offset = 0) {
  const response = await fetch(`${API_URL}/api/admin/reports?status=${status}&limit=${limit}&offset=${offset}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to get reports');
  return data;
}

export async function getReportDetail(reportId) {
  const response = await fetch(`${API_URL}/api/admin/reports/${reportId}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to get report details');
  return data;
}

export async function actionReport(reportId, action, adminNotes = '') {
  const response = await fetch(`${API_URL}/api/admin/reports/${reportId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
    body: JSON.stringify({ action, adminNotes }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to process report');
  return data;
}

export async function getReportCounts() {
  const response = await fetch(`${API_URL}/api/admin/reports/counts`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to get counts');
  return data;
}

// ========================================
// ADMIN: BAN & USER MANAGEMENT
// ========================================

export async function adminBanDeleteUser(walletAddress, reason) {
  const response = await fetch(`${API_URL}/api/admin/users/${walletAddress}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
    body: JSON.stringify({ reason }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to ban user');
  return data;
}

export async function adminCheckBanned(walletAddress) {
  const response = await fetch(`${API_URL}/api/admin/banned/${walletAddress}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to check ban status');
  return data;
}

export async function adminGetBannedWallets() {
  const response = await fetch(`${API_URL}/api/admin/banned`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to get banned wallets');
  return data;
}

export async function adminUnbanWallet(walletAddress) {
  const response = await fetch(`${API_URL}/api/admin/banned/${walletAddress}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to unban wallet');
  return data;
}

// ========================================
// DEFAULT EXPORT
// ========================================

export default {
  // Auth
  register,
  login,
  getCurrentUser,
  
  // Users
  getUsers,
  searchUsers,
  getUserProfile,
  getUserPosts,
  updateProfile,
  
  // Posts
  getPosts,
  getPublicPosts,
  getGroupPosts,
  approveGroupPost,
  rejectGroupPost,
  getGroupModeration,
  getGroupActivity,
  createPost,
  deletePost,
  
  // Reactions
  reactToPost,
  removeReaction,
  
  // Comments
  getComments,
  addComment,
  deleteComment,
  reactToComment,
  removeCommentReaction,
  
  // Follow
  followUser,
  unfollowUser,
  getFollowing,
  getFollowers,
  
  // Stories
  getStories,
  getPublicStories,
  createStory,
  deleteStory,
  
  // Friend Requests
  getFriendRequests,
  acceptFriendRequest,
  declineFriendRequest,
  sendFriendRequest,
  getFriendshipStatus,
  getFriends,
  getFriendsByAddress,
  removeFriend,
  blockUser,
  unblockUser,
  getBlockedUsers,
  
  // Albums
  getAlbums,
  createAlbum,
  getAlbumPhotos,
  uploadToAlbum,
  deleteAlbumPhoto,
  updateAlbumPhotoCaption,
  deleteAlbum,

  // Groups
  getGroups,
  getGroupById,
  updateGroup,
  createGroup,
  joinGroup,
  leaveGroup,
  getGroupMembers,
  getGroupJoinRequests,
  approveGroupJoinRequest,
  declineGroupJoinRequest,
  removeGroupMember,
  setGroupMemberRole,
  banGroupMember,
  unbanGroupMember,
  getGroupBans,
  deleteGroup,
  inviteToGroup,

  // Discord-like Channels
  getGroupChannels,
  createChannel,
  updateChannel,
  deleteChannel,
  createCategory,
  deleteCategory,
  getChannelMessages,
  sendChannelMessage,
  editChannelMessage,
  deleteChannelMessage,

  // Custom Group Roles
  getGroupRoles,
  createGroupRole,
  updateGroupRole,
  deleteGroupRole,
  assignMemberRole,
  removeMemberRole,
  getMembersWithRoles,
  getGroupOnlineMembers,

  // Account
  deleteAccount,

  // Account Linking
  linkEmail,
  linkWallet,

  // Chat/Messages
  getConversations,
  getMessages,
  sendMessage,
  editDmMessage,
  deleteDmMessage,
  setPublicKey,
  getUserKey,
  getMyKey,

  // Reports & Moderation
  submitReport,
  checkIsAdmin,
  getReports,
  getReportDetail,
  actionReport,
  getReportCounts,

  // Admin: Ban & User Management
  adminBanDeleteUser,
  adminCheckBanned,
  adminGetBannedWallets,
  adminUnbanWallet,
};