// src/components/Auth/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { setE2EESignature } from '../../utils/e2ee';
import { IconShield, IconZap, IconUsers, IconLock, IconChat, IconGlobe } from '../Icons/Icons';
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
      setE2EESignature(signature);
      
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
        <div className="login-hero">
          <div className="login-hero-content">
            <div className="login-brand">
              <img src="/hyvelogo.png" alt="Hyve" className="login-logo" />
              <div>
                <h1>Hyve Social</h1>
                <p>The decentralized social layer</p>
              </div>
            </div>
            <div className="login-hero-copy">
              <h2>Your Community. Your Rules.</h2>
              <p>
                A wallet-powered social platform with encrypted messaging, rich profiles, and real-time conversations — all owned by you.
              </p>
            </div>
          </div>
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
              {loading ? (
                <span className="connect-loading">
                  <span className="connect-spinner"></span>
                  Connecting...
                </span>
              ) : (
                'Connect with MetaMask'
              )}
            </button>
            <p className="login-subtitle">Connect your wallet to get started</p>
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
            <div className="feature-icon">
              <IconShield size={22} />
            </div>
            <div className="feature-text">
              <span className="feature-title">End-to-End Encrypted</span>
              <span className="feature-desc">Messages secured by your wallet</span>
            </div>
          </div>
          <div className="feature">
            <div className="feature-icon">
              <IconZap size={22} />
            </div>
            <div className="feature-text">
              <span className="feature-title">Instant Onboarding</span>
              <span className="feature-desc">One click, no passwords needed</span>
            </div>
          </div>
          <div className="feature">
            <div className="feature-icon">
              <IconUsers size={22} />
            </div>
            <div className="feature-text">
              <span className="feature-title">Community First</span>
              <span className="feature-desc">Groups, feeds &amp; real-time chat</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}