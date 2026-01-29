// src/components/Profile/Profile.jsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import Post from '../Post/Post';
import './Profile.css';

export default function Profile() {
  const { address } = useParams();
  const { user } = useAuth();
  const [profileUser, setProfileUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');

  const isOwnProfile = user?.walletAddress === address;

  useEffect(() => {
    loadProfile();
  }, [address]);

  async function loadProfile() {
    try {
      setLoading(true);
      const [profileData, postsData] = await Promise.all([
        api.getProfile(address),
        api.getUserPosts(address)
      ]);
      
      setProfileUser(profileData.user);
      setPosts(postsData.posts || []);
    } catch (error) {
      console.error('Load profile error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleFollow() {
    try {
      if (following) {
        await api.unfollowUser(address);
        setFollowing(false);
        setProfileUser({
          ...profileUser,
          followerCount: profileUser.followerCount - 1
        });
      } else {
        await api.followUser(address);
        setFollowing(true);
        setProfileUser({
          ...profileUser,
          followerCount: profileUser.followerCount + 1
        });
      }
    } catch (error) {
      console.error('Follow error:', error);
      alert('Failed to follow/unfollow user');
    }
  }

  function handlePostDeleted(postId) {
    setPosts(posts.filter(p => p.id !== postId));
  }

  if (loading) {
    return (
      <div className="profile-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="profile-page">
        <div className="error-container">
          <p>Profile not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-cover">
        <div className="cover-image"></div>
      </div>

      <div className="profile-header">
        <div className="profile-avatar-large">
          {profileUser.username?.charAt(0).toUpperCase() || '?'}
        </div>

        <div className="profile-info">
          <h1>{profileUser.username}</h1>
          <p className="profile-address">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </p>
          {profileUser.bio && <p className="profile-bio">{profileUser.bio}</p>}
          
          {profileUser.location && (
            <p className="profile-detail">📍 {profileUser.location}</p>
          )}
          {profileUser.website && (
            <p className="profile-detail">
              🔗 <a href={profileUser.website} target="_blank" rel="noopener noreferrer">
                {profileUser.website}
              </a>
            </p>
          )}
        </div>

        {!isOwnProfile && (
          <button onClick={handleFollow} className="follow-button">
            {following ? 'Unfollow' : 'Follow'}
          </button>
        )}
      </div>

      <div className="profile-stats">
        <div className="stat">
          <span className="stat-number">{posts.length}</span>
          <span className="stat-label">Posts</span>
        </div>
        <div className="stat">
          <span className="stat-number">{profileUser.followerCount || 0}</span>
          <span className="stat-label">Followers</span>
        </div>
        <div className="stat">
          <span className="stat-number">{profileUser.followingCount || 0}</span>
          <span className="stat-label">Following</span>
        </div>
      </div>

      <div className="profile-tabs">
        <button 
          className={activeTab === 'posts' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('posts')}
        >
          Posts
        </button>
        <button 
          className={activeTab === 'albums' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('albums')}
        >
          Albums
        </button>
      </div>

      <div className="profile-content">
        {activeTab === 'posts' && (
          <div className="profile-posts">
            {posts.length === 0 ? (
              <div className="empty-state">
                <p>No posts yet</p>
              </div>
            ) : (
              posts.map(post => (
                <Post 
                  key={post.id} 
                  post={post}
                  onDelete={handlePostDeleted}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'albums' && (
          <div className="profile-albums">
            <p>Albums coming soon...</p>
          </div>
        )}
      </div>
    </div>
  );
}
