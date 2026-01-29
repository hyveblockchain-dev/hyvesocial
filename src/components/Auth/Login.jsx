// src/components/Auth/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import './Login.css';

export default function Login() {
  const [connecting, setConnecting] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [profileData, setProfileData] = useState({
    username: '',
    bio: '',
    profileImage: '',
    coverImage: '',
    location: '',
    website: ''
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const { connectWallet, createProfile } = useAuth();
  const navigate = useNavigate();

  async function handleConnect() {
    setConnecting(true);
    setError('');
    
    try {
      const result = await connectWallet();
      
      if (result.userExists) {
        navigate('/');
      } else {
        setShowProfileSetup(true);
      }
    } catch (error) {
      setError(error.message || 'Failed to connect wallet');
    } finally {
      setConnecting(false);
    }
  }

  async function handleCreateProfile(e) {
    e.preventDefault();
    
    if (!profileData.username.trim()) {
      setError('Username is required');
      return;
    }

    setCreating(true);
    setError('');

    try {
      await createProfile(profileData);
      navigate('/');
    } catch (error) {
      setError(error.message || 'Failed to create profile');
    } finally {
      setCreating(false);
    }
  }

  if (showProfileSetup) {
    return (
      <div className="login-page">
        <div className="login-card profile-setup">
          <h2>Create Your Profile</h2>
          <p>Set up your Hyve Social profile</p>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleCreateProfile}>
            <div className="form-group">
              <label>Username *</label>
              <input
                type="text"
                value={profileData.username}
                onChange={(e) => setProfileData({...profileData, username: e.target.value})}
                placeholder="Enter your username"
                required
                disabled={creating}
              />
            </div>

            <div className="form-group">
              <label>Bio</label>
              <textarea
                value={profileData.bio}
                onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                placeholder="Tell us about yourself..."
                rows="3"
                disabled={creating}
              />
            </div>

            <div className="form-group">
              <label>Location</label>
              <input
                type="text"
                value={profileData.location}
                onChange={(e) => setProfileData({...profileData, location: e.target.value})}
                placeholder="City, Country"
                disabled={creating}
              />
            </div>

            <div className="form-group">
              <label>Website</label>
              <input
                type="url"
                value={profileData.website}
                onChange={(e) => setProfileData({...profileData, website: e.target.value})}
                placeholder="https://yourwebsite.com"
                disabled={creating}
              />
            </div>

            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? 'Creating Profile...' : 'Create Profile'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-background"></div>
      
      <div className="login-card">
        <div className="logo-section">
          <h1 className="logo-text">HyveSocial</h1>
          <p className="tagline">Decentralized Social Media</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <button 
          onClick={handleConnect} 
          className="connect-button"
          disabled={connecting}
        >
          {connecting ? (
            <>
              <span className="spinner"></span>
              Connecting...
            </>
          ) : (
            <>
              <span className="wallet-icon">🦊</span>
              Connect with MetaMask
            </>
          )}
        </button>

        <p className="connect-info">
          Connect your wallet to get started on Hyve Social
        </p>

        <div className="features">
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
