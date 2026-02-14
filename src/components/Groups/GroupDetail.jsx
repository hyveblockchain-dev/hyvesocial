import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import CreatePost from '../Feed/CreatePost';
import Post from '../Post/Post';
import ChannelChat from './ChannelChat';
import MemberSidebar from './MemberSidebar';
import UserSettings from './UserSettings';
import ServerSettings from './ServerSettings';
import { compressImage } from '../../utils/imageCompression';
import { formatDate, formatDateTime } from '../../utils/date';
import { IconArrowLeft } from '../Icons/Icons';
import DmChat from './DmChat';
import DmFriends from './DmFriends';
import DmDiscover from './DmDiscover';
import './GroupDetail.css';

export default function GroupDetail() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user, socket } = useAuth();
  const coverInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const serverHeaderRef = useRef(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

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

  // ── Invite modal state ──
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteFriends, setInviteFriends] = useState([]);
  const [inviteModalSearch, setInviteModalSearch] = useState('');
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const [inviteModalSent, setInviteModalSent] = useState(new Set());

  // ── Notification settings modal state ──
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifMuteServer, setNotifMuteServer] = useState(false);
  const [notifSetting, setNotifSetting] = useState('mentions'); // 'all' | 'mentions' | 'nothing'
  const [notifSuppressEveryone, setNotifSuppressEveryone] = useState(false);
  const [notifSuppressRoles, setNotifSuppressRoles] = useState(false);
  const [notifSuppressHighlights, setNotifSuppressHighlights] = useState(false);
  const [notifMuteEvents, setNotifMuteEvents] = useState(false);
  const [notifMobilePush, setNotifMobilePush] = useState(true);
  const [notifChannelOverride, setNotifChannelOverride] = useState('');
  const [notifChannelOverrides, setNotifChannelOverrides] = useState([]);

  // ── Nickname & Activity state ──
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [nicknames, setNicknames] = useState({});

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
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [showServerDropdown, setShowServerDropdown] = useState(false);
  const [showAllChannels, setShowAllChannels] = useState(true);
  const [hideMutedChannels, setHideMutedChannels] = useState(false);
  const [editingChannelId, setEditingChannelId] = useState(null);
  const [editChannelName, setEditChannelName] = useState('');
  const [editChannelTopic, setEditChannelTopic] = useState('');

  // ── Channel settings modal state ──
  const [channelSettingsOpen, setChannelSettingsOpen] = useState(null); // channel object or null
  const [channelSettingsTab, setChannelSettingsTab] = useState('overview'); // 'overview' | 'permissions'
  const [csName, setCsName] = useState('');
  const [csTopic, setCsTopic] = useState('');
  const [csNsfw, setCsNsfw] = useState(false);
  const [csSlowmode, setCsSlowmode] = useState(0);
  const [csCategory, setCsCategory] = useState('');

  // ── Create channel modal state ──
  const [newChannelType, setNewChannelType] = useState('text');

  // ── Category rename state ──
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editCategoryName, setEditCategoryName] = useState('');

  // ── Context menu state ──
  const [contextMenu, setContextMenu] = useState(null); // { type: 'channel'|'category', id, x, y, data }

  // ── Permission override state ──
  const [permOverrides, setPermOverrides] = useState([]); // array of { id, type:'role'|'member', allow:[], deny:[] }
  const [permSelectedId, setPermSelectedId] = useState('everyone'); // selected role/member id
  const [permAddingRole, setPermAddingRole] = useState(false);
  const [permSearch, setPermSearch] = useState('');
  const [catPermOverrides, setCatPermOverrides] = useState([]);
  const [catPermSelectedId, setCatPermSelectedId] = useState('everyone');
  const [editingCatPermsId, setEditingCatPermsId] = useState(null); // category id being edited
  const [showCatPermsModal, setShowCatPermsModal] = useState(false);

  // ── Role management state ──
  const [customRoles, setCustomRoles] = useState([]);
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#f0b232');

  // ── Member popup state ──
  const [memberPopup, setMemberPopup] = useState(null);
  const [popupRolePicker, setPopupRolePicker] = useState(false);
  const [popupRoleSearch, setPopupRoleSearch] = useState('');
  const [memberSidebarKey, setMemberSidebarKey] = useState(0);

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

  // ── Unread tracking ──
  const [unreads, setUnreads] = useState({}); // { channelId: { unread_count, mention_count } }
  const unreadsTimerRef = useRef(null);
  const [totalGroupUnreads, setTotalGroupUnreads] = useState(0);
  const totalUnreadsTimerRef = useRef(null);

  // ── DM mode state ──
  const [dmMode, setDmMode] = useState(false);
  const [dmConversations, setDmConversations] = useState([]);
  const [dmLoading, setDmLoading] = useState(false);
  const [dmSelectedUser, setDmSelectedUser] = useState(null);
  const [dmSearchQuery, setDmSearchQuery] = useState('');
  const [dmView, setDmView] = useState('friends'); // 'friends' | 'conversations'

  // ── Select Friends modal state ──
  const [showSelectFriends, setShowSelectFriends] = useState(false);
  const [selectFriendsSearch, setSelectFriendsSearch] = useState('');
  const [selectFriendsList, setSelectFriendsList] = useState([]);
  const [selectFriendsLoading, setSelectFriendsLoading] = useState(false);
  const [selectFriendsSelected, setSelectFriendsSelected] = useState(new Set());

  const myUsername = (user?.username || '').toLowerCase();

  // ── Forum channel state ──
  const [forumPosts, setForumPosts] = useState([]);
  const [forumLoading, setForumLoading] = useState(false);
  const [showForumCreate, setShowForumCreate] = useState(false);
  const [forumPostTitle, setForumPostTitle] = useState('');
  const [forumPostContent, setForumPostContent] = useState('');
  const [selectedForumPost, setSelectedForumPost] = useState(null);
  const [forumPostMessages, setForumPostMessages] = useState([]);
  const [forumMsgInput, setForumMsgInput] = useState('');

  // ── Events sidebar state ──
  const [sidebarEvents, setSidebarEvents] = useState([]);

  const loadForumPosts = useCallback(async (channelId) => {
    setForumLoading(true);
    try {
      const data = await api.getForumPosts(channelId);
      setForumPosts(data?.posts || []);
    } catch { setForumPosts([]); }
    finally { setForumLoading(false); }
  }, []);

  const loadForumPostMessages = useCallback(async (postId) => {
    try {
      const data = await api.getForumPostMessages(postId);
      setForumPostMessages(data?.messages || []);
    } catch { setForumPostMessages([]); }
  }, []);

  const handleCreateForumPost = async (channelId) => {
    if (!forumPostTitle.trim()) return;
    try {
      await api.createForumPost(channelId, forumPostTitle, forumPostContent);
      setShowForumCreate(false);
      setForumPostTitle('');
      setForumPostContent('');
      loadForumPosts(channelId);
    } catch (err) { console.error('Failed to create forum post', err); }
  };

  const handleSendForumMessage = async (postId) => {
    if (!forumMsgInput.trim()) return;
    try {
      await api.sendForumPostMessage(postId, forumMsgInput);
      setForumMsgInput('');
      loadForumPostMessages(postId);
    } catch (err) { console.error('Failed to send forum message', err); }
  };

  // ── Mobile responsive state ──
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 1024);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [mobileMembers, setMobileMembers] = useState(false);
  const touchStartRef = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)');
    const handler = (e) => {
      setIsMobile(e.matches);
      if (!e.matches) { setMobileSidebar(false); setMobileMembers(false); }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Swipe gestures for mobile
  const handleTouchStart = useCallback((e) => {
    if (!isMobile) return;
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() };
  }, [isMobile]);

  const handleTouchEnd = useCallback((e) => {
    if (!isMobile || !touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;
    if (dt > 500 || Math.abs(dy) > Math.abs(dx) || Math.abs(dx) < 60) return;
    if (dx > 0 && !mobileSidebar && !mobileMembers) { setMobileSidebar(true); }
    else if (dx < 0 && mobileSidebar) { setMobileSidebar(false); }
    else if (dx < 0 && !mobileSidebar && !mobileMembers) { setMobileMembers(true); }
    else if (dx > 0 && mobileMembers) { setMobileMembers(false); }
  }, [isMobile, mobileSidebar, mobileMembers]);

  // Close mobile panels when selecting a channel
  const handleMobileChannelSelect = useCallback((chId) => {
    setSelectedChannelId(chId);
    setActivePanel('chat');
    if (isMobile) setMobileSidebar(false);
  }, [isMobile]);

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
        setPopupRolePicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [memberPopup]);

  // Assign a custom role to a member via popup
  const handlePopupAssignRole = useCallback(async (roleId) => {
    if (!memberPopup) return;
    try {
      await api.assignMemberRole(groupId, memberPopup.username, roleId);
      // Re-fetch member data to update popup roles
      const data = await api.getMembersWithRoles(groupId);
      const updated = (data?.members || []).find(m => (m.username || '').toLowerCase() === (memberPopup.username || '').toLowerCase());
      if (updated) {
        const roles = typeof updated.custom_roles === 'string' ? JSON.parse(updated.custom_roles) : (updated.custom_roles || []);
        setMemberPopup(prev => ({ ...prev, customRoles: roles }));
      }
      setMemberSidebarKey(k => k + 1);
      setPopupRolePicker(false);
    } catch (err) {
      setNotice(err.message || 'Failed to assign role');
    }
  }, [memberPopup, groupId]);

  // Remove a custom role from a member via popup
  const handlePopupRemoveRole = useCallback(async (roleId) => {
    if (!memberPopup) return;
    try {
      await api.removeMemberRole(groupId, memberPopup.username, roleId);
      setMemberPopup(prev => ({
        ...prev,
        customRoles: (prev.customRoles || []).filter(r => r.id !== roleId)
      }));
      setMemberSidebarKey(k => k + 1);
    } catch (err) {
      setNotice(err.message || 'Failed to remove role');
    }
  }, [memberPopup, groupId]);

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

  // Load forum posts when a forum channel is selected
  useEffect(() => {
    if (selectedChannel?.type === 'forum' && selectedChannelId) {
      loadForumPosts(selectedChannelId);
      setSelectedForumPost(null);
    }
  }, [selectedChannelId, selectedChannel?.type, loadForumPosts]);

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

  // ── Fetch unreads for current group ──
  const refreshUnreads = useCallback(async () => {
    if (!groupId) return;
    try {
      const data = await api.getGroupUnreads(groupId);
      const map = {};
      (data?.unreads || []).forEach(u => { map[u.channel_id] = { unread_count: u.unread_count, mention_count: u.mention_count }; });
      setUnreads(map);
    } catch { /* ignore */ }
  }, [groupId]);

  // Poll unreads periodically
  useEffect(() => {
    refreshUnreads();
    unreadsTimerRef.current = setInterval(refreshUnreads, 30000);
    return () => clearInterval(unreadsTimerRef.current);
  }, [refreshUnreads]);

  // ── Poll total unreads across ALL joined groups (for Home badge) ──
  useEffect(() => {
    if (!joinedGroups.length) { setTotalGroupUnreads(0); return; }
    const fetchTotal = async () => {
      try {
        let total = 0;
        const results = await Promise.allSettled(
          joinedGroups.map(g => api.getGroupUnreads(g.id))
        );
        results.forEach(r => {
          if (r.status === 'fulfilled' && r.value?.unreads) {
            r.value.unreads.forEach(u => { total += (u.unread_count || 0); });
          }
        });
        setTotalGroupUnreads(total);
      } catch { /* ignore */ }
    };
    fetchTotal();
    totalUnreadsTimerRef.current = setInterval(fetchTotal, 30000);
    return () => clearInterval(totalUnreadsTimerRef.current);
  }, [joinedGroups]);

  // ── Mark all channels as read ──
  const handleMarkAllRead = async () => {
    try {
      await api.markAllChannelsRead(groupId);
      setUnreads({});
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  // ── Nicknames ──
  const loadNicknames = useCallback(async () => {
    if (!groupId) return;
    try {
      const data = await api.getNicknames(groupId);
      const map = {};
      (data || []).forEach(n => { map[n.user_address] = n.nickname; });
      setNicknames(map);
    } catch { /* ignore */ }
  }, [groupId]);

  useEffect(() => { loadNicknames(); }, [loadNicknames]);

  const handleSaveNickname = async () => {
    try {
      await api.setNickname(groupId, nicknameInput.trim() || null);
      setShowNicknameModal(false);
      loadNicknames();
    } catch (err) {
      console.error('Failed to set nickname:', err);
    }
  };

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

  // ── Load friends for Select Friends modal ──
  useEffect(() => {
    if (!showSelectFriends) return;
    (async () => {
      setSelectFriendsLoading(true);
      try {
        const data = await (api.getFriends ? api.getFriends() : Promise.resolve({ friends: [] }));
        const friends = Array.isArray(data?.friends) ? data.friends : [];
        const myHandle = (user?.username || '').toLowerCase();
        setSelectFriendsList(
          friends
            .filter((f) => {
              const h = (f.username || f.name || '').toLowerCase();
              return h && h !== myHandle;
            })
            .map((f) => ({
              username: f.username || f.name || '',
              profile_image: f.profile_image || f.profileImage || '',
            }))
        );
      } catch { setSelectFriendsList([]); }
      finally { setSelectFriendsLoading(false); }
    })();
  }, [showSelectFriends, user]);

  function handleOpenSelectFriends() {
    setShowSelectFriends(true);
    setSelectFriendsSearch('');
    setSelectFriendsSelected(new Set());
  }

  function toggleSelectFriend(username) {
    setSelectFriendsSelected((prev) => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username);
      else next.add(username);
      return next;
    });
  }

  function handleCreateDm() {
    const selected = [...selectFriendsSelected];
    if (selected.length === 0) return;
    // Start DM with first selected friend
    const friend = selectFriendsList.find((f) => f.username === selected[0]);
    setDmSelectedUser({
      username: friend?.username || selected[0],
      profileImage: friend?.profile_image || '',
    });
    setShowSelectFriends(false);
    // Refresh conversations list
    loadDmConversations();
  }

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
          // Load sidebar events
          try {
            const evData = await api.getEvents(groupId);
            setSidebarEvents(evData?.events || []);
          } catch { setSidebarEvents([]); }
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

  // ── Open invite modal ──
  async function openInviteModal() {
    setShowInviteModal(true);
    setInviteModalSearch('');
    setInviteLinkCopied(false);
    setInviteModalSent(new Set());
    try {
      const data = await api.getFriends();
      const list = Array.isArray(data) ? data : (data?.friends || []);
      // Filter out users who are already members
      const memberSet = new Set(members.map(m => (m.username || '').toLowerCase()));
      setInviteFriends(list.filter(f => !memberSet.has((f.username || '').toLowerCase())));
    } catch { setInviteFriends([]); }
  }

  async function handleInviteModalSend(username) {
    try {
      const data = await api.inviteToGroup(groupId, username);
      if (data?.error) return;
      setInviteModalSent(prev => new Set(prev).add(username.toLowerCase()));
    } catch {}
  }

  function handleCopyInviteLink() {
    const link = `${window.location.origin}/groups/${groupId}`;
    navigator.clipboard.writeText(link);
    setInviteLinkCopied(true);
    setTimeout(() => setInviteLinkCopied(false), 2000);
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
      await api.createChannel(groupId, { name: newChannelName.trim(), categoryId: newChannelCategory || null, type: newChannelType || 'text' });
      setNewChannelName(''); setNewChannelCategory(''); setNewChannelType('text'); setShowCreateChannel(false);
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

  // ── Channel settings modal save ──
  async function handleSaveChannelSettings() {
    if (!channelSettingsOpen) return;
    try {
      setBusy(true);
      await api.updateChannel(groupId, channelSettingsOpen.id, {
        name: csName.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
        topic: csTopic.trim() || null,
        nsfw: csNsfw,
        slowmode: csSlowmode,
        categoryId: csCategory || null,
      });
      setChannelSettingsOpen(null);
      await refreshChannels(groupId);
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  }

  function openChannelSettings(ch) {
    setChannelSettingsOpen(ch);
    setChannelSettingsTab('overview');
    setCsName(ch.name || '');
    setCsTopic(ch.topic || '');
    setCsNsfw(!!ch.nsfw);
    setCsSlowmode(ch.slowmode || 0);
    setCsCategory(ch.category_id || '');
    // Load existing permission overrides
    loadChannelPermOverrides(ch);
  }

  async function loadChannelPermOverrides(ch) {
    try {
      const data = await api.getChannelPermissions(groupId, ch.id);
      const overrides = data.channelPermissions?.overrides || [];
      // Always ensure @everyone entry exists
      if (!overrides.find(o => o.id === 'everyone')) {
        overrides.unshift({ id: 'everyone', type: 'role', allow: [], deny: [] });
      }
      setPermOverrides(overrides);
      setPermSelectedId('everyone');
      setPermAddingRole(false);
      setPermSearch('');
    } catch { setPermOverrides([{ id: 'everyone', type: 'role', allow: [], deny: [] }]); }
  }

  async function loadCatPermOverrides(catId) {
    try {
      const data = await api.getCategoryPermissions(groupId, catId);
      const overrides = data.permissions?.overrides || [];
      if (!overrides.find(o => o.id === 'everyone')) {
        overrides.unshift({ id: 'everyone', type: 'role', allow: [], deny: [] });
      }
      setCatPermOverrides(overrides);
      setCatPermSelectedId('everyone');
    } catch { setCatPermOverrides([{ id: 'everyone', type: 'role', allow: [], deny: [] }]); }
  }

  function getPermState(overrides, selectedId, permKey) {
    const ov = overrides.find(o => String(o.id) === String(selectedId));
    if (!ov) return 'inherit';
    if ((ov.allow || []).includes(permKey)) return 'allow';
    if ((ov.deny || []).includes(permKey)) return 'deny';
    return 'inherit';
  }

  function cyclePermState(setter, overrides, selectedId, permKey) {
    setter(prev => {
      const newOverrides = prev.map(o => ({ ...o, allow: [...(o.allow || [])], deny: [...(o.deny || [])] }));
      let ov = newOverrides.find(o => String(o.id) === String(selectedId));
      if (!ov) return prev;
      const current = getPermState(prev, selectedId, permKey);
      // Remove from both arrays first
      ov.allow = ov.allow.filter(p => p !== permKey);
      ov.deny = ov.deny.filter(p => p !== permKey);
      // Cycle: inherit -> allow -> deny -> inherit
      if (current === 'inherit') ov.allow.push(permKey);
      else if (current === 'allow') ov.deny.push(permKey);
      // else deny -> inherit (already removed)
      return newOverrides;
    });
  }

  function addRoleOverride(roleId, roleName) {
    setPermOverrides(prev => {
      if (prev.find(o => String(o.id) === String(roleId))) return prev;
      return [...prev, { id: roleId, type: 'role', name: roleName, allow: [], deny: [] }];
    });
    setPermSelectedId(String(roleId));
    setPermAddingRole(false);
    setPermSearch('');
  }

  function removeRoleOverride(roleId) {
    if (roleId === 'everyone') return;
    setPermOverrides(prev => prev.filter(o => String(o.id) !== String(roleId)));
    setPermSelectedId('everyone');
  }

  function addCatRoleOverride(roleId, roleName) {
    setCatPermOverrides(prev => {
      if (prev.find(o => String(o.id) === String(roleId))) return prev;
      return [...prev, { id: roleId, type: 'role', name: roleName, allow: [], deny: [] }];
    });
    setCatPermSelectedId(String(roleId));
  }

  function removeCatRoleOverride(roleId) {
    if (roleId === 'everyone') return;
    setCatPermOverrides(prev => prev.filter(o => String(o.id) !== String(roleId)));
    setCatPermSelectedId('everyone');
  }

  async function handleSaveChannelPerms() {
    if (!channelSettingsOpen) return;
    try {
      setBusy(true);
      await api.updateChannel(groupId, channelSettingsOpen.id, {
        permissions: { overrides: permOverrides }
      });
      setNotice('Channel permissions saved!');
      setTimeout(() => setNotice(''), 2000);
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  }

  async function handleSaveCatPerms() {
    if (!editingCatPermsId) return;
    try {
      setBusy(true);
      await api.updateCategory(groupId, editingCatPermsId, {
        permissions: { overrides: catPermOverrides }
      });
      setShowCatPermsModal(false);
      setEditingCatPermsId(null);
      setNotice('Category permissions saved!');
      setTimeout(() => setNotice(''), 2000);
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  }

  function openCatPerms(cat) {
    setEditingCatPermsId(cat.id);
    setShowCatPermsModal(true);
    loadCatPermOverrides(cat.id);
  }

  // ── Category rename ──
  async function handleRenameCategory(catId) {
    if (!editCategoryName.trim()) return;
    try {
      setBusy(true);
      await api.updateCategory(groupId, catId, { name: editCategoryName.trim() });
      setEditingCategoryId(null);
      setEditCategoryName('');
      await refreshChannels(groupId);
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  }

  // ── Clone channel ──
  async function handleCloneChannel(ch) {
    try {
      setBusy(true);
      await api.createChannel(groupId, {
        name: ch.name + '-clone',
        categoryId: ch.category_id || null,
        topic: ch.topic || '',
        type: ch.type || 'text',
      });
      await refreshChannels(groupId);
      setNotice('Channel cloned!');
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  }

  // ── Permission section definitions (shared by channel & category) ──
  const CHANNEL_PERM_SECTIONS = [
    { heading: 'General Channel Permissions', perms: [
      { key: 'viewChannels', label: 'View Channel', desc: 'Allows members to view this channel' },
      { key: 'manageChannels', label: 'Manage Channel', desc: 'Allows editing channel name, topic, and settings' },
      { key: 'manageRoles', label: 'Manage Permissions', desc: 'Allows managing channel-specific permissions' },
    ]},
    { heading: 'Text Channel Permissions', perms: [
      { key: 'sendMessages', label: 'Send Messages', desc: 'Allows members to send messages in this channel' },
      { key: 'createPublicThreads', label: 'Create Public Threads', desc: 'Allows creating public threads' },
      { key: 'createPrivateThreads', label: 'Create Private Threads', desc: 'Allows creating private threads' },
      { key: 'embedLinks', label: 'Embed Links', desc: 'Links sent will be auto-embedded' },
      { key: 'attachFiles', label: 'Attach Files', desc: 'Allows uploading images and files' },
      { key: 'addReactions', label: 'Add Reactions', desc: 'Allows adding reactions to messages' },
      { key: 'useExternalEmoji', label: 'Use External Emoji', desc: 'Allows the use of external emojis' },
      { key: 'mentionEveryone', label: 'Mention @everyone', desc: 'Allows using @everyone and @here' },
      { key: 'manageMessages', label: 'Manage Messages', desc: 'Allows deleting and pinning messages from other members' },
      { key: 'readMessageHistory', label: 'Read Message History', desc: 'Allows reading message history' },
      { key: 'sendTTS', label: 'Send TTS Messages', desc: 'Allows sending text-to-speech messages' },
    ]},
    { heading: 'Voice Channel Permissions', perms: [
      { key: 'connect', label: 'Connect', desc: 'Allows members to connect to voice channels' },
      { key: 'speak', label: 'Speak', desc: 'Allows members to speak in voice channels' },
      { key: 'video', label: 'Video', desc: 'Allows using video in voice channels' },
      { key: 'muteMembers', label: 'Mute Members', desc: 'Allows muting other members in voice' },
      { key: 'deafenMembers', label: 'Deafen Members', desc: 'Allows deafening other members in voice' },
      { key: 'moveMembers', label: 'Move Members', desc: 'Allows moving members between voice channels' },
    ]},
  ];

  // ── Context menu handler ──
  function handleContextMenu(e, type, id, data) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ type, id, x: e.clientX, y: e.clientY, data });
  }

  // Close context menu on click anywhere
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [contextMenu]);

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

  // Channel type icon helper
  function channelIcon(type) {
    if (type === 'voice') return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="channel-type-icon"><path d="M11.383 3.07904C11.009 2.92504 10.579 3.01004 10.293 3.29604L6 8.00004H3C2.447 8.00004 2 8.44704 2 9.00004V15C2 15.553 2.447 16 3 16H6L10.293 20.704C10.579 20.99 11.009 21.075 11.383 20.921C11.757 20.767 12 20.404 12 20V4.00004C12 3.59604 11.757 3.23304 11.383 3.07904Z"/><path d="M14 9.00004C14 9.00004 16 10 16 12C16 14 14 15 14 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/><path d="M17 7.00004C17 7.00004 20 9.00004 20 12C20 15 17 17 17 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/></svg>;
    if (type === 'announcement') return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="channel-type-icon"><path d="M3.9 8.26H2V15.2941H3.9V8.26Z"/><path d="M19.1 4V5.12659L4.85 8.26447V18.1176C4.85 18.5496 5.1605 18.9252 5.5851 19.0315L9.0981 19.8999C9.5765 20.0201 10.0595 19.7252 10.172 19.2397L10.7575 16.7088L19.1 18.5765V19.7059C19.1 20.4206 19.6794 21 20.3941 21H21.5765C22.2912 21 22.8706 20.4206 22.8706 19.7059V4.29412C22.8706 3.57943 22.2912 3 21.5765 3H20.3941C19.6794 3 19.1 3.57943 19.1 4.29412V4Z"/></svg>;
    if (type === 'forum') return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="channel-type-icon"><path d="M18 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V4C20 2.9 19.1 2 18 2ZM9 4H11V9L10 8.25L9 9V4ZM18 20H6V4H7V13L10 10.75L13 13V4H18V20Z"/></svg>;
    // default: text #
    return <span className="discord-channel-hash">#</span>;
  }

  // ── Top navbar (rendered outside Layout) ──
  const topBar = (
    <header className="discord-topbar">
      {/* Mobile hamburger */}
      {isMobile && (
        <button className="mobile-hamburger" onClick={() => { setMobileSidebar(s => !s); setMobileMembers(false); }} aria-label="Toggle sidebar">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
        </button>
      )}
      <Link to="/" className="discord-topbar-logo">
        <img src="/hyvelogo.png" alt="Hyve" className="discord-topbar-logo-img" />
        {!isMobile && <span>Hyve Social</span>}
      </Link>
      <div className="discord-topbar-center">
        {dmMode && dmView === 'discover' ? (
          <span className="discord-topbar-group-name">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 6, verticalAlign: -2 }}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
            Discover
          </span>
        ) : group ? (
          <span className="discord-topbar-group-name">{group.name || 'Group'}</span>
        ) : null}
      </div>
      <div className="discord-topbar-actions">
        {!isMobile && <Link to="/groups" className="discord-topbar-link">All Groups</Link>}
        {!isMobile && <Link to="/" className="discord-topbar-link">Feed</Link>}
        {/* Mobile: members toggle */}
        {isMobile && !dmMode && (
          <button className="mobile-members-toggle" onClick={() => { setMobileMembers(m => !m); setMobileSidebar(false); }} aria-label="Toggle members">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 13c-1.2 0-3.07.34-4.5 1-1.43-.67-3.3-1-4.5-1C5.33 13 1 14.08 1 16.25V19h22v-2.75c0-2.17-4.33-3.25-6.5-3.25zm-4 4.5h-10v-1.25c0-.54 2.56-1.75 5-1.75s5 1.21 5 1.75v1.25zm9 0H14v-1.25c0-.46-.2-.86-.52-1.22.88-.3 1.96-.53 3.02-.53 2.44 0 5 1.21 5 1.75v1.25zM7.5 12c1.93 0 3.5-1.57 3.5-3.5S9.43 5 7.5 5 4 6.57 4 8.5 5.57 12 7.5 12zm9 0c1.93 0 3.5-1.57 3.5-3.5S18.43 5 16.5 5 13 6.57 13 8.5s1.57 3.5 3.5 3.5z"/></svg>
          </button>
        )}
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
            onClick={() => { setDmMode(false); if (isMobile) setMobileSidebar(false); }}
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
      <button className="guild-icon guild-explore" title="Explore Servers" onClick={() => { setDmMode(true); setDmSelectedUser(null); setDmView('discover'); }}>
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
    <div
      className={`discord-fullpage${isMobile ? ' mobile-layout' : ''}${mobileSidebar ? ' mobile-sidebar-open' : ''}${mobileMembers ? ' mobile-members-open' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {topBar}

      {/* Mobile overlay backdrop */}
      {isMobile && (mobileSidebar || mobileMembers) && (
        <div className="mobile-overlay-backdrop" onClick={() => { setMobileSidebar(false); setMobileMembers(false); }} />
      )}

    <div className="discord-body">
      {guildBar}

    {dmMode ? (
      /* ════════ DM MODE LAYOUT ════════ */
      <div className={`discord-server discord-dm-layout${dmView === 'discover' ? ' dmd-fullwidth' : ''}`}>
        {/* DM sidebar (hidden in discover mode) */}
        {dmView !== 'discover' && (
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
            <button className={`discord-dm-nav-item${dmView === 'friends' && !dmSelectedUser ? ' active' : ''}`} onClick={() => { setDmSelectedUser(null); setDmView('friends'); }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 13c-1.2 0-3.07.34-4.5 1-1.43-.67-3.3-1-4.5-1C5.33 13 1 14.08 1 16.25V19h22v-2.75c0-2.17-4.33-3.25-6.5-3.25zm-4 4.5h-10v-1.25c0-.54 2.56-1.75 5-1.75s5 1.21 5 1.75v1.25zm9 0H14v-1.25c0-.46-.2-.86-.52-1.22.88-.3 1.96-.53 3.02-.53 2.44 0 5 1.21 5 1.75v1.25zM7.5 12c1.93 0 3.5-1.57 3.5-3.5S9.43 5 7.5 5 4 6.57 4 8.5 5.57 12 7.5 12zm9 0c1.93 0 3.5-1.57 3.5-3.5S18.43 5 16.5 5 13 6.57 13 8.5s1.57 3.5 3.5 3.5z"/></svg>
              <span>Friends</span>
            </button>
          </div>

          <div className="discord-dm-header">
            <span>DIRECT MESSAGES</span>
            <button className="discord-dm-add" title="Create DM" onClick={handleOpenSelectFriends}>+</button>
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
                    onClick={() => { setDmSelectedUser({
                      username: conv.username,
                      profileImage: conv.profile_image || '',
                    }); setDmView('conversations'); if (isMobile) setMobileSidebar(false); }}
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
        )}

        {/* DM main area */}
        <div className="discord-main discord-dm-main">
          {dmSelectedUser ? (
            <DmChat
              selectedUser={dmSelectedUser}
              onBack={() => setDmSelectedUser(null)}
            />
          ) : dmView === 'friends' ? (
            <DmFriends onSelectUser={(u) => { setDmSelectedUser(u); setDmView('conversations'); }} />
          ) : dmView === 'discover' ? (
            <DmDiscover onJoinServer={(gid) => { setDmMode(false); navigate(`/groups/${gid}`); }} />
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
        <div className="discord-server-header" ref={serverHeaderRef} onClick={() => {
          if (!showServerDropdown && serverHeaderRef.current) {
            const r = serverHeaderRef.current.getBoundingClientRect();
            setDropdownPos({ top: r.bottom + 4, left: r.left + 8, width: r.width - 16 });
          }
          setShowServerDropdown(p => !p);
        }}>
          <div className="discord-server-avatar">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : groupName.slice(0, 1).toUpperCase()}
          </div>
          <div className="discord-server-name">{groupName}</div>
          <span className={`discord-server-chevron${showServerDropdown ? ' open' : ''}`}>▾</span>
        </div>

        {/* Server dropdown menu — rendered via portal to escape overflow:hidden */}
        {showServerDropdown && createPortal(
          <div className="discord-server-dropdown" style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}>
            {/* Server Boost */}
            <button className="discord-dropdown-boost" onClick={() => { setShowServerDropdown(false); }}>
              <svg className="dropdown-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2Z" fill="#ff73fa"/></svg>
              <span>Server Boost</span>
              <svg className="dropdown-arrow" width="10" height="10" viewBox="0 0 16 16"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
            </button>

            {/* Invite People */}
            {isMember && (
              <button onClick={() => { setShowServerDropdown(false); openInviteModal(); }}>
                <svg className="dropdown-icon" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M21 11h-4V7a1 1 0 00-2 0v4h-4a1 1 0 000 2h4v4a1 1 0 002 0v-4h4a1 1 0 000-2zM9 12a5 5 0 100-10 5 5 0 000 10zM1.5 21a7.5 7.5 0 0115 0H1.5z"/></svg>
                <span>Invite People</span>
                <svg className="dropdown-arrow" width="10" height="10" viewBox="0 0 16 16"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
              </button>
            )}

            {/* App Directory */}
            <button onClick={() => { setShowServerDropdown(false); }}>
              <svg className="dropdown-icon" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M4 4h7v7H4V4zm9 0h7v7h-7V4zm-9 9h7v7H4v-7zm9 0h7v7h-7v-7z"/></svg>
              <span>App Directory</span>
              <svg className="dropdown-arrow" width="10" height="10" viewBox="0 0 16 16"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
            </button>

            <div className="discord-dropdown-sep" />

            {/* Show All Channels toggle */}
            <button onClick={() => setShowAllChannels(p => !p)}>
              <svg className="dropdown-icon" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M5 13h14a1 1 0 000-2H5a1 1 0 000 2zm0-6h14a1 1 0 000-2H5a1 1 0 000 2zm0 12h14a1 1 0 000-2H5a1 1 0 000 2z"/></svg>
              <span>Show All Channels</span>
              <span className={`dropdown-toggle ${showAllChannels ? 'active' : ''}`}>
                <span className="dropdown-toggle-knob" />
              </span>
            </button>

            {/* Notification Settings */}
            <button onClick={() => { setShowServerDropdown(false); setShowNotifModal(true); }}>
              <svg className="dropdown-icon" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 002 2zm6-6V10c0-3.07-1.63-5.64-4.5-6.32V3a1.5 1.5 0 00-3 0v.68C7.64 4.36 6 6.92 6 10v6l-2 2v1h16v-1l-2-2z"/></svg>
              <span>Notification Settings</span>
              <svg className="dropdown-arrow" width="10" height="10" viewBox="0 0 16 16"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
            </button>

            {/* Privacy Settings */}
            <button onClick={() => { setShowServerDropdown(false); }}>
              <svg className="dropdown-icon" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
              <span>Privacy Settings</span>
              <svg className="dropdown-arrow" width="10" height="10" viewBox="0 0 16 16"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
            </button>

            <div className="discord-dropdown-sep" />

            {/* Edit Per-server Profile */}
            <button onClick={() => { setShowServerDropdown(false); setShowNicknameModal(true); }}>
              <svg className="dropdown-icon" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
              <span>Edit Server Profile</span>
              <svg className="dropdown-arrow" width="10" height="10" viewBox="0 0 16 16"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
            </button>

            {/* Mark All as Read */}
            <button onClick={() => { setShowServerDropdown(false); handleMarkAllRead(); }}>
              <svg className="dropdown-icon" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
              <span>Mark All as Read</span>
            </button>

            {/* Hide Muted Channels toggle */}
            <button onClick={() => setHideMutedChannels(p => !p)}>
              <svg className="dropdown-icon" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M18 9.5a3.5 3.5 0 11-7 0 3.5 3.5 0 017 0zM12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
              <span>Hide Muted Channels</span>
              <span className={`dropdown-toggle ${hideMutedChannels ? 'active' : ''}`}>
                <span className="dropdown-toggle-knob" />
              </span>
            </button>

            {adminEnabled && (
              <>
                <div className="discord-dropdown-sep" />
                <button onClick={() => { setShowServerDropdown(false); setShowServerSettings(true); }}>
                  <svg className="dropdown-icon" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M19.14 12.94a7.07 7.07 0 000-1.88l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96a7.04 7.04 0 00-1.63-.94l-.36-2.54a.48.48 0 00-.48-.41h-3.84a.48.48 0 00-.48.41l-.36 2.54c-.59.24-1.13.57-1.63.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87a.48.48 0 00.12.61l2.03 1.58a7.07 7.07 0 000 1.88l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.37 1.04.7 1.63.94l.36 2.54c.05.24.26.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.57 1.63-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 00-.12-.61l-2.03-1.58zM12 15.6A3.6 3.6 0 1115.6 12 3.6 3.6 0 0112 15.6z"/></svg>
                  <span>Server Settings</span>
                  <svg className="dropdown-arrow" width="10" height="10" viewBox="0 0 16 16"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
                </button>
                <button onClick={() => { setShowServerDropdown(false); setShowCreateChannel(true); }}>
                  <svg className="dropdown-icon" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 9h-2v2a1 1 0 01-2 0v-2H7a1 1 0 010-2h2V7a1 1 0 012 0v2h2a1 1 0 010 2z"/></svg>
                  <span>Create Channel</span>
                </button>
                <button onClick={() => { setShowServerDropdown(false); setShowCreateCategory(true); }}>
                  <svg className="dropdown-icon" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M20 6h-8l-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2zm-6 10H6v-2h8v2zm4-4H6v-2h12v2z"/></svg>
                  <span>Create Category</span>
                </button>
                <button onClick={() => { setShowServerDropdown(false); setActivePanel('roles'); }}>
                  <svg className="dropdown-icon" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2a7.2 7.2 0 01-6-3.22c.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08a7.2 7.2 0 01-6 3.22z"/></svg>
                  <span>Manage Roles</span>
                </button>
              </>
            )}

            {isMember && !isOwner && (
              <>
                <div className="discord-dropdown-sep" />
                <button className="discord-dropdown-danger" onClick={() => { setShowServerDropdown(false); handleLeave(); }}>
                  <svg className="dropdown-icon" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5a2 2 0 00-2 2v4h2V5h14v14H5v-4H3v4a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2z"/></svg>
                  <span>Leave Server</span>
                </button>
              </>
            )}
          </div>,
          document.body
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
                  editingCategoryId === cat.id ? (
                    <div className="discord-category-header discord-category-editing">
                      <input
                        type="text"
                        value={editCategoryName}
                        onChange={(e) => setEditCategoryName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRenameCategory(cat.id); if (e.key === 'Escape') setEditingCategoryId(null); }}
                        onBlur={() => { if (editCategoryName.trim()) handleRenameCategory(cat.id); else setEditingCategoryId(null); }}
                        className="discord-category-rename-input"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div
                      className="discord-category-header"
                      onClick={() => toggleCategory(cat.id)}
                      onContextMenu={(e) => adminEnabled && handleContextMenu(e, 'category', cat.id, cat)}
                    >
                      <span className={`discord-category-arrow${isCollapsed ? ' collapsed' : ''}`}>&#9660;</span>
                      <span className="discord-category-name">{cat.name.toUpperCase()}</span>
                      {adminEnabled && (
                        <button className="discord-category-add" onClick={(e) => { e.stopPropagation(); setNewChannelCategory(String(cat.id)); setShowCreateChannel(true); }} title="Create Channel">
                          <svg width="14" height="14" viewBox="0 0 18 18" fill="currentColor"><path d="M15 9.5H9.5V15H8.5V9.5H3V8.5H8.5V3H9.5V8.5H15V9.5Z"/></svg>
                        </button>
                      )}
                    </div>
                  )
                )}
                {!isCollapsed && cat.channels.map((ch) => {
                  const chUnread = unreads[ch.id];
                  const hasUnread = chUnread && chUnread.unread_count > 0;
                  const hasMention = chUnread && chUnread.mention_count > 0;
                  return (
                  <div
                    key={ch.id}
                    className={`discord-channel${selectedChannelId === ch.id && activePanel === 'chat' ? ' active' : ''}${ch.nsfw ? ' nsfw' : ''}${hasUnread ? ' has-unread' : ''}`}
                    onClick={() => { setSelectedChannelId(ch.id); setActivePanel('chat'); setUnreads(prev => ({ ...prev, [ch.id]: { unread_count: 0, mention_count: 0 } })); if (isMobile) setMobileSidebar(false); }}
                    onContextMenu={(e) => adminEnabled && handleContextMenu(e, 'channel', ch.id, ch)}
                  >
                    {hasUnread && <div className="discord-channel-unread-pill" />}
                    {channelIcon(ch.type)}
                    <span className="discord-channel-name">{ch.name}</span>
                    {hasMention && (
                      <span className="discord-channel-mention-badge">{chUnread.mention_count}</span>
                    )}
                    {adminEnabled && (
                      <div className="discord-channel-actions-inline">
                        <button className="discord-channel-edit" onClick={(e) => { e.stopPropagation(); openChannelSettings(ch); }} title="Edit channel">
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M14 7.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0zM7.5 2.5A5 5 0 002.5 7.5a5 5 0 005 5 5 5 0 005-5 5 5 0 00-5-5z"/><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96a7.04 7.04 0 00-1.62-.94L14.4 3.05a.47.47 0 00-.48-.41h-3.84a.47.47 0 00-.48.41l-.36 2.54a7 7 0 00-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.73 9.16a.49.49 0 00.12.61l2.03 1.58c-.05.3-.07.63-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.49-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1115.6 12a3.611 3.611 0 01-3.6 3.6z" transform="scale(0.58) translate(1,1)"/></svg>
                        </button>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            );
          })}

          {adminEnabled && (
            <div className="discord-channel-actions">
              {showCreateChannel ? (
                <div className="discord-create-form discord-create-channel-modal">
                  <h4>Create Channel</h4>
                  <label className="discord-create-label">CHANNEL TYPE</label>
                  <div className="discord-channel-type-picker">
                    <label className={`discord-channel-type-option${newChannelType === 'text' ? ' selected' : ''}`} onClick={() => setNewChannelType('text')}>
                      <span className="discord-channel-type-icon">#</span>
                      <div>
                        <div className="discord-channel-type-title">Text</div>
                        <div className="discord-channel-type-desc">Send messages, images, GIFs, emoji, opinions, and puns</div>
                      </div>
                      <span className={`discord-channel-type-radio${newChannelType === 'text' ? ' checked' : ''}`} />
                    </label>
                    <label className={`discord-channel-type-option${newChannelType === 'voice' ? ' selected' : ''}`} onClick={() => setNewChannelType('voice')}>
                      <span className="discord-channel-type-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11.383 3.07904C11.009 2.92504 10.579 3.01004 10.293 3.29604L6 8.00004H3C2.447 8.00004 2 8.44704 2 9.00004V15C2 15.553 2.447 16 3 16H6L10.293 20.704C10.579 20.99 11.009 21.075 11.383 20.921C11.757 20.767 12 20.404 12 20V4.00004C12 3.59604 11.757 3.23304 11.383 3.07904Z"/></svg>
                      </span>
                      <div>
                        <div className="discord-channel-type-title">Voice</div>
                        <div className="discord-channel-type-desc">Hang out together with voice, video, and screen share</div>
                      </div>
                      <span className={`discord-channel-type-radio${newChannelType === 'voice' ? ' checked' : ''}`} />
                    </label>
                    <label className={`discord-channel-type-option${newChannelType === 'announcement' ? ' selected' : ''}`} onClick={() => setNewChannelType('announcement')}>
                      <span className="discord-channel-type-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3.9 8.26H2V15.2941H3.9V8.26Z"/><path d="M19.1 4V5.12659L4.85 8.26447V18.1176C4.85 18.5496 5.1605 18.9252 5.5851 19.0315L9.0981 19.8999C9.5765 20.0201 10.0595 19.7252 10.172 19.2397L10.7575 16.7088L19.1 18.5765V19.7059C19.1 20.4206 19.6794 21 20.3941 21H21.5765C22.2912 21 22.8706 20.4206 22.8706 19.7059V4.29412C22.8706 3.57943 22.2912 3 21.5765 3H20.3941C19.6794 3 19.1 3.57943 19.1 4.29412V4Z"/></svg>
                      </span>
                      <div>
                        <div className="discord-channel-type-title">Announcement</div>
                        <div className="discord-channel-type-desc">Important updates for people in and out of the server</div>
                      </div>
                      <span className={`discord-channel-type-radio${newChannelType === 'announcement' ? ' checked' : ''}`} />
                    </label>
                    <label className={`discord-channel-type-option${newChannelType === 'forum' ? ' selected' : ''}`} onClick={() => setNewChannelType('forum')}>
                      <span className="discord-channel-type-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V4C20 2.9 19.1 2 18 2ZM9 4H11V9L10 8.25L9 9V4ZM18 20H6V4H7V13L10 10.75L13 13V4H18V20Z"/></svg>
                      </span>
                      <div>
                        <div className="discord-channel-type-title">Forum</div>
                        <div className="discord-channel-type-desc">Create organized discussions with posts and replies</div>
                      </div>
                      <span className={`discord-channel-type-radio${newChannelType === 'forum' ? ' checked' : ''}`} />
                    </label>
                  </div>
                  <label className="discord-create-label">CHANNEL NAME</label>
                  <div className="discord-create-channel-name-row">
                    {channelIcon(newChannelType)}
                    <input type="text" placeholder="new-channel" value={newChannelName} onChange={(e) => setNewChannelName(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))} onKeyDown={(e) => e.key === 'Enter' && handleCreateChannel()} autoFocus />
                  </div>
                  {categories.length > 0 && (
                    <>
                      <label className="discord-create-label">CATEGORY</label>
                      <select value={newChannelCategory} onChange={(e) => setNewChannelCategory(e.target.value)}>
                        <option value="">No category</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </>
                  )}
                  <div className="discord-create-btns">
                    <button onClick={handleCreateChannel} disabled={busy || !newChannelName.trim()}>Create Channel</button>
                    <button onClick={() => { setShowCreateChannel(false); setNewChannelType('text'); }}>Cancel</button>
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

        {/* Events sidebar widget */}
        {sidebarEvents.length > 0 && (
          <div className="discord-events-widget" style={{ padding: '8px 10px' }}>
            <div style={{ color: '#949ba4', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', padding: '4px 6px', letterSpacing: 0.5 }}>Upcoming Events</div>
            {sidebarEvents.slice(0, 3).map(ev => (
              <div key={ev.id} style={{ padding: '6px 8px', borderRadius: 4, marginTop: 4, background: '#2b2d31', cursor: 'default' }}>
                <div style={{ color: '#5865f2', fontSize: 11, fontWeight: 600 }}>{new Date(ev.start_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {new Date(ev.start_time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</div>
                <div style={{ color: '#dbdee1', fontSize: 13, fontWeight: 500 }}>{ev.name}</div>
                {ev.location && <div style={{ color: '#949ba4', fontSize: 11 }}>📍 {ev.location}</div>}
              </div>
            ))}
          </div>
        )}

        <div className="discord-nav-divider" />
        <div className="discord-nav-items">
          <button className={`discord-nav-item${activePanel === 'discussion' ? ' active' : ''}`} onClick={() => { setActivePanel('discussion'); if (isMobile) setMobileSidebar(false); }}>
            <span className="discord-nav-icon">&#128221;</span> Discussion
          </button>
          <button className={`discord-nav-item${activePanel === 'about' ? ' active' : ''}`} onClick={() => { setActivePanel('about'); if (isMobile) setMobileSidebar(false); }}>
            <span className="discord-nav-icon">&#8505;&#65039;</span> About
          </button>
          {adminEnabled && (
            <>
              <button className={`discord-nav-item${activePanel === 'admin' ? ' active' : ''}`} onClick={() => { setActivePanel('admin'); if (isMobile) setMobileSidebar(false); }}>
                <span className="discord-nav-icon">&#9881;&#65039;</span> Admin
              </button>
              <button className={`discord-nav-item${activePanel === 'roles' ? ' active' : ''}`} onClick={() => { setActivePanel('roles'); if (isMobile) setMobileSidebar(false); }}>
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

        {activePanel === 'chat' && selectedChannel?.type === 'forum' && (
          <div className="discord-forum-view">
            <div className="discord-panel-header" style={{ borderBottom: '1px solid #3f4147', padding: '12px 16px' }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>📋 {selectedChannel.name}</h2>
              <button className="discord-btn-primary" style={{ marginLeft: 'auto', padding: '6px 14px', fontSize: 13 }} onClick={() => setShowForumCreate(true)}>New Post</button>
            </div>

            {showForumCreate && (
              <div style={{ padding: 16, borderBottom: '1px solid #3f4147', background: '#2b2d31' }}>
                <input className="discord-input" placeholder="Post title *" value={forumPostTitle} onChange={e => setForumPostTitle(e.target.value)} style={{ marginBottom: 8, width: '100%' }} />
                <textarea className="discord-input" placeholder="Post content (optional)" value={forumPostContent} onChange={e => setForumPostContent(e.target.value)} rows={3} style={{ width: '100%', resize: 'vertical', marginBottom: 8 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="discord-btn-primary" onClick={() => handleCreateForumPost(selectedChannelId)} disabled={!forumPostTitle.trim()}>Create Post</button>
                  <button className="discord-btn-cancel" onClick={() => { setShowForumCreate(false); setForumPostTitle(''); setForumPostContent(''); }}>Cancel</button>
                </div>
              </div>
            )}

            {selectedForumPost ? (
              <div className="discord-forum-thread" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #3f4147', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => { setSelectedForumPost(null); setForumPostMessages([]); }} style={{ background: 'none', border: 'none', color: '#b5bac1', cursor: 'pointer', fontSize: 16 }}>←</button>
                  <h3 style={{ margin: 0, fontSize: 15, color: '#fff' }}>{selectedForumPost.title}</h3>
                  <span style={{ color: '#949ba4', fontSize: 12, marginLeft: 'auto' }}>by {selectedForumPost.created_by_name || 'Unknown'}</span>
                </div>
                {selectedForumPost.content && (
                  <div style={{ padding: '12px 16px', color: '#dbdee1', borderBottom: '1px solid #3f4147' }}>{selectedForumPost.content}</div>
                )}
                <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {forumPostMessages.map(msg => (
                    <div key={msg.id} style={{ display: 'flex', gap: 10 }}>
                      <img src={msg.profile_image || '/default-avatar.png'} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} onError={e => { e.target.src = '/default-avatar.png'; }} />
                      <div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                          <span style={{ color: '#fff', fontWeight: 500, fontSize: 14 }}>{msg.username || 'Unknown'}</span>
                          <span style={{ color: '#949ba4', fontSize: 11 }}>{new Date(msg.created_at).toLocaleString()}</span>
                        </div>
                        <div style={{ color: '#dbdee1', fontSize: 14 }}>{msg.content}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '12px 16px', borderTop: '1px solid #3f4147', display: 'flex', gap: 8 }}>
                  <input className="discord-input" placeholder="Reply to this post..." value={forumMsgInput} onChange={e => setForumMsgInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendForumMessage(selectedForumPost.id)} style={{ flex: 1 }} />
                  <button className="discord-btn-primary" onClick={() => handleSendForumMessage(selectedForumPost.id)} disabled={!forumMsgInput.trim()}>Send</button>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                {forumLoading ? <p className="discord-muted">Loading posts...</p> : forumPosts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#949ba4' }}>
                    <p style={{ fontSize: 40 }}>📋</p>
                    <p>No posts yet. Create the first one!</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {forumPosts.map(post => (
                      <div key={post.id} className="discord-forum-post-card" onClick={() => { setSelectedForumPost(post); loadForumPostMessages(post.id); }}
                        style={{ background: '#2b2d31', borderRadius: 8, padding: '12px 16px', cursor: 'pointer', transition: 'background 0.15s' }}
                        onMouseOver={e => e.currentTarget.style.background = '#32353b'} onMouseOut={e => e.currentTarget.style.background = '#2b2d31'}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <h4 style={{ margin: '0 0 4px', color: '#fff', fontSize: 15 }}>{post.title}</h4>
                            {post.content && <p style={{ margin: 0, color: '#949ba4', fontSize: 13, maxHeight: 40, overflow: 'hidden' }}>{post.content}</p>}
                          </div>
                          <span style={{ color: '#949ba4', fontSize: 11, whiteSpace: 'nowrap' }}>{post.reply_count || 0} replies</span>
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 12, color: '#949ba4' }}>
                          <span>{post.created_by_name || 'Unknown'}</span>
                          <span>{new Date(post.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activePanel === 'chat' && selectedChannel?.type !== 'forum' && (
          <ChannelChat
            channel={selectedChannel}
            groupId={groupId}
            user={user}
            isAdmin={adminEnabled}
            onToggleMembers={() => {
              if (isMobile) { setMobileMembers(p => !p); setMobileSidebar(false); }
              else setShowMemberSidebar(p => !p);
            }}
            showMembers={isMobile ? mobileMembers : showMemberSidebar}
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
      {(isMobile ? mobileMembers : showMemberSidebar) && (
        <div className={isMobile ? 'mobile-members-drawer open' : undefined}>
        <MemberSidebar
          key={memberSidebarKey}
          groupId={groupId}
          user={user}
          isAdmin={adminEnabled}
          isOwner={isOwner}
          onMemberClick={(m, e) => {
            const rect = e?.currentTarget?.getBoundingClientRect();
            const roles = typeof m.custom_roles === 'string' ? JSON.parse(m.custom_roles) : (m.custom_roles || []);
            setPopupRolePicker(false);
            setMemberPopup({
              username: m.username || 'Unknown',
              profileImage: m.profile_image || '/default-avatar.png',
              role: m.role || null,
              customRoles: roles,
              userAddress: m.user_address,
              joinedAt: m.joined_at,
              x: rect ? (isMobile ? 10 : rect.left - 310) : 400,
              y: rect ? Math.min(rect.top, window.innerHeight - 420) : 200,
            });
          }}
        />
        </div>
      )}
    </div>
    )}
    </div>

    {/* ── Mobile Bottom Tab Bar (Discord-style) ── */}
    {isMobile && (
      <nav className="mobile-bottom-tab-bar">
        <button
          className="mobile-tab-item"
          onClick={() => navigate('/')}
        >
          <div className="mobile-tab-icon-wrap">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
            {totalGroupUnreads > 0 && (
              <span className="mobile-tab-badge">{totalGroupUnreads > 99 ? '99+' : totalGroupUnreads}</span>
            )}
          </div>
          <span>Home</span>
        </button>
        <button
          className="mobile-tab-item"
          onClick={() => navigate('/notifications')}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/></svg>
          <span>Notifications</span>
        </button>
        <button
          className="mobile-tab-item"
          onClick={() => navigate(`/profile/${user?.username || ''}`)}
        >
          <img
            src={user?.profile_image || user?.profileImage || '/default-avatar.png'}
            alt="You"
            className="mobile-tab-avatar"
            onError={(e) => { e.target.src = '/default-avatar.png'; }}
          />
          <span>You</span>
        </button>
        {/* Floating new-DM action button */}
        <button
          className="mobile-fab-new-dm"
          onClick={() => { setDmMode(true); handleOpenSelectFriends(); }}
          title="New Message"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/><line x1="12" y1="8" x2="12" y2="14" stroke="#fff" strokeWidth="2" strokeLinecap="round"/><line x1="9" y1="11" x2="15" y2="11" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
      </nav>
    )}

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
                    {(isOwner || adminEnabled) && (
                      <button
                        className="discord-role-remove-btn"
                        title="Remove role"
                        onClick={(e) => { e.stopPropagation(); handlePopupRemoveRole(r.id); }}
                      >×</button>
                    )}
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
              {(isOwner || adminEnabled) && (
                <div className="discord-role-add-wrap">
                  <button
                    className="discord-role-add-btn"
                    title="Add role"
                    onClick={() => { setPopupRolePicker(p => !p); setPopupRoleSearch(''); }}
                  >+</button>
                  {popupRolePicker && (
                    <div className="discord-role-picker-dropdown">
                      <div className="discord-role-picker-header">Add Role</div>
                      <div className="discord-role-picker-list">
                        {customRoles
                          .filter(r => !(memberPopup.customRoles || []).some(cr => cr.id === r.id))
                          .map(r => (
                            <div
                              key={r.id}
                              className="discord-role-picker-item"
                              onClick={() => handlePopupAssignRole(r.id)}
                            >
                              <span className="discord-role-dot" style={{ background: r.color || '#5865f2' }} />
                              {r.name}
                            </div>
                          ))}
                        {customRoles.filter(r => !(memberPopup.customRoles || []).some(cr => cr.id === r.id)).length === 0 && (
                          <div className="discord-role-picker-empty">No roles available</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
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

    {/* ── Select Friends Modal ── */}
    {showSelectFriends && (
      <div className="dm-select-friends-overlay" onClick={() => setShowSelectFriends(false)}>
        <div className="dm-select-friends-modal" onClick={(e) => e.stopPropagation()}>
          <button className="dm-select-friends-close" onClick={() => setShowSelectFriends(false)}>✕</button>
          <div className="dm-select-friends-header">
            <h2>Select Friends</h2>
            <p>You can add {Math.max(0, 10 - selectFriendsSelected.size)} more friends.</p>
          </div>
          <div className="dm-select-friends-search">
            <input
              type="text"
              placeholder="Type the username of a friend"
              value={selectFriendsSearch}
              onChange={(e) => setSelectFriendsSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="dm-select-friends-list">
            {selectFriendsLoading ? (
              <div className="dm-select-friends-empty">Loading friends...</div>
            ) : selectFriendsList.length === 0 ? (
              <div className="dm-select-friends-empty">No friends found. Add some friends first!</div>
            ) : (
              selectFriendsList
                .filter((f) => !selectFriendsSearch.trim() || f.username.toLowerCase().includes(selectFriendsSearch.toLowerCase()))
                .map((friend) => {
                  const isChecked = selectFriendsSelected.has(friend.username);
                  return (
                    <button
                      key={friend.username}
                      className={`dm-select-friends-item${isChecked ? ' selected' : ''}`}
                      onClick={() => toggleSelectFriend(friend.username)}
                    >
                      <div className="dm-select-friends-item-left">
                        <div className="dm-select-friends-avatar">
                          {friend.profile_image
                            ? <img src={friend.profile_image} alt="" onError={(e) => { e.target.src = '/default-avatar.png'; }} />
                            : <div className="dm-select-friends-letter">{(friend.username || '?')[0].toUpperCase()}</div>}
                        </div>
                        <div className="dm-select-friends-info">
                          <span className="dm-select-friends-name">{friend.username}</span>
                          <span className="dm-select-friends-handle">{friend.username.toLowerCase()}</span>
                        </div>
                      </div>
                      <div className={`dm-select-friends-check${isChecked ? ' checked' : ''}`}>
                        {isChecked && <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>}
                      </div>
                    </button>
                  );
                })
            )}
          </div>
          <div className="dm-select-friends-actions">
            <button className="dm-select-friends-cancel" onClick={() => setShowSelectFriends(false)}>Cancel</button>
            <button
              className="dm-select-friends-create"
              onClick={handleCreateDm}
              disabled={selectFriendsSelected.size === 0}
            >
              Create DM
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── User Settings Modal ── */}
    {showUserSettings && <UserSettings onClose={() => setShowUserSettings(false)} />}

    {/* ── Server Settings Modal ── */}
    {showServerSettings && (
      <ServerSettings
        group={group}
        groupId={groupId}
        members={members}
        bannedMembers={bannedMembers}
        requests={requests}
        customRoles={customRoles}
        channels={channels}
        categories={categories}
        postingPermission={postingPermission}
        setPostingPermission={setPostingPermission}
        requirePostApproval={requirePostApproval}
        setRequirePostApproval={setRequirePostApproval}
        adminsBypassApproval={adminsBypassApproval}
        setAdminsBypassApproval={setAdminsBypassApproval}
        onClose={() => setShowServerSettings(false)}
        onRefreshGroup={() => refreshGroup(groupId)}
        onRefreshMembers={() => refreshMembers(groupId)}
        onRefreshRoles={() => refreshRoles(groupId)}
        onSavePostingPermission={handleSavePostingPermission}
        onSaveModeration={handleSaveModeration}
        onApprove={handleApprove}
        onDecline={handleDecline}
        onUnban={handleUnban}
        onDeleteGroup={handleDeleteGroup}
        isOwner={isOwner}
        busy={busy}
        setBusy={setBusy}
      />
    )}

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
    {/* ── Notification Settings Modal ── */}
    {showNotifModal && createPortal(
      <div className="notif-modal-overlay" onClick={() => setShowNotifModal(false)}>
        <div className="notif-modal" onClick={e => e.stopPropagation()}>
          <button className="notif-modal-close" onClick={() => setShowNotifModal(false)}>✕</button>
          <h2 className="notif-modal-title">Notification Settings</h2>

          <div className="notif-modal-body">
            {/* Mute server */}
            <div className="notif-modal-row">
              <div className="notif-modal-row-text">
                <span className="notif-modal-row-label">Mute {groupName}</span>
                <span className="notif-modal-row-desc">Muting a server prevents unread indicators and notifications from appearing unless you are mentioned.</span>
              </div>
              <button className={`notif-toggle${notifMuteServer ? ' active' : ''}`} onClick={() => setNotifMuteServer(p => !p)}>
                <span className="notif-toggle-knob" />
              </button>
            </div>

            <div className="notif-modal-sep" />

            {/* Server Notification Settings */}
            <div className="notif-modal-section">
              <h3>Server Notification Settings</h3>
              <label className="notif-radio">
                <input type="radio" name="notif-setting" checked={notifSetting === 'all'} onChange={() => setNotifSetting('all')} />
                <span className="notif-radio-custom" />
                <span>All Messages</span>
              </label>
              <label className="notif-radio">
                <input type="radio" name="notif-setting" checked={notifSetting === 'mentions'} onChange={() => setNotifSetting('mentions')} />
                <span className="notif-radio-custom" />
                <span>Only @mentions</span>
              </label>
              <label className="notif-radio">
                <input type="radio" name="notif-setting" checked={notifSetting === 'nothing'} onChange={() => setNotifSetting('nothing')} />
                <span className="notif-radio-custom" />
                <span>Nothing</span>
              </label>
            </div>

            <div className="notif-modal-sep" />

            {/* Toggle rows */}
            <div className="notif-modal-row">
              <span className="notif-modal-row-label">Suppress @everyone and @here</span>
              <button className={`notif-toggle${notifSuppressEveryone ? ' active' : ''}`} onClick={() => setNotifSuppressEveryone(p => !p)}>
                <span className="notif-toggle-knob" />
              </button>
            </div>

            <div className="notif-modal-row">
              <span className="notif-modal-row-label">Suppress All Role @mentions</span>
              <button className={`notif-toggle${notifSuppressRoles ? ' active' : ''}`} onClick={() => setNotifSuppressRoles(p => !p)}>
                <span className="notif-toggle-knob" />
              </button>
            </div>

            <div className="notif-modal-row">
              <div className="notif-modal-row-text">
                <span className="notif-modal-row-label">Suppress Highlights</span>
                <span className="notif-modal-row-desc">Highlights provide occasional updates when your friends are chatting in busy servers, and more.</span>
                <a href="#" className="notif-modal-link" onClick={e => e.preventDefault()}>Learn more about Highlights</a>
              </div>
              <button className={`notif-toggle${notifSuppressHighlights ? ' active' : ''}`} onClick={() => setNotifSuppressHighlights(p => !p)}>
                <span className="notif-toggle-knob" />
              </button>
            </div>

            <div className="notif-modal-row">
              <span className="notif-modal-row-label">Mute New Events</span>
              <button className={`notif-toggle${notifMuteEvents ? ' active' : ''}`} onClick={() => setNotifMuteEvents(p => !p)}>
                <span className="notif-toggle-knob" />
              </button>
            </div>

            <div className="notif-modal-row">
              <span className="notif-modal-row-label">Mobile Push Notifications</span>
              <button className={`notif-toggle${notifMobilePush ? ' active' : ''}`} onClick={() => setNotifMobilePush(p => !p)}>
                <span className="notif-toggle-knob" />
              </button>
            </div>

            <div className="notif-modal-sep" />

            {/* Channel override section */}
            <div className="notif-modal-section">
              <h3>Select a channel or category…</h3>
              <p className="notif-modal-section-desc">Add a channel to override its default notification settings</p>
              <select
                className="notif-modal-select"
                value={notifChannelOverride}
                onChange={e => setNotifChannelOverride(e.target.value)}
              >
                <option value="">Select a channel or category…</option>
                {categories.map(cat => (
                  <option key={`cat-${cat.id}`} value={`cat-${cat.id}`}>📁 {cat.name}</option>
                ))}
                {channels.map(ch => (
                  <option key={`ch-${ch.id}`} value={`ch-${ch.id}`}># {ch.name}</option>
                ))}
              </select>

              {notifChannelOverrides.length > 0 && (
                <div className="notif-override-table">
                  <div className="notif-override-header">
                    <span>CHANNEL OR CATEGORY</span>
                    <span>ALL</span>
                    <span>MENTIONS</span>
                    <span>NOTHING</span>
                    <span>MUTE</span>
                  </div>
                  {notifChannelOverrides.map(o => (
                    <div key={o.id} className="notif-override-row">
                      <span>{o.name}</span>
                      <input type="radio" name={`ovr-${o.id}`} />
                      <input type="radio" name={`ovr-${o.id}`} defaultChecked />
                      <input type="radio" name={`ovr-${o.id}`} />
                      <input type="checkbox" />
                    </div>
                  ))}
                </div>
              )}

              <p className="notif-modal-section-hint">Add a channel to override its default notification settings</p>
            </div>
          </div>

          <div className="notif-modal-footer">
            <button className="notif-modal-done" onClick={() => setShowNotifModal(false)}>Done</button>
          </div>
        </div>
      </div>,
      document.body
    )}

    {/* ── Invite Friends Modal ── */}
    {showInviteModal && createPortal(
      <div className="invite-modal-overlay" onClick={() => setShowInviteModal(false)}>
        <div className="invite-modal" onClick={e => e.stopPropagation()}>
          <button className="invite-modal-close" onClick={() => setShowInviteModal(false)}>✕</button>
          <div className="invite-modal-header">
            <h2>Invite friends to {groupName}</h2>
            {selectedChannel && (
              <p className="invite-modal-channel">
                Recipients will land in <span className="invite-modal-channel-tag"># {selectedChannel.name}</span>
              </p>
            )}
          </div>
          <div className="invite-modal-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#b5bac1"><path d="M21.71 20.29l-5.4-5.4A7.92 7.92 0 0018 10a8 8 0 10-8 8 7.92 7.92 0 004.89-1.69l5.4 5.4a1 1 0 001.42-1.42zM4 10a6 6 0 1112 0 6 6 0 01-12 0z"/></svg>
            <input
              type="text"
              placeholder="Search for friends"
              value={inviteModalSearch}
              onChange={e => setInviteModalSearch(e.target.value)}
              autoFocus
            />
          </div>
          {group?.privacy === 'private' && (
            <div className="invite-modal-notice">
              <span className="invite-modal-notice-dot">●</span>
              This channel is private, only select members and roles can view this channel.
            </div>
          )}
          <div className="invite-modal-list">
            {inviteFriends
              .filter(f => {
                if (!inviteModalSearch.trim()) return true;
                const q = inviteModalSearch.toLowerCase();
                return (f.username || '').toLowerCase().includes(q) || (f.display_name || '').toLowerCase().includes(q);
              })
              .map(f => {
                const uname = f.username || '';
                const displayName = f.display_name || f.displayName || uname;
                const avatar = f.profile_image || f.profileImage || '/default-avatar.png';
                const sent = inviteModalSent.has(uname.toLowerCase());
                return (
                  <div key={uname} className="invite-modal-row">
                    <img src={avatar} alt="" className="invite-modal-avatar" onError={e => { e.target.src = '/default-avatar.png'; }} />
                    <div className="invite-modal-user-info">
                      <span className="invite-modal-displayname">{displayName}</span>
                      <span className="invite-modal-username">{uname}</span>
                    </div>
                    <button
                      className={`invite-modal-send${sent ? ' sent' : ''}`}
                      onClick={() => handleInviteModalSend(uname)}
                      disabled={sent}
                    >
                      {sent ? 'Sent!' : 'Send Link'}
                    </button>
                  </div>
                );
              })}
            {inviteFriends.length === 0 && (
              <div className="invite-modal-empty">No friends to invite</div>
            )}
          </div>
          <div className="invite-modal-footer">
            <p className="invite-modal-footer-label">Or, send a server invite link to a friend</p>
            <div className="invite-modal-link-row">
              <input type="text" readOnly value={`${window.location.origin}/groups/${groupId}`} />
              <button className={`invite-modal-copy${inviteLinkCopied ? ' copied' : ''}`} onClick={handleCopyInviteLink}>
                {inviteLinkCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="invite-modal-expire">Your invite link expires in 7 days.</p>
          </div>
        </div>
      </div>,
      document.body
    )}

    {/* ── Channel Settings Modal ── */}
    {channelSettingsOpen && createPortal(
      <div className="discord-modal-overlay" onClick={() => setChannelSettingsOpen(null)}>
        <div className="discord-channel-settings" onClick={(e) => e.stopPropagation()}>
          <div className="discord-cs-sidebar">
            <div className="discord-cs-sidebar-header">{csName || 'Channel'}</div>
            <button className={`discord-cs-sidebar-item${channelSettingsTab === 'overview' ? ' active' : ''}`} onClick={() => setChannelSettingsTab('overview')}>Overview</button>
            <button className={`discord-cs-sidebar-item${channelSettingsTab === 'permissions' ? ' active' : ''}`} onClick={() => setChannelSettingsTab('permissions')}>Permissions</button>
            <div className="discord-cs-sidebar-sep" />
            <button className="discord-cs-sidebar-item danger" onClick={() => { handleDeleteChannel(channelSettingsOpen.id); setChannelSettingsOpen(null); }}>Delete Channel</button>
          </div>
          <div className="discord-cs-main">
            <div className="discord-cs-header">
              <h2>{channelSettingsTab === 'overview' ? 'Overview' : 'Permissions'}</h2>
              <button className="discord-cs-close" onClick={() => setChannelSettingsOpen(null)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z"/></svg>
              </button>
            </div>

            {channelSettingsTab === 'overview' && (
              <div className="discord-cs-body">
                <div className="discord-cs-field">
                  <label>CHANNEL NAME</label>
                  <div className="discord-cs-name-input">
                    {channelIcon(channelSettingsOpen.type)}
                    <input type="text" value={csName} onChange={(e) => setCsName(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))} />
                  </div>
                </div>
                <div className="discord-cs-field">
                  <label>CHANNEL TOPIC</label>
                  <textarea value={csTopic} onChange={(e) => setCsTopic(e.target.value)} placeholder="Let everyone know how to use this channel!" maxLength={1024} rows={3} />
                  <span className="discord-cs-charcount">{csTopic.length}/1024</span>
                </div>
                {categories.length > 0 && (
                  <div className="discord-cs-field">
                    <label>CATEGORY</label>
                    <select value={csCategory} onChange={(e) => setCsCategory(e.target.value)}>
                      <option value="">No category</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="discord-cs-field">
                  <div className="discord-cs-toggle-row">
                    <div>
                      <label>NSFW Channel</label>
                      <p className="discord-cs-field-desc">Users will need to confirm their age to view this channel</p>
                    </div>
                    <button className={`discord-cs-toggle${csNsfw ? ' active' : ''}`} onClick={() => setCsNsfw(p => !p)}>
                      <span className="discord-cs-toggle-knob" />
                    </button>
                  </div>
                </div>
                <div className="discord-cs-field">
                  <label>SLOWMODE</label>
                  <p className="discord-cs-field-desc">Limit how frequently members can send messages in this channel</p>
                  <select value={csSlowmode} onChange={(e) => setCsSlowmode(Number(e.target.value))}>
                    <option value={0}>Off</option>
                    <option value={5}>5s</option>
                    <option value={10}>10s</option>
                    <option value={15}>15s</option>
                    <option value={30}>30s</option>
                    <option value={60}>1m</option>
                    <option value={120}>2m</option>
                    <option value={300}>5m</option>
                    <option value={600}>10m</option>
                    <option value={900}>15m</option>
                    <option value={1800}>30m</option>
                    <option value={3600}>1h</option>
                    <option value={7200}>2h</option>
                    <option value={21600}>6h</option>
                  </select>
                </div>
              </div>
            )}

            {channelSettingsTab === 'permissions' && (
              <div className="discord-cs-body discord-cs-perms-body">
                <div className="discord-cs-perms-info">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                  <p>Channel permission overrides customize which roles can see and interact with this channel, overriding server-level permissions.</p>
                </div>

                {/* Role / member selector bar */}
                <div className="perm-roles-bar">
                  <div className="perm-roles-list">
                    {permOverrides.map(ov => {
                      const role = ov.id === 'everyone' ? { name: '@everyone', color: '#99aab5' } : customRoles.find(r => String(r.id) === String(ov.id));
                      return (
                        <button
                          key={ov.id}
                          className={`perm-role-chip${String(permSelectedId) === String(ov.id) ? ' active' : ''}`}
                          onClick={() => setPermSelectedId(String(ov.id))}
                          style={role?.color ? { '--role-color': role.color } : {}}
                        >
                          <span className="perm-role-dot" style={{ background: role?.color || '#99aab5' }} />
                          {ov.id === 'everyone' ? '@everyone' : (role?.name || ov.name || 'Unknown')}
                          {ov.id !== 'everyone' && (
                            <span className="perm-role-remove" onClick={(e) => { e.stopPropagation(); removeRoleOverride(ov.id); }}>×</span>
                          )}
                        </button>
                      );
                    })}
                    <div className="perm-add-role-wrap">
                      <button className="perm-add-role-btn" onClick={() => setPermAddingRole(p => !p)}>+</button>
                      {permAddingRole && (
                        <div className="perm-add-role-dropdown">
                          <input
                            type="text"
                            placeholder="Search roles..."
                            value={permSearch}
                            onChange={(e) => setPermSearch(e.target.value)}
                            autoFocus
                          />
                          <div className="perm-add-role-list">
                            {customRoles
                              .filter(r => !permOverrides.find(o => String(o.id) === String(r.id)))
                              .filter(r => !permSearch || r.name.toLowerCase().includes(permSearch.toLowerCase()))
                              .map(r => (
                                <button key={r.id} onClick={() => addRoleOverride(r.id, r.name)}>
                                  <span className="perm-role-dot" style={{ background: r.color || '#99aab5' }} />
                                  {r.name}
                                </button>
                              ))}
                            {customRoles.filter(r => !permOverrides.find(o => String(o.id) === String(r.id))).length === 0 && (
                              <div className="perm-add-role-empty">No more roles to add</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Permission toggle list */}
                <div className="perm-toggle-list">
                  {(() => {
                    const selectedOv = permOverrides.find(o => String(o.id) === String(permSelectedId));
                    const role = permSelectedId === 'everyone' ? { name: '@everyone' } : customRoles.find(r => String(r.id) === String(permSelectedId));
                    if (!selectedOv) return <div className="perm-no-selection">Select a role to configure permissions</div>;
                    return (
                      <>
                        <div className="perm-selected-header">
                          <span>Permissions for <strong>{permSelectedId === 'everyone' ? '@everyone' : (role?.name || 'Unknown')}</strong></span>
                        </div>
                        {CHANNEL_PERM_SECTIONS.map(section => (
                          <div className="perm-section" key={section.heading}>
                            <h4 className="perm-section-heading">{section.heading}</h4>
                            {section.perms.map(p => {
                              const state = getPermState(permOverrides, permSelectedId, p.key);
                              return (
                                <div className="perm-row" key={p.key}>
                                  <div className="perm-row-info">
                                    <span className="perm-row-label">{p.label}</span>
                                    <span className="perm-row-desc">{p.desc}</span>
                                  </div>
                                  <div className="perm-tri-toggle">
                                    <button
                                      className={`perm-tri-btn deny${state === 'deny' ? ' active' : ''}`}
                                      onClick={() => cyclePermState(setPermOverrides, permOverrides, permSelectedId, p.key)}
                                      title="Deny"
                                    >✕</button>
                                    <button
                                      className={`perm-tri-btn inherit${state === 'inherit' ? ' active' : ''}`}
                                      onClick={() => cyclePermState(setPermOverrides, permOverrides, permSelectedId, p.key)}
                                      title="Inherit"
                                    >/</button>
                                    <button
                                      className={`perm-tri-btn allow${state === 'allow' ? ' active' : ''}`}
                                      onClick={() => cyclePermState(setPermOverrides, permOverrides, permSelectedId, p.key)}
                                      title="Allow"
                                    >✓</button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                        <div className="perm-save-bar">
                          <button className="discord-cs-save" onClick={handleSaveChannelPerms} disabled={busy}>Save Permissions</button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            <div className="discord-cs-footer">
              <button className="discord-cs-cancel" onClick={() => setChannelSettingsOpen(null)}>Cancel</button>
              <button className="discord-cs-save" onClick={handleSaveChannelSettings} disabled={busy || !csName.trim()}>Save Changes</button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    )}

    {/* ── Right-click Context Menu ── */}
    {contextMenu && createPortal(
      <div className="discord-context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
        {contextMenu.type === 'channel' && (
          <>
            <button onClick={() => { openChannelSettings(contextMenu.data); setContextMenu(null); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
              Edit Channel
            </button>
            <button onClick={() => { handleCloneChannel(contextMenu.data); setContextMenu(null); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
              Clone Channel
            </button>
            <div className="discord-context-sep" />
            <button className="discord-context-danger" onClick={() => { handleDeleteChannel(contextMenu.id); setContextMenu(null); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              Delete Channel
            </button>
            <div className="discord-context-sep" />
            <button onClick={() => { navigator.clipboard.writeText(String(contextMenu.id)); setContextMenu(null); setNotice('Channel ID copied!'); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
              Copy Channel ID
            </button>
          </>
        )}
        {contextMenu.type === 'category' && (
          <>
            <button onClick={() => { setEditingCategoryId(contextMenu.id); setEditCategoryName(contextMenu.data.name); setContextMenu(null); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
              Edit Category
            </button>
            <button onClick={() => { openCatPerms(contextMenu.data); setContextMenu(null); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
              Edit Permissions
            </button>
            <button onClick={() => { setNewChannelCategory(String(contextMenu.id)); setShowCreateChannel(true); setContextMenu(null); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
              Create Channel
            </button>
            <div className="discord-context-sep" />
            <button className="discord-context-danger" onClick={() => { handleDeleteCategory(contextMenu.id); setContextMenu(null); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              Delete Category
            </button>
            <div className="discord-context-sep" />
            <button onClick={() => { navigator.clipboard.writeText(String(contextMenu.id)); setContextMenu(null); setNotice('Category ID copied!'); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
              Copy Category ID
            </button>
          </>
        )}
      </div>,
      document.body
    )}

    {/* ── Category Permissions Modal ── */}
    {showCatPermsModal && editingCatPermsId && createPortal(
      <div className="discord-modal-overlay" onClick={() => setShowCatPermsModal(false)}>
        <div className="discord-channel-settings discord-cat-perms-modal" onClick={(e) => e.stopPropagation()}>
          <div className="discord-cs-sidebar">
            <div className="discord-cs-sidebar-header">
              {categories.find(c => c.id === editingCatPermsId)?.name || 'Category'} — Permissions
            </div>
            <div className="perm-roles-list perm-roles-list-vertical">
              {catPermOverrides.map(ov => {
                const role = ov.id === 'everyone' ? { name: '@everyone', color: '#99aab5' } : customRoles.find(r => String(r.id) === String(ov.id));
                return (
                  <button
                    key={ov.id}
                    className={`perm-role-chip${String(catPermSelectedId) === String(ov.id) ? ' active' : ''}`}
                    onClick={() => setCatPermSelectedId(String(ov.id))}
                  >
                    <span className="perm-role-dot" style={{ background: role?.color || '#99aab5' }} />
                    {ov.id === 'everyone' ? '@everyone' : (role?.name || ov.name || 'Unknown')}
                    {ov.id !== 'everyone' && (
                      <span className="perm-role-remove" onClick={(e) => { e.stopPropagation(); removeCatRoleOverride(ov.id); }}>×</span>
                    )}
                  </button>
                );
              })}
              <button className="perm-add-role-btn-v" onClick={() => {
                const remaining = customRoles.filter(r => !catPermOverrides.find(o => String(o.id) === String(r.id)));
                if (remaining.length > 0) addCatRoleOverride(remaining[0].id, remaining[0].name);
              }}>+ Add Role</button>
            </div>
          </div>
          <div className="discord-cs-main">
            <div className="discord-cs-header">
              <h2>Category Permissions</h2>
              <button className="discord-cs-close" onClick={() => setShowCatPermsModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              </button>
            </div>
            <div className="discord-cs-body">
              <div className="discord-cs-perms-info">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                <p>Category permissions are inherited by all channels within this category, unless the channel has its own overrides.</p>
              </div>
              <div className="perm-toggle-list">
                {(() => {
                  const selectedOv = catPermOverrides.find(o => String(o.id) === String(catPermSelectedId));
                  const role = catPermSelectedId === 'everyone' ? { name: '@everyone' } : customRoles.find(r => String(r.id) === String(catPermSelectedId));
                  if (!selectedOv) return <div className="perm-no-selection">Select a role to configure</div>;
                  return (
                    <>
                      <div className="perm-selected-header">
                        <span>Permissions for <strong>{catPermSelectedId === 'everyone' ? '@everyone' : (role?.name || 'Unknown')}</strong></span>
                      </div>
                      {CHANNEL_PERM_SECTIONS.map(section => (
                        <div className="perm-section" key={section.heading}>
                          <h4 className="perm-section-heading">{section.heading}</h4>
                          {section.perms.map(p => {
                            const state = getPermState(catPermOverrides, catPermSelectedId, p.key);
                            return (
                              <div className="perm-row" key={p.key}>
                                <div className="perm-row-info">
                                  <span className="perm-row-label">{p.label}</span>
                                  <span className="perm-row-desc">{p.desc}</span>
                                </div>
                                <div className="perm-tri-toggle">
                                  <button
                                    className={`perm-tri-btn deny${state === 'deny' ? ' active' : ''}`}
                                    onClick={() => cyclePermState(setCatPermOverrides, catPermOverrides, catPermSelectedId, p.key)}
                                    title="Deny"
                                  >✕</button>
                                  <button
                                    className={`perm-tri-btn inherit${state === 'inherit' ? ' active' : ''}`}
                                    onClick={() => cyclePermState(setCatPermOverrides, catPermOverrides, catPermSelectedId, p.key)}
                                    title="Inherit"
                                  >/</button>
                                  <button
                                    className={`perm-tri-btn allow${state === 'allow' ? ' active' : ''}`}
                                    onClick={() => cyclePermState(setCatPermOverrides, catPermOverrides, catPermSelectedId, p.key)}
                                    title="Allow"
                                  >✓</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </>
                  );
                })()}
              </div>
            </div>
            <div className="discord-cs-footer">
              <button className="discord-cs-cancel" onClick={() => setShowCatPermsModal(false)}>Cancel</button>
              <button className="discord-cs-save" onClick={handleSaveCatPerms} disabled={busy}>Save Permissions</button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    )}

    {/* Nickname modal */}
    {showNicknameModal && createPortal(
      <div className="notif-modal-overlay" onClick={() => setShowNicknameModal(false)}>
        <div className="notif-modal nickname-modal" onClick={(e) => e.stopPropagation()}>
          <div className="notif-modal-header">
            <h2>Edit Server Profile</h2>
            <button className="notif-modal-close" onClick={() => setShowNicknameModal(false)}>✕</button>
          </div>
          <div className="notif-modal-body" style={{ padding: '16px 20px' }}>
            <label style={{ display: 'block', marginBottom: 8, color: '#b5bac1', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Server Nickname</label>
            <input
              type="text"
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              placeholder={user?.username || 'Nickname'}
              maxLength={32}
              style={{ width: '100%', padding: '10px 12px', background: '#1e1f22', color: '#dbdee1', border: 'none', borderRadius: 4, fontSize: 14 }}
              autoFocus
            />
            <p style={{ color: '#949ba4', fontSize: 12, marginTop: 8 }}>This nickname is only visible within this server.</p>
          </div>
          <div className="notif-modal-footer" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="notif-modal-done" style={{ background: 'transparent', color: '#dbdee1' }} onClick={() => setShowNicknameModal(false)}>Cancel</button>
            <button className="notif-modal-done" onClick={handleSaveNickname}>Save</button>
          </div>
        </div>
      </div>,
      document.body
    )}

    </div>
  );
}