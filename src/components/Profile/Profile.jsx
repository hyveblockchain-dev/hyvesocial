// src/components/Profile/Profile.jsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import Post from '../Post/Post';
import { compressImage } from '../../utils/imageCompression';
import './Profile.css';

export default function Profile() {
  const { address } = useParams();
  const { user, setUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [activeTab, setActiveTab] = useState('posts');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [friendshipStatus, setFriendshipStatus] = useState('none');
  const [requestId, setRequestId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [showUploadToAlbum, setShowUploadToAlbum] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  
  const isOwnProfile = user?.walletAddress === address;

  useEffect(() => {
    loadProfile();
    loadPosts();
    loadAlbums();
    if (!isOwnProfile && user) {
      checkFriendshipStatus();
    }
  }, [address, user]);

  async function loadProfile() {
    try {
      setLoading(true);
      const data = await api.getUserProfile(address);
      setProfile(data.user);
      
      // Update user context if viewing own profile
      if (isOwnProfile) {
        setUser(data.user);
      }
    } catch (error) {
      console.error('Load profile error:', error);
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

  async function loadAlbums() {
    try {
      const data = await api.getAlbums(address);
      setAlbums(data.albums || []);
    } catch (error) {
      console.error('Load albums error:', error);
    }
  }

  async function checkFriendshipStatus() {
    try {
      const data = await api.getFriendshipStatus(address);
      setFriendshipStatus(data.status || 'none');
      setRequestId(data.requestId || null);
    } catch (error) {
      console.error('Check friendship error:', error);
    }
  }

  async function handleAddFriend() {
    try {
      setActionLoading(true);
      await api.sendFriendRequest(address);
      setFriendshipStatus('request_sent');
    } catch (error) {
      console.error('Send friend request error:', error);
      alert(error?.message || 'Failed to send friend request');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAcceptRequest() {
    if (!requestId) return;
    try {
      setActionLoading(true);
      await api.acceptFriendRequest(requestId);
      setFriendshipStatus('friends');
      setRequestId(null);
    } catch (error) {
      console.error('Accept friend request error:', error);
      alert('Failed to accept friend request');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeclineRequest() {
    if (!requestId) return;
    if (!confirm('Decline this friend request?')) return;
    try {
      setActionLoading(true);
      await api.declineFriendRequest(requestId);
      setFriendshipStatus('none');
      setRequestId(null);
    } catch (error) {
      console.error('Decline friend request error:', error);
      alert('Failed to decline friend request');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRemoveFriend() {
    if (!confirm('Remove this friend?')) return;
    try {
      setActionLoading(true);
      await api.removeFriend(address);
      setFriendshipStatus('none');
    } catch (error) {
      console.error('Remove friend error:', error);
      alert('Failed to remove friend');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleBlockUser() {
    if (!confirm('Block this user?')) return;
    try {
      setActionLoading(true);
      await api.blockUser(address);
      setFriendshipStatus('blocked');
      setRequestId(null);
    } catch (error) {
      console.error('Block user error:', error);
      alert('Failed to block user');
    } finally {
      setActionLoading(false);
    }
  }

  function handleMessageUser() {
    const conversation = {
      address: profile?.walletAddress || profile?.wallet_address || address,
      username: profile?.username || 'User',
      profileImage: profile?.profileImage || profile?.profile_image || ''
    };

    window.dispatchEvent(new CustomEvent('open-chat', { detail: conversation }));
  }

  async function handleCreateAlbum(e) {
    e.preventDefault();
    if (!newAlbumName.trim()) return;

    try {
      await api.createAlbum(newAlbumName);
      setNewAlbumName('');
      setShowCreateAlbum(false);
      loadAlbums();
    } catch (error) {
      console.error('Create album error:', error);
    }
  }

  async function handleUploadToAlbum(albumId) {
    if (!selectedFile) return;

    try {
      setUploading(true);
      
      // Compress image before upload
      console.log('Original size:', (selectedFile.size / 1024 / 1024).toFixed(2), 'MB');
      const compressedFile = await compressImage(selectedFile, 2, 1920);
      console.log('Compressed size:', (compressedFile.size / 1024 / 1024).toFixed(2), 'MB');
      
      const formData = new FormData();
      formData.append('image', compressedFile);
      formData.append('albumId', albumId);

      await api.uploadToAlbum(formData);
      setSelectedFile(null);
      setShowUploadToAlbum(false);
      
      // Reload album to show new photo
      const data = await api.getAlbumPhotos(albumId);
      setSelectedAlbum({ ...selectedAlbum, photos: data.photos });
    } catch (error) {
      console.error('Upload to album error:', error);
      alert('Failed to upload photo. Please try a smaller image.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeletePhoto(photoId) {
    if (!confirm('Delete this photo?')) return;

    try {
      await api.deleteAlbumPhoto(photoId);
      // Reload album photos
      const data = await api.getAlbumPhotos(selectedAlbum.id);
      setSelectedAlbum({ ...selectedAlbum, photos: data.photos });
    } catch (error) {
      console.error('Delete photo error:', error);
    }
  }

  async function handleDeleteAlbum(albumId) {
    if (!confirm('Delete this album and all its photos?')) return;

    try {
      await api.deleteAlbum(albumId);
      setSelectedAlbum(null);
      loadAlbums();
    } catch (error) {
      console.error('Delete album error:', error);
    }
  }

  async function handleViewAlbum(album) {
    try {
      const data = await api.getAlbumPhotos(album.id);
      setSelectedAlbum({ ...album, photos: data.photos });
    } catch (error) {
      console.error('Load album photos error:', error);
    }
  }

  async function handleUpdateProfilePicture(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      
      // Compress image before upload
      console.log('Original size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
      const compressedFile = await compressImage(file, 2, 1920);
      console.log('Compressed size:', (compressedFile.size / 1024 / 1024).toFixed(2), 'MB');
      
      const formData = new FormData();
      formData.append('profileImage', compressedFile);

      const result = await api.updateProfile(formData);
      
      // Update both profile state and user context
      if (result.user) {
        setProfile(result.user);
        setUser(result.user);
      }
      
      // Reload everything to ensure consistency
      await loadProfile();
      await loadAlbums();
    } catch (error) {
      console.error('Update profile picture error:', error);
      alert('Failed to update profile picture. Please try a smaller image.');
    } finally {
      setUploading(false);
    }
  }

  async function handleUpdateCoverPhoto(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      
      // Compress image before upload
      console.log('Original size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
      const compressedFile = await compressImage(file, 2, 1920);
      console.log('Compressed size:', (compressedFile.size / 1024 / 1024).toFixed(2), 'MB');
      
      const formData = new FormData();
      formData.append('coverImage', compressedFile);

      const result = await api.updateProfile(formData);
      
      // Update both profile state and user context
      if (result.user) {
        setProfile(result.user);
        setUser(result.user);
      }
      
      // Reload everything to ensure consistency
      await loadProfile();
      await loadAlbums();
    } catch (error) {
      console.error('Update cover photo error:', error);
      alert('Failed to update cover photo. Please try a smaller image.');
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return <div className="loading-container"><div className="spinner"></div></div>;
  }

  if (!profile) {
    return <div className="error-container">Profile not found</div>;
  }

  return (
    <div className="profile-page">
      {/* Cover Photo */}
      <div className="cover-photo">
        {profile.coverImage ? (
          <img src={profile.coverImage} alt="Cover" />
        ) : (
          <div className="cover-placeholder"></div>
        )}
        {isOwnProfile && (
          <label className={`edit-cover-btn ${uploading ? 'disabled' : ''}`}>
            {uploading ? '⏳ Uploading...' : '📷 Change Cover'}
            <input
              type="file"
              accept="image/*"
              onChange={handleUpdateCoverPhoto}
              style={{ display: 'none' }}
              disabled={uploading}
            />
          </label>
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
          {isOwnProfile && (
            <label className={`edit-avatar-btn ${uploading ? 'disabled' : ''}`}>
              {uploading ? '⏳' : '📷'}
              <input
                type="file"
                accept="image/*"
                onChange={handleUpdateProfilePicture}
                style={{ display: 'none' }}
                disabled={uploading}
              />
            </label>
          )}
        </div>

        <div className="profile-info">
          <h1>{profile.username || 'Anonymous'}</h1>
          {profile.bio && <p className="profile-bio">{profile.bio}</p>}
        </div>

        {!isOwnProfile && (
          <div className="profile-actions">
            {friendshipStatus === 'none' && (
              <button
                className="btn-add-friend"
                onClick={handleAddFriend}
                disabled={actionLoading}
              >
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
                <button
                  className="btn-accept"
                  onClick={handleAcceptRequest}
                  disabled={actionLoading}
                >
                  ✓ Accept
                </button>
                <button
                  className="btn-decline"
                  onClick={handleDeclineRequest}
                  disabled={actionLoading}
                >
                  ✕ Decline
                </button>
              </div>
            )}

            {friendshipStatus === 'friends' && (
              <button
                className="btn-remove-friend"
                onClick={handleRemoveFriend}
                disabled={actionLoading}
              >
                ❌ Remove Friend
              </button>
            )}

            {friendshipStatus === 'blocked' && (
              <button className="btn-blocked" disabled>
                🚫 Blocked
              </button>
            )}

            {friendshipStatus !== 'blocked' && (
              <button
                className="btn-block"
                onClick={handleBlockUser}
                disabled={actionLoading}
              >
                🚫 Block
              </button>
            )}

            <button
              className="btn-message"
              onClick={handleMessageUser}
              disabled={actionLoading}
            >
              💬 Message
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="profile-tabs">
        <button
          className={activeTab === 'posts' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('posts')}
        >
          Posts ({posts.length})
        </button>
        <button
          className={activeTab === 'albums' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('albums')}
        >
          Albums ({albums.length})
        </button>
      </div>

      {/* Content */}
      <div className="profile-content">
        {activeTab === 'posts' && (
          <div className="posts-list">
            {posts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📝</div>
                <div className="empty-state-title">No posts yet</div>
                <div className="empty-state-description">
                  {isOwnProfile ? 'Share your first post!' : 'No posts to show'}
                </div>
              </div>
            ) : (
              posts.map(post => (
                <Post
                  key={post.id}
                  post={post}
                  onDelete={() => setPosts(posts.filter(p => p.id !== post.id))}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'albums' && (
          <div className="albums-section">
            {!selectedAlbum ? (
              <>
                {isOwnProfile && (
                  <div className="album-actions">
                    <button
                      className="btn-create-album"
                      onClick={() => setShowCreateAlbum(true)}
                    >
                      ➕ Create Album
                    </button>
                  </div>
                )}

                {showCreateAlbum && (
                  <div className="create-album-form">
                    <form onSubmit={handleCreateAlbum}>
                      <input
                        type="text"
                        placeholder="Album name"
                        value={newAlbumName}
                        onChange={(e) => setNewAlbumName(e.target.value)}
                        autoFocus
                      />
                      <div className="form-actions">
                        <button type="submit" className="btn-primary">Create</button>
                        <button 
                          type="button" 
                          className="btn-secondary"
                          onClick={() => {
                            setShowCreateAlbum(false);
                            setNewAlbumName('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                <div className="albums-grid">
                  {albums.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-icon">📁</div>
                      <div className="empty-state-title">No albums yet</div>
                      <div className="empty-state-description">
                        {isOwnProfile ? 'Create your first album!' : 'No albums to show'}
                      </div>
                    </div>
                  ) : (
                    albums.map(album => (
                      <div 
                        key={album.id} 
                        className="album-card"
                        onClick={() => handleViewAlbum(album)}
                      >
                        <div className="album-cover">
                          {album.cover_photo ? (
                            <img src={album.cover_photo} alt={album.name || album.title} />
                          ) : (
                            <div className="album-cover-placeholder">📷</div>
                          )}
                        </div>
                        <div className="album-info">
                          <h3>{album.name || album.title}</h3>
                          <p>{album.photo_count || 0} photos</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="album-view">
                <div className="album-header">
                  <button 
                    className="btn-back"
                    onClick={() => setSelectedAlbum(null)}
                  >
                    ← Back to Albums
                  </button>
                  <h2>{selectedAlbum.name || selectedAlbum.title}</h2>
                  <div className="album-actions">
                    {isOwnProfile && !selectedAlbum.is_default && (
                      <>
                        <button
                          className="btn-upload"
                          onClick={() => setShowUploadToAlbum(true)}
                          disabled={uploading}
                        >
                          {uploading ? '⏳ Uploading...' : '➕ Add Photos'}
                        </button>
                        <button
                          className="btn-delete-album"
                          onClick={() => handleDeleteAlbum(selectedAlbum.id)}
                        >
                          🗑️ Delete Album
                        </button>
                      </>
                    )}
                    {isOwnProfile && selectedAlbum.is_default && (
                      <button
                        className="btn-upload"
                        onClick={() => setShowUploadToAlbum(true)}
                        disabled={uploading}
                      >
                        {uploading ? '⏳ Uploading...' : '➕ Add Photos'}
                      </button>
                    )}
                  </div>
                </div>

                {showUploadToAlbum && (
                  <div className="upload-form">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setSelectedFile(e.target.files[0])}
                      disabled={uploading}
                    />
                    <div className="form-actions">
                      <button
                        className="btn-primary"
                        onClick={() => handleUploadToAlbum(selectedAlbum.id)}
                        disabled={!selectedFile || uploading}
                      >
                        {uploading ? 'Uploading...' : 'Upload'}
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => {
                          setShowUploadToAlbum(false);
                          setSelectedFile(null);
                        }}
                        disabled={uploading}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="photos-grid">
                  {!selectedAlbum.photos || selectedAlbum.photos.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-icon">📷</div>
                      <div className="empty-state-title">No photos in this album</div>
                      <div className="empty-state-description">
                        {isOwnProfile ? 'Add your first photo!' : 'No photos to show'}
                      </div>
                    </div>
                  ) : (
                    selectedAlbum.photos.map(photo => (
                      <div key={photo.id} className="photo-card">
                        <img src={photo.image_url || photo.photo_url} alt="Album photo" />
                        {isOwnProfile && (
                          <button
                            className="btn-delete-photo"
                            onClick={() => handleDeletePhoto(photo.id)}
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}