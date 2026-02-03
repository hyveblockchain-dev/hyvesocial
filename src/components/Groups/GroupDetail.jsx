import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import CreatePost from '../Feed/CreatePost';
import Post from '../Post/Post';
import './GroupDetail.css';

export default function GroupDetail() {
  const { groupId } = useParams();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
  const canPost = effectivePostingPermission === 'admins' ? isAdmin : (isMember || isOwner);

  const effectiveRequireApproval = !!(group?.require_post_approval ?? group?.requirePostApproval ?? requirePostApproval);
  const effectiveAdminsBypass = !!(group?.admins_bypass_approval ?? group?.adminsBypassApproval ?? adminsBypassApproval);

  const pendingPosts = useMemo(() => {
    if (!isAdmin) return [];
    return (posts || []).filter((p) => String(p.moderation_status || '').toLowerCase() === 'pending');
  }, [posts, isAdmin]);

  async function refreshModeration(nextGroupId = groupId) {
    if (!isAdmin) return;
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
    if (!isAdmin) return;
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
    if (!groupId) return;
    if (!canViewPosts) {
      setPosts([]);
      setPostsError('Join this group to view posts.');
      return;
    }
    refreshPosts(groupId);
  }, [groupId, canViewPosts]);

  useEffect(() => {
    if (!isAdmin) {
      setRequests([]);
      return;
    }
    refreshRequests(groupId);
  }, [groupId, isAdmin]);

  useEffect(() => {
    if (!isAdmin) {
      setModerationItems([]);
      return;
    }
    refreshModeration(groupId);
  }, [groupId, isAdmin, moderationFilter]);

  useEffect(() => {
    if (!isAdmin) {
      setActivityItems([]);
      return;
    }
    refreshActivity(groupId);
  }, [groupId, isAdmin, activityFilter]);

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
      if (isAdmin) await refreshRequests(groupId);
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
      if (isAdmin) await refreshRequests(groupId);
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

  if (loading) return <div className="group-detail-page">Loading...</div>;
  if (error) return <div className="group-detail-page error">{error}</div>;
  if (!group) return <div className="group-detail-page">Group not found.</div>;

  return (
    <div className="group-detail-page">
      <div className="group-detail-header">
        <img className="group-detail-cover" src={group.cover_image || group.coverImage} alt={group.name} />
        <div className="group-detail-info">
          <h1>{group.name}</h1>
          <p>{group.description}</p>
          <div className="group-detail-meta">
            <span>{group.member_count || 1} members</span>
            <span>{group.privacy}</span>
          </div>

          <div className="group-detail-actions">
            {group.is_member ? (
              <button className="group-btn secondary" onClick={handleLeave} disabled={busy || isOwner}>
                {isOwner ? 'Owner' : 'Leave group'}
              </button>
            ) : (
              <button className="group-btn primary" onClick={handleJoin} disabled={busy}>
                Join group
              </button>
            )}
          </div>
        </div>
      </div>

      {notice && <div className="group-notice">{notice}</div>}

      <div className="group-detail-section">
        <h2>Members</h2>
        {members.length === 0 ? (
          <div className="group-muted">No members to show.</div>
        ) : (
          <div className="group-members">
            {members.map((m) => {
              const addr = (m.member_address || '').toLowerCase();
              const isMe = addr && addr === myAddress;
              const isMemberOwner = addr && addr === (group.owner_address || '').toLowerCase();
              const canRemove = isAdmin && !isMemberOwner && !isMe;
              const canPromote = isOwner && !isMemberOwner;
              return (
                <div key={m.member_address} className="group-member">
                  <div className="group-member-main">
                    <div className="group-member-name">
                      {m.username || m.member_address}
                      {isMe ? ' (you)' : ''}
                    </div>
                    <div className="group-member-meta">
                      <span className="badge">{m.role}</span>
                    </div>
                  </div>

                  {isAdmin && (
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

      {isAdmin && (
        <div className="group-detail-section">
          <h2>Admin</h2>
          <div className="group-muted">
            Owner can promote admins. Admins can approve requests and remove members.
          </div>

          <div className="group-admin-settings">
            <h3>Post permissions</h3>
            <div className="group-muted">Control who can create posts in this group.</div>
            <div className="group-admin-row">
              <select
                value={postingPermission}
                onChange={(e) => setPostingPermission(e.target.value)}
                disabled={busy}
              >
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
                <input
                  type="checkbox"
                  checked={requirePostApproval}
                  onChange={(e) => setRequirePostApproval(e.target.checked)}
                  disabled={busy}
                />
                <span>Require approval</span>
              </label>
              <label className="group-toggle">
                <input
                  type="checkbox"
                  checked={adminsBypassApproval}
                  onChange={(e) => setAdminsBypassApproval(e.target.checked)}
                  disabled={busy || !requirePostApproval}
                />
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
                        <div className="group-pending-title">
                          {p.username || p.author_address}
                        </div>
                        <div className="group-muted">{(p.content || '').slice(0, 140)}{(p.content || '').length > 140 ? '…' : ''}</div>
                      </div>
                      <div className="group-request-actions">
                        <button className="group-btn tiny" onClick={() => handleApprovePost(p.id)} disabled={busy}>
                          Approve
                        </button>
                        <button className="group-btn tiny danger" onClick={() => handleRejectPost(p.id)} disabled={busy}>
                          Reject
                        </button>
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
              <select
                value={moderationFilter}
                onChange={(e) => setModerationFilter(e.target.value)}
                disabled={busy}
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <button className="group-btn tiny" onClick={() => refreshModeration(groupId)} disabled={busy || moderationLoading}>
                Refresh
              </button>
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
                  const who = isApproved
                    ? (it.approver_username || it.approved_by)
                    : (it.rejector_username || it.rejected_by);
                  const when = it.approved_at || it.rejected_at || it.created_at;
                  const label = status === 'pending' ? 'Pending' : isApproved ? 'Approved' : 'Rejected';
                  const badgeClass =
                    label === 'Approved' ? 'approved' : label === 'Rejected' ? 'rejected' : 'pending';
                  return (
                    <div key={it.id} className="group-pending-item">
                      <div className="group-pending-meta">
                        <div className="group-pending-title">
                          {it.author_username || it.author_address}
                        </div>
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
              <select
                value={activityFilter}
                onChange={(e) => setActivityFilter(e.target.value)}
                disabled={busy}
              >
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
              <button className="group-btn tiny" onClick={() => refreshActivity(groupId)} disabled={busy || activityLoading}>
                Refresh
              </button>
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
                        {f.snippet ? (
                          <div className="group-muted">{f.snippet}{String(it.post_content || '').length > 160 ? '…' : ''}</div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="group-admin-requests">
            <h3>Join requests</h3>
            {requests.length === 0 ? (
              <div className="group-muted">No pending requests.</div>
            ) : (
              <div className="group-requests">
                {requests.map((r) => (
                  <div key={r.requester_address} className="group-request">
                    <div className="group-request-name">{r.username || r.requester_address}</div>
                    <div className="group-request-actions">
                      <button className="group-btn tiny" onClick={() => handleApprove(r.requester_address)} disabled={busy}>
                        Approve
                      </button>
                      <button className="group-btn tiny danger" onClick={() => handleDecline(r.requester_address)} disabled={busy}>
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="group-detail-content">
        <h2>Posts</h2>

        {canPost ? (
          <CreatePost
            groupId={groupId}
            contextLabel={group.name}
            onPostCreated={handlePostCreated}
          />
        ) : (
          <div className="group-muted">
            {effectivePostingPermission === 'admins'
              ? 'Only admins can post in this group.'
              : 'Join this group to post.'}
          </div>
        )}

        {postsLoading ? (
          <div className="group-muted">Loading posts…</div>
        ) : postsError ? (
          <div className="group-muted">{postsError}</div>
        ) : posts.length === 0 ? (
          <div className="group-muted">No posts yet.</div>
        ) : (
          <div className="group-posts">
            {posts.map((p) => {
              const isPinned = pinnedPostId !== null && String(p.id) === String(pinnedPostId);
              const status = String(p.moderation_status || 'published').toLowerCase();
              const isMine = (p.author_address || '').toLowerCase() === myAddress;
              const showStatus = (status !== 'published') && (isMine || isAdmin);
              return (
                <div key={p.id} className={isPinned ? 'group-post pinned' : 'group-post'}>
                  {(isPinned || isAdmin) && (
                    <div className="group-post-toolbar">
                      <div className="group-post-badges">
                        {isPinned && <span className="group-pin-badge">Pinned</span>}
                        {showStatus && status === 'pending' && <span className="group-status-badge pending">Pending</span>}
                        {showStatus && status === 'rejected' && <span className="group-status-badge rejected">Rejected</span>}
                      </div>
                      {isAdmin && (
                        isPinned ? (
                          <button className="group-btn tiny" onClick={handleUnpin} disabled={busy}>
                            Unpin
                          </button>
                        ) : (
                          <button className="group-btn tiny" onClick={() => handlePin(p.id)} disabled={busy}>
                            Pin
                          </button>
                        )
                      )}
                    </div>
                  )}
                  {showStatus && !isAdmin && status === 'pending' && (
                    <div className="group-muted">Your post is waiting for approval.</div>
                  )}
                  <Post post={p} onDelete={handlePostDeleted} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
