// src/services/api.js
import axios from 'axios';

const API_URL = 'https://api.hyvechain.com';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const api = {
  // Auth
  login: async (walletAddress, signature) => {
    const response = await apiClient.post('/auth/login', {
      wallet_address: walletAddress,
      signature,
    });
    return response.data;
  },

  register: async (walletAddress, username) => {
    const response = await apiClient.post('/auth/register', {
      wallet_address: walletAddress,
      username,
    });
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  // Users
  getUsers: async () => {
    const response = await apiClient.get('/users');
    return response.data;
  },

  getUserByAddress: async (address) => {
    const response = await apiClient.get(`/users/${address}`);
    return response.data;
  },

  updateProfile: async (username, bio, profileImage) => {
    const response = await apiClient.put('/users/profile', {
      username,
      bio,
      profile_image: profileImage,
    });
    return response.data;
  },

  searchUsers: async (query) => {
    const response = await apiClient.get(`/users/search?q=${encodeURIComponent(query)}`);
    return response.data;
  },

  // Posts
  createPost: async (content, imageUrl = null) => {
    const response = await apiClient.post('/posts', {
      content,
      image_url: imageUrl,
    });
    return response.data;
  },

  getPosts: async () => {
    const response = await apiClient.get('/posts');
    return response.data;
  },

  getPostsByUser: async (address) => {
    const response = await apiClient.get(`/posts/user/${address}`);
    return response.data;
  },

  deletePost: async (postId) => {
    const response = await apiClient.delete(`/posts/${postId}`);
    return response.data;
  },

  // Reactions
  reactToPost: async (postId, reactionType) => {
    const response = await apiClient.post(`/posts/${postId}/reactions`, {
      reaction_type: reactionType,
    });
    return response.data;
  },

  removeReaction: async (postId) => {
    const response = await apiClient.delete(`/posts/${postId}/reactions`);
    return response.data;
  },

  // Comments
  addComment: async (postId, content) => {
    const response = await apiClient.post(`/posts/${postId}/comments`, {
      content,
    });
    return response.data;
  },

  getComments: async (postId) => {
    const response = await apiClient.get(`/posts/${postId}/comments`);
    return response.data;
  },

  deleteComment: async (postId, commentId) => {
    const response = await apiClient.delete(`/posts/${postId}/comments/${commentId}`);
    return response.data;
  },

  // Following
  followUser: async (address) => {
    const response = await apiClient.post('/users/follow', {
      followed_address: address,
    });
    return response.data;
  },

  unfollowUser: async (address) => {
    const response = await apiClient.delete(`/users/follow/${address}`);
    return response.data;
  },

  getFollowers: async () => {
    const response = await apiClient.get('/users/followers');
    return response.data;
  },

  getFollowing: async () => {
    const response = await apiClient.get('/users/following');
    return response.data;
  },
};

export default api;