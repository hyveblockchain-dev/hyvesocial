// src/services/api.js
const API_URL = 'https://social-api.hyvechain.com/api';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('authToken');
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('authToken', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('authToken');
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
      ...options.headers
    };

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      if (error.message.includes('401')) {
        this.clearToken();
        window.location.href = '/login';
      }
      throw error;
    }
  }

  // Auth
  async getNonce(address) {
    return this.request(`/auth/nonce/${address}`);
  }

  async login(address, signature) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ address, signature })
    });
  }

  // Profile
  async createProfile(profileData) {
    return this.request('/profile', {
      method: 'POST',
      body: JSON.stringify(profileData)
    });
  }

  async updateProfile(profileData) {
    return this.request('/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
  }

  async getProfile(address) {
    return this.request(`/profile/${address}`);
  }

  // Posts
  async createPost(postData) {
    return this.request('/posts', {
      method: 'POST',
      body: JSON.stringify(postData)
    });
  }

  async getPosts(limit = 50, offset = 0) {
    return this.request(`/posts?limit=${limit}&offset=${offset}`);
  }

  async getUserPosts(address) {
    return this.request(`/posts/user/${address}`);
  }

  async deletePost(postId) {
    return this.request(`/posts/${postId}`, {
      method: 'DELETE'
    });
  }

  // Reactions
  async reactToPost(postId, reactionType) {
    return this.request(`/posts/${postId}/react`, {
      method: 'POST',
      body: JSON.stringify({ reactionType })
    });
  }

  async removeReaction(postId) {
    return this.request(`/posts/${postId}/react`, {
      method: 'DELETE'
    });
  }

  // Comments
  async addComment(postId, content) {
    return this.request(`/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });
  }

  async getComments(postId) {
    return this.request(`/posts/${postId}/comments`);
  }

  async deleteComment(commentId) {
    return this.request(`/comments/${commentId}`, {
      method: 'DELETE'
    });
  }

  // Follow
  async followUser(address) {
    return this.request(`/follow/${address}`, {
      method: 'POST'
    });
  }

  async unfollowUser(address) {
    return this.request(`/follow/${address}`, {
      method: 'DELETE'
    });
  }

  async getFollowers(address) {
    return this.request(`/followers/${address}`);
  }

  async getFollowing(address) {
    return this.request(`/following/${address}`);
  }

  // Messages
  async sendMessage(messageData) {
    return this.request('/messages', {
      method: 'POST',
      body: JSON.stringify(messageData)
    });
  }

  async getConversation(address) {
    return this.request(`/messages/${address}`);
  }

  async getConversations() {
    return this.request('/conversations');
  }

  // Search
  async searchUsers(query) {
    return this.request(`/search/users?q=${encodeURIComponent(query)}`);
  }

  // Albums
  async createAlbum(albumData) {
    return this.request('/albums', {
      method: 'POST',
      body: JSON.stringify(albumData)
    });
  }

  async getUserAlbums(address) {
    return this.request(`/albums/user/${address}`);
  }

  // Stories
  async createStory(storyData) {
    return this.request('/stories', {
      method: 'POST',
      body: JSON.stringify(storyData)
    });
  }

  async getStories() {
    return this.request('/stories');
  }
}

export default new ApiService();
