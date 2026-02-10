import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import { UsersIcon, MailIcon, StarIcon } from '../Icons/Icons';
import './Friends.css';

export default function Friends() {
  const navigate = useNavigate();
  const { user, socket } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [mutualCounts, setMutualCounts] = useState({});
  const [presenceMap, setPresenceMap] = useState({});
  const [blockedUsers, setBlockedUsers] = useState([]);

  function getUserHandle(userObj) {
    return (userObj?.username || userObj?.user?.username || userObj?.name || '').toLowerCase();
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadPresence();
  }, []);

  useEffect(() => {
    setMutualCounts({});
  }, [friends]);

  useEffect(() => {
    if (!socket) return;

    const handleFriendRequest = () => {
      loadData();
    };

    const handleFriendAccepted = () => {
      loadData();
    };

    const handlePresenceUpdate = (payload) => {
      const username = payload?.username;
      if (!username) return;

      setPresenceMap((prev) => ({
        ...prev,
        [username.toLowerCase()]: {
          username,
          online: payload?.status === 'online',
          lastSeen: payload?.lastSeen || prev?.[username.toLowerCase()]?.lastSeen || null
        }
      }));
    };

    socket.on('friend_request', handleFriendRequest);
    socket.on('friend_request_accepted', handleFriendAccepted);
    socket.on('presence:update', handlePresenceUpdate);

    return () => {
      socket.off('friend_request', handleFriendRequest);
      socket.off('friend_request_accepted', handleFriendAccepted);
      socket.off('presence:update', handlePresenceUpdate);
    };
  }, [socket]);

  async function loadData() {
    try {
      setLoading(true);

      const [friendsData, requestsData, usersData, blockedData] = await Promise.all([
        api.getFriends(),
        api.getFriendRequests(),
        api.getUsers(),
        api.getBlockedUsers ? api.getBlockedUsers() : Promise.resolve({ blocked: [] })
      ]);

      const blockedList = blockedData.blocks || blockedData.blocked || blockedData.users || blockedData || [];
      const blockedHandleSet = new Set(
        (Array.isArray(blockedList) ? blockedList : [])
          .map(getUserHandle)
          .filter(Boolean)
      );
      setBlockedUsers(Array.isArray(blockedList) ? blockedList : []);

      const filteredFriends = (friendsData.friends || friendsData || []).filter((friend) => {
        const handle = getUserHandle(friend);
        if (handle && blockedHandleSet.has(handle)) return false;
        return true;
      });
      setFriends(filteredFriends);

      await loadPresence();

      const filteredRequests = (requestsData.requests || []).filter((request) => {
        const handle = getUserHandle(request);
        if (handle && blockedHandleSet.has(handle)) return false;
        return true;
      });
      setFriendRequests(filteredRequests);

      const currentFriendHandles = filteredFriends.map((f) => getUserHandle(f)).filter(Boolean);
      const requestHandles = filteredRequests.map((r) => getUserHandle(r)).filter(Boolean);
      const filtered = (usersData.users || [])
        .filter((u) => getUserHandle(u) !== user?.username?.toLowerCase?.())
        .filter((u) => !currentFriendHandles.includes(getUserHandle(u)))
        .filter((u) => !requestHandles.includes(getUserHandle(u)))
        .filter((u) => {
          const handle = getUserHandle(u);
          if (handle && blockedHandleSet.has(handle)) return false;
          return true;
        })
        .slice(0, 20);
      setSuggestions(filtered);
    } catch (error) {
      console.error('Failed to load friends data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadPresence() {
    if (!api.getPresence) return;
    try {
      const data = await api.getPresence();
      const presenceList = data?.presence || [];
      const nextMap = {};
      presenceList.forEach((entry) => {
        const username = entry?.username;
        if (username) {
          const key = username.toLowerCase();
          nextMap[key] = {
            username,
            online: !!entry?.online,
            lastSeen: entry?.lastSeen || null
          };
        }
      });
      setPresenceMap(nextMap);
    } catch (error) {
      console.error('Failed to load presence:', error);
      setPresenceMap({});
    }
  }

  async function handleUnfriend(username) {
    if (!confirm('Are you sure you want to remove this friend?')) return;
    
    try {
      await api.removeFriend(username);
      setFriends(friends.filter(f => getUserHandle(f) !== username.toLowerCase()));
    } catch (error) {
      console.error('Failed to unfriend:', error);
    }
  }

  async function handleAddFriend(username) {
    try {
      await api.sendFriendRequest(username);
      setSuggestions(suggestions.filter(s => getUserHandle(s) !== username.toLowerCase()));
      await loadData();
    } catch (error) {
      console.error('Failed to add friend:', error);
    }
  }

  async function handleAcceptRequest(requestId) {
    try {
      await api.acceptFriendRequest(requestId);
      await loadData();
    } catch (error) {
      console.error('Failed to accept request:', error);
    }
  }

  async function handleDeclineRequest(requestId) {
    try {
      await api.declineFriendRequest(requestId);
      setFriendRequests(friendRequests.filter(r => r.id !== requestId));
    } catch (error) {
      console.error('Failed to decline request:', error);
    }
  }

  function openChat(person) {
    const username = person?.username || person?.name || 'User';
    const profileImage = person?.profile_image || person?.profileImage || '';

    window.dispatchEvent(
      new CustomEvent('open-chat', {
        detail: { username, profileImage }
      })
    );
  }

  function getFilteredList() {
    let list = [];
    if (activeTab === 'all') list = friends;
    if (activeTab === 'requests') list = friendRequests;
    if (activeTab === 'suggestions') list = suggestions;

    if (!searchQuery) return list;

    return list.filter(item => 
      item.username?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  const filteredList = getFilteredList();

  return (
    <div className="friends-page">
      <div className="friends-header">
        <h1>Friends</h1>
        <div className="friends-search">
          <input
            type="text"
            placeholder="Search friends..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="friends-tabs">
        <button
          className={`tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <span className="tab-icon"><UsersIcon size={18} /></span>
          All Friends
          <span className="tab-count">{friends.length}</span>
        </button>
        <button
          className={`tab ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          <span className="tab-icon"><MailIcon size={18} /></span>
          Friend Requests
          {friendRequests.length > 0 && (
            <span className="tab-count badge">{friendRequests.length}</span>
          )}
        </button>
        <button
          className={`tab ${activeTab === 'suggestions' ? 'active' : ''}`}
          onClick={() => setActiveTab('suggestions')}
        >
          <span className="tab-icon"><StarIcon size={18} /></span>
          Suggestions
          <span className="tab-count">{suggestions.length}</span>
        </button>
      </div>

      <div className="friends-content">
        {loading ? (
          <div className="friends-loading">
            <div className="spinner"></div>
            <p>Loading...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="friends-empty">
            <div className="empty-icon">
              {activeTab === 'all' && <UsersIcon size={48} />}
              {activeTab === 'requests' && <MailIcon size={48} />}
              {activeTab === 'suggestions' && <StarIcon size={48} />}
            </div>
            <h3>
              {activeTab === 'all' && 'No friends yet'}
              {activeTab === 'requests' && 'No friend requests'}
              {activeTab === 'suggestions' && 'No suggestions available'}
            </h3>
            <p>
              {activeTab === 'all' && 'Start connecting with people!'}
              {activeTab === 'requests' && "You don't have any pending requests"}
              {activeTab === 'suggestions' && 'Check back later for suggestions'}
            </p>
          </div>
        ) : (
          <div className="friends-grid">
            {filteredList.map((person) => {
              const username = person.username || person.name || 'User';
              const presenceKey = username.toLowerCase();
              return (
              <div key={person.id || username} className="friend-card">
                <div 
                  className="friend-card-clickable"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/profile/${encodeURIComponent(username || 'unknown')}`);
                  }}
                >
                  <div className="friend-card-header">
                    <div className="friend-avatar">
                      {person.profile_image ? (
                        <img src={person.profile_image} alt={username} />
                      ) : (
                        <div className="avatar-placeholder">
                          {username?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                    {presenceMap[presenceKey]?.online && (
                      <div className="online-indicator"></div>
                    )}
                  </div>

                  <div className="friend-card-body">
                    <h3 className="friend-name">
                      {username}
                    </h3>
                    {person.bio && <p className="friend-bio">{person.bio}</p>}
                    {activeTab === 'all' && (
                      <p className="friend-mutual">
                        {(mutualCounts[username.toLowerCase()] || 0)} mutual friends
                      </p>
                    )}
                  </div>
                </div>

                <div className="friend-card-actions">
                  {activeTab === 'all' && (
                    <>
                      <button
                        className="btn-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          openChat(person);
                        }}
                      >
                        Message
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnfriend(username);
                        }}
                      >
                        Unfriend
                      </button>
                    </>
                  )}

                  {activeTab === 'requests' && (
                    <>
                      <button
                        className="btn-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAcceptRequest(person.id);
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeclineRequest(person.id);
                        }}
                      >
                        Delete
                      </button>
                    </>
                  )}

                  {activeTab === 'suggestions' && (
                    <>
                      <button
                        className="btn-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddFriend(username);
                        }}
                      >
                        Add Friend
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSuggestions(suggestions.filter(s => getUserHandle(s) !== username.toLowerCase()));
                        }}
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </div>
            );})}
          </div>
        )}
      </div>

    </div>
  );
}