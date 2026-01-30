// src/components/Auth/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import './Login.css';

export default function Login() {
  const navigate = useNavigate();
  const { login, register, connectWallet } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [username, setUsername] = useState('');
  const [walletAddress, setWalletAddress] = useState('');

  async function handleConnect() {
    try {
      setLoading(true);
      setError('');

      console.log('Connecting wallet...');
      const { address, signature } = await connectWallet();
      setWalletAddress(address);
      
      console.log('Attempting login...');
      const result = await login(address, signature);
      
      if (result.needsRegistration) {
        console.log('User needs to register');
        setNeedsRegistration(true);
      } else {
        console.log('Login successful!');
        navigate('/');
      }
    } catch (err) {
      console.error('Connection error:', err);
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    try {
      setLoading(true);
      setError('');

      console.log('Registering user...');
      await register(walletAddress, username);
      
      console.log('Registration successful!');
      navigate('/');
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to register');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>HyveSocial</h1>
          <p>Decentralized Social Media</p>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {!needsRegistration ? (
          <div className="login-box">
            <button 
              className="connect-button" 
              onClick={handleConnect}
              disabled={loading}
            >
              {loading ? '⏳ Connecting...' : '🦊 Connect with MetaMask'}
            </button>
            <p className="login-subtitle">Connect your wallet to get started on Hyve Social</p>
          </div>
        ) : (
          <form className="register-form" onSubmit={handleRegister}>
            <h2>Create Your Profile</h2>
            <input
              type="text"
              placeholder="Choose a username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              maxLength={20}
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
            <button 
              type="button" 
              onClick={() => setNeedsRegistration(false)}
              disabled={loading}
              className="back-button"
            >
              Back
            </button>
          </form>
        )}

        <div className="login-features">
          <div className="feature">
            <span className="feature-icon">⚡</span>
            <span>Gas-Free</span>
          </div>
          <div className="feature">
            <span className="feature-icon">🔒</span>
            <span>Secure</span>
          </div>
          <div className="feature">
            <span className="feature-icon">🌐</span>
            <span>Decentralized</span>
          </div>
        </div>
      </div>
    </div>
  );
}