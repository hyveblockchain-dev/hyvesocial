// src/components/Layout/Layout.jsx
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import Chat from '../Chat/Chat';
import './Layout.css';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showChat, setShowChat] = useState(false);

  function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
      logout();
      navigate('/login');
    }
  }

  return (
    <div className="page-container">
      {/* Header */}
      <header className="page-header">
        <div className="logo">
          <span className="logo-icon">⚡</span>
          <span className="logo-text">Hyve Social</span>
        </div>

        <div className="search-box">
          <input type="text" placeholder="Search users..." />
        </div>

        <div className="header-actions">
          <button className="icon-btn">🔔</button>
          
          <div className="user-menu">
            <button className="user-btn" onClick={() => setShowUserMenu(!showUserMenu)}>
              {user?.profileImage ? (
                <img src={user.profileImage} alt={user.username} className="avatar-mini" />
              ) : (
                <div className="avatar-mini">
                  {user?.username?.charAt(0).toUpperCase() || '?'}
                </div>
              )}
            </button>

            {showUserMenu && (
              <div className="user-dropdown">
                <Link to={`/profile/${user?.walletAddress}`} onClick={() => setShowUserMenu(false)}>
                  My Profile
                </Link>
                <button onClick={handleLogout}>Disconnect Wallet</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="page-body">
        {/* Left Sidebar */}
        <aside className="left-column">
          <div className="profile-card">
            {user?.profileImage ? (
              <img src={user.profileImage} alt={user.username} className="profile-avatar" />
            ) : (
              <div className="profile-avatar">
                {user?.username?.charAt(0).toUpperCase() || '?'}
              </div>
            )}
            <div className="profile-details">
              <h3>{user?.username || 'User'}</h3>
              <p className="profile-address">
                {user?.walletAddress?.slice(0, 6)}...{user?.walletAddress?.slice(-4)}
              </p>
            </div>
            <button className="disconnect-btn" onClick={handleLogout}>
              Disconnect Wallet
            </button>
          </div>

          <nav className="nav-menu">
            <Link to="/" className={location.pathname === '/' ? 'nav-item active' : 'nav-item'}>
              <span className="nav-icon">📰</span>
              <span>Feed</span>
            </Link>
            <Link to="/videos" className="nav-item">
              <span className="nav-icon">🎥</span>
              <span>Videos</span>
            </Link>
            <Link to={`/profile/${user?.walletAddress}`} className="nav-item">
              <span className="nav-icon">👤</span>
              <span>My Profile</span>
            </Link>
            <Link to="/friends" className="nav-item">
              <span className="nav-icon">👥</span>
              <span>Friends</span>
              <span className="badge">0</span>
            </Link>
            <Link to="/discover" className="nav-item">
              <span className="nav-icon">🔍</span>
              <span>Discover</span>
            </Link>
          </nav>

          <div className="stats-section">
            <div className="stat-item">
              <h4>YOUR POSTS</h4>
              <div className="stat-num">0</div>
            </div>
            <div className="stat-item">
              <h4>FRIENDS</h4>
              <div className="stat-num">0</div>
            </div>
          </div>

          <div className="friends-section">
            <h4>FRIENDS</h4>
            <p className="empty-msg">No friends yet. Start following users!</p>
          </div>
        </aside>

        {/* Center Content */}
        <main className="center-column">
          {children}
        </main>

        {/* Right Sidebar */}
        <aside className="right-column">
          <div className="widget suggestions">
            <h3>Suggested Users</h3>
            <p className="loading">Loading users...</p>
          </div>

          {/* Chat Popup */}
          {showChat && (
            <div className="chat-popup-container">
              <div className="chat-popup">
                <div className="chat-popup-header">
                  <h3>💬 Messages</h3>
                  <button className="close-chat" onClick={() => setShowChat(false)}>✕</button>
                </div>
                <div className="chat-popup-body">
                  <Chat />
                </div>
              </div>
            </div>
          )}

          {/* Chat Button */}
          <button className="chat-fab" onClick={() => setShowChat(!showChat)}>
            💬
          </button>
        </aside>
      </div>

      {/* Footer */}
      <footer className="page-footer">
        <div className="footer-links">
          <a href="#">About</a>
          <a href="#">Help</a>
          <a href="#">Terms</a>
          <a href="#">Privacy</a>
        </div>
        <p className="copyright">© 2026 Hyve Social</p>
      </footer>
    </div>
  );
}