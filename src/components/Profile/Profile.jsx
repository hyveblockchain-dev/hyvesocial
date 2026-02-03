// src/components/Profile/Profile.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import Post from '../Post/Post';
import { compressImage } from '../../utils/imageCompression';
import './Profile.css';

export default function Profile() {
  const { handle } = useParams();
  const navigate = useNavigate();
  const { user, setUser, socket } = useAuth();
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
  const [friends, setFriends] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [aboutSaving, setAboutSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [aboutForm, setAboutForm] = useState({
    bio: '',
    location: '',
    work: '',
    education: '',
    website: '',
    hometown: '',
    relationshipStatus: '',
    birthday: '',
    gender: '',
    languages: ''
  });
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [captionDraft, setCaptionDraft] = useState('');
  const [captionSaving, setCaptionSaving] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState(null);
  const [profileCache, setProfileCache] = useState({});
  
  const isOwnProfile = user?.walletAddress && user?.walletAddress === resolvedAddress;
  const friendCount = profile?.friendCount || profile?.friendsCount || friends.length || 0;
  const canViewPrivateContent = isOwnProfile || friendshipStatus === 'friends';
  const currentPhoto = selectedAlbum?.photos?.[lightboxIndex];
  const isProfilePhotoAlbum = /profile/i.test(selectedAlbum?.name || selectedAlbum?.title || '');
  const isCoverPhotoAlbum = /cover/i.test(selectedAlbum?.name || selectedAlbum?.title || '');

  function isWalletAddress(value) {
    return /^0x[a-fA-F0-9]{40}$/.test(value || '');
  }

  useEffect(() => {
    resolveProfileHandle();
  }, [handle, user?.walletAddress]);

  useEffect(() => {
    if (!resolvedAddress) return;
    loadProfile(resolvedAddress);
    loadPosts(resolvedAddress);
    loadAlbums(resolvedAddress);
    loadFriends(resolvedAddress);
    if (!isOwnProfile && user) {
      checkFriendshipStatus(resolvedAddress);
    }
  }, [resolvedAddress, handle]);

  useEffect(() => {
    if (!socket || !resolvedAddress) return;

    const handleFriendAccepted = (payload) => {
      const fromAddress = payload?.from || payload?.address;
      if (!fromAddress) return;
      if (fromAddress === resolvedAddress) {
        setFriendshipStatus('friends');
      }
    };

    socket.on('friend_request_accepted', handleFriendAccepted);
    return () => {
      socket.off('friend_request_accepted', handleFriendAccepted);
    };
  }, [socket, resolvedAddress]);

  async function resolveProfileHandle() {
    if (!handle) return;

    if (handle === 'me' && user?.walletAddress) {
      setResolvedAddress((prev) => (prev === user.walletAddress ? prev : user.walletAddress));
      return;
    }

    if (isWalletAddress(handle)) {
      setResolvedAddress((prev) => (prev === handle ? prev : handle));
      return;
    }

    try {
      setLoading(true);
      const data = await api.searchUsers(handle);
      const users = data.users || data || [];
      const match = users.find((u) => u.username?.toLowerCase() === handle.toLowerCase());
      if (match?.wallet_address) {
        setResolvedAddress((prev) => (prev === match.wallet_address ? prev : match.wallet_address));
      } else {
        setResolvedAddress(null);
        setProfile(null);
        setLoading(false);
      }
    } catch (error) {
      console.error('Resolve profile error:', error);
      setResolvedAddress(null);
      setProfile(null);
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isLightboxOpen || !selectedAlbum?.photos?.length) return;
    if (lightboxIndex >= selectedAlbum.photos.length) {
      setLightboxIndex(0);
      return;
    }
    const photo = selectedAlbum.photos[lightboxIndex];
    setCaptionDraft(photo?.caption || photo?.description || '');
  }, [isLightboxOpen, lightboxIndex, selectedAlbum]);

  async function loadFriends(address) {
    if (!address) {
      setFriends([]);
      return;
    }
    try {
      setFriendsLoading(true);
      const data = isOwnProfile
        ? await api.getFriends()
        : await api.getFriendsByAddress(address);
      setFriends(data.friends || data || []);
    } catch (error) {
      console.error('Load friends error:', error);
      setFriends([]);
    } finally {
      setFriendsLoading(false);
    }
  }

  async function loadProfile(address) {
    try {
      setLoading(true);
      const cached = profileCache[address];
      if (cached) {
        setProfile(cached);
        setLoading(false);
      }
      const data = await api.getUserProfile(address);
      setProfile(data.user);
      setProfileCache((prev) => ({ ...prev, [address]: data.user }));
      
      // Update user context if viewing own profile
      if (isOwnProfile) {
        setUser(data.user);
      }

      if (isWalletAddress(handle) && data.user?.username) {
        navigate(`/profile/${data.user.username}`, { replace: true });
      }
    } catch (error) {
      console.error('Load profile error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadPosts(address) {
    try {
      const data = await api.getUserPosts(address);
      setPosts(data.posts || []);
    } catch (error) {
      console.error('Load posts error:', error);
    }
  }

  async function loadAlbums(address) {
    try {
      const data = await api.getAlbums(address);
      setAlbums(data.albums || []);
    } catch (error) {
      console.error('Load albums error:', error);
    }
  }

  async function checkFriendshipStatus(address) {
    try {
      const data = await api.getFriendshipStatus(address);
      let nextStatus = data.status || 'none';
      setRequestId(data.requestId || null);

      if (api.getBlockedUsers) {
        const blockedData = await api.getBlockedUsers();
        const blockedList = blockedData.blocked || blockedData.users || blockedData || [];
        const blockedAddresses = new Set(
          blockedList
            .map((item) => item.wallet_address || item.walletAddress || item.address)
            .filter(Boolean)
        );
        if (blockedAddresses.has(address)) {
          nextStatus = 'blocked';
        }
      }

      setFriendshipStatus(nextStatus);
    } catch (error) {
      console.error('Check friendship error:', error);
    }
  }

  async function handleAddFriend() {
    if (!resolvedAddress) return;
    try {
      setActionLoading(true);
      await api.sendFriendRequest(resolvedAddress);
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
    if (!resolvedAddress) return;
    if (!confirm('Remove this friend?')) return;
    try {
      setActionLoading(true);
      await api.removeFriend(resolvedAddress);
      setFriendshipStatus('none');
    } catch (error) {
      console.error('Remove friend error:', error);
      alert('Failed to remove friend');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleBlockUser() {
    if (!resolvedAddress) return;
    if (!confirm('Block this user?')) return;
    try {
      setActionLoading(true);
      await api.blockUser(resolvedAddress);
      setFriendshipStatus('blocked');
      setRequestId(null);
    } catch (error) {
      console.error('Block user error:', error);
      alert('Failed to block user');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUnblockUser() {
    if (!resolvedAddress) return;
    try {
      setActionLoading(true);
      if (api.unblockUser) {
        await api.unblockUser(resolvedAddress);
      }
      setFriendshipStatus('none');
    } catch (error) {
      console.error('Unblock user error:', error);
      alert('Failed to unblock user');
    } finally {
      setActionLoading(false);
    }
  }

  function handleMessageUser(targetUser) {
    const address =
      targetUser?.walletAddress ||
      targetUser?.wallet_address ||
      targetUser?.address ||
      targetUser?.user?.walletAddress ||
      targetUser?.user?.wallet_address ||
      targetUser?.user?.address ||
      profile?.walletAddress ||
      profile?.wallet_address ||
      profile?.address ||
      resolvedAddress ||
      (isWalletAddress(handle) ? handle : null);

    const username =
      targetUser?.username ||
      targetUser?.name ||
      targetUser?.user?.username ||
      profile?.username ||
      'User';

    const profileImage =
      targetUser?.profileImage ||
      targetUser?.profile_image ||
      targetUser?.user?.profileImage ||
      targetUser?.user?.profile_image ||
      profile?.profileImage ||
      profile?.profile_image ||
      '';

    if (!address) {
      alert('Missing wallet address for this user.');
      return;
    }

    window.dispatchEvent(
      new CustomEvent('open-chat', {
        detail: { address, username, profileImage }
      })
    );
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
      await api.deleteAlbumPhoto(selectedAlbum.id, photoId);
      // Reload album photos
      const data = await api.getAlbumPhotos(selectedAlbum.id);
      setSelectedAlbum({ ...selectedAlbum, photos: data.photos });
    } catch (error) {
      console.error('Delete photo error:', error);
    }
  }

  function openLightbox(index) {
    setLightboxIndex(index);
    setIsLightboxOpen(true);
  }

  function closeLightbox() {
    setIsLightboxOpen(false);
  }

  function showNextPhoto() {
    if (!selectedAlbum?.photos?.length) return;
    setLightboxIndex((prev) => (prev + 1) % selectedAlbum.photos.length);
  }

  function showPrevPhoto() {
    if (!selectedAlbum?.photos?.length) return;
    setLightboxIndex((prev) => (prev - 1 + selectedAlbum.photos.length) % selectedAlbum.photos.length);
  }

  async function savePhotoCaption() {
    if (!selectedAlbum || !currentPhoto) return;
    try {
      setCaptionSaving(true);
      const result = await api.updateAlbumPhotoCaption(selectedAlbum.id, currentPhoto.id, captionDraft);
      const nextCaption = result?.photo?.caption ?? captionDraft;
      setSelectedAlbum((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          photos: prev.photos.map((photo) =>
            photo.id === currentPhoto.id ? { ...photo, caption: nextCaption } : photo
          )
        };
      });
    } catch (error) {
      console.error('Update photo caption error:', error);
      alert('Failed to update caption');
    } finally {
      setCaptionSaving(false);
    }
  }

  async function setAsProfilePhoto() {
    if (!currentPhoto) return;
    try {
      setActionLoading(true);
      const photoUrl = currentPhoto.image_url || currentPhoto.photo_url;
      const result = await api.updateProfile({ profileImage: photoUrl });
      if (result.user) {
        setProfile(result.user);
        setUser(result.user);
      }
      await loadProfile();
    } catch (error) {
      console.error('Set profile photo error:', error);
      alert('Failed to set profile photo');
    } finally {
      setActionLoading(false);
    }
  }

  async function setAsCoverPhoto() {
    if (!currentPhoto) return;
    try {
      setActionLoading(true);
      const photoUrl = currentPhoto.image_url || currentPhoto.photo_url;
      const result = await api.updateProfile({ coverImage: photoUrl });
      if (result.user) {
        setProfile(result.user);
        setUser(result.user);
      }
      await loadProfile();
    } catch (error) {
      console.error('Set cover photo error:', error);
      alert('Failed to set cover photo');
    } finally {
      setActionLoading(false);
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

    if (file.size > 5 * 1024 * 1024) {
      setProfileMessage('Image too large. Max 5MB.');
      return;
    }

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
      setProfileMessage('Profile picture updated.');
    } catch (error) {
      console.error('Update profile picture error:', error);
      setProfileMessage('Failed to update profile picture. Please try a smaller image.');
    } finally {
      setUploading(false);
    }
  }

  async function handleUpdateCoverPhoto(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setProfileMessage('Image too large. Max 5MB.');
      return;
    }

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
      setProfileMessage('Cover photo updated.');
    } catch (error) {
      console.error('Update cover photo error:', error);
      setProfileMessage('Failed to update cover photo. Please try a smaller image.');
    } finally {
      setUploading(false);
    }
  }

  function startEditAbout() {
    setAboutForm({
      bio: profile?.bio || '',
      location: profile?.location || '',
      work: profile?.work || '',
      education: profile?.education || '',
      website: profile?.website || '',
      hometown: profile?.hometown || '',
      relationshipStatus: profile?.relationshipStatus || profile?.relationship_status || '',
      birthday: profile?.birthday || '',
      gender: profile?.gender || '',
      languages: profile?.languages || ''
    });
    setIsEditingAbout(true);
  }

  function cancelEditAbout() {
    setIsEditingAbout(false);
  }

  async function saveAboutInfo(e) {
    e.preventDefault();
    try {
      setAboutSaving(true);
      const result = await api.updateProfile({
        bio: aboutForm.bio,
        location: aboutForm.location,
        work: aboutForm.work,
        education: aboutForm.education,
        website: aboutForm.website,
        hometown: aboutForm.hometown,
        relationship_status: aboutForm.relationshipStatus,
        birthday: aboutForm.birthday,
        gender: aboutForm.gender,
        languages: aboutForm.languages
      });

      console.log('saveAboutInfo - result.user:', result.user);
      
      // Always clear cache to ensure fresh data on reload
      setProfileCache((prev) => {
        const copy = { ...prev };
        delete copy[resolvedAddress];
        return copy;
      });

      // If API returns updated user, use it; otherwise reload from server
      if (result.user) {
        setProfile(result.user);
        setUser(result.user);
      } else {
        // Reload profile from server to get updated data
        const data = await api.getUserProfile(resolvedAddress);
        if (data.user) {
          setProfile(data.user);
          setUser(data.user);
        }
      }
      setIsEditingAbout(false);
      setProfileMessage('Profile updated successfully!');
      setTimeout(() => setProfileMessage(''), 3000);
    } catch (error) {
      console.error('Update about info error:', error);
      setProfileMessage('Failed to update profile info');
      setTimeout(() => setProfileMessage(''), 3000);
    } finally {
      setAboutSaving(false);
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
      {profileMessage && (
        <div className={profileMessage.startsWith('Failed') ? 'inline-error' : 'inline-success'}>
          {profileMessage}
        </div>
      )}
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
          <div className="profile-stats">
            <span><strong>{friendCount}</strong> Friends</span>
            <span><strong>{posts.length}</strong> Posts</span>
          </div>
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
              <>
                <button className="btn-blocked" disabled>
                  🚫 Blocked
                </button>
                <button
                  className="btn-secondary"
                  onClick={handleUnblockUser}
                  disabled={actionLoading}
                >
                  ✅ Unblock
                </button>
              </>
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
        {isOwnProfile && (
          <div className="profile-actions">
            <button
              className="btn-secondary"
              onClick={() => {
                setActiveTab('about');
                startEditAbout();
              }}
            >
              ✏️ Edit Profile
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                navigate('/');
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('open-story-creator'));
                }, 150);
              }}
            >
              ➕ Add to Story
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="profile-tabs">
        <div className="tab-group">
          <button
            className={activeTab === 'posts' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('posts')}
          >
            Posts
          </button>
          <button
            className={activeTab === 'about' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('about')}
          >
            About
          </button>
          <button
            className={activeTab === 'friends' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('friends')}
          >
            Friends
          </button>
          <button
            className={activeTab === 'photos' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('photos')}
          >
            Photos
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="profile-content">
        {activeTab === 'posts' && (
          <div className="profile-content-grid">
            <div className="profile-left">
              <div className="profile-card">
                <div className="profile-card-header">
                  <h3>Intro</h3>
                  {isOwnProfile && (
                    <button
                      className="btn-link"
                      onClick={() => {
                        setActiveTab('about');
                        startEditAbout();
                      }}
                    >
                      Edit
                    </button>
                  )}
                </div>
                {profile.bio ? (
                  <p className="profile-card-text">{profile.bio}</p>
                ) : (
                  <p className="profile-card-muted">No bio yet.</p>
                )}
                <ul className="profile-details-list">
                  <li>📍 Location: <span>{profile.location || 'Not set'}</span></li>
                  <li>🌐 Website: <span>{profile.website || 'Not set'}</span></li>
                  <li>🗓️ Joined: <span>{profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Not set'}</span></li>
                </ul>
              </div>

              <div className="profile-card">
                <div className="profile-card-header">
                  <h3>Photos</h3>
                  <button className="btn-link" onClick={() => setActiveTab('photos')}>See all photos</button>
                </div>
                <div className="profile-photos-grid">
                  {!canViewPrivateContent ? (
                    <div className="privacy-card">
                      <div className="privacy-icon">🔒</div>
                      <div className="privacy-title">Photos are private</div>
                      <div className="privacy-text">Add as a friend to see photos.</div>
                    </div>
                  ) : albums.length === 0 ? (
                    <div className="profile-card-muted">No photos yet.</div>
                  ) : (
                    albums.slice(0, 9).map(album => (
                      <div key={album.id} className="profile-photo-tile">
                        {album.cover_photo ? (
                          <img src={album.cover_photo} alt={album.name || album.title} />
                        ) : (
                          <div className="profile-photo-placeholder">📷</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="profile-right">
              <div className="posts-list">
                {!canViewPrivateContent ? (
                  <div className="privacy-card">
                    <div className="privacy-icon">🔒</div>
                    <div className="privacy-title">Posts are private</div>
                    <div className="privacy-text">Add as a friend to see posts.</div>
                  </div>
                ) : posts.length === 0 ? (
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
            </div>
          </div>
        )}

        {activeTab === 'about' && (
          <div className="profile-card">
            <div className="profile-card-header">
              <h2>About</h2>
              {isOwnProfile && !isEditingAbout && (
                <button className="btn-link" onClick={startEditAbout}>Edit</button>
              )}
            </div>

            {isOwnProfile && isEditingAbout ? (
              <form className="about-form" onSubmit={saveAboutInfo}>
                <label>
                  Bio
                  <textarea
                    value={aboutForm.bio}
                    onChange={(e) => setAboutForm({ ...aboutForm, bio: e.target.value })}
                    rows={4}
                  />
                </label>
                <label>
                  Location
                  <input
                    type="text"
                    value={aboutForm.location}
                    onChange={(e) => setAboutForm({ ...aboutForm, location: e.target.value })}
                  />
                </label>
                <label>
                  Work
                  <input
                    type="text"
                    value={aboutForm.work}
                    onChange={(e) => setAboutForm({ ...aboutForm, work: e.target.value })}
                  />
                </label>
                <label>
                  Education
                  <input
                    type="text"
                    value={aboutForm.education}
                    onChange={(e) => setAboutForm({ ...aboutForm, education: e.target.value })}
                  />
                </label>
                <label>
                  Website
                  <input
                    type="text"
                    value={aboutForm.website}
                    onChange={(e) => setAboutForm({ ...aboutForm, website: e.target.value })}
                  />
                </label>
                <label>
                  Hometown
                  <input
                    type="text"
                    value={aboutForm.hometown}
                    onChange={(e) => setAboutForm({ ...aboutForm, hometown: e.target.value })}
                  />
                </label>
                <label>
                  Relationship Status
                  <input
                    type="text"
                    value={aboutForm.relationshipStatus}
                    onChange={(e) => setAboutForm({ ...aboutForm, relationshipStatus: e.target.value })}
                  />
                </label>
                <label>
                  Birthday
                  <input
                    type="text"
                    placeholder="e.g. Jan 12, 1994"
                    value={aboutForm.birthday}
                    onChange={(e) => setAboutForm({ ...aboutForm, birthday: e.target.value })}
                  />
                </label>
                <label>
                  Gender
                  <input
                    type="text"
                    value={aboutForm.gender}
                    onChange={(e) => setAboutForm({ ...aboutForm, gender: e.target.value })}
                  />
                </label>
                <label>
                  Languages
                  <input
                    type="text"
                    placeholder="e.g. English, Spanish"
                    value={aboutForm.languages}
                    onChange={(e) => setAboutForm({ ...aboutForm, languages: e.target.value })}
                  />
                </label>
                <div className="form-actions">
                  <button className="btn-primary" type="submit" disabled={aboutSaving}>
                    {aboutSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button className="btn-secondary" type="button" onClick={cancelEditAbout} disabled={aboutSaving}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <p className="profile-card-text">
                  {profile.bio || 'No bio yet.'}
                </p>
                <ul className="profile-details-list">
                  <li>📍 Location: <span>{profile.location || 'Not set'}</span></li>
                  <li>💼 Work: <span>{profile.work || 'Not set'}</span></li>
                  <li>🎓 Education: <span>{profile.education || 'Not set'}</span></li>
                  <li>🌐 Website: <span>{profile.website || 'Not set'}</span></li>
                  <li>🏡 Hometown: <span>{profile.hometown || 'Not set'}</span></li>
                  <li>💞 Relationship: <span>{profile.relationshipStatus || profile.relationship_status || 'Not set'}</span></li>
                  <li>🎂 Birthday: <span>{profile.birthday || 'Not set'}</span></li>
                  <li>⚧ Gender: <span>{profile.gender || 'Not set'}</span></li>
                  <li>🗣️ Languages: <span>{profile.languages || 'Not set'}</span></li>
                  <li>🗓️ Joined: <span>{profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Not set'}</span></li>
                </ul>
              </>
            )}
          </div>
        )}

        {activeTab === 'friends' && (
          <div className="profile-card">
            <h2>Friends</h2>
            {friendsLoading ? (
              <div className="loading-container"><div className="spinner"></div></div>
            ) : friends.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">👥</div>
                <div className="empty-state-title">No friends to show</div>
                <div className="empty-state-description">Connect with people to see them here.</div>
              </div>
            ) : (
              <div className="friends-grid">
                {friends.map(friend => {
                  const username = friend.username || friend.name || friend.user?.username || 'User';
                  const image = friend.profileImage || friend.profile_image || friend.user?.profileImage;
                  const friendKey =
                    friend.id ||
                    friend.wallet_address ||
                    friend.walletAddress ||
                    friend.address ||
                    username;

                  return (
                    <div key={friendKey} className="friend-card">
                      <div className="friend-avatar">
                        {image ? (
                          <img src={image} alt={username} />
                        ) : (
                          <div className="friend-avatar-placeholder">
                            {username.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="friend-info">
                        <div className="friend-name">{username}</div>
                      </div>
                      {!isOwnProfile && (
                        <button
                          className="btn-message"
                          onClick={() => handleMessageUser(friend)}
                          disabled={actionLoading}
                        >
                          💬 Message
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'photos' && (
          <div className="albums-section">
            {!canViewPrivateContent ? (
              <div className="privacy-card">
                <div className="privacy-icon">🔒</div>
                <div className="privacy-title">Photos are private</div>
                <div className="privacy-text">Add as a friend to view albums and photos.</div>
              </div>
            ) : !selectedAlbum ? (
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
                    selectedAlbum.photos.map((photo, index) => (
                      <div
                        key={photo.id}
                        className="photo-card"
                        onClick={() => openLightbox(index)}
                      >
                        <img src={photo.image_url || photo.photo_url} alt="Album photo" />
                        {isOwnProfile && (
                          <button
                            className="btn-delete-photo"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePhoto(photo.id);
                            }}
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {isLightboxOpen && currentPhoto && (
                  <div className="lightbox-overlay" onClick={closeLightbox}>
                    <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
                      <button className="lightbox-close" onClick={closeLightbox}>✕</button>
                      <button className="lightbox-nav left" onClick={showPrevPhoto}>❮</button>
                      <button className="lightbox-nav right" onClick={showNextPhoto}>❯</button>

                      <div className="lightbox-image">
                        <img
                          src={currentPhoto.image_url || currentPhoto.photo_url}
                          alt="Album photo"
                        />
                      </div>
                      <div className="lightbox-side">
                        <h3>Photo Caption</h3>
                        <textarea
                          value={captionDraft}
                          onChange={(e) => setCaptionDraft(e.target.value)}
                          placeholder="Write a caption..."
                          rows={6}
                        />
                        <div className="lightbox-actions">
                          <button
                            className="btn-primary"
                            onClick={savePhotoCaption}
                            disabled={captionSaving}
                          >
                            {captionSaving ? 'Saving...' : 'Save Caption'}
                          </button>
                          {isOwnProfile && isProfilePhotoAlbum && (
                            <button
                              className="btn-secondary"
                              onClick={setAsProfilePhoto}
                              disabled={actionLoading}
                            >
                              {actionLoading ? 'Updating...' : 'Use as Profile Photo'}
                            </button>
                          )}
                          {isOwnProfile && isCoverPhotoAlbum && (
                            <button
                              className="btn-secondary"
                              onClick={setAsCoverPhoto}
                              disabled={actionLoading}
                            >
                              {actionLoading ? 'Updating...' : 'Use as Cover Photo'}
                            </button>
                          )}
                        </div>
                        {currentPhoto.caption && (
                          <div className="lightbox-caption-preview">
                            <div className="preview-label">Current Caption</div>
                            <div className="preview-text">{currentPhoto.caption}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}