import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import CreatePost from '../Feed/CreatePost';
import Post from '../Post/Post';
import './GroupDetail.css';

export default function GroupDetail() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const coverInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewAsMember, setViewAsMember] = useState(false);
  const [activeTab, setActiveTab] = useState('discussion');
  const [members, setMembers] = useState([]);
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

  const myAddress = (user?.walletAddress || '').toLowerCase();

  const isOwner = useMemo(() => {
    const owner = (group?.owner_address || group?.ownerAddress || '').toLowerCase();
    return !!owner && !!myAddress && owner === myAddress;
  }, [group, myAddress]);

  const myRole = useMemo(() => {
    const row = members.find((m) => (m.member_address || '').toLowerCase() === myAddress);
    return row?.role || null;
  }, [members, myAddress]);

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

  async function refreshModeration(nextGroupId = groupId) {
    if (!adminEnabled) return;
    if (!api.getGroupModeration) return;
    setModerationError('');
    setModerationLoading(true);
    try {
      const data = await api.getGroupModeration(nextGroupId, { status: moderationFilter, limit: 50 });
      if (data?.error) {
        setModerationItems([]);
        setModerationError(data.error);
        return;
      }
      setModerationItems(data?.items || []);
    } catch {
      setModerationItems([]);
      setModerationError('Failed to load moderation activity.');
    } finally {
      setModerationLoading(false);
    }
  }

  function formatActivity(it) {
    const actor = it.actor_username || it.actor_address || 'Someone';
    const target = it.target_username || it.target_address || '';
    const type = String(it.action_type || '').toLowerCase();
    const when = it.created_at ? new Date(it.created_at).toLocaleString() : '';
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
    if (type === 'set_member_role') text = `set ${target || 'a member'} role to ${meta?.role || '—'}`;
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
      if (data?.error) {
        setActivityItems([]);
        setActivityError(data.error);
        return;
      }
      setActivityItems(data?.items || []);
    } catch {
      setActivityItems([]);
      setActivityError('Failed to load activity log.');
    } finally {
      setActivityLoading(false);
    }
  }

  async function refreshMembers(nextGroupId = groupId) {
    if (!api.getGroupMembers) return;
    try {
      const data = await api.getGroupMembers(nextGroupId);
      setMembers(data?.members || []);
    } catch {
      setMembers([]);
    }
  }

  async function refreshRequests(nextGroupId = groupId) {
    if (!api.getGroupJoinRequests) return;
    try {
      const data = await api.getGroupJoinRequests(nextGroupId);
      setRequests(data?.requests || []);
    } catch {
      setRequests([]);
    }
  }

  async function refreshGroup(nextGroupId = groupId) {
    try {
      if (api.getGroupById) {
        const data = await api.getGroupById(nextGroupId);
        if (data?.error) {
          setGroup(null);
          setError(data.error);
          return null;
        }
        setGroup(data?.group || null);
        if (data?.group?.posting_permission || data?.group?.postingPermission) {
          setPostingPermission(String(data?.group?.posting_permission || data?.group?.postingPermission));
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
    } catch {
      setError('Failed to load group.');
      return null;
    }
  }

  async function refreshPosts(nextGroupId = groupId) {
    if (!api.getGroupPosts) return;
    if (!nextGroupId) return;

    setPostsError('');
    setPostsLoading(true);
    try {
      const data = await api.getGroupPosts(nextGroupId);
      if (data?.error) {
        setPosts([]);
        setPostsError(data.error);
        return;
      }
      setPosts(data?.posts || []);
    } catch {
      setPosts([]);
      setPostsError('Failed to load group posts.');
    } finally {
      setPostsLoading(false);
    }
  }

  useEffect(() => {
    async function fetchGroup() {
      setLoading(true);
      setError('');
      setNotice('');
      try {
        setActiveTab('discussion');
        setViewAsMember(false);
        const loadedGroup = await refreshGroup(groupId);
        await refreshMembers(groupId);
        if (loadedGroup) {
          await refreshPosts(groupId);
        }
      } catch (err) {
        setError('Failed to load group.');
      } finally {
        setLoading(false);
      }
    }
    fetchGroup();
  }, [groupId]);

  useEffect(() => {
    if (!adminEnabled && activeTab === 'admin') {
      setActiveTab('discussion');
    }
  }, [adminEnabled, activeTab]);

  useEffect(() => {
    if (!groupId) return;
    if (!canViewPosts) {
      setPosts([]);
      setPostsError('Join this group to view posts.');
      return;
    }
    refreshPosts(groupId);
  }, [groupId, canViewPosts]);

  useEffect(() => {
    if (!adminEnabled) {
      setRequests([]);
      return;
    }
    refreshRequests(groupId);
  }, [groupId, adminEnabled]);

  useEffect(() => {
    if (!adminEnabled) {
      setModerationItems([]);
      return;
    }
    refreshModeration(groupId);
  }, [groupId, adminEnabled, moderationFilter]);

  useEffect(() => {
    if (!adminEnabled) {
      setActivityItems([]);
      return;
    }
    refreshActivity(groupId);
  }, [groupId, adminEnabled, activityFilter]);

  async function handleJoin() {
    try {
      setBusy(true);
      setNotice('');
      const data = await api.joinGroup(groupId);
      if (data?.error) {
        setNotice(data.error);
        return;
      }
      if (data?.requested) {
        setNotice('Join request sent. Waiting for admin approval.');
      } else {
        setNotice('You joined this group.');
      }
      await refreshGroup(groupId);
      await refreshMembers(groupId);
      await refreshPosts(groupId);
      if (adminEnabled) await refreshRequests(groupId);
    } catch {
      setNotice('Failed to join group.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    try {
      setBusy(true);
      setNotice('');
      const data = await api.leaveGroup(groupId);
      if (data?.error) {
        setNotice(data.error);
        return;
      }
      setNotice('You left this group.');
      await refreshGroup(groupId);
      await refreshMembers(groupId);
      setPosts([]);
      if (group?.privacy !== 'public') {
        setPostsError('Join this group to view posts.');
      } else {
        await refreshPosts(groupId);
      }
      if (adminEnabled) await refreshRequests(groupId);
    } catch {
      setNotice('Failed to leave group.');
    } finally {
      setBusy(false);
    }
  }

  function handlePostCreated(newPost) {
    setPosts((prev) => [newPost, ...prev]);
  }

  function handlePostDeleted(postId) {
    setPosts((prev) => prev.filter((p) => String(p.id) !== String(postId)));
  }

  async function handleApprove(requesterAddress) {
    try {
      setBusy(true);
      const data = await api.approveGroupJoinRequest(groupId, requesterAddress);
      if (data?.error) {
        setNotice(data.error);
        return;
      }
      await refreshRequests(groupId);
      await refreshMembers(groupId);
      await refreshGroup(groupId);
    } finally {
      setBusy(false);
    }
  }

  async function handleDecline(requesterAddress) {
    try {
      setBusy(true);
      const data = await api.declineGroupJoinRequest(groupId, requesterAddress);
      if (data?.error) {
        setNotice(data.error);
        return;
      }
      await refreshRequests(groupId);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(memberAddress) {
    try {
      setBusy(true);
      const data = await api.removeGroupMember(groupId, memberAddress);
      if (data?.error) {
        setNotice(data.error);
        return;
      }
      await refreshMembers(groupId);
      await refreshGroup(groupId);
    } finally {
      setBusy(false);
    }
  }

  async function handleRoleChange(memberAddress, role) {
    try {
      setBusy(true);
      const data = await api.setGroupMemberRole(groupId, memberAddress, role);
      if (data?.error) {
        setNotice(data.error);
        return;
      }
      await refreshMembers(groupId);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveDescription() {
    try {
      setBusy(true);
      setNotice('');
      const data = await api.updateGroup(groupId, { description: editDescription });
      if (data?.error) {
        setNotice(data.error);
        return;
      }
      setGroup(data?.group || { ...group, description: editDescription });
      setEditingDescription(false);
      setNotice('Description updated.');
    } catch {
      setNotice('Failed to update description.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCoverUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be selected again
    e.target.value = '';
    try {
      setBusy(true);
      setNotice('Uploading cover photo...');
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setCoverPreview(base64);
      const data = await api.updateGroup(groupId, { coverImage: base64 });
      if (data?.error) {
        setNotice('Error: ' + data.error);
        setCoverPreview(null);
        return;
      }
      setGroup(data?.group || { ...group, cover_image: base64 });
      setNotice('Cover photo updated successfully!');
    } catch (err) {
      console.error('Cover upload error:', err);
      setNotice('Failed to upload cover photo.');
      setCoverPreview(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be selected again
    e.target.value = '';
    try {
      setBusy(true);
      setNotice('Uploading avatar...');
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setAvatarPreview(base64);
      const data = await api.updateGroup(groupId, { avatarImage: base64 });
      if (data?.error) {
        setNotice('Error: ' + data.error);
        setAvatarPreview(null);
        return;
      }
      setGroup(data?.group || { ...group, avatar_image: base64 });
      setNotice('Group avatar updated successfully!');
    } catch (err) {
      console.error('Avatar upload error:', err);
      setNotice('Failed to upload avatar.');
      setAvatarPreview(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePostingPermission() {
    try {
      setBusy(true);
      setNotice('');
      const data = await api.updateGroup(groupId, { postingPermission });
      if (data?.error) {
        setNotice(data.error);
        return;
      }
      setGroup(data?.group || group);
      setNotice('Group settings updated.');
    } catch {
      setNotice('Failed to update group settings.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveModeration() {
    try {
      setBusy(true);
      setNotice('');
      const data = await api.updateGroup(groupId, { requirePostApproval, adminsBypassApproval });
      if (data?.error) {
        setNotice(data.error);
        return;
      }
      setGroup(data?.group || group);
      setNotice('Moderation settings updated.');
      await refreshPosts(groupId);
    } catch {
      setNotice('Failed to update moderation settings.');
    } finally {
      setBusy(false);
    }
  }

  async function handleApprovePost(postId) {
    try {
      setBusy(true);
      setNotice('');
      const data = await api.approveGroupPost(groupId, postId);
      if (data?.error) {
        setNotice(data.error);
        return;
      }
      setNotice('Post approved.');
      await refreshPosts(groupId);
      await refreshGroup(groupId);
      await refreshModeration(groupId);
    } catch {
      setNotice('Failed to approve post.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRejectPost(postId) {
    try {
      setBusy(true);
      setNotice('');
      const data = await api.rejectGroupPost(groupId, postId);
      if (data?.error) {
        setNotice(data.error);
        return;
      }
      setNotice('Post rejected.');
      await refreshPosts(groupId);
      await refreshGroup(groupId);
      await refreshModeration(groupId);
    } catch {
      setNotice('Failed to reject post.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePin(postId) {
    try {
      setBusy(true);
      setNotice('');
      const data = await api.updateGroup(groupId, { pinnedPostId: postId });
      if (data?.error) {
        setNotice(data.error);
        return;
      }
      await refreshGroup(groupId);
      await refreshPosts(groupId);
      setNotice('Post pinned.');
    } catch {
      setNotice('Failed to pin post.');
    } finally {
      setBusy(false);
    }
  }

  async function handleUnpin() {
    try {
      setBusy(true);
      setNotice('');
      const data = await api.updateGroup(groupId, { pinnedPostId: null });
      if (data?.error) {
        setNotice(data.error);
        return;
      }
      await refreshGroup(groupId);
      await refreshPosts(groupId);
      setNotice('Post unpinned.');
    } catch {
      setNotice('Failed to unpin post.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="group-page">Loading...</div>;
  if (error) return <div className="group-page error">{error}</div>;
  if (!group) return <div className="group-page">Group not found.</div>;

  const coverUrl = coverPreview || group.cover_image || group.coverImage;
  const avatarUrl = avatarPreview || group.avatar_image || group.avatarImage;
  const groupName = group.name || 'Group';
  const groupDescription = group.description || '';
  const memberCount = group.member_count || members.length || 1;
  const privacy = String(group.privacy || 'public').toLowerCase();
  const isLocked = privacy === 'private' && !isMember && !isOwner;
  const postingLabel = effectivePostingPermission === 'admins' ? 'Admins can post' : 'Members can post';
  const createdAtRaw = group.created_at || group.createdAt;
  const createdAt = createdAtRaw ? new Date(createdAtRaw).toLocaleDateString() : null;
  const ownerAddressRaw = group.owner_address || group.ownerAddress || '';
  const ownerAddress = ownerAddressRaw ? ownerAddressRaw.toLowerCase() : '';
  const ownerRow = ownerAddress
    ? members.find((m) => String(m.member_address || '').toLowerCase() === ownerAddress)
    : null;

  function avatarForMember(m) {
    return (
      m?.profile_image ||
      m?.profileImage ||
      m?.avatar_url ||
      m?.avatarUrl ||
      m?.profile_photo ||
      m?.profilePhoto ||
      m?.photo_url ||
      m?.photoUrl ||
      ''
    );
  }

  function profileHandleForMember(m) {
    return m?.username || m?.handle || m?.member_address || '';
  }

  return (
    <div className="group-page">
      <div className="group-hero">
        <div
          className="group-hero-cover"
          style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
          role="img"
          aria-label={`${groupName} cover`}
        />
        <div className="group-hero-bar">
          <div className="group-hero-left">
            <div className="group-avatar" aria-hidden="true">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="group-avatar-img" />
              ) : (
                (groupName || '?').slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="group-hero-meta">
              <h1 className="group-title">{groupName}</h1>
              <div className="group-subtitle">
                <span className="group-pill">{privacy}</span>
                <span className="group-dot">•</span>
                <span>{memberCount} members</span>
                <span className="group-dot">•</span>
                <span>{postingLabel}</span>
              </div>
            </div>
          </div>

          <div className="group-hero-actions">
            {isMember ? (
              <button className="group-btn secondary" onClick={handleLeave} disabled={busy || isOwner}>
                {isOwner ? 'Owner' : 'Leave group'}
              </button>
            ) : (
              <button className="group-btn primary" onClick={handleJoin} disabled={busy}>
                {privacy === 'private' ? 'Request to join' : 'Join group'}
              </button>
            )}

            {isAdmin && (
              <label className="group-view-toggle">
                <input
                  type="checkbox"
                  checked={viewAsMember}
                  onChange={(e) => setViewAsMember(e.target.checked)}
                  disabled={busy}
                />
                <span>View as member</span>
              </label>
            )}
          </div>
        </div>
      </div>

      <div className="group-tabs" role="tablist" aria-label="Group sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'discussion'}
          className={activeTab === 'discussion' ? 'group-tab active' : 'group-tab'}
          onClick={() => setActiveTab('discussion')}
        >
          Discussion
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'about'}
          className={activeTab === 'about' ? 'group-tab active' : 'group-tab'}
          onClick={() => setActiveTab('about')}
        >
          About
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'members'}
          className={activeTab === 'members' ? 'group-tab active' : 'group-tab'}
          onClick={() => setActiveTab('members')}
        >
          Members
        </button>
        {adminEnabled && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'admin'}
            className={activeTab === 'admin' ? 'group-tab active' : 'group-tab'}
            onClick={() => setActiveTab('admin')}
          >
            Admin
          </button>
        )}
      </div>

      {notice ? <div className="group-notice">{notice}</div> : null}

      {activeTab === 'about' && (
        <div className="group-panel">
          <h2>About</h2>
          
          <div className="group-about-description">
            {adminEnabled && editingDescription ? (
              <div className="group-edit-description">
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Write a description for this group..."
                  rows={4}
                  maxLength={1000}
                  disabled={busy}
                />
                <div className="group-edit-actions">
                  <button className="group-btn tiny" onClick={handleSaveDescription} disabled={busy}>
                    Save
                  </button>
                  <button
                    className="group-btn tiny secondary"
                    onClick={() => {
                      setEditingDescription(false);
                      setEditDescription(groupDescription);
                    }}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="group-description-text">
                  {groupDescription || 'No description yet.'}
                </div>
                {adminEnabled && (
                  <button
                    className="group-btn tiny"
                    onClick={() => {
                      setEditDescription(groupDescription);
                      setEditingDescription(true);
                    }}
                  >
                    Edit description
                  </button>
                )}
              </>
            )}
          </div>

          <div className="group-about-grid">
            <div className="group-about-item">
              <div className="group-about-k">Privacy</div>
              <div className="group-about-v">{privacy}</div>
            </div>
            <div className="group-about-item">
              <div className="group-about-k">Members</div>
              <div className="group-about-v">{memberCount}</div>
            </div>
            <div className="group-about-item">
              <div className="group-about-k">Owner</div>
              <div className="group-about-v">{ownerRow?.username || ownerAddressRaw || '—'}</div>
            </div>
            <div className="group-about-item">
              <div className="group-about-k">Created</div>
              <div className="group-about-v">{createdAt || '—'}</div>
            </div>
            <div className="group-about-item">
              <div className="group-about-k">Posting</div>
              <div className="group-about-v">{postingLabel}</div>
            </div>
            <div className="group-about-item">
              <div className="group-about-k">Post approval</div>
              <div className="group-about-v">{effectiveRequireApproval ? 'On' : 'Off'}</div>
            </div>
            <div className="group-about-item">
              <div className="group-about-k">Admins bypass approval</div>
              <div className="group-about-v">{effectiveAdminsBypass ? 'On' : 'Off'}</div>
            </div>
            <div className="group-about-item">
              <div className="group-about-k">Pinned post</div>
              <div className="group-about-v">{pinnedPostId !== null ? `#${pinnedPostId}` : 'None'}</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'members' && (
        <div className="group-panel">
          <div className="group-panel-header">
            <h2>Members</h2>
            <div className="group-muted">{memberCount} total</div>
          </div>

          {members.length === 0 ? (
            <div className="group-muted">No members to show.</div>
          ) : (
            <div className="group-members">
              {members.map((m) => {
                const addr = (m.member_address || '').toLowerCase();
                const isMe = addr && addr === myAddress;
                const isMemberOwner = addr && addr === (group.owner_address || group.ownerAddress || '').toLowerCase();
                const canRemove = adminEnabled && !isMemberOwner && !isMe;
                const canPromote = isOwner && !isMemberOwner;
                const handle = profileHandleForMember(m);
                const avatarUrl = avatarForMember(m);

                return (
                  <div key={m.member_address} className="group-member">
                    <button
                      type="button"
                      className="group-member-main"
                      onClick={() => {
                        if (!handle) return;
                        navigate(`/profile/${encodeURIComponent(handle)}`);
                      }}
                    >
                      <div className="group-member-avatar" aria-hidden="true">
                        {avatarUrl ? (
                          <img className="group-member-avatar-img" src={avatarUrl} alt="" loading="lazy" />
                        ) : (
                          (m.username || m.member_address || '?').slice(0, 1).toUpperCase()
                        )}
                      </div>
                      <div>
                        <div className="group-member-name">
                          {m.username || m.member_address}
                          {isMe ? ' (you)' : ''}
                        </div>
                        <div className="group-member-meta">
                          <span className="badge">{m.role}</span>
                        </div>
                      </div>
                    </button>

                    {adminEnabled && (
                      <div className="group-member-actions">
                        {canPromote && m.role !== 'admin' && m.role !== 'owner' && (
                          <button className="group-btn tiny" onClick={() => handleRoleChange(m.member_address, 'admin')} disabled={busy}>
                            Make admin
                          </button>
                        )}
                        {canPromote && m.role === 'admin' && (
                          <button className="group-btn tiny" onClick={() => handleRoleChange(m.member_address, 'member')} disabled={busy}>
                            Remove admin
                          </button>
                        )}
                        {canRemove && (
                          <button className="group-btn tiny danger" onClick={() => handleRemove(m.member_address)} disabled={busy}>
                            Remove
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'admin' && adminEnabled && (
        <div className="group-panel">
          <h2>Admin tools</h2>
          <div className="group-muted">Settings, approvals, and logs for moderators.</div>

          <div className="group-admin-settings">
            <h3>Group appearance</h3>
            <div className="group-muted">Customize how your group looks.</div>
            <div className="group-appearance-row">
              <div className="group-appearance-item">
                <label>Cover photo</label>
                <div className="group-image-upload">
                  <div
                    className="group-cover-preview"
                    style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
                  >
                    {!coverUrl && <span>No cover</span>}
                  </div>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCoverUpload}
                    disabled={busy}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    className="group-btn tiny"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={busy}
                  >
                    {busy ? 'Uploading...' : 'Upload cover'}
                  </button>
                </div>
              </div>
              <div className="group-appearance-item">
                <label>Group avatar</label>
                <div className="group-image-upload">
                  <div className="group-avatar-preview">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" />
                    ) : (
                      <span>{(groupName || '?').slice(0, 1).toUpperCase()}</span>
                    )}
                  </div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={busy}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    className="group-btn tiny"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={busy}
                  >
                    {busy ? 'Uploading...' : 'Upload avatar'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="group-admin-settings">
            <h3>Post permissions</h3>
            <div className="group-muted">Control who can create posts in this group.</div>
            <div className="group-admin-row">
              <select value={postingPermission} onChange={(e) => setPostingPermission(e.target.value)} disabled={busy}>
                <option value="members">Members can post</option>
                <option value="admins">Admins only</option>
              </select>
              <button className="group-btn tiny" onClick={handleSavePostingPermission} disabled={busy}>
                Save
              </button>
            </div>
          </div>

          <div className="group-admin-settings">
            <h3>Post approval</h3>
            <div className="group-muted">When enabled, member posts require admin approval before publishing.</div>
            <div className="group-admin-row">
              <label className="group-toggle">
                <input type="checkbox" checked={requirePostApproval} onChange={(e) => setRequirePostApproval(e.target.checked)} disabled={busy} />
                <span>Require approval</span>
              </label>
              <label className="group-toggle">
                <input type="checkbox" checked={adminsBypassApproval} onChange={(e) => setAdminsBypassApproval(e.target.checked)} disabled={busy || !requirePostApproval} />
                <span>Admins bypass approval</span>
              </label>
              <button className="group-btn tiny" onClick={handleSaveModeration} disabled={busy}>
                Save
              </button>
            </div>
          </div>

          {effectiveRequireApproval && (
            <div className="group-admin-settings">
              <h3>Pending posts</h3>
              {pendingPosts.length === 0 ? (
                <div className="group-muted">No posts awaiting approval.</div>
              ) : (
                <div className="group-pending-list">
                  {pendingPosts.map((p) => (
                    <div key={p.id} className="group-pending-item">
                      <div className="group-pending-meta">
                        <div className="group-pending-title">{p.username || p.author_address}</div>
                        <div className="group-muted">{(p.content || '').slice(0, 140)}{(p.content || '').length > 140 ? '…' : ''}</div>
                      </div>
                      <div className="group-request-actions">
                        <button className="group-btn tiny" onClick={() => handleApprovePost(p.id)} disabled={busy}>Approve</button>
                        <button className="group-btn tiny danger" onClick={() => handleRejectPost(p.id)} disabled={busy}>Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="group-admin-settings">
            <h3>Moderation history</h3>
            <div className="group-admin-row">
              <select value={moderationFilter} onChange={(e) => setModerationFilter(e.target.value)} disabled={busy}>
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <button className="group-btn tiny" onClick={() => refreshModeration(groupId)} disabled={busy || moderationLoading}>Refresh</button>
            </div>

            {moderationLoading ? (
              <div className="group-muted">Loading activity…</div>
            ) : moderationError ? (
              <div className="group-muted">{moderationError}</div>
            ) : moderationItems.length === 0 ? (
              <div className="group-muted">No activity to show.</div>
            ) : (
              <div className="group-pending-list">
                {moderationItems.map((it) => {
                  const status = String(it.moderation_status || '').toLowerCase();
                  const isApproved = !!it.approved_by;
                  const who = isApproved ? (it.approver_username || it.approved_by) : (it.rejector_username || it.rejected_by);
                  const when = it.approved_at || it.rejected_at || it.created_at;
                  const label = status === 'pending' ? 'Pending' : isApproved ? 'Approved' : 'Rejected';
                  const badgeClass = label === 'Approved' ? 'approved' : label === 'Rejected' ? 'rejected' : 'pending';

                  return (
                    <div key={it.id} className="group-pending-item">
                      <div className="group-pending-meta">
                        <div className="group-pending-title">{it.author_username || it.author_address}</div>
                        <div className="group-muted">
                          <span className={`group-status-badge ${badgeClass}`}>{label}</span>
                          {' '}· {who ? `by ${who}` : ''}{when ? ` · ${new Date(when).toLocaleString()}` : ''}
                        </div>
                        <div className="group-muted">{(it.content || '').slice(0, 160)}{(it.content || '').length > 160 ? '…' : ''}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="group-admin-settings">
            <h3>Activity log</h3>
            <div className="group-admin-row">
              <select value={activityFilter} onChange={(e) => setActivityFilter(e.target.value)} disabled={busy}>
                <option value="all">All</option>
                <option value="create_group">Group created</option>
                <option value="update_settings">Settings updated</option>
                <option value="join_group">Member joined</option>
                <option value="leave_group">Member left</option>
                <option value="request_to_join">Join requested</option>
                <option value="approve_join_request">Join approved</option>
                <option value="decline_join_request">Join declined</option>
                <option value="set_member_role">Role changed</option>
                <option value="remove_member">Member removed</option>
                <option value="create_post">Post created</option>
                <option value="approve_post">Post approved</option>
                <option value="reject_post">Post rejected</option>
                <option value="pin_post">Post pinned</option>
                <option value="unpin_post">Post unpinned</option>
              </select>
              <button className="group-btn tiny" onClick={() => refreshActivity(groupId)} disabled={busy || activityLoading}>Refresh</button>
            </div>

            {activityLoading ? (
              <div className="group-muted">Loading activity…</div>
            ) : activityError ? (
              <div className="group-muted">{activityError}</div>
            ) : activityItems.length === 0 ? (
              <div className="group-muted">No activity to show.</div>
            ) : (
              <div className="group-pending-list">
                {activityItems.map((it) => {
                  const f = formatActivity(it);
                  return (
                    <div key={it.id} className="group-pending-item">
                      <div className="group-pending-meta">
                        <div className="group-pending-title">{f.actor}</div>
                        <div className="group-muted">{f.text}{f.when ? ` · ${f.when}` : ''}</div>
                        {f.snippet ? <div className="group-muted">{f.snippet}{String(it.post_content || '').length > 160 ? '…' : ''}</div> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="group-admin-settings">
            <h3>Join requests</h3>
            {requests.length === 0 ? (
              <div className="group-muted">No pending requests.</div>
            ) : (
              <div className="group-requests">
                {requests.map((r) => (
                  <div key={r.requester_address} className="group-request">
                    <div className="group-request-name">{r.username || r.requester_address}</div>
                    <div className="group-request-actions">
                      <button className="group-btn tiny" onClick={() => handleApprove(r.requester_address)} disabled={busy}>Approve</button>
                      <button className="group-btn tiny danger" onClick={() => handleDecline(r.requester_address)} disabled={busy}>Decline</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'discussion' && (
        <div className="group-panel">
          {isLocked ? (
            <>
              <h2>This is a private group</h2>
              <div className="group-muted">Request to join to see posts and discussions.</div>
            </>
          ) : (
            <>
              <div className="group-panel-header">
                <h2>Discussion</h2>
                {pinnedPostId !== null ? <span className="group-muted">Pinned post is highlighted</span> : null}
              </div>

              {canPost ? (
                <CreatePost groupId={groupId} contextLabel={groupName} onPostCreated={handlePostCreated} />
              ) : (
                <div className="group-muted">
                  {effectivePostingPermission === 'admins' ? 'Only admins can post in this group.' : 'Join this group to post.'}
                </div>
              )}

              {postsLoading ? (
                <div className="group-muted" style={{ marginTop: 12 }}>Loading posts…</div>
              ) : postsError ? (
                <div className="group-muted" style={{ marginTop: 12 }}>{postsError}</div>
              ) : posts.length === 0 ? (
                <div className="group-muted" style={{ marginTop: 12 }}>No posts yet.</div>
              ) : (
                <div className="group-posts" style={{ marginTop: 12 }}>
                  {posts.map((p) => {
                    const isPinned = pinnedPostId !== null && String(p.id) === String(pinnedPostId);
                    const status = String(p.moderation_status || 'published').toLowerCase();
                    const isMine = (p.author_address || '').toLowerCase() === myAddress;
                    const showStatus = status !== 'published' && (isMine || adminEnabled);

                    return (
                      <div key={p.id} className={isPinned ? 'group-post pinned' : 'group-post'}>
                        {(isPinned || adminEnabled) && (
                          <div className="group-post-toolbar">
                            <div className="group-post-badges">
                              {isPinned && <span className="group-pin-badge">Pinned</span>}
                              {showStatus && status === 'pending' && <span className="group-status-badge pending">Pending</span>}
                              {showStatus && status === 'rejected' && <span className="group-status-badge rejected">Rejected</span>}
                            </div>
                            {adminEnabled &&
                              (isPinned ? (
                                <button className="group-btn tiny" onClick={handleUnpin} disabled={busy}>
                                  Unpin
                                </button>
                              ) : (
                                <button className="group-btn tiny" onClick={() => handlePin(p.id)} disabled={busy}>
                                  Pin
                                </button>
                              ))}
                          </div>
                        )}
                        {showStatus && !adminEnabled && status === 'pending' && (
                          <div className="group-muted">Your post is waiting for approval.</div>
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
      )}
    </div>
  );
}
