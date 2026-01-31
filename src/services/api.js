// src/services/api.js
const API_URL = process.env.REACT_APP_API_URL || 'https://social-api.hyvechain.com';

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

export async function createPost(content, imageFile = null) {
  const token = localStorage.getItem('token');
  
  const postData = {
    content: content,
  };
  
  if (imageFile) {
    const base64 = await fileToBase64(imageFile);
    postData.imageUrl = base64;
  }

  const response = await fetch(`${API_URL}/api/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(postData),
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

async function handleDeletePhoto(photoId) {
  if (!confirm('Delete this photo?')) return;

  try {
    await api.deleteAlbumPhoto(selectedAlbum.id, photoId);
    // Reload album photos
    const data = await api.getAlbumPhotos(selectedAlbum.id);
    setSelectedAlbum({ ...selectedAlbum, photos: data.photos });
  } catch (error) {
    console.error('Delete photo error:', error);
  }
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
  
  // Friend Requests
  getFriendRequests,
  acceptFriendRequest,
  declineFriendRequest,
  
  // Albums
  getAlbums,
  createAlbum,
  getAlbumPhotos,
  uploadToAlbum,
  deleteAlbumPhoto,
  deleteAlbum,
};