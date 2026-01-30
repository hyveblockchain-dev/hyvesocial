// src/components/Notifications/Notifications.jsx
import { useState, useEffect } from 'react';
import api from '../../services/api';
import './Notifications.css';

export default function Notifications() {
  const [friendRequests, setFriendRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFriendRequests();
  }, []);

  async function loadFriendRequests() {
    try {
      setLoading(true);
      const data = await api.getFriendRequests();
      setFriendRequests(data.requests || []);
    } catch (error) {
      console.error('Load friend requests error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(requestId) {
    try {
      await api.acceptFriendRequest(requestId);
      setFriendRequests(friendRequests.filter(r => r.id !== requestId));
    } catch (error) {
      console.error('Accept friend request error:', error);
      alert('Failed to accept friend request');
    }
  }

  async function handleDecline(requestId) {
    try {
      await api.declineFriendRequest(requestId);
      setFriendRequests(friendRequests.filter(r => r.id !== requestId));
    } catch (error) {
      console.error('Decline friend request error:', error);
      alert('Failed to decline friend request');
    }
  }

  if (loading) {
    return (
      <div className="notifications-container">
        <h2>Notifications</h2>
        <div className="notifications-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="notifications-container">
      <h2>Notifications</h2>

      {friendRequests.length === 0 ? (
        <div className="no-notifications">
          <p>🔔 No new notifications</p>
        </div>
      ) : (
        <div className="notifications-list">
          {friendRequests.map(request => (
            <div key={request.id} className="notification-card">
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
                    className="btn-accept"
                    onClick={() => handleAccept(request.id)}
                  >
                    ✓ Accept
                  </button>
                  <button
                    className="btn-decline"
                    onClick={() => handleDecline(request.id)}
                  >
                    ✕ Decline
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}