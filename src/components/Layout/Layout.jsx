// src/components/Layout/Layout.jsx
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import Chat from '../Chat/Chat';
import ChatWindow from '../Chat/ChatWindow';
import api from '../../services/api';
import './Layout.css';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [selectedChat, setSelectedChat] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [postCount, setPostCount] = useState(0);
  const [friendCount, setFriendCount] = useState(0);

  useEffect(() => {
    loadSuggestedUsers();
    loadUserStats();
  }, [user]);

  useEffect(() => {
    function handleOpenChat(event) {
      if (!event?.detail) return;
      setSelectedChat(event.detail);
      setShowChat(false);
    }

    window.addEventListener('open-chat', handleOpenChat);
    return () => window.removeEventListener('open-chat', handleOpenChat);
  }, []);

  async function loadSuggestedUsers() {
    try {
      // Check if getUsers function exists
      if (!api.getUsers) {
        console.log('getUsers not available');
        return;
      }
      
      const data = await api.getUsers();
      
      if (!data || !data.users) {
        return;
      }
      
      // Filter out current user and get random 5
      const others = data.users.filter(u => u.wallet_address !== user?.walletAddress);
      const random = others.sort(() => 0.5 - Math.random()).slice(0, 5);
      setSuggestedUsers(random);
    } catch (error) {
      console.error('Load suggested users error:', error);
      // Don't block the app if this fails
    }
  }

  async function loadUserStats() {
    if (!user?.walletAddress) return;
    
    try {
      // Load post count
      if (api.getUserPosts) {
        const postsData = await api.getUserPosts(user.walletAddress);
        setPostCount(postsData.posts?.length || 0);
      }
      
      // Load friend count
      if (api.getFollowing) {
        const friendsData = await api.getFollowing();
        setFriendCount(friendsData.following?.length || 0);
      }
    } catch (error) {
      console.error('Load user stats error:', error);
    }
  }

  async function handleSearch(query) {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setShowSearchResults(false);
      return;
    }

    try {
      if (!api.searchUsers) {
        console.log('searchUsers not available');
        return;
      }
      
      const data = await api.searchUsers(query);
      setSearchResults(data.users || []);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    }
  }

  function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
      logout();
      navigate('/login');
    }
  }

  function handleChatSelect(conversation) {
    setSelectedChat(conversation);
    setShowChat(false);
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
          <input 
            type="text" 
            placeholder="Search users..." 
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => searchQuery && setShowSearchResults(true)}
          />
          
          {showSearchResults && (
            <div className="search-dropdown">
              {searchResults.length === 0 ? (
                <div className="search-empty">No users found</div>
              ) : (
                searchResults.map(user => (
                  <Link 
                    key={user.wallet_address}
                    to={`/profile/${user.wallet_address}`}
                    className="search-result"
                    onClick={() => setShowSearchResults(false)}
                  >
                    {user.profile_image ? (
                      <img src={user.profile_image} alt={user.username} className="search-avatar" />
                    ) : (
                      <div className="search-avatar">
                        {user.username?.charAt(0).toUpperCase() || '?'}
                      </div>
                    )}
                    <span>{user.username}</span>
                  </Link>
                ))
              )}
            </div>
          )}
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
            </Link>
            <Link to="/discover" className="nav-item">
              <span className="nav-icon">🔍</span>
              <span>Discover</span>
            </Link>
          </nav>

          <div className="stats-section">
            <div className="stat-item">
              <h4>YOUR POSTS</h4>
              <div className="stat-num">{postCount}</div>
            </div>
            <div className="stat-item">
              <h4>FRIENDS</h4>
              <div className="stat-num">{friendCount}</div>
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
            {suggestedUsers.length === 0 ? (
              <p className="loading">No suggestions</p>
            ) : (
              <div className="suggested-list">
                {suggestedUsers.map(suggestedUser => (
                  <Link 
                    key={suggestedUser.wallet_address}
                    to={`/profile/${suggestedUser.wallet_address}`}
                    className="suggested-user"
                  >
                    {suggestedUser.profile_image ? (
                      <img src={suggestedUser.profile_image} alt={suggestedUser.username} className="suggested-avatar" />
                    ) : (
                      <div className="suggested-avatar">
                        {suggestedUser.username?.charAt(0).toUpperCase() || '?'}
                      </div>
                    )}
                    <span className="suggested-name">{suggestedUser.username}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Chat Button */}
          <button className="chat-fab-bottom" onClick={() => setShowChat(!showChat)}>
            💬
          </button>
        </aside>
      </div>

      {/* Chat List Popup */}
      {showChat && (
        <div className="chat-list-popup">
          <div className="chat-list-header">
            <h3>💬 Messages</h3>
            <button className="close-chat" onClick={() => setShowChat(false)}>✕</button>
          </div>
          <div className="chat-list-body">
            <Chat onSelectChat={handleChatSelect} />
          </div>
        </div>
      )}

      {/* Individual Chat Window */}
      {selectedChat && (
        <div className="chat-window-popup">
          <ChatWindow conversation={selectedChat} onClose={() => setSelectedChat(null)} />
        </div>
      )}

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