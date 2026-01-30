// src/services/api.js
import axios from 'axios';

const API_URL = 'https://social-api.hyvechain.com/api';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
      address: walletAddress,
      signature,
    });
    return response.data;
  },

  register: async (walletAddress, username) => {
    // First login to get token
    const loginResponse = await apiClient.post('/auth/login', {
      address: walletAddress,
    });
    
    // Then create profile
    const token = loginResponse.data.token;
    const profileResponse = await axios.post(
      `${API_URL}/profile`,
      { username },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    return {
      token,
      user: profileResponse.data.user
    };
  },

  getCurrentUser: async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) throw new Error('No token');
    
    // Decode JWT to get wallet address
    const payload = JSON.parse(atob(token.split('.')[1]));
    const address = payload.walletAddress;
    
    const response = await apiClient.get(`/profile/${address}`);
    return response.data;
  },

  // Users
  getUsers: async () => {
    const response = await apiClient.get('/search/users?q=');
    return response.data;
  },

  getUserByAddress: async (address) => {
    const response = await apiClient.get(`/profile/${address}`);
    return response.data;
  },

  updateProfile: async (username, bio, profileImage) => {
    const response = await apiClient.put('/profile', {
      username,
      bio,
      profileImage,
    });
    return response.data;
  },

  searchUsers: async (query) => {
    const response = await apiClient.get(`/search/users?q=${encodeURIComponent(query)}`);
    return response.data;
  },

  // Posts
  createPost: async (content, imageUrl = null) => {
    const response = await apiClient.post('/posts', {
      content,
      imageUrl,
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
    const response = await apiClient.post(`/posts/${postId}/react`, {
      reactionType,
    });
    return response.data;
  },

  removeReaction: async (postId) => {
    const response = await apiClient.delete(`/posts/${postId}/react`);
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
    const response = await apiClient.delete(`/comments/${commentId}`);
    return response.data;
  },

  // Following
  followUser: async (address) => {
    const response = await apiClient.post(`/follow/${address}`);
    return response.data;
  },

  unfollowUser: async (address) => {
    const response = await apiClient.delete(`/follow/${address}`);
    return response.data;
  },

  getFollowers: async (address) => {
    const response = await apiClient.get(`/followers/${address}`);
    return response.data;
  },

  getFollowing: async (address) => {
    const response = await apiClient.get(`/following/${address}`);
    return response.data;
  },
};

export default api;