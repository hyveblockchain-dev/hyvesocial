// src/services/socket.js
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../utils/env';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
  }

  connect(userAddress) {
    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected');
      this.connected = true;
      if (userAddress) {
        this.socket.emit('join', userAddress);
      }
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      this.connected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.connected = false;
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  // Message events
  onNewMessage(callback) {
    if (this.socket) {
      this.socket.on('new_message', callback);
    }
  }

  offNewMessage(callback) {
    if (this.socket) {
      this.socket.off('new_message', callback);
    }
  }

  // Typing indicators
  sendTyping(from, to) {
    if (this.socket?.connected) {
      this.socket.emit('typing', { from, to });
    }
  }

  stopTyping(from, to) {
    if (this.socket?.connected) {
      this.socket.emit('stop_typing', { from, to });
    }
  }

  onTyping(callback) {
    if (this.socket) {
      this.socket.on('user_typing', callback);
    }
  }

  onStopTyping(callback) {
    if (this.socket) {
      this.socket.on('user_stopped_typing', callback);
    }
  }
}

export default new SocketService();
