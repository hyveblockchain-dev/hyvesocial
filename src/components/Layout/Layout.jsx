// src/components/Layout/Layout.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Chat from '../Chat/Chat';
import ChatWindow from '../Chat/ChatWindow';
import api from '../../services/api';
import './Layout.css';

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [showChat, setShowChat] = useState(false);
  const [selectedChat, setSelectedChat] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [friendRequests, setFriendRequests] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadNotifications() {
    try {
      const data = await api.getFriendRequests();
      setFriendRequests(data.requests || []);
      setNotificationCount(data.requests?.length || 0);
    } catch (error) {
      console.error('Load notifications error:', error);
    }
  }

  async function handleAcceptRequest(requestId) {
    try {
      await api.acceptFriendRequest(requestId);
      setFriendRequests(friendRequests.filter(r => r.id !== requestId));
      setNotificationCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Accept request error:', error);
      alert('Failed to accept friend request');
    }
  }

  async function handleDeclineRequest(requestId) {
    try {
      await api.declineFriendRequest(requestId);
      setFriendRequests(friendRequests.filter(r => r.id !== requestId));
      setNotificationCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Decline request error:', error);
      alert('Failed to decline friend request');
    }
  }

  function handleChatSelect(conversation) {
    setSelectedChat(conversation);
    setShowChat(false);
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function isActive(path) {
    return location.pathname === path;
  }

  return (
    <div className="app-layout">
      {/* Animated Background */}
      <div className="animated-background"></div>

      {/* Fixed Header */}
      <header className="app-header">
        <div className="header-container">
          <div className="logo" onClick={() => navigate('/')}>
            ⚡ Hyve Social
          </div>
          <div className="search-bar">
            <input type="text" placeholder="Search Hyve Social..." />
          </div>
          <div className="header-actions">
            <button 
              className={`icon-button ${notificationCount > 0 ? 'has-notifications' : ''}`}
              onClick={() => setShowNotifications(!showNotifications)}
            >
              🔔
              {notificationCount > 0 && (
                <span className="notification-badge">{notificationCount}</span>
              )}
            </button>
            <div className="user-menu">
              <img 
                src={user?.profileImage || `https://api.dicebear.com/7.x/identicon/svg?seed=${user?.walletAddress}`}
                alt={user?.username}
                className="user-avatar"
              />
            </div>
          </div>
        </div>

        {/* Notifications Dropdown */}
        {showNotifications && (
          <div className="notifications-dropdown">
            <div className="notifications-header">
              <h3>Notifications</h3>
              <button onClick={() => setShowNotifications(false)}>✕</button>
            </div>
            <div className="notifications-list">
              {friendRequests.length === 0 ? (
                <div className="no-notifications">
                  <p>🔔 No new notifications</p>
                </div>
              ) : (
                friendRequests.map(request => (
                  <div key={request.id} className="notification-item">
                    <div className="notification-avatar">
                      {request.profile_image ? (
                        <img src={request.profile_image} alt={request.username} />
                      ) : (
                        <div className="avatar-placeholder">
                          {request.username?.charAt(0).toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                    <div className="notification-content">
                      <p>
                        <strong>{request.username}</strong> sent you a friend request
                      </p>
                      <div className="notification-actions">
                        <button
                          className="btn-accept-small"
                          onClick={() => handleAcceptRequest(request.id)}
                        >
                          ✓ Accept
                        </button>
                        <button
                          className="btn-decline-small"
                          onClick={() => handleDeclineRequest(request.id)}
                        >
                          ✕ Decline
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <div className="app-body">
        {/* Left Sidebar - Fixed */}
        <aside className="app-sidebar left-sidebar">
          <div className="user-profile" onClick={() => navigate(`/profile/${user?.walletAddress}`)}>
            <img 
              src={user?.profileImage || `https://api.dicebear.com/7.x/identicon/svg?seed=${user?.walletAddress}`}
              alt={user?.username}
              className="profile-avatar"
            />
            <div className="profile-info">
              <h3>{user?.username || 'User'}</h3>
              <p>0x...{user?.walletAddress?.slice(-4)}</p>
            </div>
          </div>

          <button className="nav-item disconnect-btn" onClick={handleLogout}>
            🚪 Disconnect Wallet
          </button>

          <nav className="nav-menu">
            <button 
              className={`nav-item ${isActive('/') ? 'active' : ''}`}
              onClick={() => navigate('/')}
            >
              📰 Feed
            </button>
            <button 
              className={`nav-item ${isActive('/videos') ? 'active' : ''}`}
              onClick={() => navigate('/videos')}
            >
              🎥 Videos
            </button>
            <button 
              className={`nav-item ${isActive(`/profile/${user?.walletAddress}`) ? 'active' : ''}`}
              onClick={() => navigate(`/profile/${user?.walletAddress}`)}
            >
              👤 My Profile
            </button>
            <button 
              className={`nav-item ${isActive('/friends') ? 'active' : ''}`}
              onClick={() => navigate('/friends')}
            >
              👥 Friends
            </button>
            <button 
              className={`nav-item ${isActive('/discover') ? 'active' : ''}`}
              onClick={() => navigate('/discover')}
            >
              🔍 Discover
            </button>
          </nav>

          <div className="sidebar-stats">
            <div className="stat-item">
              <span className="stat-number">0</span>
              <span className="stat-label">POSTS</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">0</span>
              <span className="stat-label">FRIENDS</span>
            </div>
          </div>
        </aside>

        {/* Center Content - Scrollable */}
        <main className="app-main">
          {children}
        </main>

        {/* Right Sidebar - Fixed */}
        <aside className="app-sidebar right-sidebar">
          <div className="suggested-users">
            <h3>Suggested Users</h3>
            <div className="user-list">
              <div className="user-item">
                <div className="user-avatar">👤</div>
                <div className="user-info">
                  <div className="user-name">I'm The Man</div>
                </div>
              </div>
              <div className="user-item">
                <div className="user-avatar">👤</div>
                <div className="user-info">
                  <div className="user-name">Felix the Cat</div>
                </div>
              </div>
              <div className="user-item">
                <div className="user-avatar">👤</div>
                <div className="user-info">
                  <div className="user-name">test User</div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Fixed Footer */}
      <footer className="app-footer">
        <div className="footer-container">
          <span>About</span>
          <span>Help</span>
          <span>Terms</span>
          <span>Privacy</span>
          <span>© 2026 Hyve Social</span>
        </div>
      </footer>

      {/* Chat Button */}
      <button className="chat-button" onClick={() => setShowChat(!showChat)}>
        💬
      </button>

      {/* Chat Windows */}
      {showChat && (
        <div className="chat-list-popup">
          <Chat onSelectConversation={handleChatSelect} />
        </div>
      )}

      {selectedChat && (
        <div className="chat-window-popup">
          <ChatWindow
            conversation={selectedChat}
            onClose={() => setSelectedChat(null)}
          />
        </div>
      )}
    </div>
  );
}