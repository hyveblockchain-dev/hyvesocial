// src/components/Profile/Profile.jsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import Post from '../Post/Post';
import './Profile.css';

export default function Profile() {
  const { address } = useParams();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('posts');
  const [friendshipStatus, setFriendshipStatus] = useState('none');
  const [requestId, setRequestId] = useState(null);
  const [friends, setFriends] = useState([]);

  const isOwnProfile = address?.toLowerCase() === currentUser?.walletAddress?.toLowerCase();

  useEffect(() => {
    if (address) {
      loadProfile();
      loadPosts();
      if (!isOwnProfile) {
        checkFriendshipStatus();
      }
      if (activeTab === 'friends') {
        loadFriends();
      }
    }
  }, [address, activeTab]);

  async function loadProfile() {
    try {
      setLoading(true);
      const data = await api.getProfile(address);
      setProfile(data.user);
    } catch (error) {
      console.error('Load profile error:', error);
      setError('Profile not found');
    } finally {
      setLoading(false);
    }
  }

  async function loadPosts() {
    try {
      const data = await api.getUserPosts(address);
      setPosts(data.posts || []);
    } catch (error) {
      console.error('Load posts error:', error);
    }
  }

  async function checkFriendshipStatus() {
    try {
      const data = await api.getFriendshipStatus(address);
      setFriendshipStatus(data.status);
      setRequestId(data.requestId || null);
    } catch (error) {
      console.error('Check friendship error:', error);
    }
  }

  async function loadFriends() {
    try {
      const data = await api.getFriends();
      setFriends(data.friends || []);
    } catch (error) {
      console.error('Load friends error:', error);
    }
  }

  async function handleAddFriend() {
    try {
      await api.sendFriendRequest(address);
      setFriendshipStatus('request_sent');
    } catch (error) {
      console.error('Send friend request error:', error);
      alert(error.response?.data?.error || 'Failed to send friend request');
    }
  }

  async function handleAcceptRequest() {
    if (!requestId) return;
    
    try {
      await api.acceptFriendRequest(requestId);
      setFriendshipStatus('friends');
      setRequestId(null);
    } catch (error) {
      console.error('Accept friend request error:', error);
      alert('Failed to accept friend request');
    }
  }

  async function handleDeclineRequest() {
    if (!requestId) return;
    
    if (!confirm('Decline this friend request?')) return;
    
    try {
      await api.declineFriendRequest(requestId);
      setFriendshipStatus('none');
      setRequestId(null);
    } catch (error) {
      console.error('Decline friend request error:', error);
      alert('Failed to decline friend request');
    }
  }

  async function handleRemoveFriend() {
    if (!confirm('Remove this friend?')) return;
    
    try {
      await api.removeFriend(address);
      setFriendshipStatus('none');
    } catch (error) {
      console.error('Remove friend error:', error);
      alert('Failed to remove friend');
    }
  }

  function handlePostDeleted(postId) {
    setPosts(posts.filter(p => p.id !== postId));
  }

  function handlePostUpdated(updatedPost) {
    setPosts(posts.map(p => p.id === updatedPost.id ? updatedPost : p));
  }

  if (loading) {
    return (
      <div className="profile-container">
        <div className="profile-loading">Loading profile...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-container">
        <div className="profile-error">{error}</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-container">
        <div className="profile-error">Profile not found</div>
      </div>
    );
  }

  const friendCount = friends.length;

  return (
    <div className="profile-container">
      {/* Cover Image */}
      <div className="profile-cover">
        {profile.coverImage && (
          <img src={profile.coverImage} alt="Cover" />
        )}
      </div>

      {/* Profile Header */}
      <div className="profile-header">
        <div className="profile-avatar-large">
          {profile.profileImage ? (
            <img src={profile.profileImage} alt={profile.username} />
          ) : (
            <div className="avatar-placeholder">
              {profile.username?.charAt(0).toUpperCase() || '?'}
            </div>
          )}
        </div>

        <div className="profile-info">
          <h1>{profile.username}</h1>
          <p className="profile-address">
            {profile.walletAddress?.slice(0, 6)}...{profile.walletAddress?.slice(-4)}
          </p>
          {profile.bio && <p className="profile-bio">{profile.bio}</p>}
          
          <div className="profile-meta">
            {profile.location && <span>📍 {profile.location}</span>}
            {profile.website && (
              <a href={profile.website} target="_blank" rel="noopener noreferrer">
                🔗 {profile.website}
              </a>
            )}
          </div>
        </div>

        <div className="profile-actions">
          {!isOwnProfile && (
            <>
              {friendshipStatus === 'none' && (
                <button className="btn-add-friend" onClick={handleAddFriend}>
                  ➕ Add Friend
                </button>
              )}
              
              {friendshipStatus === 'request_sent' && (
                <button className="btn-pending" disabled>
                  ⏳ Request Sent
                </button>
              )}
              
              {friendshipStatus === 'request_received' && (
                <div className="friend-request-actions">
                  <button className="btn-accept" onClick={handleAcceptRequest}>
                    ✓ Accept
                  </button>
                  <button className="btn-decline" onClick={handleDeclineRequest}>
                    ✕ Decline
                  </button>
                </div>
              )}
              
              {friendshipStatus === 'friends' && (
                <button className="btn-remove-friend" onClick={handleRemoveFriend}>
                  ❌ Remove Friend
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="profile-stats">
        <div className="stat-box">
          <div className="stat-number">{posts.length}</div>
          <div className="stat-label">Posts</div>
        </div>
        <div className="stat-box">
          <div className="stat-number">{friendCount}</div>
          <div className="stat-label">Friends</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="profile-tabs">
        <button
          className={activeTab === 'posts' ? 'tab-active' : ''}
          onClick={() => setActiveTab('posts')}
        >
          Posts
        </button>
        <button
          className={activeTab === 'albums' ? 'tab-active' : ''}
          onClick={() => setActiveTab('albums')}
        >
          Albums
        </button>
        <button
          className={activeTab === 'friends' ? 'tab-active' : ''}
          onClick={() => setActiveTab('friends')}
        >
          Friends
        </button>
      </div>

      {/* Content */}
      <div className="profile-content">
        {activeTab === 'posts' && (
          <div className="posts-list">
            {posts.length === 0 ? (
              <div className="no-posts">No posts yet</div>
            ) : (
              posts.map(post => (
                <Post
                  key={post.id}
                  post={post}
                  onDelete={handlePostDeleted}
                  onUpdate={handlePostUpdated}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'albums' && (
          <div className="coming-soon">
            📸 Albums coming soon
          </div>
        )}

        {activeTab === 'friends' && (
          <div className="friends-grid">
            {friends.length === 0 ? (
              <div className="no-friends">No friends yet</div>
            ) : (
              friends.map(friend => (
                <div key={friend.wallet_address} className="friend-card">
                  {friend.profile_image ? (
                    <img src={friend.profile_image} alt={friend.username} />
                  ) : (
                    <div className="friend-avatar">
                      {friend.username?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}
                  <h3>{friend.username}</h3>
                  <a href={`/profile/${friend.wallet_address}`}>View Profile</a>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}