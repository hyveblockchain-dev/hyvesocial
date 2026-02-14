import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import CreatePost from '../Feed/CreatePost';
import Post from '../Post/Post';
import ChannelChat from './ChannelChat';
import MemberSidebar from './MemberSidebar';
import UserSettings from './UserSettings';
import { compressImage } from '../../utils/imageCompression';
import { formatDate, formatDateTime } from '../../utils/date';
import { IconArrowLeft } from '../Icons/Icons';
import ChatWindow from '../Chat/ChatWindow';
import './GroupDetail.css';

export default function GroupDetail() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user, socket } = useAuth();
  const coverInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  // ── Core state ──
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewAsMember, setViewAsMember] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState('');
  const [postingPermission, setPostingPermission] = useState('members');
  const [requirePostApproval, setRequirePostApproval] = useState(false);
  const [adminsBypassApproval, setAdminsBypassApproval] = useState(true);
  const [moderationItems, setModerationItems] = useState([]);
  const [moderationLoading, setModerationLoading] = useState(false);
  const [moderationError, setModerationError] = useState('');
  const [moderationFilter, setModerationFilter] = useState('all');
  const [activityItems, setActivityItems] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');
  const [activityFilter, setActivityFilter] = useState('all');
  const [editDescription, setEditDescription] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [coverPreview, setCoverPreview] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [bannedMembers, setBannedMembers] = useState([]);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteResults, setInviteResults] = useState([]);
  const [inviteSearching, setInviteSearching] = useState(false);
  const [inviteSent, setInviteSent] = useState(new Set());
  const inviteTimerRef = useRef(null);

  // ── Discord channel state ──
  const [channels, setChannels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedChannelId, setSelectedChannelId] = useState(null);
  const [collapsedCategories, setCollapsedCategories] = useState(new Set());
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelCategory, setNewChannelCategory] = useState('');
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [activePanel, setActivePanel] = useState('chat');
  const [showMemberSidebar, setShowMemberSidebar] = useState(true);
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [showServerDropdown, setShowServerDropdown] = useState(false);
  const [editingChannelId, setEditingChannelId] = useState(null);
  const [editChannelName, setEditChannelName] = useState('');
  const [editChannelTopic, setEditChannelTopic] = useState('');

  // ── Role management state ──
  const [customRoles, setCustomRoles] = useState([]);
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#f0b232');

  // ── Member popup state ──
  const [memberPopup, setMemberPopup] = useState(null);

  // ── Create Server modal state ──
  const [showCreateServerModal, setShowCreateServerModal] = useState(false);
  const [createServerStep, setCreateServerStep] = useState('main'); // 'main' | 'form' | 'join'
  const [createServerName, setCreateServerName] = useState('');
  const [createServerDesc, setCreateServerDesc] = useState('');
  const [createServerPrivacy, setCreateServerPrivacy] = useState('public');
  const [createServerBusy, setCreateServerBusy] = useState(false);
  const [joinServerCode, setJoinServerCode] = useState('');

  // ── Guild bar (joined groups list) ──
  const [joinedGroups, setJoinedGroups] = useState([]);

  // ── DM mode state ──
  const [dmMode, setDmMode] = useState(false);
  const [dmConversations, setDmConversations] = useState([]);
  const [dmLoading, setDmLoading] = useState(false);
  const [dmSelectedUser, setDmSelectedUser] = useState(null);
  const [dmSearchQuery, setDmSearchQuery] = useState('');

  const myUsername = (user?.username || '').toLowerCase();

  // Close server dropdown on click outside
  useEffect(() => {
    if (!showServerDropdown) return;
    const handler = (e) => {
      if (!e.target.closest('.discord-server-header') && !e.target.closest('.discord-server-dropdown')) {
        setShowServerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showServerDropdown]);

  // Close member popup on click outside
  useEffect(() => {
    if (!memberPopup) return;
    const handler = (e) => {
      if (!e.target.closest('.discord-member-popup') && !e.target.closest('.member-item')) {
        setMemberPopup(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [memberPopup]);

  // ── Computed values ──
  const isOwner = useMemo(() => {
    const ownerName =
      (group?.owner_username || group?.ownerUsername || '').toLowerCase() ||
      (members.find((m) => String(m.role || '').toLowerCase() === 'owner')?.username || '').toLowerCase();
    return !!ownerName && !!myUsername && ownerName === myUsername;
  }, [group, members, myUsername]);

  const myRole = useMemo(() => {
    const row = members.find((m) => (m.username || '').toLowerCase() === myUsername);
    return row?.role || null;
  }, [members, myUsername]);

  const isAdmin = isOwner || myRole === 'admin' || myRole === 'owner';
  const adminEnabled = isAdmin && !viewAsMember;

  const isMember = useMemo(() => {
    if (group?.is_member === true) return true;
    if (isOwner) return true;
    return !!myRole;
  }, [group, isOwner, myRole]);

  const canViewPosts = group?.privacy !== 'private' || isMember || isOwner;
  const pinnedPostId = useMemo(() => {
    const raw = group?.pinned_post_id ?? group?.pinnedPostId;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }, [group]);

  const effectivePostingPermission = (group?.posting_permission || group?.postingPermission || postingPermission || 'members').toLowerCase();
  const canPost = effectivePostingPermission === 'admins' ? adminEnabled : (isMember || isOwner);

  const effectiveRequireApproval = !!(group?.require_post_approval ?? group?.requirePostApproval ?? requirePostApproval);
  const effectiveAdminsBypass = !!(group?.admins_bypass_approval ?? group?.adminsBypassApproval ?? adminsBypassApproval);

  const pendingPosts = useMemo(() => {
    if (!adminEnabled) return [];
    return (posts || []).filter((p) => String(p.moderation_status || '').toLowerCase() === 'pending');
  }, [posts, adminEnabled]);

  const selectedChannel = useMemo(() => {
    return channels.find((c) => c.id === selectedChannelId) || null;
  }, [channels, selectedChannelId]);

  const channelsByCategory = useMemo(() => {
    const result = [];
    const uncategorized = channels.filter((c) => !c.category_id);
    const catMap = new Map();
    for (const cat of categories) catMap.set(cat.id, { ...cat, channels: [] });
    for (const ch of channels) {
      if (ch.category_id && catMap.has(ch.category_id)) catMap.get(ch.category_id).channels.push(ch);
    }
    if (uncategorized.length > 0) result.push({ id: null, name: null, channels: uncategorized });
    for (const cat of categories) {
      const entry = catMap.get(cat.id);
      if (entry) result.push(entry);
    }
    return result;
  }, [channels, categories]);

  // ── Data refresh functions ──
  async function refreshModeration(nextGroupId = groupId) {
    if (!adminEnabled) return;
    if (!api.getGroupModeration) return;
    setModerationError('');
    setModerationLoading(true);
    try {
      const data = await api.getGroupModeration(nextGroupId, { status: moderationFilter, limit: 50 });
      if (data?.error) { setModerationItems([]); setModerationError(data.error); return; }
      setModerationItems(data?.items || []);
    } catch { setModerationItems([]); setModerationError('Failed to load moderation activity.'); }
    finally { setModerationLoading(false); }
  }

  function formatActivity(it) {
    const actor = it.actor_username || 'Someone';
    const target = it.target_username || '';
    const type = String(it.action_type || '').toLowerCase();
    const when = formatDateTime(it.created_at);
    const meta = it.meta || {};
    let text = type || 'activity';
    if (type === 'create_group') text = 'created the group';
    if (type === 'update_settings') text = 'updated group settings';
    if (type === 'pin_post') text = 'pinned a post';
    if (type === 'unpin_post') text = 'unpinned a post';
    if (type === 'join_group') text = 'joined the group';
    if (type === 'leave_group') text = 'left the group';
    if (type === 'request_to_join') text = 'requested to join';
    if (type === 'approve_join_request') text = `approved ${target || 'a request'}`;
    if (type === 'decline_join_request') text = `declined ${target || 'a request'}`;
    if (type === 'set_member_role') text = `set ${target || 'a member'} role to ${meta?.role || '\u2014'}`;
    if (type === 'remove_member') text = `removed ${target || 'a member'}`;
    if (type === 'create_post') text = `created a post${meta?.moderationStatus && meta.moderationStatus !== 'published' ? ` (${meta.moderationStatus})` : ''}`;
    if (type === 'approve_post') text = `approved ${target || 'a post'}`;
    if (type === 'reject_post') text = `rejected ${target || 'a post'}`;
    const snippet = it.post_content ? String(it.post_content).slice(0, 160) : '';
    return { actor, text, when, snippet };
  }

  async function refreshActivity(nextGroupId = groupId) {
    if (!adminEnabled) return;
    if (!api.getGroupActivity) return;
    setActivityError('');
    setActivityLoading(true);
    try {
      const data = await api.getGroupActivity(nextGroupId, { type: activityFilter, limit: 50 });
      if (data?.error) { setActivityItems([]); setActivityError(data.error); return; }
      setActivityItems(data?.items || []);
    } catch { setActivityItems([]); setActivityError('Failed to load activity log.'); }
    finally { setActivityLoading(false); }
  }

  async function refreshMembers(nextGroupId = groupId) {
    if (!api.getGroupMembers) return;
    try {
      setMembersLoading(true);
      const data = await api.getGroupMembers(nextGroupId);
      setMembers(data?.members || []);
    } catch { setMembers([]); }
    finally { setMembersLoading(false); }
  }

  async function refreshRequests(nextGroupId = groupId) {
    if (!api.getGroupJoinRequests) return;
    try {
      const data = await api.getGroupJoinRequests(nextGroupId);
      setRequests(data?.requests || []);
    } catch { setRequests([]); }
  }

  async function refreshGroup(nextGroupId = groupId) {
    try {
      if (api.getGroupById) {
        const data = await api.getGroupById(nextGroupId);
        if (data?.error) { setGroup(null); setError(data.error); return null; }
        setGroup(data?.group || null);
        if (data?.group?.posting_permission || data?.group?.postingPermission) {
          setPostingPermission(String(data.group.posting_permission || data.group.postingPermission));
        }
        setRequirePostApproval(!!(data?.group?.require_post_approval ?? data?.group?.requirePostApproval));
        setAdminsBypassApproval((data?.group?.admins_bypass_approval ?? data?.group?.adminsBypassApproval) !== false);
        if (!data?.group) setError('Group not found.');
        return data?.group || null;
      }
      const data = await api.getGroups();
      const found = (data.groups || []).find((g) => String(g.id) === String(nextGroupId));
      setGroup(found || null);
      if (found?.posting_permission || found?.postingPermission) {
        setPostingPermission(String(found?.posting_permission || found?.postingPermission));
      }
      setRequirePostApproval(!!(found?.require_post_approval ?? found?.requirePostApproval));
      setAdminsBypassApproval((found?.admins_bypass_approval ?? found?.adminsBypassApproval) !== false);
      if (!found) setError('Group not found.');
      return found || null;
    } catch { setError('Failed to load group.'); return null; }
  }

  async function refreshPosts(nextGroupId = groupId) {
    if (!api.getGroupPosts || !nextGroupId) return;
    setPostsError('');
    setPostsLoading(true);
    try {
      const data = await api.getGroupPosts(nextGroupId);
      if (data?.error) { setPosts([]); setPostsError(data.error); return; }
      setPosts(data?.posts || []);
    } catch { setPosts([]); setPostsError('Failed to load group posts.'); }
    finally { setPostsLoading(false); }
  }

  const refreshChannels = useCallback(async (nextGroupId) => {
    const gid = nextGroupId || groupId;
    try {
      const data = await api.getGroupChannels(gid);
      setCategories(data?.categories || []);
      const chs = data?.channels || [];
      setChannels(chs);
      if (chs.length > 0) {
        setSelectedChannelId((prev) => {
          if (prev && chs.some((c) => c.id === prev)) return prev;
          const def = chs.find((c) => c.is_default) || chs[0];
          return def.id;
        });
      }
    } catch { setChannels([]); setCategories([]); }
  }, [groupId]);

  const refreshRoles = useCallback(async (nextGroupId) => {
    const gid = nextGroupId || groupId;
    try {
      const data = await api.getGroupRoles(gid);
      setCustomRoles(data?.roles || []);
    } catch { setCustomRoles([]); }
  }, [groupId]);

  // ── Fetch all joined groups for guild bar ──
  const refreshJoinedGroups = useCallback(async () => {
    try {
      const data = await api.getGroups();
      const all = data?.groups || [];
      setJoinedGroups(all.filter((g) => g.is_member));
    } catch { setJoinedGroups([]); }
  }, []);

  useEffect(() => {
    refreshJoinedGroups();
  }, [groupId, refreshJoinedGroups]);

  // ── Load DM conversations ──
  const loadDmConversations = useCallback(async () => {
    setDmLoading(true);
    try {
      const myHandle = (user?.username || '').toLowerCase();
      const [friendsData, convoData, blockedData] = await Promise.all([
        api.getFriends ? api.getFriends() : Promise.resolve({ friends: [] }),
        api.getConversations ? api.getConversations() : Promise.resolve({ conversations: [] }),
        api.getBlockedUsers ? api.getBlockedUsers() : Promise.resolve({ blocked: [] }),
      ]);
      const blockedList = blockedData?.blocks || blockedData?.blocked || blockedData?.users || blockedData || [];
      const blockedSet = new Set(
        (Array.isArray(blockedList) ? blockedList : []).map((b) => (b?.username || b?.user?.username || b?.name || '').toLowerCase()).filter(Boolean)
      );
      const friends = Array.isArray(friendsData?.friends) ? friendsData.friends : [];
      const convos = Array.isArray(convoData?.conversations) ? convoData.conversations : [];
      const userMap = new Map();
      for (const f of friends) {
        const h = (f.username || f.name || '').toLowerCase();
        if (!h || h === myHandle || blockedSet.has(h)) continue;
        userMap.set(h, { username: f.username || f.name || h, profile_image: f.profile_image || f.profileImage || '', isFriend: true, hasMessages: false, lastMessageTime: null });
      }
      for (const c of convos) {
        const h = (c.username || c.name || '').toLowerCase();
        if (!h || h === myHandle || blockedSet.has(h)) continue;
        const existing = userMap.get(h);
        if (existing) { existing.hasMessages = true; existing.lastMessageTime = c.last_message_time || c.lastMessageTime || null; }
        else userMap.set(h, { username: c.username || c.name || h, profile_image: c.profile_image || c.profileImage || '', isFriend: false, hasMessages: true, lastMessageTime: c.last_message_time || c.lastMessageTime || null });
      }
      const sorted = [...userMap.values()].sort((a, b) => {
        if (a.hasMessages !== b.hasMessages) return a.hasMessages ? -1 : 1;
        if (a.lastMessageTime && b.lastMessageTime) return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
        return a.username.localeCompare(b.username);
      });
      setDmConversations(sorted);
    } catch { setDmConversations([]); }
    finally { setDmLoading(false); }
  }, [user]);

  useEffect(() => {
    if (dmMode) loadDmConversations();
  }, [dmMode, loadDmConversations]);

  // ── Initial load ──
  useEffect(() => {
    async function fetchGroup() {
      setLoading(true);
      setError('');
      setNotice('');
      try {
        setActivePanel('chat');
        setViewAsMember(false);
        setSelectedChannelId(null);
        const loadedGroup = await refreshGroup(groupId);
        await refreshMembers(groupId);
        if (loadedGroup) {
          await refreshPosts(groupId);
          await refreshChannels(groupId);
          await refreshRoles(groupId);
        }
      } catch { setError('Failed to load group.'); }
      finally { setLoading(false); }
    }
    fetchGroup();
  }, [groupId]);

  useEffect(() => {
    if (!adminEnabled && activePanel === 'admin') setActivePanel('chat');
  }, [adminEnabled, activePanel]);

  useEffect(() => {
    if (!groupId || !canViewPosts) { setPosts([]); setPostsError('Join this group to view posts.'); return; }
    refreshPosts(groupId);
  }, [groupId, canViewPosts]);

  useEffect(() => {
    if (!adminEnabled) { setRequests([]); return; }
    refreshRequests(groupId);
  }, [groupId, adminEnabled]);

  useEffect(() => {
    if (!adminEnabled) { setBannedMembers([]); return; }
    refreshBans(groupId);
  }, [groupId, adminEnabled]);

  useEffect(() => {
    if (!adminEnabled) { setModerationItems([]); return; }
    refreshModeration(groupId);
  }, [groupId, adminEnabled, moderationFilter]);

  useEffect(() => {
    if (!adminEnabled) { setActivityItems([]); return; }
    refreshActivity(groupId);
  }, [groupId, adminEnabled, activityFilter]);

  // ── Handlers ──
  async function handleJoin() {
    try {
      setBusy(true); setNotice('');
      const data = await api.joinGroup(groupId);
      if (data?.error) { setNotice(data.error); return; }
      if (data?.requested) { setNotice('Join request sent. Waiting for admin approval.'); }
      else { setNotice('You joined this group.'); }
      await refreshGroup(groupId);
      await refreshMembers(groupId);
      await refreshPosts(groupId);
      await refreshChannels(groupId);
      if (adminEnabled) await refreshRequests(groupId);
    } catch { setNotice('Failed to join group.'); }
    finally { setBusy(false); }
  }

  async function handleLeave() {
    try {
      setBusy(true); setNotice('');
      const data = await api.leaveGroup(groupId);
      if (data?.error) { setNotice(data.error); return; }
      setNotice('You left this group.');
      await refreshGroup(groupId);
      await refreshMembers(groupId);
      setPosts([]);
      if (group?.privacy !== 'public') { setPostsError('Join this group to view posts.'); }
      else { await refreshPosts(groupId); }
      if (adminEnabled) await refreshRequests(groupId);
    } catch { setNotice('Failed to leave group.'); }
    finally { setBusy(false); }
  }

  async function handleDeleteGroup() {
    if (!confirm('Are you sure you want to permanently delete this group? All posts, members, and data will be lost. This cannot be undone.')) return;
    try {
      setBusy(true); setNotice('');
      const data = await api.deleteGroup(groupId);
      if (data?.error) { setNotice(typeof data.error === 'string' ? data.error : 'Failed to delete group.'); return; }
      navigate('/groups');
    } catch (err) { setNotice('Failed to delete group: ' + (err?.message || 'Unknown error')); }
    finally { setBusy(false); }
  }

  function handleInviteSearch(value) {
    setInviteQuery(value);
    if (inviteTimerRef.current) clearTimeout(inviteTimerRef.current);
    if (!value.trim()) { setInviteResults([]); return; }
    inviteTimerRef.current = setTimeout(async () => {
      try {
        setInviteSearching(true);
        const data = await api.searchUsers(value.trim());
        const users = data.users || data || [];
        const memberSet = new Set(members.map((m) => (m.username || '').toLowerCase()));
        const filtered = users.filter((u) => !(memberSet.has((u.username || '').toLowerCase())) && (u.username || '').toLowerCase() !== myUsername);
        setInviteResults(filtered.slice(0, 8));
      } catch { setInviteResults([]); }
      finally { setInviteSearching(false); }
    }, 350);
  }

  async function handleInviteUser(username) {
    try {
      setBusy(true); setNotice('');
      const data = await api.inviteToGroup(groupId, username);
      if (data?.error) { setNotice(typeof data.error === 'string' ? data.error : 'Failed to send invitation.'); return; }
      setInviteSent((prev) => new Set(prev).add(username.toLowerCase()));
      setNotice(`Invitation sent to ${username}.`);
    } catch (err) { setNotice('Failed to send invitation: ' + (err?.message || 'Unknown error')); }
    finally { setBusy(false); }
  }

  function handlePostCreated(newPost) { setPosts((prev) => [newPost, ...prev]); }
  function handlePostDeleted(postId) { setPosts((prev) => prev.filter((p) => String(p.id) !== String(postId))); }

  async function handleApprove(requesterUsername) {
    try { setBusy(true); const data = await api.approveGroupJoinRequest(groupId, requesterUsername); if (data?.error) { setNotice(data.error); return; } await refreshRequests(groupId); await refreshMembers(groupId); await refreshGroup(groupId); } finally { setBusy(false); }
  }
  async function handleDecline(requesterUsername) {
    try { setBusy(true); const data = await api.declineGroupJoinRequest(groupId, requesterUsername); if (data?.error) { setNotice(data.error); return; } await refreshRequests(groupId); } finally { setBusy(false); }
  }
  async function handleRemove(memberUsername) {
    try { setBusy(true); const data = await api.removeGroupMember(groupId, memberUsername); if (data?.error) { setNotice(data.error); return; } await refreshMembers(groupId); await refreshGroup(groupId); } finally { setBusy(false); }
  }
  async function handleBan(memberUsername) {
    if (!confirm('Ban this member? They will be removed and cannot rejoin.')) return;
    try { setBusy(true); const data = await api.banGroupMember(groupId, memberUsername); if (data?.error) { setNotice(data.error); return; } setNotice('Member banned successfully.'); await refreshMembers(groupId); await refreshBans(groupId); await refreshGroup(groupId); } finally { setBusy(false); }
  }
  async function handleUnban(memberUsername) {
    try { setBusy(true); const data = await api.unbanGroupMember(groupId, memberUsername); if (data?.error) { setNotice(data.error); return; } setNotice('Member unbanned.'); await refreshBans(groupId); } finally { setBusy(false); }
  }
  async function refreshBans(nextGroupId = groupId) {
    if (!adminEnabled) return;
    try { const data = await api.getGroupBans(nextGroupId); if (data?.error) { setBannedMembers([]); return; } setBannedMembers(data?.bans || data || []); } catch { setBannedMembers([]); }
  }
  async function handleRoleChange(memberUsername, role) {
    try { setBusy(true); const data = await api.setGroupMemberRole(groupId, memberUsername, role); if (data?.error) { setNotice(data.error); return; } await refreshMembers(groupId); } finally { setBusy(false); }
  }
  async function handleSaveDescription() {
    try { setBusy(true); setNotice(''); const data = await api.updateGroup(groupId, { description: editDescription }); if (data?.error) { setNotice(data.error); return; } setGroup(data?.group || { ...group, description: editDescription }); setEditingDescription(false); setNotice('Description updated.'); } catch { setNotice('Failed to update description.'); } finally { setBusy(false); }
  }
  async function handleCoverUpload(e) {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = '';
    if (file.size > 5 * 1024 * 1024) { setNotice('Image too large. Max 5MB.'); return; }
    try {
      setBusy(true); setNotice('Scanning image...');
      const { checkImageNSFW } = await import('../../utils/nsfwCheck');
      const nsfwResult = await checkImageNSFW(file);
      if (!nsfwResult.safe) { setNotice(nsfwResult.reason); return; }
      setNotice('Uploading cover photo...');
      const compressedFile = await compressImage(file, 2, 1920);
      const previewBase64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(compressedFile); });
      setCoverPreview(previewBase64);
      const formData = new FormData(); formData.append('coverImage', compressedFile);
      const data = await api.updateGroup(groupId, formData);
      if (data?.error) { setNotice('Error: ' + data.error); setCoverPreview(null); return; }
      setGroup(data?.group || { ...group, cover_image: previewBase64 }); setNotice('Cover photo updated successfully!');
    } catch { setNotice('Failed to upload cover photo.'); setCoverPreview(null); } finally { setBusy(false); }
  }
  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = '';
    if (file.size > 5 * 1024 * 1024) { setNotice('Image too large. Max 5MB.'); return; }
    try {
      setBusy(true); setNotice('Scanning image...');
      const { checkImageNSFW } = await import('../../utils/nsfwCheck');
      const nsfwResult = await checkImageNSFW(file);
      if (!nsfwResult.safe) { setNotice(nsfwResult.reason); return; }
      setNotice('Uploading avatar...');
      const compressedFile = await compressImage(file, 2, 1024);
      const previewBase64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(compressedFile); });
      setAvatarPreview(previewBase64);
      const formData = new FormData(); formData.append('avatarImage', compressedFile);
      const data = await api.updateGroup(groupId, formData);
      if (data?.error) { setNotice('Error: ' + data.error); setAvatarPreview(null); return; }
      setGroup(data?.group || { ...group, avatar_image: previewBase64 }); setNotice('Group avatar updated successfully!');
    } catch { setNotice('Failed to upload avatar.'); setAvatarPreview(null); } finally { setBusy(false); }
  }
  async function handleSavePostingPermission() {
    try { setBusy(true); setNotice(''); const data = await api.updateGroup(groupId, { postingPermission }); if (data?.error) { setNotice(data.error); return; } setGroup(data?.group || group); setNotice('Group settings updated.'); } catch { setNotice('Failed to update group settings.'); } finally { setBusy(false); }
  }
  async function handleSaveModeration() {
    try { setBusy(true); setNotice(''); const data = await api.updateGroup(groupId, { requirePostApproval, adminsBypassApproval }); if (data?.error) { setNotice(data.error); return; } setGroup(data?.group || group); setNotice('Moderation settings updated.'); await refreshPosts(groupId); } catch { setNotice('Failed to update moderation settings.'); } finally { setBusy(false); }
  }
  async function handleApprovePost(postId) {
    try { setBusy(true); setNotice(''); const data = await api.approveGroupPost(groupId, postId); if (data?.error) { setNotice(data.error); return; } setNotice('Post approved.'); await refreshPosts(groupId); await refreshGroup(groupId); await refreshModeration(groupId); } catch { setNotice('Failed to approve post.'); } finally { setBusy(false); }
  }
  async function handleRejectPost(postId) {
    try { setBusy(true); setNotice(''); const data = await api.rejectGroupPost(groupId, postId); if (data?.error) { setNotice(data.error); return; } setNotice('Post rejected.'); await refreshPosts(groupId); await refreshGroup(groupId); await refreshModeration(groupId); } catch { setNotice('Failed to reject post.'); } finally { setBusy(false); }
  }
  async function handlePin(postId) {
    try { setBusy(true); setNotice(''); const data = await api.updateGroup(groupId, { pinnedPostId: postId }); if (data?.error) { setNotice(data.error); return; } await refreshGroup(groupId); await refreshPosts(groupId); setNotice('Post pinned.'); } catch { setNotice('Failed to pin post.'); } finally { setBusy(false); }
  }
  async function handleUnpin() {
    try { setBusy(true); setNotice(''); const data = await api.updateGroup(groupId, { pinnedPostId: null }); if (data?.error) { setNotice(data.error); return; } await refreshGroup(groupId); await refreshPosts(groupId); setNotice('Post unpinned.'); } catch { setNotice('Failed to unpin post.'); } finally { setBusy(false); }
  }

  // ── Create Server handler ──
  async function handleCreateServer() {
    if (!createServerName.trim()) return;
    try {
      setCreateServerBusy(true);
      const coverPool = [
        'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80',
      ];
      const data = await api.createGroup({
        name: createServerName.trim(),
        description: createServerDesc.trim(),
        privacy: createServerPrivacy,
        coverImage: coverPool[Math.floor(Math.random() * coverPool.length)],
      });
      if (data?.error) { setNotice(data.error); }
      else {
        setShowCreateServerModal(false);
        setCreateServerName(''); setCreateServerDesc(''); setCreateServerPrivacy('public');
        await refreshJoinedGroups();
        if (data?.group?.id) navigate(`/groups/${data.group.id}`);
      }
    } catch (err) { setNotice('Failed to create server.'); }
    finally { setCreateServerBusy(false); }
  }

  async function handleJoinServerByCode() {
    if (!joinServerCode.trim()) return;
    try {
      setCreateServerBusy(true);
      const gid = joinServerCode.trim();
      const data = await api.joinGroup(gid);
      if (data?.error) { setNotice(data.error); }
      else {
        setShowCreateServerModal(false);
        setJoinServerCode('');
        navigate(`/groups/${gid}`);
      }
    } catch { setNotice('Failed to join server.'); }
    finally { setCreateServerBusy(false); }
  }

  // ── Channel handlers ──
  async function handleCreateChannel() {
    if (!newChannelName.trim()) return;
    try {
      setBusy(true);
      await api.createChannel(groupId, { name: newChannelName.trim(), categoryId: newChannelCategory || null });
      setNewChannelName(''); setNewChannelCategory(''); setShowCreateChannel(false);
      await refreshChannels(groupId);
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  }

  async function handleDeleteChannel(channelId) {
    if (!confirm('Delete this channel? All messages will be lost.')) return;
    try {
      setBusy(true);
      await api.deleteChannel(groupId, channelId);
      if (selectedChannelId === channelId) setSelectedChannelId(null);
      await refreshChannels(groupId);
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  }

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) return;
    try {
      setBusy(true);
      await api.createCategory(groupId, newCategoryName.trim());
      setNewCategoryName(''); setShowCreateCategory(false);
      await refreshChannels(groupId);
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  }

  async function handleDeleteCategory(catId) {
    if (!confirm('Delete this category? Channels will be moved to uncategorized.')) return;
    try {
      setBusy(true);
      await api.deleteCategory(groupId, catId);
      await refreshChannels(groupId);
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  }

  async function handleCreateRole() {
    if (!newRoleName.trim()) return;
    try {
      setBusy(true);
      await api.createGroupRole(groupId, { name: newRoleName.trim(), color: newRoleColor });
      setNewRoleName(''); setNewRoleColor('#f0b232'); setShowCreateRole(false);
      await refreshRoles(groupId);
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  }

  async function handleDeleteRole(roleId) {
    if (!confirm('Delete this role?')) return;
    try {
      setBusy(true);
      await api.deleteGroupRole(groupId, roleId);
      await refreshRoles(groupId);
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  }

  function toggleCategory(catId) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId); else next.add(catId);
      return next;
    });
  }

  async function handleEditChannel() {
    if (!editingChannelId || !editChannelName.trim()) return;
    try {
      setBusy(true);
      await api.updateChannel(groupId, editingChannelId, {
        name: editChannelName.trim(),
        topic: editChannelTopic.trim() || null,
      });
      setEditingChannelId(null);
      await refreshChannels(groupId);
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  }

  // ── Top navbar (rendered outside Layout) ──
  const topBar = (
    <header className="discord-topbar">
      <Link to="/" className="discord-topbar-logo">
        <img src="/hyvelogo.png" alt="Hyve" className="discord-topbar-logo-img" />
        <span>Hyve Social</span>
      </Link>
      <div className="discord-topbar-center">
        {group && <span className="discord-topbar-group-name">{group.name || 'Group'}</span>}
      </div>
      <div className="discord-topbar-actions">
        <Link to="/groups" className="discord-topbar-link">All Groups</Link>
        <Link to="/" className="discord-topbar-link">Feed</Link>
      </div>
    </header>
  );

  // ── Guild icon bar (far-left server list) ──
  const guildBar = (
    <nav className="discord-guild-bar">
      <button className={`guild-icon guild-home${dmMode ? ' guild-active' : ''}`} title="Direct Messages" onClick={() => { setDmMode(true); setDmSelectedUser(null); }}>
        <img src="/hyvelogo.png" alt="Home" />
        {dmMode && <span className="guild-pill" />}
      </button>
      <div className="guild-separator" />
      {joinedGroups.map((g) => {
        const isActive = !dmMode && String(g.id) === String(groupId);
        const avatar = g.avatar_image || g.avatarImage;
        return (
          <Link
            key={g.id}
            to={`/groups/${g.id}`}
            className={`guild-icon${isActive ? ' guild-active' : ''}`}
            title={g.name}
            onClick={() => setDmMode(false)}
          >
            {avatar
              ? <img src={avatar} alt={g.name} />
              : <span className="guild-icon-letter">{(g.name || '?')[0].toUpperCase()}</span>}
            {isActive && <span className="guild-pill" />}
          </Link>
        );
      })}
      <div className="guild-separator" />
      <button className="guild-icon guild-add" title="Add a Server" onClick={() => { setShowCreateServerModal(true); setCreateServerStep('main'); }}>
        <span>+</span>
      </button>
      <button className="guild-icon guild-explore" title="Explore Servers" onClick={() => navigate('/groups')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
      </button>
    </nav>
  );

  // ── Loading / error states (skip if in DM mode) ──
  if (!dmMode && loading) return <div className="discord-fullpage">{topBar}<div className="discord-body">{guildBar}<div className="discord-loading">Loading server...</div></div></div>;
  if (!dmMode && error) return <div className="discord-fullpage">{topBar}<div className="discord-body">{guildBar}<div className="discord-loading error">{error}</div></div></div>;
  if (!dmMode && !group) return <div className="discord-fullpage">{topBar}<div className="discord-body">{guildBar}<div className="discord-loading">Group not found.</div></div></div>;

  const coverUrl = coverPreview || group?.cover_image || group?.coverImage || '';
  const avatarUrl = avatarPreview || group?.avatar_image || group?.avatarImage || '';
  const groupName = group?.name || 'Group';
  const groupDescription = group?.description || '';
  const memberCount = group?.member_count || members.length || 1;
  const privacy = String(group?.privacy || 'public').toLowerCase();
  const isLocked = privacy === 'private' && !isMember && !isOwner;
  const postingLabel = effectivePostingPermission === 'admins' ? 'Admins can post' : 'Members can post';
  const createdAtRaw = group?.created_at || group?.createdAt;
  const createdAt = formatDate(createdAtRaw);
  const ownerUsernameRaw = group?.owner_username || group?.ownerUsername || '';

  // ── Not a member of private group: show join screen ──
  if (!dmMode && !isMember && privacy === 'private') {
    return (
      <div className="discord-fullpage">
        {topBar}
      <div className="discord-body">
        {guildBar}
      <div className="discord-join-screen">
        <button className="discord-back-btn" onClick={() => navigate('/groups')}>
          <IconArrowLeft size={18} /> Back to Groups
        </button>
        <div className="discord-join-card">
          <div className="discord-join-avatar">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : groupName.slice(0, 1).toUpperCase()}
          </div>
          <h1>{groupName}</h1>
          <p className="discord-join-desc">{groupDescription || 'This is a private group.'}</p>
          <p className="discord-join-meta">{memberCount} members &middot; {privacy}</p>
          <button className="discord-join-btn" onClick={handleJoin} disabled={busy}>
            {busy ? 'Requesting...' : 'Request to Join'}
          </button>
        </div>
      </div>
      </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // ═══ Main Discord-style 3-column layout ═════════════════
  // ══════════════════════════════════════════════════════════

  const filteredDmConversations = dmSearchQuery.trim()
    ? dmConversations.filter((c) => c.username.toLowerCase().includes(dmSearchQuery.toLowerCase()))
    : dmConversations;

  return (
    <div className="discord-fullpage">
      {topBar}
    <div className="discord-body">
      {guildBar}

    {dmMode ? (
      /* ════════ DM MODE LAYOUT ════════ */
      <div className="discord-server discord-dm-layout">
        {/* DM sidebar */}
        <div className="discord-sidebar discord-dm-sidebar">
          <div className="discord-dm-search">
            <input
              type="text"
              placeholder="Find or start a conversation"
              value={dmSearchQuery}
              onChange={(e) => setDmSearchQuery(e.target.value)}
            />
          </div>

          <div className="discord-dm-nav">
            <button className="discord-dm-nav-item" onClick={() => navigate('/friends')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 13c-1.2 0-3.07.34-4.5 1-1.43-.67-3.3-1-4.5-1C5.33 13 1 14.08 1 16.25V19h22v-2.75c0-2.17-4.33-3.25-6.5-3.25zm-4 4.5h-10v-1.25c0-.54 2.56-1.75 5-1.75s5 1.21 5 1.75v1.25zm9 0H14v-1.25c0-.46-.2-.86-.52-1.22.88-.3 1.96-.53 3.02-.53 2.44 0 5 1.21 5 1.75v1.25zM7.5 12c1.93 0 3.5-1.57 3.5-3.5S9.43 5 7.5 5 4 6.57 4 8.5 5.57 12 7.5 12zm9 0c1.93 0 3.5-1.57 3.5-3.5S18.43 5 16.5 5 13 6.57 13 8.5s1.57 3.5 3.5 3.5z"/></svg>
              <span>Friends</span>
            </button>
          </div>

          <div className="discord-dm-header">
            <span>DIRECT MESSAGES</span>
            <button className="discord-dm-add" title="Create DM" onClick={() => {}}>+</button>
          </div>

          <div className="discord-dm-list">
            {dmLoading ? (
              <div className="discord-dm-empty">Loading...</div>
            ) : filteredDmConversations.length === 0 ? (
              <div className="discord-dm-empty">{dmSearchQuery ? 'No results' : 'No conversations yet'}</div>
            ) : (
              filteredDmConversations.map((conv) => {
                const isSelected = dmSelectedUser?.username?.toLowerCase() === conv.username.toLowerCase();
                return (
                  <button
                    key={conv.username}
                    className={`discord-dm-item${isSelected ? ' active' : ''}`}
                    onClick={() => setDmSelectedUser({
                      username: conv.username,
                      profileImage: conv.profile_image || '',
                    })}
                  >
                    <div className="discord-dm-item-avatar">
                      {conv.profile_image
                        ? <img src={conv.profile_image} alt="" onError={(e) => { e.target.src = '/default-avatar.png'; }} />
                        : <div className="discord-dm-item-letter">{(conv.username || '?')[0].toUpperCase()}</div>}
                      <span className="discord-dm-item-status" />
                    </div>
                    <div className="discord-dm-item-info">
                      <span className="discord-dm-item-name">{conv.username}</span>
                      <span className="discord-dm-item-preview">
                        {conv.hasMessages ? 'Tap to continue chat' : conv.isFriend ? 'Friend' : ''}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* User panel (bottom) */}
          <div className="discord-user-panel">
            <div className="discord-user-panel-avatar">
              <img src={user?.profile_image || user?.profileImage || '/default-avatar.png'} alt="" onError={(e) => { e.target.src = '/default-avatar.png'; }} />
              <span className="discord-user-panel-dot" />
            </div>
            <div className="discord-user-panel-info">
              <span className="discord-user-panel-name">{user?.username || 'Unknown'}</span>
              <span className="discord-user-panel-status">Online</span>
            </div>
            <div className="discord-user-panel-icons">
              <button title="Mute" className="discord-user-mic">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a4 4 0 014 4v5a4 4 0 01-8 0V6a4 4 0 014-4zm-6 9a1 1 0 012 0 6 6 0 0012 0 1 1 0 012 0 8 8 0 01-7 7.93V21h3a1 1 0 010 2H9a1 1 0 010-2h3v-2.07A8 8 0 016 11z"/></svg>
              </button>
              <button title="Deafen" className="discord-user-deafen">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12v4.5C2 18.43 3.57 20 5.5 20h1a1 1 0 001-1v-6a1 1 0 00-1-1h-.84A8.001 8.001 0 0112 4a8.001 8.001 0 016.34 8H17.5a1 1 0 00-1 1v6a1 1 0 001 1h1c1.93 0 3.5-1.57 3.5-3.5V12c0-5.52-4.48-10-10-10z"/></svg>
              </button>
              <button title="User Settings" onClick={() => setShowUserSettings(true)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96a7.04 7.04 0 00-1.62-.94L14.4 3.05a.47.47 0 00-.48-.41h-3.84a.47.47 0 00-.48.41l-.36 2.54c-.59.24-1.13.57-1.62.94L5.24 5.62a.49.49 0 00-.59.22L2.73 9.16a.49.49 0 00.12.61l2.03 1.58c-.05.3-.07.63-.07.94 0 .32.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 00-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1115.6 12 3.611 3.611 0 0112 15.6z"/></svg>
              </button>
            </div>
          </div>
        </div>

        {/* DM main area */}
        <div className="discord-main discord-dm-main">
          {dmSelectedUser ? (
            <ChatWindow
              conversation={dmSelectedUser}
              onClose={() => setDmSelectedUser(null)}
            />
          ) : (
            <div className="discord-dm-welcome">
              <div className="discord-dm-welcome-icon">
                <svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor" opacity="0.4"><path d="M16.5 13c-1.2 0-3.07.34-4.5 1-1.43-.67-3.3-1-4.5-1C5.33 13 1 14.08 1 16.25V19h22v-2.75c0-2.17-4.33-3.25-6.5-3.25zm-4 4.5h-10v-1.25c0-.54 2.56-1.75 5-1.75s5 1.21 5 1.75v1.25zm9 0H14v-1.25c0-.46-.2-.86-.52-1.22.88-.3 1.96-.53 3.02-.53 2.44 0 5 1.21 5 1.75v1.25zM7.5 12c1.93 0 3.5-1.57 3.5-3.5S9.43 5 7.5 5 4 6.57 4 8.5 5.57 12 7.5 12zm9 0c1.93 0 3.5-1.57 3.5-3.5S18.43 5 16.5 5 13 6.57 13 8.5s1.57 3.5 3.5 3.5z"/></svg>
              </div>
              <h2>Select a conversation</h2>
              <p>Choose a friend from the sidebar to start chatting</p>
            </div>
          )}
        </div>
      </div>
    ) : (
    <div className="discord-server">
      {/* ── Left: Channel sidebar ── */}
      <div className="discord-sidebar">
        <div className="discord-server-header" onClick={() => setShowServerDropdown(p => !p)}>
          <div className="discord-server-avatar">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : groupName.slice(0, 1).toUpperCase()}
          </div>
          <div className="discord-server-name">{groupName}</div>
          <span className={`discord-server-chevron${showServerDropdown ? ' open' : ''}`}>▾</span>
        </div>

        {/* Server dropdown menu */}
        {showServerDropdown && (
          <div className="discord-server-dropdown">
            <button onClick={() => { setShowServerDropdown(false); setActivePanel('about'); }}>
              <span className="dropdown-icon">ℹ️</span> Server Info
            </button>
            {isMember && (
              <button onClick={() => { setShowServerDropdown(false); setActivePanel('about'); }}>
                <span className="dropdown-icon">✉️</span> Invite People
              </button>
            )}
            {adminEnabled && (
              <>
                <div className="discord-dropdown-sep" />
                <button onClick={() => { setShowServerDropdown(false); setActivePanel('admin'); }}>
                  <span className="dropdown-icon">⚙️</span> Server Settings
                </button>
                <button onClick={() => { setShowServerDropdown(false); setShowCreateChannel(true); }}>
                  <span className="dropdown-icon">#</span> Create Channel
                </button>
                <button onClick={() => { setShowServerDropdown(false); setShowCreateCategory(true); }}>
                  <span className="dropdown-icon">📁</span> Create Category
                </button>
                <button onClick={() => { setShowServerDropdown(false); setActivePanel('roles'); }}>
                  <span className="dropdown-icon">🏷️</span> Manage Roles
                </button>
              </>
            )}
            {isMember && !isOwner && (
              <>
                <div className="discord-dropdown-sep" />
                <button className="discord-dropdown-danger" onClick={() => { setShowServerDropdown(false); handleLeave(); }}>
                  <span className="dropdown-icon">🚪</span> Leave Server
                </button>
              </>
            )}
          </div>
        )}

        {!isMember && (
          <div className="discord-sidebar-join">
            <button className="discord-join-btn" onClick={handleJoin} disabled={busy}>
              {busy ? 'Joining...' : 'Join Group'}
            </button>
          </div>
        )}

        <div className="discord-channel-list">
          {channelsByCategory.map((cat) => {
            const isCollapsed = cat.id && collapsedCategories.has(cat.id);
            return (
              <div key={cat.id || 'uncategorized'} className="discord-category">
                {cat.name && (
                  <div className="discord-category-header" onClick={() => toggleCategory(cat.id)}>
                    <span className={`discord-category-arrow${isCollapsed ? ' collapsed' : ''}`}>&#9660;</span>
                    <span className="discord-category-name">{cat.name.toUpperCase()}</span>
                    {adminEnabled && (
                      <button className="discord-category-delete" onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }} title="Delete category">&#10005;</button>
                    )}
                  </div>
                )}
                {!isCollapsed && cat.channels.map((ch) => (
                  editingChannelId === ch.id ? (
                    <div key={ch.id} className="discord-channel-edit-form">
                      <input
                        type="text"
                        value={editChannelName}
                        onChange={(e) => setEditChannelName(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))}
                        placeholder="channel-name"
                        autoFocus
                      />
                      <input
                        type="text"
                        value={editChannelTopic}
                        onChange={(e) => setEditChannelTopic(e.target.value)}
                        placeholder="Channel topic (optional)"
                      />
                      <div className="discord-create-btns">
                        <button onClick={handleEditChannel} disabled={busy || !editChannelName.trim()}>Save</button>
                        <button onClick={() => setEditingChannelId(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={ch.id}
                      className={`discord-channel${selectedChannelId === ch.id && activePanel === 'chat' ? ' active' : ''}`}
                      onClick={() => { setSelectedChannelId(ch.id); setActivePanel('chat'); }}
                    >
                      <span className="discord-channel-hash">#</span>
                      <span className="discord-channel-name">{ch.name}</span>
                      {adminEnabled && (
                        <div className="discord-channel-actions-inline">
                          <button className="discord-channel-edit" onClick={(e) => { e.stopPropagation(); setEditingChannelId(ch.id); setEditChannelName(ch.name); setEditChannelTopic(ch.topic || ''); }} title="Edit channel">✏️</button>
                          {channels.length > 1 && (
                            <button className="discord-channel-delete" onClick={(e) => { e.stopPropagation(); handleDeleteChannel(ch.id); }} title="Delete channel">✕</button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                ))}
              </div>
            );
          })}

          {adminEnabled && (
            <div className="discord-channel-actions">
              {showCreateChannel ? (
                <div className="discord-create-form">
                  <input type="text" placeholder="channel-name" value={newChannelName} onChange={(e) => setNewChannelName(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))} onKeyDown={(e) => e.key === 'Enter' && handleCreateChannel()} autoFocus />
                  {categories.length > 0 && (
                    <select value={newChannelCategory} onChange={(e) => setNewChannelCategory(e.target.value)}>
                      <option value="">No category</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
                  <div className="discord-create-btns">
                    <button onClick={handleCreateChannel} disabled={busy || !newChannelName.trim()}>Create</button>
                    <button onClick={() => setShowCreateChannel(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button className="discord-add-channel" onClick={() => setShowCreateChannel(true)}>+ Create Channel</button>
              )}
              {showCreateCategory ? (
                <div className="discord-create-form">
                  <input type="text" placeholder="Category Name" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()} autoFocus />
                  <div className="discord-create-btns">
                    <button onClick={handleCreateCategory} disabled={busy || !newCategoryName.trim()}>Create</button>
                    <button onClick={() => setShowCreateCategory(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button className="discord-add-channel" onClick={() => setShowCreateCategory(true)}>+ Create Category</button>
              )}
            </div>
          )}
        </div>

        <div className="discord-nav-divider" />
        <div className="discord-nav-items">
          <button className={`discord-nav-item${activePanel === 'discussion' ? ' active' : ''}`} onClick={() => setActivePanel('discussion')}>
            <span className="discord-nav-icon">&#128221;</span> Discussion
          </button>
          <button className={`discord-nav-item${activePanel === 'about' ? ' active' : ''}`} onClick={() => setActivePanel('about')}>
            <span className="discord-nav-icon">&#8505;&#65039;</span> About
          </button>
          {adminEnabled && (
            <>
              <button className={`discord-nav-item${activePanel === 'admin' ? ' active' : ''}`} onClick={() => setActivePanel('admin')}>
                <span className="discord-nav-icon">&#9881;&#65039;</span> Admin
              </button>
              <button className={`discord-nav-item${activePanel === 'roles' ? ' active' : ''}`} onClick={() => setActivePanel('roles')}>
                <span className="discord-nav-icon">&#127991;&#65039;</span> Roles
              </button>
            </>
          )}
        </div>

        <div className="discord-sidebar-footer">
          {isMember && !isOwner && (
            <button className="discord-leave-btn" onClick={handleLeave} disabled={busy}>Leave Server</button>
          )}
          {isAdmin && (
            <label className="discord-view-toggle">
              <input type="checkbox" checked={viewAsMember} onChange={(e) => setViewAsMember(e.target.checked)} />
              <span>View as member</span>
            </label>
          )}
        </div>

        {/* User panel (bottom) */}
        <div className="discord-user-panel">
          <div className="discord-user-panel-avatar">
            <img
              src={user?.profile_image || user?.profileImage || '/default-avatar.png'}
              alt=""
              onError={(e) => { e.target.src = '/default-avatar.png'; }}
            />
            <span className="discord-user-panel-dot" />
          </div>
          <div className="discord-user-panel-info">
            <span className="discord-user-panel-name">{user?.username || 'Unknown'}</span>
            <span className="discord-user-panel-status">Online</span>
          </div>
          <div className="discord-user-panel-icons">
            <button title="Mute" className="discord-user-mic">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a4 4 0 014 4v5a4 4 0 01-8 0V6a4 4 0 014-4zm-6 9a1 1 0 012 0 6 6 0 0012 0 1 1 0 012 0 8 8 0 01-7 7.93V21h3a1 1 0 010 2H9a1 1 0 010-2h3v-2.07A8 8 0 016 11z"/></svg>
            </button>
            <button title="Deafen" className="discord-user-deafen">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12v4.5C2 18.43 3.57 20 5.5 20h1a1 1 0 001-1v-6a1 1 0 00-1-1h-.84A8.001 8.001 0 0112 4a8.001 8.001 0 016.34 8H17.5a1 1 0 00-1 1v6a1 1 0 001 1h1c1.93 0 3.5-1.57 3.5-3.5V12c0-5.52-4.48-10-10-10z"/></svg>
            </button>
            <button title="User Settings" onClick={() => setShowUserSettings(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96a7.04 7.04 0 00-1.62-.94L14.4 3.05a.47.47 0 00-.48-.41h-3.84a.47.47 0 00-.48.41l-.36 2.54c-.59.24-1.13.57-1.62.94L5.24 5.62a.49.49 0 00-.59.22L2.73 9.16a.49.49 0 00.12.61l2.03 1.58c-.05.3-.07.63-.07.94 0 .32.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 00-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1115.6 12 3.611 3.611 0 0112 15.6z"/></svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Center: Main content area ── */}
      <div className="discord-main">
        {notice && <div className="discord-notice">{notice}<button onClick={() => setNotice('')}>&#10005;</button></div>}

        {activePanel === 'chat' && (
          <ChannelChat
            channel={selectedChannel}
            groupId={groupId}
            user={user}
            isAdmin={adminEnabled}
            onToggleMembers={() => setShowMemberSidebar((p) => !p)}
            showMembers={showMemberSidebar}
            members={members}
          />
        )}

        {activePanel === 'discussion' && (
          <div className="discord-panel">
            <div className="discord-panel-header">
              <h2>Discussion</h2>
              {pinnedPostId !== null && <span className="discord-muted">Pinned post is highlighted</span>}
            </div>
            <div className="discord-panel-content">
              {isLocked ? (
                <div className="discord-muted">This is a private group. Request to join to see posts.</div>
              ) : (
                <>
                  {canPost && <CreatePost groupId={groupId} contextLabel={groupName} onPostCreated={handlePostCreated} />}
                  {postsLoading ? <div className="discord-muted">Loading posts...</div> : postsError ? <div className="discord-muted">{postsError}</div> : posts.length === 0 ? <div className="discord-muted">No posts yet.</div> : (
                    <div className="discord-posts">
                      {posts.map((p) => {
                        const isPinned = pinnedPostId !== null && String(p.id) === String(pinnedPostId);
                        const status = String(p.moderation_status || 'published').toLowerCase();
                        const isMine = (p.author_username || p.username || '').toLowerCase() === myUsername;
                        const showStatus = status !== 'published' && (isMine || adminEnabled);
                        return (
                          <div key={p.id} className={isPinned ? 'discord-post pinned' : 'discord-post'}>
                            {(isPinned || adminEnabled) && (
                              <div className="discord-post-toolbar">
                                <div className="discord-post-badges">
                                  {isPinned && <span className="discord-pin-badge">&#128204; Pinned</span>}
                                  {showStatus && status === 'pending' && <span className="discord-status-badge pending">Pending</span>}
                                  {showStatus && status === 'rejected' && <span className="discord-status-badge rejected">Rejected</span>}
                                </div>
                                {adminEnabled && (isPinned
                                  ? <button className="discord-tiny-btn" onClick={handleUnpin} disabled={busy}>Unpin</button>
                                  : <button className="discord-tiny-btn" onClick={() => handlePin(p.id)} disabled={busy}>Pin</button>
                                )}
                              </div>
                            )}
                            <Post post={p} onDelete={handlePostDeleted} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {activePanel === 'about' && (
          <div className="discord-panel">
            <div className="discord-panel-header"><h2>About</h2></div>
            <div className="discord-panel-content">
              <div className="discord-about-section">
                <h3>Description</h3>
                {adminEnabled && editingDescription ? (
                  <div className="discord-edit-desc">
                    <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Write a description..." rows={4} maxLength={1000} disabled={busy} />
                    <div className="discord-edit-btns">
                      <button onClick={handleSaveDescription} disabled={busy}>Save</button>
                      <button onClick={() => { setEditingDescription(false); setEditDescription(groupDescription); }} disabled={busy}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p>{groupDescription || 'No description yet.'}</p>
                    {adminEnabled && <button className="discord-tiny-btn" onClick={() => { setEditDescription(groupDescription); setEditingDescription(true); }}>Edit description</button>}
                  </>
                )}
              </div>
              <div className="discord-about-grid">
                <div className="discord-about-item"><span className="discord-about-k">Privacy</span><span className="discord-about-v">{privacy}</span></div>
                <div className="discord-about-item"><span className="discord-about-k">Members</span><span className="discord-about-v">{memberCount}</span></div>
                <div className="discord-about-item"><span className="discord-about-k">Owner</span><span className="discord-about-v">{ownerUsernameRaw || '\u2014'}</span></div>
                <div className="discord-about-item"><span className="discord-about-k">Created</span><span className="discord-about-v">{createdAt || '\u2014'}</span></div>
                <div className="discord-about-item"><span className="discord-about-k">Posting</span><span className="discord-about-v">{postingLabel}</span></div>
                <div className="discord-about-item"><span className="discord-about-k">Post approval</span><span className="discord-about-v">{effectiveRequireApproval ? 'On' : 'Off'}</span></div>
              </div>
              {isMember && (
                <div className="discord-about-section">
                  <h3>Invite people</h3>
                  <div className="discord-invite-search">
                    <input type="text" placeholder="Search by username..." value={inviteQuery} onChange={(e) => handleInviteSearch(e.target.value)} disabled={busy} />
                    {inviteSearching && <span className="discord-muted">Searching...</span>}
                  </div>
                  {inviteResults.length > 0 && (
                    <div className="discord-invite-results">
                      {inviteResults.map((u) => {
                        const uName = u.username || u.name || '';
                        const alreadySent = inviteSent.has(uName.toLowerCase());
                        return (
                          <div key={uName} className="discord-invite-item">
                            <div className="discord-invite-user">
                              <img src={u.profileImage || u.profile_image || '/default-avatar.png'} alt="" className="discord-invite-avatar" onError={(e) => { e.target.src = '/default-avatar.png'; }} />
                              <span>{uName}</span>
                            </div>
                            <button className={`discord-tiny-btn${alreadySent ? ' secondary' : ''}`} onClick={() => handleInviteUser(uName)} disabled={busy || alreadySent}>
                              {alreadySent ? 'Invited' : 'Invite'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activePanel === 'roles' && adminEnabled && (
          <div className="discord-panel">
            <div className="discord-panel-header"><h2>Roles</h2></div>
            <div className="discord-panel-content">
              <div className="discord-roles-list">
                {customRoles.map((role) => (
                  <div key={role.id} className="discord-role-item">
                    <div className="discord-role-color" style={{ backgroundColor: role.color }} />
                    <span className="discord-role-name" style={{ color: role.color }}>{role.name}</span>
                    <span className="discord-muted">{role.member_count || 0} members</span>
                    {isOwner && <button className="discord-tiny-btn danger" onClick={() => handleDeleteRole(role.id)} disabled={busy}>Delete</button>}
                  </div>
                ))}
                {customRoles.length === 0 && <div className="discord-muted">No custom roles yet.</div>}
              </div>
              {showCreateRole ? (
                <div className="discord-create-role-form">
                  <input type="text" placeholder="Role name" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateRole()} autoFocus />
                  <input type="color" value={newRoleColor} onChange={(e) => setNewRoleColor(e.target.value)} />
                  <div className="discord-create-btns">
                    <button onClick={handleCreateRole} disabled={busy || !newRoleName.trim()}>Create</button>
                    <button onClick={() => setShowCreateRole(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button className="discord-add-channel" onClick={() => setShowCreateRole(true)}>+ Create Role</button>
              )}
              <div className="discord-about-section" style={{ marginTop: 24 }}>
                <h3>Members</h3>
                {membersLoading ? <div className="discord-muted">Loading members...</div> : (
                  <div className="discord-members-admin">
                    {members.map((m, index) => {
                      const memberName = (m.username || '').toLowerCase();
                      const isMe = memberName && memberName === myUsername;
                      const ownerName = (group?.owner_username || group?.ownerUsername || '').toLowerCase() || (members.find((row) => String(row.role || '').toLowerCase() === 'owner')?.username || '').toLowerCase();
                      const isMemberOwner = memberName && ownerName && memberName === ownerName;
                      const canRemove = adminEnabled && !isMemberOwner && !isMe;
                      const canPromote = isOwner && !isMemberOwner;
                      const memberDisplay = m.username || 'Member';
                      const memberIdentifier = m.username || m.handle || '';
                      return (
                        <div key={`${memberIdentifier}-${index}`} className="discord-member-admin-item">
                          <div className="discord-member-admin-info">
                            <img src={m.profile_image || m.profileImage || '/default-avatar.png'} alt="" className="discord-member-admin-avatar" onError={(e) => { e.target.src = '/default-avatar.png'; }} />
                            <span className="discord-member-admin-name">{memberDisplay}{isMe ? ' (you)' : ''}</span>
                            <span className={`discord-role-badge-inline ${m.role}`}>{m.role}</span>
                          </div>
                          <div className="discord-member-admin-actions">
                            {canPromote && m.role !== 'admin' && m.role !== 'owner' && (
                              <button className="discord-tiny-btn" onClick={() => handleRoleChange(memberIdentifier, 'admin')} disabled={busy}>Make admin</button>
                            )}
                            {canPromote && m.role === 'admin' && (
                              <button className="discord-tiny-btn" onClick={() => handleRoleChange(memberIdentifier, 'member')} disabled={busy}>Remove admin</button>
                            )}
                            {canRemove && (
                              <>
                                <button className="discord-tiny-btn" onClick={() => handleRemove(memberIdentifier)} disabled={busy}>Remove</button>
                                <button className="discord-tiny-btn danger" onClick={() => handleBan(memberIdentifier)} disabled={busy}>Ban</button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activePanel === 'admin' && adminEnabled && (
          <div className="discord-panel">
            <div className="discord-panel-header"><h2>Server Settings</h2></div>
            <div className="discord-panel-content">
              <div className="discord-admin-section">
                <h3>Server Appearance</h3>
                <div className="discord-appearance-row">
                  <div className="discord-appearance-item">
                    <label>Cover Photo</label>
                    <div className="discord-image-upload">
                      <div className="discord-cover-preview" style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}>
                        {!coverUrl && <span>No cover</span>}
                      </div>
                      <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverUpload} disabled={busy} style={{ display: 'none' }} />
                      <button className="discord-tiny-btn" onClick={() => coverInputRef.current?.click()} disabled={busy}>{busy ? 'Uploading...' : 'Upload cover'}</button>
                    </div>
                  </div>
                  <div className="discord-appearance-item">
                    <label>Server Avatar</label>
                    <div className="discord-image-upload">
                      <div className="discord-avatar-preview">
                        {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{(groupName || '?').slice(0, 1).toUpperCase()}</span>}
                      </div>
                      <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} disabled={busy} style={{ display: 'none' }} />
                      <button className="discord-tiny-btn" onClick={() => avatarInputRef.current?.click()} disabled={busy}>{busy ? 'Uploading...' : 'Upload avatar'}</button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="discord-admin-section">
                <h3>Post Permissions</h3>
                <div className="discord-admin-row">
                  <select value={postingPermission} onChange={(e) => setPostingPermission(e.target.value)} disabled={busy}>
                    <option value="members">Members can post</option>
                    <option value="admins">Admins only</option>
                  </select>
                  <button className="discord-tiny-btn" onClick={handleSavePostingPermission} disabled={busy}>Save</button>
                </div>
              </div>
              <div className="discord-admin-section">
                <h3>Post Approval</h3>
                <div className="discord-admin-row">
                  <label className="discord-toggle"><input type="checkbox" checked={requirePostApproval} onChange={(e) => setRequirePostApproval(e.target.checked)} disabled={busy} /><span>Require approval</span></label>
                  <label className="discord-toggle"><input type="checkbox" checked={adminsBypassApproval} onChange={(e) => setAdminsBypassApproval(e.target.checked)} disabled={busy || !requirePostApproval} /><span>Admins bypass</span></label>
                  <button className="discord-tiny-btn" onClick={handleSaveModeration} disabled={busy}>Save</button>
                </div>
              </div>
              {effectiveRequireApproval && pendingPosts.length > 0 && (
                <div className="discord-admin-section">
                  <h3>Pending Posts ({pendingPosts.length})</h3>
                  <div className="discord-pending-list">
                    {pendingPosts.map((p) => (
                      <div key={p.id} className="discord-pending-item">
                        <div><strong>{p.author_username || 'Member'}</strong><br /><span className="discord-muted">{(p.content || '').slice(0, 140)}</span></div>
                        <div className="discord-pending-actions">
                          <button className="discord-tiny-btn" onClick={() => handleApprovePost(p.id)} disabled={busy}>Approve</button>
                          <button className="discord-tiny-btn danger" onClick={() => handleRejectPost(p.id)} disabled={busy}>Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="discord-admin-section">
                <h3>Moderation History</h3>
                <div className="discord-admin-row">
                  <select value={moderationFilter} onChange={(e) => setModerationFilter(e.target.value)} disabled={busy}>
                    <option value="all">All</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
                  </select>
                  <button className="discord-tiny-btn" onClick={() => refreshModeration(groupId)} disabled={busy || moderationLoading}>Refresh</button>
                </div>
                {moderationLoading ? <div className="discord-muted">Loading...</div> : moderationError ? <div className="discord-muted">{moderationError}</div> : moderationItems.length === 0 ? <div className="discord-muted">No activity.</div> : (
                  <div className="discord-pending-list">
                    {moderationItems.map((it) => {
                      const status = String(it.moderation_status || '').toLowerCase();
                      const isApproved = !!it.approved_by;
                      const who = isApproved ? (it.approver_username || it.approved_by) : (it.rejector_username || it.rejected_by);
                      const when = it.approved_at || it.rejected_at || it.created_at;
                      const label = status === 'pending' ? 'Pending' : isApproved ? 'Approved' : 'Rejected';
                      return (
                        <div key={it.id} className="discord-pending-item">
                          <div><strong>{it.author_username || 'Member'}</strong><br />
                          <span className={`discord-status-badge ${label.toLowerCase()}`}>{label}</span>{' \u00b7 '}{who ? `by ${who}` : ''}{when ? ` \u00b7 ${formatDateTime(when)}` : ''}<br />
                          <span className="discord-muted">{(it.content || '').slice(0, 160)}</span></div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="discord-admin-section">
                <h3>Activity Log</h3>
                <div className="discord-admin-row">
                  <select value={activityFilter} onChange={(e) => setActivityFilter(e.target.value)} disabled={busy}>
                    <option value="all">All</option>
                    <option value="create_group">Created</option><option value="update_settings">Settings</option>
                    <option value="join_group">Joined</option><option value="leave_group">Left</option>
                    <option value="set_member_role">Role changed</option><option value="remove_member">Removed</option>
                  </select>
                  <button className="discord-tiny-btn" onClick={() => refreshActivity(groupId)} disabled={busy || activityLoading}>Refresh</button>
                </div>
                {activityLoading ? <div className="discord-muted">Loading...</div> : activityError ? <div className="discord-muted">{activityError}</div> : activityItems.length === 0 ? <div className="discord-muted">No activity.</div> : (
                  <div className="discord-pending-list">
                    {activityItems.map((it) => {
                      const f = formatActivity(it);
                      return (
                        <div key={it.id} className="discord-pending-item">
                          <div><strong>{f.actor}</strong> {f.text}{f.when ? ` \u00b7 ${f.when}` : ''}{f.snippet ? <><br /><span className="discord-muted">{f.snippet}</span></> : null}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="discord-admin-section">
                <h3>Banned Members</h3>
                {bannedMembers.length === 0 ? <div className="discord-muted">No banned members.</div> : (
                  <div className="discord-pending-list">
                    {bannedMembers.map((b, index) => {
                      const banName = b.username || b.handle || b.member_username || '';
                      return (
                        <div key={`${banName}-${index}`} className="discord-pending-item">
                          <div><strong>{banName || 'Banned member'}</strong></div>
                          <button className="discord-tiny-btn" onClick={() => banName && handleUnban(banName)} disabled={busy}>Unban</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="discord-admin-section">
                <h3>Join Requests</h3>
                {requests.length === 0 ? <div className="discord-muted">No pending requests.</div> : (
                  <div className="discord-pending-list">
                    {requests.map((r, index) => {
                      const name = r.username || r.requester_username || '';
                      return (
                        <div key={`${name}-${index}`} className="discord-pending-item">
                          <div><strong>{name || 'Member'}</strong></div>
                          <div className="discord-pending-actions">
                            <button className="discord-tiny-btn" onClick={() => name && handleApprove(name)} disabled={busy}>Approve</button>
                            <button className="discord-tiny-btn danger" onClick={() => name && handleDecline(name)} disabled={busy}>Decline</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {isOwner && (
                <div className="discord-admin-section discord-danger-zone">
                  <h3>Danger Zone</h3>
                  <p className="discord-muted">Permanently delete this server and all data.</p>
                  <button className="discord-delete-btn" onClick={handleDeleteGroup} disabled={busy}>
                    {busy ? 'Deleting...' : '\ud83d\uddd1\ufe0f Delete Server'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Right: Member sidebar ── */}
      {showMemberSidebar && (
        <MemberSidebar
          groupId={groupId}
          user={user}
          isAdmin={adminEnabled}
          isOwner={isOwner}
          onMemberClick={(m, e) => {
            const rect = e?.currentTarget?.getBoundingClientRect();
            const roles = typeof m.custom_roles === 'string' ? JSON.parse(m.custom_roles) : (m.custom_roles || []);
            setMemberPopup({
              username: m.username || 'Unknown',
              profileImage: m.profile_image || '/default-avatar.png',
              role: m.role || null,
              customRoles: roles,
              userAddress: m.user_address,
              joinedAt: m.joined_at,
              x: rect ? rect.left - 310 : 400,
              y: rect ? Math.min(rect.top, window.innerHeight - 420) : 200,
            });
          }}
        />
      )}
    </div>
    )}
    </div>

    {/* Member popup card */}
    {memberPopup && (
      <div
        className="discord-member-popup"
        style={{ top: memberPopup.y, left: memberPopup.x }}
      >
        <div className="discord-member-popup-banner" />
        <div className="discord-member-popup-avatar-wrap">
          <img
            src={memberPopup.profileImage}
            alt=""
            className="discord-member-popup-avatar"
            onError={(e) => { e.target.src = '/default-avatar.png'; }}
          />
          <span className="discord-member-popup-status-dot" />
        </div>
        <div className="discord-member-popup-body">
          <h3 className="discord-member-popup-name">{memberPopup.username}</h3>
          <span className="discord-member-popup-handle">{memberPopup.username}</span>
          <div className="discord-member-popup-divider" />
          {memberPopup.joinedAt && (
            <div className="discord-member-popup-section">
              <h4>Member Since</h4>
              <p>{new Date(memberPopup.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            </div>
          )}
          <div className="discord-member-popup-section">
            <h4>Roles</h4>
            <div className="discord-member-popup-roles">
              {memberPopup.customRoles && memberPopup.customRoles.length > 0 ? (
                memberPopup.customRoles.map((r) => (
                  <span key={r.id || r.name} className="discord-member-popup-role-tag" style={{ borderColor: r.color || '#5865f2' }}>
                    <span className="discord-role-dot" style={{ background: r.color || '#5865f2' }} />
                    {r.name}
                  </span>
                ))
              ) : memberPopup.role ? (
                <span className="discord-member-popup-role-tag">
                  <span className="discord-role-dot" />
                  {memberPopup.role}
                </span>
              ) : (
                <span className="discord-member-popup-role-tag">
                  <span className="discord-role-dot" />
                  @everyone
                </span>
              )}
            </div>
          </div>
          <div className="discord-member-popup-note">
            <h4>Note</h4>
            <input type="text" placeholder="Click to add a note" readOnly />
          </div>
          <div className="discord-member-popup-msg">
            <input
              type="text"
              placeholder={`Message @${memberPopup.username}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                  setMemberPopup(null);
                }
              }}
            />
          </div>
        </div>
      </div>
    )}

    {/* ── User Settings Modal ── */}
    {showUserSettings && <UserSettings onClose={() => setShowUserSettings(false)} />}

    {/* ── Create Server Modal ── */}
    {showCreateServerModal && (
      <div className="discord-create-modal-overlay" onClick={() => setShowCreateServerModal(false)}>
        <div className="discord-create-modal" onClick={(e) => e.stopPropagation()}>
          <button className="discord-create-modal-close" onClick={() => setShowCreateServerModal(false)}>✕</button>

          {createServerStep === 'main' && (
            <>
              <div className="discord-create-modal-header">
                <h2>Create Your Server</h2>
                <p>Your server is where you and your friends hang out. Make yours and start talking.</p>
              </div>
              <div className="discord-create-modal-options">
                <button className="discord-create-modal-option" onClick={() => setCreateServerStep('form')}>
                  <div className="discord-create-modal-option-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>
                  </div>
                  <span>Create My Own</span>
                  <span className="discord-create-modal-arrow">›</span>
                </button>
                <div className="discord-create-modal-label">START FROM A TEMPLATE</div>
                <button className="discord-create-modal-option" onClick={() => setCreateServerStep('form')}>
                  <div className="discord-create-modal-option-icon" style={{color: '#5865f2'}}>🎮</div>
                  <span>Gaming</span>
                  <span className="discord-create-modal-arrow">›</span>
                </button>
                <button className="discord-create-modal-option" onClick={() => setCreateServerStep('form')}>
                  <div className="discord-create-modal-option-icon" style={{color: '#eb459e'}}>💜</div>
                  <span>Friends</span>
                  <span className="discord-create-modal-arrow">›</span>
                </button>
                <button className="discord-create-modal-option" onClick={() => setCreateServerStep('form')}>
                  <div className="discord-create-modal-option-icon" style={{color: '#fee75c'}}>📚</div>
                  <span>Study Group</span>
                  <span className="discord-create-modal-arrow">›</span>
                </button>
                <button className="discord-create-modal-option" onClick={() => setCreateServerStep('form')}>
                  <div className="discord-create-modal-option-icon" style={{color: '#57f287'}}>🏫</div>
                  <span>Community</span>
                  <span className="discord-create-modal-arrow">›</span>
                </button>
              </div>
              <div className="discord-create-modal-footer">
                <h3>Have an invite already?</h3>
                <button className="discord-create-modal-join-btn" onClick={() => setCreateServerStep('join')}>
                  Join a Server
                </button>
              </div>
            </>
          )}

          {createServerStep === 'form' && (
            <>
              <div className="discord-create-modal-header">
                <h2>Customize Your Server</h2>
                <p>Give your new server a personality with a name and description. You can always change it later.</p>
              </div>
              <div className="discord-create-modal-form">
                <label>
                  <span className="discord-create-modal-form-label">SERVER NAME</span>
                  <input
                    type="text"
                    value={createServerName}
                    onChange={(e) => setCreateServerName(e.target.value)}
                    placeholder={`${user?.username || 'My'}'s server`}
                    maxLength={50}
                    autoFocus
                  />
                </label>
                <label>
                  <span className="discord-create-modal-form-label">DESCRIPTION</span>
                  <textarea
                    value={createServerDesc}
                    onChange={(e) => setCreateServerDesc(e.target.value)}
                    placeholder="Tell people what your server is about"
                    maxLength={160}
                    rows={3}
                  />
                </label>
                <label>
                  <span className="discord-create-modal-form-label">PRIVACY</span>
                  <select value={createServerPrivacy} onChange={(e) => setCreateServerPrivacy(e.target.value)}>
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                </label>
                <p className="discord-create-modal-hint">By creating a server, you agree to the community guidelines.</p>
              </div>
              <div className="discord-create-modal-actions">
                <button className="discord-create-modal-back" onClick={() => setCreateServerStep('main')}>Back</button>
                <button
                  className="discord-create-modal-submit"
                  onClick={handleCreateServer}
                  disabled={createServerBusy || !createServerName.trim()}
                >
                  {createServerBusy ? 'Creating...' : 'Create'}
                </button>
              </div>
            </>
          )}

          {createServerStep === 'join' && (
            <>
              <div className="discord-create-modal-header">
                <h2>Join a Server</h2>
                <p>Enter a server ID below to join an existing server.</p>
              </div>
              <div className="discord-create-modal-form">
                <label>
                  <span className="discord-create-modal-form-label">SERVER ID</span>
                  <input
                    type="text"
                    value={joinServerCode}
                    onChange={(e) => setJoinServerCode(e.target.value)}
                    placeholder="Enter a server ID"
                    autoFocus
                  />
                </label>
              </div>
              <div className="discord-create-modal-actions">
                <button className="discord-create-modal-back" onClick={() => setCreateServerStep('main')}>Back</button>
                <button
                  className="discord-create-modal-submit"
                  onClick={handleJoinServerByCode}
                  disabled={createServerBusy || !joinServerCode.trim()}
                >
                  {createServerBusy ? 'Joining...' : 'Join Server'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )}
    </div>
  );
}
