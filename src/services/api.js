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
  // =====================
  // Auth
  // =====================
  login: async (walletAddress, signature) => {
    const response = await apiClient.post('/auth/login', {
      address: walletAddress,
      signature,
    });
    localStorage.setItem('auth_token', response.data.token);
    return response.data;
  },

  register: async (walletAddress, signature, username) => {
    const loginResponse = await apiClient.post('/auth/login', {
      address: walletAddress,
      signature,
    });

    const token = loginResponse.data.token;
    localStorage.setItem('auth_token', token);

    const profileResponse = await apiClient.post('/profile', { username });

    return {
      token,
      user: profileResponse.data.user,
    };
  },

  getCurrentUser: async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) throw new Error('No token');

    const payload = JSON.parse(atob(token.split('.')[1]));
    const address = payload.walletAddress;

    const response = await apiClient.get(`/profile/${address}`);
    return response.data;
  },

  // =====================
  // Users
  // =====================
  getUsers: async () => (await apiClient.get('/search/users?q=')).data,

  getProfile: async (address) =>
    (await apiClient.get(`/profile/${address}`)).data,

  updateProfile: async (formData) => {
    const response = await apiClient.put('/users/profile', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  searchUsers: async (query) =>
    (await apiClient.get(`/search/users?q=${encodeURIComponent(query)}`)).data,

  // =====================
  // Posts
  // =====================
  createPost: async (content, imageUrl = null) =>
    (await apiClient.post('/posts', { content, imageUrl })).data,

  getPosts: async () => (await apiClient.get('/posts')).data,

  getPostsByUser: async (address) =>
    (await apiClient.get(`/posts/user/${address}`)).data,

  deletePost: async (postId) =>
    (await apiClient.delete(`/posts/${postId}`)).data,

  // =====================
  // Reactions
  // =====================
  reactToPost: async (postId, reactionType) =>
    (await apiClient.post(`/posts/${postId}/react`, { reactionType })).data,

  removeReaction: async (postId) =>
    (await apiClient.delete(`/posts/${postId}/react`)).data,

  getReactions: async (postId) =>
    (await apiClient.get(`/posts/${postId}/reactions`)).data,

  // =====================
  // Comments
  // =====================
  addComment: async (postId, content) =>
    (await apiClient.post(`/posts/${postId}/comments`, { content })).data,

  getComments: async (postId) =>
    (await apiClient.get(`/posts/${postId}/comments`)).data,

  deleteComment: async (commentId) =>
    (await apiClient.delete(`/comments/${commentId}`)).data,

  // =====================
  // Friends
  // =====================
  sendFriendRequest: async (address) =>
    (await apiClient.post(`/friend-request/${address}`)).data,

  acceptFriendRequest: async (requestId) =>
    (await apiClient.post(`/friend-request/${requestId}/accept`)).data,

  declineFriendRequest: async (requestId) =>
    (await apiClient.post(`/friend-request/${requestId}/decline`)).data,

  getFriendRequests: async () =>
    (await apiClient.get('/friend-requests')).data,

  getFriends: async () => (await apiClient.get('/friends')).data,

  getFriendshipStatus: async (address) =>
    (await apiClient.get(`/friendship-status/${address}`)).data,

  removeFriend: async (address) =>
    (await apiClient.delete(`/friend/${address}`)).data,

  // =====================
  // Messages
  // =====================
  sendMessage: async (toAddress, content) =>
    (await apiClient.post('/messages', { toAddress, content })).data,

  getMessages: async (address) =>
    (await apiClient.get(`/messages/${address}`)).data,

  getConversations: async () =>
    (await apiClient.get('/conversations')).data,

  markMessagesAsRead: async (address) =>
    (await apiClient.put(`/messages/read/${address}`)).data,

  // =====================
  // Albums (NEW)
  // =====================
  getAlbums: async (walletAddress) =>
    (await apiClient.get(`/albums/${walletAddress}`)).data,

  createAlbum: async (name) =>
    (await apiClient.post('/albums', { name })).data,

  getAlbumPhotos: async (albumId) =>
    (await apiClient.get(`/albums/${albumId}/photos`)).data,

  uploadToAlbum: async (formData) => {
    const response = await apiClient.post('/albums/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  deleteAlbumPhoto: async (photoId) =>
    (await apiClient.delete(`/albums/photos/${photoId}`)).data,

  deleteAlbum: async (albumId) =>
    (await apiClient.delete(`/albums/${albumId}`)).data,
};

export default api;
