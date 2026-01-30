// src/contexts/AuthContext.jsx
import { createContext, useState, useEffect } from 'react';
import api from '../services/api';
import io from 'socket.io-client';

export const AuthContext = createContext();

let socket = null;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setLoading(false);
        return;
      }

      const data = await api.getCurrentUser();
      setUser(data.user);
      
      // Connect socket with auth token
      if (!socket) {
        connectSocket(token);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('auth_token');
    } finally {
      setLoading(false);
    }
  }

  function connectSocket(token) {
    try {
      socket = io('https://api.hyvechain.com', {
        auth: {
          token: token
        },
        transports: ['websocket', 'polling']
      });

      socket.on('connect', () => {
        console.log('✅ Socket connected');
      });

      socket.on('disconnect', () => {
        console.log('❌ Socket disconnected');
      });

      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
      });
    } catch (error) {
      console.error('Socket setup error:', error);
    }
  }

  async function login(walletAddress, signature) {
    try {
      const data = await api.login(walletAddress, signature);
      localStorage.setItem('auth_token', data.token);
      setUser(data.user);
      
      // Connect socket with new token
      connectSocket(data.token);
      
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async function register(walletAddress, username) {
    try {
      const data = await api.register(walletAddress, username);
      localStorage.setItem('auth_token', data.token);
      setUser(data.user);
      
      // Connect socket with new token
      connectSocket(data.token);
      
      return data;
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  }

  function logout() {
    localStorage.removeItem('auth_token');
    setUser(null);
    
    // Disconnect socket
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  }

  async function connectWallet() {
    try {
      if (!window.ethereum) {
        throw new Error('Please install MetaMask');
      }

      // Request account access
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const address = accounts[0];
      console.log('Connected address:', address);

      // Create message to sign
      const message = `Sign this message to login to Hyve Social: ${Date.now()}`;
      
      // Request signature
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, address]
      });

      console.log('Signature obtained');
      return { address, signature };
    } catch (error) {
      console.error('Wallet connection error:', error);
      
      // Handle user rejection
      if (error.code === 4001) {
        throw new Error('You rejected the connection request');
      }
      
      throw error;
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, connectWallet, socket }}>
      {children}
    </AuthContext.Provider>
  );
}