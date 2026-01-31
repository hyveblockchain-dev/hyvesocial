// src/services/api.js
const API_URL = process.env.REACT_APP_API_URL || 'https://social-api.hyvechain.com';

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
  const response = await fetch(`${API_URL}/api/users`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function searchUsers(query) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/users/search?q=${encodeURIComponent(query)}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function getUserProfile(address) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/users/${address}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function getUserPosts(address) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/users/${address}/posts`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function updateProfile(formData) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/users/profile`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
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

export async function createPost(content, imageFile = null) {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('content', content);
  if (imageFile) {
    formData.append('image', imageFile);
  }

  const response = await fetch(`${API_URL}/api/posts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
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
  const response = await fetch(`${API_URL}/api/users/${address}/follow`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function unfollowUser(address) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/users/${address}/follow`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function getFollowing() {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/users/following`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function getFollowers(address) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/users/${address}/followers`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

// ========================================
// ALBUM FUNCTIONS
// ========================================

export async function getAlbums(walletAddress) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/albums/${walletAddress}`, {
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
    body: JSON.stringify({ name }),
  });
  return response.json();
}

export async function getAlbumPhotos(albumId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/albums/${albumId}/photos`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function uploadToAlbum(formData) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/albums/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });
  return response.json();
}

export async function deleteAlbumPhoto(photoId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/api/albums/photos/${photoId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
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
  
  // Albums
  getAlbums,
  createAlbum,
  getAlbumPhotos,
  uploadToAlbum,
  deleteAlbumPhoto,
  deleteAlbum,
};