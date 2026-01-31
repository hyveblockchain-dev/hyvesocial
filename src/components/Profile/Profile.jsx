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
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [activeTab, setActiveTab] = useState('posts');
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [showUploadToAlbum, setShowUploadToAlbum] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  
  const isOwnProfile = user?.walletAddress === address;

  useEffect(() => {
    loadProfile();
    loadPosts();
    loadAlbums();
    checkFollowing();
  }, [address]);

  async function loadProfile() {
    try {
      setLoading(true);
      const data = await api.getUserProfile(address);
      setProfile(data.user);
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

  async function checkFollowing() {
    if (!isOwnProfile && user) {
      try {
        const data = await api.getFollowing();
        setIsFollowing(data.following?.some(f => f.address === address));
      } catch (error) {
        console.error('Check following error:', error);
      }
    }
  }

  async function handleFollow() {
    try {
      if (isFollowing) {
        await api.unfollowUser(address);
        setIsFollowing(false);
      } else {
        await api.followUser(address);
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('Follow error:', error);
    }
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
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('albumId', albumId);

      await api.uploadToAlbum(formData);
      setSelectedFile(null);
      setShowUploadToAlbum(false);
      
      // Reload album to show new photo
      const data = await api.getAlbumPhotos(albumId);
      setSelectedAlbum({ ...selectedAlbum, photos: data.photos });
    } catch (error) {
      console.error('Upload to album error:', error);
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
      const formData = new FormData();
      formData.append('profileImage', file);

      await api.updateProfile(formData);
      loadProfile();
      loadAlbums(); // Reload to show new photo in Profile Photos album
    } catch (error) {
      console.error('Update profile picture error:', error);
    }
  }

  async function handleUpdateCoverPhoto(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('coverImage', file);

      await api.updateProfile(formData);
      loadProfile();
      loadAlbums(); // Reload to show new photo in Cover Photos album
    } catch (error) {
      console.error('Update cover photo error:', error);
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
        {profile.cover_image ? (
          <img src={profile.cover_image} alt="Cover" />
        ) : (
          <div className="cover-placeholder"></div>
        )}
        {isOwnProfile && (
          <label className="edit-cover-btn">
            📷 Change Cover
            <input
              type="file"
              accept="image/*"
              onChange={handleUpdateCoverPhoto}
              style={{ display: 'none' }}
            />
          </label>
        )}
      </div>

      {/* Profile Header */}
      <div className="profile-header">
        <div className="profile-avatar-large">
          {profile.profile_image ? (
            <img src={profile.profile_image} alt={profile.username} />
          ) : (
            <div className="avatar-placeholder">
              {profile.username?.charAt(0).toUpperCase() || '?'}
            </div>
          )}
          {isOwnProfile && (
            <label className="edit-avatar-btn">
              📷
              <input
                type="file"
                accept="image/*"
                onChange={handleUpdateProfilePicture}
                style={{ display: 'none' }}
              />
            </label>
          )}
        </div>

        <div className="profile-info">
          <h1>{profile.username || 'Anonymous'}</h1>
          <p className="profile-wallet">
            {address?.slice(0, 8)}...{address?.slice(-6)}
          </p>
          {profile.bio && <p className="profile-bio">{profile.bio}</p>}
        </div>

        {!isOwnProfile && (
          <button 
            className={isFollowing ? 'btn-following' : 'btn-follow'}
            onClick={handleFollow}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </button>
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
                            <img src={album.cover_photo} alt={album.name} />
                          ) : (
                            <div className="album-cover-placeholder">📷</div>
                          )}
                        </div>
                        <div className="album-info">
                          <h3>{album.name}</h3>
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
                  <h2>{selectedAlbum.name}</h2>
                  <div className="album-actions">
                    {isOwnProfile && !selectedAlbum.is_default && (
                      <>
                        <button
                          className="btn-upload"
                          onClick={() => setShowUploadToAlbum(true)}
                        >
                          ➕ Add Photos
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
                      >
                        ➕ Add Photos
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
                    />
                    <div className="form-actions">
                      <button
                        className="btn-primary"
                        onClick={() => handleUploadToAlbum(selectedAlbum.id)}
                        disabled={!selectedFile}
                      >
                        Upload
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => {
                          setShowUploadToAlbum(false);
                          setSelectedFile(null);
                        }}
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
                        <img src={photo.image_url} alt="Album photo" />
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
