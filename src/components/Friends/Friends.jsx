// src/components/Friends/Friends.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import './Friends.css';

export default function Friends() {
  const { user } = useAuth();
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFriends();
  }, []);

  async function loadFriends() {
    try {
      setLoading(true);
      const data = await api.getFollowing();
      setFriends(data.following || []);
    } catch (error) {
      console.error('Load friends error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleUnfollow(address) {
    if (confirm('Remove this friend?')) {
      try {
        await api.unfollowUser(address);
        setFriends(friends.filter(f => f.address !== address));
      } catch (error) {
        console.error('Unfollow error:', error);
      }
    }
  }

  if (loading) {
    return (
      <div className="friends-page">
        <h1>Friends</h1>
        <div className="loading-friends">Loading friends...</div>
      </div>
    );
  }

  return (
    <div className="friends-page">
      <h1>Friends ({friends.length})</h1>

      {friends.length === 0 ? (
        <div className="empty-friends">
          <p>No friends yet. Start following users!</p>
          <Link to="/discover" className="btn-discover">Discover Users</Link>
        </div>
      ) : (
        <div className="friends-grid">
          {friends.map(friend => (
            <div key={friend.address} className="friend-card">
              <Link to={`/profile/${friend.address}`} className="friend-avatar-link">
                {friend.profile_image ? (
                  <img src={friend.profile_image} alt={friend.username} className="friend-avatar" />
                ) : (
                  <div className="friend-avatar">
                    {friend.username?.charAt(0).toUpperCase() || '?'}
                  </div>
                )}
              </Link>
              
              <div className="friend-info">
                <Link to={`/profile/${friend.address}`} className="friend-name">
                  {friend.username || 'Anonymous'}
                </Link>
                <p className="friend-address">
                  {friend.address?.slice(0, 6)}...{friend.address?.slice(-4)}
                </p>
              </div>

              <div className="friend-actions">
                <Link to="/chat" className="btn-message">💬 Message</Link>
                <button className="btn-remove" onClick={() => handleUnfollow(friend.address)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}