// src/components/Layout/Layout.jsx
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import './Layout.css';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);

  function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
      logout();
      navigate('/login');
    }
  }

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="top-header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">⚡</span>
            <span className="logo-text">Hyve Social</span>
          </div>

          <div className="header-search">
            <input type="text" placeholder="Search users..." />
          </div>

          <div className="header-right">
            <button className="icon-button">🔔</button>
            <button className="icon-button">💬</button>
            
            <div className="user-menu">
              <button 
                className="user-button"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <div className="user-avatar-small">
                  {user?.username?.charAt(0).toUpperCase() || '?'}
                </div>
              </button>

              {showUserMenu && (
                <div className="user-dropdown">
                  <Link to={`/profile/${user?.walletAddress}`} onClick={() => setShowUserMenu(false)}>
                    My Profile
                  </Link>
                  <button onClick={handleLogout}>
                    Disconnect Wallet
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="main-container">
        {/* Left Sidebar */}
        <aside className="left-sidebar">
          <div className="sidebar-section">
            <div className="wallet-info">
              <div className="wallet-avatar">
                {user?.username?.charAt(0).toUpperCase() || '?'}
              </div>
              <div className="wallet-details">
                <h3>Connect Wallet</h3>
                <p>Connect your wallet to get started<br />Now connected!</p>
              </div>
            </div>
          </div>

          <nav className="sidebar-nav">
            <Link 
              to="/" 
              className={location.pathname === '/' ? 'nav-item active' : 'nav-item'}
            >
              <span className="nav-icon">📰</span>
              <span>Feed</span>
            </Link>

            <Link 
              to="/videos" 
              className={location.pathname === '/videos' ? 'nav-item active' : 'nav-item'}
            >
              <span className="nav-icon">🎥</span>
              <span>Videos</span>
            </Link>

            <Link 
              to={`/profile/${user?.walletAddress}`}
              className={location.pathname.includes('/profile') ? 'nav-item active' : 'nav-item'}
            >
              <span className="nav-icon">👤</span>
              <span>My Profile</span>
            </Link>

            <Link 
              to="/friends" 
              className={location.pathname === '/friends' ? 'nav-item active' : 'nav-item'}
            >
              <span className="nav-icon">👥</span>
              <span>Friends</span>
              <span className="badge">0</span>
            </Link>

            <Link 
              to="/discover" 
              className={location.pathname === '/discover' ? 'nav-item active' : 'nav-item'}
            >
              <span className="nav-icon">🔍</span>
              <span>Discover</span>
            </Link>
          </nav>

          <div className="sidebar-stats">
            <h4>Your Posts</h4>
            <div className="stat-number">0</div>

            <h4>Friends</h4>
            <div className="stat-number">0</div>
          </div>

          <div className="sidebar-section">
            <h4>FRIENDS</h4>
            <p className="empty-state">No friends yet. Start following users!</p>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          {children}
        </main>

        {/* Right Sidebar */}
        <aside className="right-sidebar">
          <div className="sidebar-widget">
            <h3>Suggested Users</h3>
            <p className="loading-text">Loading users...</p>
          </div>
        </aside>
      </div>
    </div>
  );
}