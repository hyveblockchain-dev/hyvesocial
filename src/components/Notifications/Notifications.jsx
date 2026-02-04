// src/components/Notifications/Notifications.jsx
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import { normalizeNotification } from '../../utils/notifications';
import './Notifications.css';

export default function Notifications() {
  const { socket } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [friendRequests, setFriendRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const READ_NOTIFICATIONS_KEY = 'read_notifications';

  function getReadNotifications() {
    try {
      const stored = localStorage.getItem(READ_NOTIFICATIONS_KEY);
      return new Set(stored ? JSON.parse(stored) : []);
    } catch (error) {
      return new Set();
    }
  }

  function markNotificationRead(id) {
    const current = getReadNotifications();
    current.add(id);
    localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify([...current]));
  }

  useEffect(() => {
    loadFriendRequests();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleFriendRequest = async () => {
      await loadFriendRequests();
    };

    const handleFriendAccepted = async (payload) => {
      try {
        const username = payload?.fromUsername || payload?.from;
        if (!username) return;
        const data = await api.getUserProfile(username);
        const user = data?.user || {};
        const entry = {
          id: `accepted-${username}-${Date.now()}`,
          type: 'friend_accepted',
          createdAt: new Date().toISOString(),
          user
        };
        setNotifications((prev) => [entry, ...prev]);
      } catch (error) {
        console.error('Load accepted friend profile error:', error);
      }
    };

    socket.on('friend_request', handleFriendRequest);
    socket.on('friend_request_accepted', handleFriendAccepted);

    return () => {
      socket.off('friend_request', handleFriendRequest);
      socket.off('friend_request_accepted', handleFriendAccepted);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    const events = [
      'notification',
      'new_notification',
      'post_comment',
      'comment',
      'comment_created',
      'reply',
      'reply_created',
      'comment_reply',
      'post_reply',
      'post_reaction',
      'comment_reaction',
      'reaction',
      'follow'
    ];

    const handlers = events.map((eventName) => {
      const handler = (payload) => {
        const normalized = normalizeNotification(payload, eventName);
        if (!normalized) return;

        setNotifications((prev) => {
          if (prev.some((item) => item.id === normalized.id)) return prev;
          return [normalized, ...prev];
        });
      };

      socket.on(eventName, handler);
      return { eventName, handler };
    });

    return () => {
      handlers.forEach(({ eventName, handler }) => socket.off(eventName, handler));
    };
  }, [socket]);

  async function loadFriendRequests() {
    try {
      setLoading(true);
      const data = await api.getFriendRequests();
      const requests = data.requests || [];
      const read = getReadNotifications();
      setFriendRequests(requests);
      const requestNotifications = requests
        .filter((request) => !read.has(`request-${request.id}`))
        .map((request) => ({
          id: `request-${request.id}`,
          type: 'friend_request',
          createdAt: request.created_at || new Date().toISOString(),
          request
        }));
      setNotifications((prev) => {
        const existingIds = new Set(prev.map((item) => item.id));
        const merged = [...requestNotifications.filter((item) => !existingIds.has(item.id)), ...prev];
        return merged;
      });
    } catch (error) {
      console.error('Load friend requests error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(requestId) {
    try {
      await api.acceptFriendRequest(requestId);
      markNotificationRead(`request-${requestId}`);
      setFriendRequests(friendRequests.filter(r => r.id !== requestId));
      setNotifications((prev) => prev.filter((item) => item.id !== `request-${requestId}`));
    } catch (error) {
      console.error('Accept friend request error:', error);
      alert('Failed to accept friend request');
    }
  }

  async function handleDecline(requestId) {
    try {
      await api.declineFriendRequest(requestId);
      markNotificationRead(`request-${requestId}`);
      setFriendRequests(friendRequests.filter(r => r.id !== requestId));
      setNotifications((prev) => prev.filter((item) => item.id !== `request-${requestId}`));
    } catch (error) {
      console.error('Decline friend request error:', error);
      alert('Failed to decline friend request');
    }
  }

  const allNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }, [notifications]);

  const visibleNotifications = useMemo(() => {
    if (activeTab === 'requests') {
      return allNotifications.filter((item) => item.type === 'friend_request');
    }
    return allNotifications;
  }, [activeTab, allNotifications]);

  if (loading) {
    return (
      <div className="notifications-container">
        <div className="notifications-header">
          <h2>Notifications</h2>
        </div>
        <div className="notifications-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="notifications-container">
      <div className="notifications-header">
        <div>
          <h2>Notifications</h2>
          <p className="notifications-subtitle">Stay up to date with requests and activity</p>
        </div>
        <div className="notifications-tabs">
          <button
            className={`tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All
          </button>
          <button
            className={`tab ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            Requests
            {friendRequests.length > 0 && <span className="tab-count">{friendRequests.length}</span>}
          </button>
        </div>
      </div>

      {visibleNotifications.length === 0 ? (
        <div className="no-notifications">
          <p>🔔 No new notifications</p>
        </div>
      ) : (
        <div className="notifications-list">
          {visibleNotifications.map((item) => {
            if (item.type === 'friend_request') {
              const request = item.request;
              return (
                <div key={item.id} className="notification-card">
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
                      <button className="btn-accept" onClick={() => handleAccept(request.id)}>
                        ✓ Accept
                      </button>
                      <button className="btn-decline" onClick={() => handleDecline(request.id)}>
                        ✕ Decline
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            if (item.type === 'friend_accepted') {
              const user = item.user || {};
              return (
                <div key={item.id} className="notification-card">
                  <div className="notification-avatar">
                    {user.profileImage ? (
                      <img src={user.profileImage} alt={user.username} />
                    ) : (
                      <div className="avatar-placeholder">
                        {user.username?.charAt(0).toUpperCase() || '?'}
                      </div>
                    )}
                  </div>
                  <div className="notification-content">
                    <p>
                      <strong>{user.username || 'Someone'}</strong> accepted your friend request
                    </p>
                    <div className="notification-meta">Now you’re friends</div>
                  </div>
                </div>
              );
            }

            if (['post_comment', 'comment_reply', 'reaction', 'follow', 'notification'].includes(item.type)) {
              const user = item.user || {};
              const username = user.username || 'Someone';
              const message =
                item.type === 'post_comment'
                  ? 'commented on your post'
                  : item.type === 'comment_reply'
                  ? 'replied to your comment'
                  : item.type === 'reaction'
                  ? 'reacted to your post'
                  : item.type === 'follow'
                  ? 'started following you'
                  : 'sent you a notification';

              const snippet = item.commentContent || item.postContent || '';

              return (
                <div key={item.id} className="notification-card">
                  <div className="notification-avatar">
                    {user.profileImage || user.profile_image ? (
                      <img src={user.profileImage || user.profile_image} alt={username} />
                    ) : (
                      <div className="avatar-placeholder">
                        {username?.charAt(0).toUpperCase() || '?'}
                      </div>
                    )}
                  </div>
                  <div className="notification-content">
                    <p>
                      <strong>{username}</strong> {message}
                    </p>
                    {snippet && <div className="notification-meta">{snippet}</div>}
                  </div>
                </div>
              );
            }

            return null;
          })}
        </div>
      )}
    </div>
  );
}