// src/components/Profile/Profile.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import Post from '../Post/Post';
import { formatDate } from '../../utils/date';
import { compressImage } from '../../utils/imageCompression';
import './Profile.css';

export default function Profile() {
  const { handle } = useParams();
  const navigate = useNavigate();
  const { user, setUser, socket, logout, connectWallet } = useAuth();
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
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showBanConfirm, setShowBanConfirm] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [banning, setBanning] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [aboutSaving, setAboutSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [aboutForm, setAboutFormState] = useState({
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
  const aboutFormRef = useRef(aboutForm);
  
  // Custom setter that updates ref synchronously BEFORE React processes state
  const setAboutForm = (updater) => {
    let newValue;
    if (typeof updater === 'function') {
      // Compute new value using current ref (always up to date)
      newValue = updater(aboutFormRef.current);
    } else {
      newValue = updater;
    }
    // Update ref IMMEDIATELY (synchronous)
    aboutFormRef.current = newValue;
    // Then update React state
    setAboutFormState(newValue);
  };
  
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [captionDraft, setCaptionDraft] = useState('');
  const [captionSaving, setCaptionSaving] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState(null);
  const [profileCache, setProfileCache] = useState({});
  
  // Account linking state
  const [showLinkEmail, setShowLinkEmail] = useState(false);
  const [linkEmailAddress, setLinkEmailAddress] = useState('');
  const [linkEmailPassword, setLinkEmailPassword] = useState('');
  const [linkingEmail, setLinkingEmail] = useState(false);
  const [linkingWallet, setLinkingWallet] = useState(false);
  const [linkMessage, setLinkMessage] = useState('');
  const [showLinkPassword, setShowLinkPassword] = useState(false);
  const peekRef = useRef(null);

  const startPeek = useCallback((setter) => {
    setter(true);
    clearTimeout(peekRef.current);
    peekRef.current = setTimeout(() => setter(false), 3000);
  }, []);
  const stopPeek = useCallback((setter) => {
    setter(false);
    clearTimeout(peekRef.current);
  }, []);

  // Auto-hide password when user leaves the page/tab
  useEffect(() => {
    const hide = () => { setShowLinkPassword(false); clearTimeout(peekRef.current); };
    window.addEventListener('blur', hide);
    const onVis = () => { if (document.hidden) hide(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { window.removeEventListener('blur', hide); document.removeEventListener('visibilitychange', onVis); clearTimeout(peekRef.current); };
  }, []);
  
  const isOwnProfile = (() => {
    const resolved = resolvedAddress?.toLowerCase?.();
    const userName = user?.username?.toLowerCase?.();
    if (!resolved || !userName) return false;
    return resolved === userName;
  })();
  const friendCount = profile?.friendCount || profile?.friendsCount || friends.length || 0;
  const canViewPrivateContent = isOwnProfile || friendshipStatus === 'friends' || isAdmin;
  const currentPhoto = selectedAlbum?.photos?.[lightboxIndex];
  const isProfilePhotoAlbum = /profile/i.test(selectedAlbum?.name || selectedAlbum?.title || '');
  const isCoverPhotoAlbum = /cover/i.test(selectedAlbum?.name || selectedAlbum?.title || '');

  function getUserHandle(userObj) {
    return (userObj?.username || userObj?.name || userObj?.user?.username || '').toLowerCase();
  }

  function getFriendProfilePath(friend) {
    const username = friend?.username || friend?.name || friend?.user?.username;
    if (username) {
      return `/profile/${encodeURIComponent(username)}`;
    }
    return null;
  }

  const blockedHandleSet = new Set(
    blockedUsers
      .map(getUserHandle)
      .filter(Boolean)
  );
  const visibleFriends = friends.filter((friend) => {
    const handle = getUserHandle(friend);
    if (handle && blockedHandleSet.has(handle)) return false;
    return true;
  });

  useEffect(() => {
    resolveProfileHandle();
  }, [handle, user?.username]);

  useEffect(() => {
    if (!resolvedAddress) return;
    loadProfile(resolvedAddress);
    loadPosts(resolvedAddress);
    loadAlbums(resolvedAddress);
    loadFriends(resolvedAddress);
    if (!isOwnProfile && user) {
      checkFriendshipStatus(resolvedAddress);
    }
  }, [resolvedAddress]);

  useEffect(() => {
    if (isOwnProfile) {
      loadBlockedUsers();
    } else {
      setBlockedUsers([]);
    }
    // Check admin status
    api.checkIsAdmin().then(admin => setIsAdmin(admin)).catch(() => {});
  }, [isOwnProfile]);

  useEffect(() => {
    if (!socket || !resolvedAddress) return;

    const handleFriendAccepted = (payload) => {
      const fromUsername = payload?.fromUsername || payload?.from;
      if (!fromUsername) return;
      if (String(fromUsername).toLowerCase() === String(resolvedAddress || '').toLowerCase()) {
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

    if (handle === 'me') {
      if (user?.username) {
        setResolvedAddress((prev) => (prev === user.username ? prev : user.username));
      }
      return;
    }

    try {
      setLoading(true);
      const data = await api.searchUsers(handle);
      const users = data.users || data || [];
      const match = users.find((u) => u.username?.toLowerCase() === handle.toLowerCase());
      if (match?.username) {
        setResolvedAddress((prev) => (prev === match.username ? prev : match.username));
      } else {
        setResolvedAddress((prev) => (prev === handle ? prev : handle));
      }
    } catch (error) {
      console.error('Resolve profile error:', error);
      setResolvedAddress((prev) => (prev === handle ? prev : handle));
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
    if (!isOwnProfile) {
      setFriends([]);
      return;
    }
    try {
      setFriendsLoading(true);
      const data = await api.getFriends();
      setFriends(data.friends || data || []);
    } catch (error) {
      console.error('Load friends error:', error);
      setFriends([]);
    } finally {
      setFriendsLoading(false);
    }
  }

  async function loadBlockedUsers() {
    if (!api.getBlockedUsers) {
      setBlockedUsers([]);
      return;
    }
    try {
      setBlockedLoading(true);
      const data = await api.getBlockedUsers();
      const blockedList = data.blocks || data.blocked || data.users || data || [];
      setBlockedUsers(Array.isArray(blockedList) ? blockedList : []);
    } catch (error) {
      console.error('Load blocked users error:', error);
      setBlockedUsers([]);
    } finally {
      setBlockedLoading(false);
    }
  }

  async function loadProfile(address) {
    try {
      setLoading(true);
      // Skip cache - always load fresh from server
      const data = await api.getUserProfile(address);
      setProfile(data.user);
      setProfileCache((prev) => ({ ...prev, [address]: data.user }));
      
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
        const normalizedBlockedList = Array.isArray(blockedList) ? blockedList : [];
        const blockedHandles = new Set(
          normalizedBlockedList
            .map((item) => item.username || item.name)
            .filter(Boolean)
            .map((name) => name.toLowerCase())
        );
        if (blockedHandles.has(String(address || '').toLowerCase())) {
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
      if (isOwnProfile) {
        loadBlockedUsers();
      }
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
      if (isOwnProfile) {
        loadBlockedUsers();
      }
    } catch (error) {
      console.error('Unblock user error:', error);
      alert('Failed to unblock user');
    } finally {
      setActionLoading(false);
    }
  }

  function handleMessageUser(targetUser) {
    const username =
      targetUser?.username ||
      targetUser?.name ||
      targetUser?.user?.username ||
      profile?.username ||
      resolvedAddress ||
      'User';

    const profileImage =
      targetUser?.profileImage ||
      targetUser?.profile_image ||
      targetUser?.user?.profileImage ||
      targetUser?.user?.profile_image ||
      profile?.profileImage ||
      profile?.profile_image ||
      '';

    window.dispatchEvent(
      new CustomEvent('open-chat', {
        detail: { username, profileImage }
      })
    );
  }

  async function handleSaveUsername() {
    const trimmed = usernameInput.trim();
    if (!trimmed || trimmed.length < 2) {
      setUsernameError('Username must be at least 2 characters');
      return;
    }
    if (trimmed.length > 30) {
      setUsernameError('Username must be 30 characters or less');
      return;
    }
    if (!/^[a-zA-Z0-9 _.-]+$/.test(trimmed)) {
      setUsernameError('Only letters, numbers, spaces, underscores, hyphens, and dots');
      return;
    }
    if (trimmed.toLowerCase() === profile.username?.toLowerCase()) {
      setIsEditingUsername(false);
      setUsernameError('');
      return;
    }
    try {
      setUsernameSaving(true);
      setUsernameError('');
      const result = await api.updateProfile({ username: trimmed });
      if (result.error) {
        setUsernameError(result.error);
        setUsernameSaving(false);
        return;
      }
      // Update local state
      setProfile((prev) => ({ ...prev, username: trimmed }));
      if (user) setUser({ ...user, username: trimmed });
      setIsEditingUsername(false);
      // Navigate to new username URL
      navigate(`/profile/${encodeURIComponent(trimmed)}`, { replace: true });
    } catch (error) {
      const msg = error?.message || 'Failed to update username';
      // Try to parse JSON error from backend
      try {
        const parsed = JSON.parse(msg);
        setUsernameError(parsed.error || msg);
      } catch {
        setUsernameError(msg);
      }
    } finally {
      setUsernameSaving(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== 'DELETE') return;
    try {
      setDeletingAccount(true);
      const result = await api.deleteAccount();
      if (result.error) {
        alert(result.error);
        setDeletingAccount(false);
        return;
      }
      // Account deleted — log out and redirect
      logout();
      navigate('/');
    } catch (error) {
      console.error('Delete account error:', error);
      alert('Failed to delete account. Please try again.');
      setDeletingAccount(false);
    }
  }

  async function handleLinkEmail(e) {
    e.preventDefault();
    setLinkMessage('');
    const email = linkEmailAddress.toLowerCase().includes('@')
      ? linkEmailAddress.toLowerCase()
      : `${linkEmailAddress.toLowerCase()}@hyvechain.com`;
    
    try {
      setLinkingEmail(true);
      await api.linkEmail(email, linkEmailPassword);
      setLinkMessage('Email linked successfully! You can now sign in with either your wallet or email.');
      setShowLinkEmail(false);
      setLinkEmailAddress('');
      setLinkEmailPassword('');
      // Refresh user data
      const freshUser = await api.getCurrentUser();
      if (freshUser?.user) setUser(freshUser.user);
    } catch (error) {
      setLinkMessage(error.message || 'Failed to link email');
    } finally {
      setLinkingEmail(false);
    }
  }

  async function handleLinkWallet() {
    setLinkMessage('');
    try {
      setLinkingWallet(true);
      const { address, signature } = await connectWallet();
      await api.linkWallet(address, signature);
      setLinkMessage('Wallet linked successfully! You can now sign in with either your wallet or email.');
      // Refresh user data
      const freshUser = await api.getCurrentUser();
      if (freshUser?.user) setUser(freshUser.user);
    } catch (error) {
      setLinkMessage(error.message || 'Failed to link wallet');
    } finally {
      setLinkingWallet(false);
    }
  }

  async function handleBanDeleteUser() {
    const targetAddress = profile?.walletAddress || profile?.wallet_address;
    if (!targetAddress) {
      console.error('Ban user error: no wallet address found on profile object', profile);
      alert('Error: Could not determine wallet address for this user. Please refresh and try again.');
      return;
    }
    try {
      setBanning(true);
      console.log('Banning user:', targetAddress);
      const result = await api.adminBanDeleteUser(targetAddress, banReason || 'Banned by admin');
      if (result.error) {
        throw new Error(result.error);
      }
      alert(result.message || 'User has been permanently banned and deleted.');
      setShowBanConfirm(false);
      setBanReason('');
      navigate('/');
    } catch (error) {
      console.error('Ban user error:', error);
      alert(error.message || 'Failed to ban user');
    } finally {
      setBanning(false);
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
      setUploading(true);

      // NSFW check
      const { checkImageNSFW } = await import('../../utils/nsfwCheck');
      const nsfwResult = await checkImageNSFW(selectedFile);
      if (!nsfwResult.safe) {
        alert(nsfwResult.reason);
        return;
      }
      
      // Compress image before upload
      const compressedFile = await compressImage(selectedFile, 2, 1920);
      
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
      setProfileMessage('Scanning image...');

      // NSFW check
      const { checkImageNSFW } = await import('../../utils/nsfwCheck');
      const nsfwResult = await checkImageNSFW(file);
      if (!nsfwResult.safe) {
        setProfileMessage(nsfwResult.reason);
        e.target.value = '';
        return;
      }
      
      // Compress image before upload
      const compressedFile = await compressImage(file, 2, 1920);
      
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

  async function handleRemoveProfilePicture() {
    if (!confirm('Remove your profile picture? This cannot be undone.')) return;
    try {
      setUploading(true);
      const result = await api.updateProfile({ profileImage: '', removeProfileImage: true });
      if (result.user) {
        setProfile(result.user);
        setUser(result.user);
      }
      await loadProfile();
      setProfileMessage('Profile picture removed.');
    } catch (error) {
      console.error('Remove profile picture error:', error);
      setProfileMessage('Failed to remove profile picture.');
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveCoverPhoto() {
    if (!confirm('Remove your cover photo? This cannot be undone.')) return;
    try {
      setUploading(true);
      const result = await api.updateProfile({ coverImage: '', removeCoverImage: true });
      if (result.user) {
        setProfile(result.user);
        setUser(result.user);
      }
      await loadProfile();
      setProfileMessage('Cover photo removed.');
    } catch (error) {
      console.error('Remove cover photo error:', error);
      setProfileMessage('Failed to remove cover photo.');
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
      setProfileMessage('Scanning image...');

      // NSFW check
      const { checkImageNSFW: checkNSFW } = await import('../../utils/nsfwCheck');
      const nsfwResult = await checkNSFW(file);
      if (!nsfwResult.safe) {
        setProfileMessage(nsfwResult.reason);
        e.target.value = '';
        return;
      }
      
      // Compress image before upload
      const compressedFile = await compressImage(file, 2, 1920);
      
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
    const newForm = {
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
    };
    setAboutForm(newForm);
    setIsEditingAbout(true);
  }

  function cancelEditAbout() {
    setIsEditingAbout(false);
  }

  async function saveAboutInfo(e) {
    e.preventDefault();
    try {
      setAboutSaving(true);
      
      // Use ref to get the latest form values (avoids stale closure)
      const currentForm = aboutFormRef.current;
      
      const dataToSend = {
        bio: currentForm.bio,
        location: currentForm.location,
        work: currentForm.work,
        education: currentForm.education,
        website: currentForm.website,
        hometown: currentForm.hometown,
        relationshipStatus: currentForm.relationshipStatus,
        birthday: currentForm.birthday,
        gender: currentForm.gender,
        languages: currentForm.languages
      };
      
      
      const result = await api.updateProfile(dataToSend);

      
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
          <div className="cover-photo-actions">
            <label className={`edit-cover-btn ${uploading ? 'disabled' : ''}`}>
              {uploading ? '⏳' : '📷 Change Cover'}
              <input
                type="file"
                accept="image/*"
                onChange={handleUpdateCoverPhoto}
                style={{ display: 'none' }}
                disabled={uploading}
              />
            </label>
            {profile.coverImage && (
              <button
                className={`remove-cover-btn ${uploading ? 'disabled' : ''}`}
                onClick={handleRemoveCoverPhoto}
                disabled={uploading}
                title="Remove cover photo"
              >
                🗑️ Remove
              </button>
            )}
          </div>
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
            <>
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
              {profile.profileImage && (
                <button
                  className={`remove-avatar-btn ${uploading ? 'disabled' : ''}`}
                  onClick={handleRemoveProfilePicture}
                  disabled={uploading}
                  title="Remove profile picture"
                >
                  ✕
                </button>
              )}
            </>
          )}
        </div>

        <div className="profile-info">
          {isEditingUsername ? (
            <div className="username-edit-inline">
              <input
                type="text"
                className="username-edit-input"
                value={usernameInput}
                onChange={(e) => { setUsernameInput(e.target.value); setUsernameError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveUsername(); if (e.key === 'Escape') { setIsEditingUsername(false); setUsernameError(''); } }}
                disabled={usernameSaving}
                autoFocus
                maxLength={30}
              />
              <div className="username-edit-actions">
                <button className="btn-save-username" onClick={handleSaveUsername} disabled={usernameSaving}>
                  {usernameSaving ? 'Saving...' : '✓ Save'}
                </button>
                <button className="btn-cancel-username" onClick={() => { setIsEditingUsername(false); setUsernameError(''); }} disabled={usernameSaving}>
                  ✕
                </button>
              </div>
              {usernameError && <div className="username-error">{usernameError}</div>}
            </div>
          ) : (
            <h1 className="profile-display-name">
              {profile.username || 'Anonymous'}
              {isOwnProfile && (
                <button
                  className="btn-edit-username"
                  title="Edit username"
                  onClick={() => { setUsernameInput(profile.username || ''); setIsEditingUsername(true); setUsernameError(''); }}
                >
                  ✏️
                </button>
              )}
            </h1>
          )}
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
            {isAdmin && (
              <button
                className="btn-ban"
                onClick={() => setShowBanConfirm(true)}
                disabled={actionLoading}
              >
                🔨 Ban & Delete
              </button>
            )}
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
          {isOwnProfile && (
            <button
              className={activeTab === 'blocked' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('blocked')}
            >
              Blocked
            </button>
          )}
          {isOwnProfile && (
            <button
              className={activeTab === 'settings' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('settings')}
            >
              Settings
            </button>
          )}
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
                  <li>🗓️ Joined: <span>{formatDate(profile.createdAt, undefined, 'Not set')}</span></li>
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
                    onChange={(e) => {
                      setAboutForm(prev => ({ ...prev, bio: e.target.value }));
                    }}
                    rows={4}
                  />
                </label>
                <label>
                  Location
                  <input
                    type="text"
                    value={aboutForm.location}
                    onChange={(e) => {
                      setAboutForm(prev => ({ ...prev, location: e.target.value }));
                    }}
                  />
                </label>
                <label>
                  Work
                  <input
                    type="text"
                    value={aboutForm.work}
                    onChange={(e) => setAboutForm(prev => ({ ...prev, work: e.target.value }))}
                  />
                </label>
                <label>
                  Education
                  <input
                    type="text"
                    value={aboutForm.education}
                    onChange={(e) => setAboutForm(prev => ({ ...prev, education: e.target.value }))}
                  />
                </label>
                <label>
                  Website
                  <input
                    type="text"
                    value={aboutForm.website}
                    onChange={(e) => setAboutForm(prev => ({ ...prev, website: e.target.value }))}
                  />
                </label>
                <label>
                  Hometown
                  <input
                    type="text"
                    value={aboutForm.hometown}
                    onChange={(e) => setAboutForm(prev => ({ ...prev, hometown: e.target.value }))}
                  />
                </label>
                <label>
                  Relationship Status
                  <input
                    type="text"
                    value={aboutForm.relationshipStatus}
                    onChange={(e) => {
                      setAboutForm(prev => ({ ...prev, relationshipStatus: e.target.value }));
                    }}
                  />
                </label>
                <label>
                  Birthday
                  <input
                    type="text"
                    placeholder="e.g. Jan 12, 1994"
                    value={aboutForm.birthday}
                    onChange={(e) => setAboutForm(prev => ({ ...prev, birthday: e.target.value }))}
                  />
                </label>
                <label>
                  Gender
                  <input
                    type="text"
                    value={aboutForm.gender}
                    onChange={(e) => setAboutForm(prev => ({ ...prev, gender: e.target.value }))}
                  />
                </label>
                <label>
                  Languages
                  <input
                    type="text"
                    placeholder="e.g. English, Spanish"
                    value={aboutForm.languages}
                    onChange={(e) => setAboutForm(prev => ({ ...prev, languages: e.target.value }))}
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
                  <li>🗓️ Joined: <span>{formatDate(profile.createdAt, undefined, 'Not set')}</span></li>
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
            ) : visibleFriends.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">👥</div>
                <div className="empty-state-title">No friends to show</div>
                <div className="empty-state-description">Connect with people to see them here.</div>
              </div>
            ) : (
              <div className="friends-grid">
                {visibleFriends.map(friend => {
                  const username = friend.username || friend.name || friend.user?.username || 'User';
                  const image = friend.profileImage || friend.profile_image || friend.user?.profileImage;
                  const friendKey = friend.id || username;

                  const friendProfilePath = getFriendProfilePath(friend);

                  return (
                    <div
                      key={friendKey}
                      className="friend-card"
                      role={friendProfilePath ? 'button' : undefined}
                      tabIndex={friendProfilePath ? 0 : undefined}
                      onClick={() => {
                        if (friendProfilePath) {
                          navigate(friendProfilePath);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (!friendProfilePath) return;
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          navigate(friendProfilePath);
                        }
                      }}
                    >
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
                          onClick={(event) => {
                            event.stopPropagation();
                            handleMessageUser(friend);
                          }}
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

        {activeTab === 'blocked' && isOwnProfile && (
          <div className="profile-card">
            <h2>Blocked Users</h2>
            {blockedLoading ? (
              <div className="loading-container"><div className="spinner"></div></div>
            ) : blockedUsers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🚫</div>
                <div className="empty-state-title">No blocked users</div>
                <div className="empty-state-description">Users you block will appear here.</div>
              </div>
            ) : (
              <div className="friends-grid">
                {blockedUsers.map((blockedUser) => {
                  const username = blockedUser?.username || blockedUser?.name || blockedUser?.user?.username || 'User';
                  const image = blockedUser?.profileImage || blockedUser?.profile_image || blockedUser?.user?.profileImage;
                  const blockedKey = blockedUser?.id || username;

                  return (
                    <div key={blockedKey} className="friend-card blocked-card">
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
                      <button
                        className="btn-secondary"
                        onClick={async () => {
                          if (!username) return;
                          try {
                            setActionLoading(true);
                            await api.unblockUser(username);
                            loadBlockedUsers();
                          } catch (error) {
                            console.error('Unblock user error:', error);
                            alert('Failed to unblock user');
                          } finally {
                            setActionLoading(false);
                          }
                        }}
                        disabled={actionLoading}
                      >
                        ✅ Unblock
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && isOwnProfile && (
          <div className="profile-card settings-section">
            <h2>Account Settings</h2>

            {/* Account Linking Section */}
            <div className="account-linking-section">
              <h3>🔗 Linked Accounts</h3>
              <p className="linking-description">Link your wallet and HyveMail email to use either for signing in.</p>
              
              {linkMessage && (
                <div className={`link-message ${linkMessage.includes('successfully') ? 'success' : 'error'}`}>
                  {linkMessage}
                </div>
              )}

              <div className="linked-accounts-list">
                {/* Wallet status */}
                <div className="linked-account-item">
                  <div className="linked-account-icon">🦊</div>
                  <div className="linked-account-info">
                    <div className="linked-account-label">Wallet</div>
                    <div className="linked-account-value">
                      {user?.linkedWallet
                        ? `${user.linkedWallet.slice(0, 6)}...${user.linkedWallet.slice(-4)}`
                        : (user?.walletAddress && !user?.email)
                          ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
                          : <span className="not-linked">Not linked</span>
                      }
                    </div>
                  </div>
                  {user?.email && !user?.linkedWallet && (
                    <button
                      className="btn-link-account"
                      onClick={handleLinkWallet}
                      disabled={linkingWallet}
                    >
                      {linkingWallet ? 'Linking...' : 'Link Wallet'}
                    </button>
                  )}
                </div>

                {/* Email status */}
                <div className="linked-account-item">
                  <div className="linked-account-icon">📧</div>
                  <div className="linked-account-info">
                    <div className="linked-account-label">HyveMail</div>
                    <div className="linked-account-value">
                      {user?.email
                        ? user.email
                        : <span className="not-linked">Not linked</span>
                      }
                    </div>
                  </div>
                  {!user?.email && (
                    <button
                      className="btn-link-account"
                      onClick={() => setShowLinkEmail(!showLinkEmail)}
                      disabled={linkingEmail}
                    >
                      Link Email
                    </button>
                  )}
                </div>
              </div>

              {/* Link Email Form */}
              {showLinkEmail && !user?.email && (
                <form className="link-email-form" onSubmit={handleLinkEmail}>
                  <div className="link-email-input-group">
                    <input
                      type="text"
                      placeholder="username"
                      value={linkEmailAddress}
                      onChange={(e) => setLinkEmailAddress(e.target.value)}
                      required
                    />
                    <span className="email-domain">@hyvechain.com</span>
                  </div>
                  <div className={`password-input-wrapper${showLinkPassword ? ' peeking' : ''}`}>
                    <input
                      type={showLinkPassword ? 'text' : 'password'}
                      placeholder="Email password"
                      value={linkEmailPassword}
                      onChange={(e) => setLinkEmailPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className={`password-toggle${showLinkPassword ? ' peeking' : ''}`}
                      onMouseDown={() => startPeek(setShowLinkPassword)}
                      onMouseUp={() => stopPeek(setShowLinkPassword)}
                      onMouseLeave={() => stopPeek(setShowLinkPassword)}
                      onTouchStart={(e) => { e.preventDefault(); startPeek(setShowLinkPassword); }}
                      onTouchEnd={() => stopPeek(setShowLinkPassword)}
                      tabIndex={-1}
                      title="Hold to peek"
                    >
                      {showLinkPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                  <div className="link-email-actions">
                    <button type="submit" className="btn-primary" disabled={linkingEmail}>
                      {linkingEmail ? 'Verifying...' : 'Link Email'}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => { setShowLinkEmail(false); setLinkEmailAddress(''); setLinkEmailPassword(''); }}
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="link-email-note">Don't have a HyveMail account? <a href="https://hyvechain.com/#/email/signup" target="_blank" rel="noopener noreferrer">Sign up here</a></p>
                </form>
              )}
            </div>

            <div className="danger-zone">
              <div className="danger-zone-header">
                <h3>⚠️ Danger Zone</h3>
              </div>
              <div className="danger-zone-content">
                <div className="danger-zone-info">
                  <h4>Delete Account</h4>
                  <p>Permanently delete your account and all associated data. This includes your posts, comments, messages, photos, albums, stories, group memberships, and all other data. <strong>This action cannot be undone.</strong></p>
                </div>
                {!showDeleteConfirm ? (
                  <button
                    className="btn-danger"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    🗑️ Delete My Account
                  </button>
                ) : (
                  <div className="delete-confirm-box">
                    <p className="delete-confirm-warning">Are you absolutely sure? Type <strong>DELETE</strong> to confirm.</p>
                    <input
                      type="text"
                      className="delete-confirm-input"
                      placeholder="Type DELETE to confirm"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      disabled={deletingAccount}
                    />
                    <div className="delete-confirm-actions">
                      <button
                        className="btn-danger"
                        onClick={handleDeleteAccount}
                        disabled={deleteConfirmText !== 'DELETE' || deletingAccount}
                      >
                        {deletingAccount ? 'Deleting...' : 'Permanently Delete Account'}
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeleteConfirmText('');
                        }}
                        disabled={deletingAccount}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
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

      {/* Admin Ban & Delete Confirmation Modal */}
      {showBanConfirm && createPortal(
        <div className="report-modal-overlay" onClick={() => setShowBanConfirm(false)}>
          <div className="report-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="report-modal-header">
              <h3>🔨 Ban & Delete User</h3>
              <button onClick={() => setShowBanConfirm(false)}>✕</button>
            </div>
            <div className="report-modal-body">
              <p style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>
                You are about to <strong style={{ color: '#e53e3e' }}>permanently ban</strong> and delete <strong>{profile?.username || 'this user'}</strong>.
              </p>
              <p style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                This will erase all their posts, comments, stories, albums, and profile data. Their wallet address will be permanently blocked from creating a new account.
              </p>
              <textarea
                placeholder="Reason for banning (optional)..."
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                rows="2"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                  borderRadius: '10px',
                  background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </div>
            <div className="report-modal-footer">
              <button className="btn-secondary" onClick={() => { setShowBanConfirm(false); setBanReason(''); }}>Cancel</button>
              <button
                className="btn-danger"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleBanDeleteUser(); }}
                disabled={banning}
                style={{ position: 'relative', zIndex: 10 }}
              >
                {banning ? 'Banning...' : 'Permanently Ban & Delete'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}