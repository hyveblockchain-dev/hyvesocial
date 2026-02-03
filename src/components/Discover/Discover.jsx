// src/components/Discover/Discover.jsx
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import './Discover.css';

export default function Discover() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState({});

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

      const blockedAddresses = new Set(
        (blockedData.blocked || []).map((blocked) => blocked.wallet_address).filter(Boolean)
      );

      const allUsers = usersData.users || usersData || [];
      const filtered = allUsers
        .filter((u) => u.wallet_address !== user?.walletAddress)
        .filter((u) => !blockedAddresses.has(u.wallet_address));

      setUsers(filtered);
    } catch (error) {
      console.error('Load discover error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendRequest(address) {
    try {
      setPendingRequests((prev) => ({ ...prev, [address]: true }));
      await api.sendFriendRequest(address);
    } catch (error) {
      console.error('Send friend request error:', error);
      setPendingRequests((prev) => ({ ...prev, [address]: false }));
      alert('Failed to send friend request');
    }
  }

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    return users.filter((u) => u.username?.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [users, searchQuery]);

  const friendAddressSet = useMemo(() => {
    return new Set(
      (friends || [])
        .map((friend) => friend.wallet_address || friend.walletAddress || friend.address)
        .filter(Boolean)
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
                  const isFriend = friendAddressSet.has(person.wallet_address);
                  return (
                    <div key={person.wallet_address} className="user-card">
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
                          onClick={() => handleSendRequest(person.wallet_address)}
                          disabled={pendingRequests[person.wallet_address]}
                        >
                          {pendingRequests[person.wallet_address] ? 'Requested' : 'Add Friend'}
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
