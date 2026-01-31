import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import './Friends.css';

export default function Friends() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPerson, setChatPerson] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      
      const followingData = await api.getFollowing();
      setFriends(followingData.following || []);

      const requestsData = await api.getFriendRequests();
      setFriendRequests(requestsData.requests || []);

      const usersData = await api.getUsers();
      const currentFriendAddresses = (followingData.following || []).map(f => f.wallet_address);
      const filtered = (usersData.users || [])
        .filter(u => u.wallet_address !== user?.walletAddress)
        .filter(u => !currentFriendAddresses.includes(u.wallet_address))
        .slice(0, 20);
      setSuggestions(filtered);
    } catch (error) {
      console.error('Failed to load friends data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleUnfriend(address) {
    if (!confirm('Are you sure you want to remove this friend?')) return;
    
    try {
      await api.unfollowUser(address);
      setFriends(friends.filter(f => f.wallet_address !== address));
    } catch (error) {
      console.error('Failed to unfriend:', error);
    }
  }

  async function handleAddFriend(address) {
    try {
      await api.followUser(address);
      setSuggestions(suggestions.filter(s => s.wallet_address !== address));
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
    setChatPerson(person);
    setChatOpen(true);
  }

  function closeChat() {
    setChatOpen(false);
    setChatPerson(null);
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
          <span className="tab-icon">👥</span>
          All Friends
          <span className="tab-count">{friends.length}</span>
        </button>
        <button
          className={`tab ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          <span className="tab-icon">📬</span>
          Friend Requests
          {friendRequests.length > 0 && (
            <span className="tab-count badge">{friendRequests.length}</span>
          )}
        </button>
        <button
          className={`tab ${activeTab === 'suggestions' ? 'active' : ''}`}
          onClick={() => setActiveTab('suggestions')}
        >
          <span className="tab-icon">✨</span>
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
              {activeTab === 'all' && '👥'}
              {activeTab === 'requests' && '📬'}
              {activeTab === 'suggestions' && '✨'}
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
            {filteredList.map((person) => (
              <div key={person.wallet_address || person.id} className="friend-card">
                <div 
                  className="friend-card-clickable"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/profile/${person.wallet_address}`);
                  }}
                >
                  <div className="friend-card-header">
                    <div className="friend-avatar">
                      {person.profile_image ? (
                        <img src={person.profile_image} alt={person.username} />
                      ) : (
                        <div className="avatar-placeholder">
                          {person.username?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                    <div className="online-indicator"></div>
                  </div>

                  <div className="friend-card-body">
                    <h3 className="friend-name">
                      {person.username}
                    </h3>
                    {person.bio && <p className="friend-bio">{person.bio}</p>}
                    {activeTab === 'all' && (
                      <p className="friend-mutual">12 mutual friends</p>
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
                          handleUnfriend(person.wallet_address);
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
                          handleAddFriend(person.wallet_address);
                        }}
                      >
                        Add Friend
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSuggestions(suggestions.filter(s => s.wallet_address !== person.wallet_address));
                        }}
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chat Modal */}
      {chatOpen && chatPerson && (
        <div className="chat-modal-overlay" onClick={closeChat}>
          <div className="chat-modal" onClick={(e) => e.stopPropagation()}>
            <div className="chat-modal-header">
              <div className="chat-modal-user">
                <div className="chat-modal-avatar">
                  {chatPerson.profile_image ? (
                    <img src={chatPerson.profile_image} alt={chatPerson.username} />
                  ) : (
                    <div className="avatar-placeholder-small">
                      {chatPerson.username?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                </div>
                <div>
                  <h4>{chatPerson.username}</h4>
                  <span className="chat-status">Active now</span>
                </div>
              </div>
              <button className="chat-close" onClick={closeChat}>✕</button>
            </div>
            <div className="chat-modal-body">
              <div className="chat-empty">
                <div className="chat-empty-icon">💬</div>
                <p>Start a conversation with {chatPerson.username}</p>
              </div>
            </div>
            <div className="chat-modal-footer">
              <input
                type="text"
                placeholder="Type a message..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && e.target.value.trim()) {
                    // TODO: Send message
                    console.log('Send message:', e.target.value);
                    e.target.value = '';
                  }
                }}
              />
              <button className="chat-send">Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}