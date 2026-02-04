// src/components/Discover/Discover.jsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import './Discover.css';

export default function Discover() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState({});

  function getUserHandle(userObj) {
    return (userObj?.username || userObj?.user?.username || userObj?.name || '').toLowerCase();
  }

  useEffect(() => {
    loadDiscover();
  }, []);

  async function loadDiscover() {
    try {
      setLoading(true);
      const [usersData, blockedData, friendsData] = await Promise.all([
        api.getUsers(),
        api.getBlockedUsers(),
        api.getFriends()
      ]);

      const friendList = friendsData.friends || friendsData || [];
      setFriends(friendList);

      const blockedList = blockedData?.blocks || blockedData?.blocked || blockedData?.users || blockedData || [];
      const blockedHandles = new Set(
        (Array.isArray(blockedList) ? blockedList : [])
          .map(getUserHandle)
          .filter(Boolean)
      );

      const allUsers = usersData.users || usersData || [];
      const filtered = allUsers
        .filter((u) => getUserHandle(u) !== user?.username?.toLowerCase?.())
        .filter((u) => {
          const handle = getUserHandle(u);
          if (handle && blockedHandles.has(handle)) return false;
          return true;
        });

      setUsers(filtered);
    } catch (error) {
      console.error('Load discover error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendRequest(username) {
    try {
      setPendingRequests((prev) => ({ ...prev, [username]: true }));
      await api.sendFriendRequest(username);
    } catch (error) {
      console.error('Send friend request error:', error);
      setPendingRequests((prev) => ({ ...prev, [username]: false }));
      alert('Failed to send friend request');
    }
  }

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    return users.filter((u) => u.username?.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [users, searchQuery]);

  const friendHandleSet = useMemo(() => {
    return new Set(
      (friends || [])
        .map((friend) => friend.username || friend.user?.username || friend.name)
        .filter(Boolean)
        .map((name) => name.toLowerCase())
    );
  }, [friends]);

  return (
    <div className="discover-page">
      <div className="discover-header">
        <div>
          <h1>Discover</h1>
          <p>Find people to connect with</p>
        </div>
        <div className="discover-search">
          <input
            type="text"
            placeholder="Search people..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="discover-loading">Loading people...</div>
      ) : (
        <div className="discover-layout">
          <section className="discover-section">
            <div className="section-header">
              <h2>People on Hyve Social</h2>
              <span>{filteredUsers.length} people</span>
            </div>
            {filteredUsers.length === 0 ? (
              <div className="discover-empty">No users found.</div>
            ) : (
              <div className="users-grid">
                {filteredUsers.map((person) => {
                  const username = person.username || person.name || 'User';
                  const profileHandle = person.username || person.name || '';
                  const isFriend = friendHandleSet.has(username.toLowerCase());
                  return (
                    <div
                      key={username}
                      className="user-card"
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (!profileHandle) return;
                        navigate(`/profile/${encodeURIComponent(profileHandle)}`);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (!profileHandle) return;
                          navigate(`/profile/${encodeURIComponent(profileHandle)}`);
                        }
                      }}
                    >
                      <div className="user-card-info">
                        <div className="user-avatar">
                          {person.profile_image ? (
                            <img src={person.profile_image} alt={person.username} />
                          ) : (
                            <div className="avatar-placeholder">
                              {person.username?.charAt(0).toUpperCase() || '?'}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="user-name">{person.username}</div>
                          {person.bio && <div className="user-bio">{person.bio}</div>}
                        </div>
                      </div>
                      {isFriend ? (
                        <span className="friend-badge">Friends</span>
                      ) : (
                        <button
                          className="btn-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendRequest(username);
                          }}
                          disabled={pendingRequests[username]}
                        >
                          {pendingRequests[username] ? 'Requested' : 'Add Friend'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
