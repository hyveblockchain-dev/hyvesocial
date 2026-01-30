// src/contexts/AuthContext.jsx
import { createContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';
import api from '../services/api';
import socket from '../services/socket';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const token = localStorage.getItem('authToken');
    const address = localStorage.getItem('userAddress');
    
    if (token && address) {
      api.setToken(token);
      try {
        const data = await api.getProfile(address);
        setUser(data.user);
        socket.connect(address);
      } catch (error) {
        console.error('Auth check failed:', error);
        logout();
      }
    }
    setLoading(false);
  }

  async function connectWallet() {
    if (!window.ethereum) {
      throw new Error('Please install MetaMask!');
    }

    try {
      setLoading(true);

      // Request accounts
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      const address = accounts[0].toLowerCase();

      // Get nonce
      const { nonce } = await api.getNonce(address);

      // Sign JUST the raw nonce (backend expects this!)
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const signature = await signer.signMessage(nonce);

      // Login
      const loginData = await api.login(address, signature);
      
      // Store auth
      localStorage.setItem('authToken', loginData.token);
      localStorage.setItem('userAddress', address);
      api.setToken(loginData.token);
      
      if (loginData.userExists) {
        setUser(loginData.user);
        socket.connect(address);
        return { success: true, userExists: true };
      } else {
        return { success: true, userExists: false, address };
      }
    } catch (error) {
      console.error('Connect wallet error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }

  async function createProfile(profileData) {
    try {
      const data = await api.createProfile(profileData);
      setUser(data.user);
      const address = localStorage.getItem('userAddress');
      if (address) {
        socket.connect(address);
      }
      return data;
    } catch (error) {
      console.error('Create profile error:', error);
      throw error;
    }
  }

  async function updateProfile(profileData) {
    try {
      const data = await api.updateProfile(profileData);
      setUser(data.user);
      return data;
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  }

  function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userAddress');
    api.clearToken();
    socket.disconnect();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      connectWallet, 
      createProfile,
      updateProfile,
      logout,
      setUser 
    }}>
      {children}
    </AuthContext.Provider>
  );
}