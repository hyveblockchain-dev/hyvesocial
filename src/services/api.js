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
  return response.json();
}

export async function login(walletAddress, signature) {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ address: walletAddress, signature }),
  });
  return response.json();
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
  return response.json();
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
  
  const response = await fetch(`${API_URL}/api/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });
  return response.json();
}

// ========================================
// POST FUNCTIONS
// ========================================

export async function getPosts() {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/posts`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function createPost(content, imageFile = null, videoUrl = '') {
  const token = localStorage.getItem('token');

  let normalizedContent = content;
  let normalizedImageFile = imageFile;
  let normalizedVideoUrl = videoUrl;
  let preEncodedImage = null;

  if (typeof content === 'object' && content !== null) {
    normalizedContent = content.content || '';
    normalizedImageFile = content.imageFile || null;
    normalizedVideoUrl = content.videoUrl || content.video_url || '';
    preEncodedImage = content.imageUrl || content.image_url || null;
  }

  const postData = {
    content: normalizedContent,
  };
  
  if (preEncodedImage) {
    postData.imageUrl = preEncodedImage;
  } else if (normalizedImageFile) {
    const base64 = await fileToBase64(normalizedImageFile);
    postData.imageUrl = base64;
  }

  if (normalizedVideoUrl) {
    postData.videoUrl = normalizedVideoUrl;
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

export async function addComment(postId, content) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/posts/${postId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ content }),
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

// ========================================
// FOLLOW FUNCTIONS
// ========================================

export async function followUser(address) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/follow/${address}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function unfollowUser(address) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/follow/${address}`, {
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
  const address = userData.user?.walletAddress;
  
  if (!address) return { following: [] };
  
  const response = await fetch(`${API_URL}/api/following/${address}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function getFollowers(address) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/followers/${address}`, {
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

export async function createStory({ file, mediaType }) {
  const token = localStorage.getItem('token');
  const base64 = await fileToBase64(file);
  const response = await fetch(`${API_URL}/api/stories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ media: base64, mediaType: mediaType || 'image' }),
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

export async function getBlockedUsers() {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/blocked`, {
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

  try {
    return response.json();
  } catch (error) {
    return { blocked: [] };
  }
}

// ========================================
// ALBUM FUNCTIONS
// ========================================

export async function getAlbums(walletAddress) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/albums/user/${walletAddress}`, {
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

export async function getMessages(address) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/messages/${address}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function sendMessage(toAddress, content) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ toAddress, content }),
  });
  return response.json();
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
  createPost,
  deletePost,
  
  // Reactions
  reactToPost,
  removeReaction,
  
  // Comments
  getComments,
  addComment,
  deleteComment,
  
  // Follow
  followUser,
  unfollowUser,
  getFollowing,
  getFollowers,
  
  // Stories
  getStories,
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
  getBlockedUsers,
  
  // Albums
  getAlbums,
  createAlbum,
  getAlbumPhotos,
  uploadToAlbum,
  deleteAlbumPhoto,
  updateAlbumPhotoCaption,
  deleteAlbum,

  // Chat/Messages
  getMessages,
  sendMessage,
};