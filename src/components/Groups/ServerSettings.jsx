import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { formatDateTime } from '../../utils/date';
import { compressImage } from '../../utils/imageCompression';
import './ServerSettings.css';

const BANNER_GRADIENTS = [
  'linear-gradient(135deg, #f5af19, #f12711)',
  'linear-gradient(135deg, #f953c6, #b91d73)',
  'linear-gradient(135deg, #eb3349, #f45c43)',
  'linear-gradient(135deg, #ff6a00, #ee0979)',
  'linear-gradient(135deg, #f7971e, #ffd200)',
  'linear-gradient(135deg, #a855f7, #6d28d9)',
  'linear-gradient(135deg, #667eea, #764ba2)',
  'linear-gradient(135deg, #06b6d4, #3b82f6)',
  'linear-gradient(135deg, #00b09b, #96c93d)',
  'linear-gradient(135deg, #56ab2f, #a8e063)',
  'linear-gradient(135deg, #bdc3c7, #2c3e50)',
  'linear-gradient(135deg, #9ca3af, #6b7280)',
];

const NAV_SECTIONS = [
  { category: null, items: [{ key: 'profile', label: 'Server Profile' }] },
  { category: null, items: [
    { key: 'engagement', label: 'Engagement' },
    { key: 'boostPerks', label: 'Boost Perks' },
  ]},
  { category: 'EXPRESSION', items: [
    { key: 'emoji', label: 'Emoji' },
    { key: 'stickers', label: 'Stickers' },
    { key: 'soundboard', label: 'Soundboard' },
  ]},
  { category: 'PEOPLE', items: [
    { key: 'members', label: 'Members' },
    { key: 'roles', label: 'Roles' },
    { key: 'invites', label: 'Invites' },
    { key: 'access', label: 'Access' },
  ]},
  { category: 'APPS', items: [
    { key: 'integrations', label: 'Integrations' },
    { key: 'appDirectory', label: 'App Directory', external: true },
  ]},
  { category: 'MODERATION', items: [
    { key: 'safetySetup', label: 'Safety Setup' },
    { key: 'auditLog', label: 'Audit Log' },
    { key: 'bans', label: 'Bans' },
    { key: 'automod', label: 'AutoMod' },
  ]},
];

export default function ServerSettings({
  group,
  groupId,
  members,
  bannedMembers,
  requests,
  customRoles,
  channels,
  categories,
  postingPermission,
  setPostingPermission,
  requirePostApproval,
  setRequirePostApproval,
  adminsBypassApproval,
  setAdminsBypassApproval,
  onClose,
  onRefreshGroup,
  onRefreshMembers,
  onSavePostingPermission,
  onSaveModeration,
  onApprove,
  onDecline,
  onUnban,
  onDeleteGroup,
  isOwner,
  busy,
  setBusy,
}) {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState('profile');
  const [serverName, setServerName] = useState(group?.name || '');
  const [serverDesc, setServerDesc] = useState(group?.description || '');
  const [selectedBanner, setSelectedBanner] = useState(0);
  const [notice, setNotice] = useState('');
  const coverInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  const groupName = group?.name || '';
  const avatarUrl = group?.avatar_url || group?.avatar || '';
  const coverUrl = group?.cover_photo || group?.cover_url || '';
  const memberCount = group?.member_count || members?.length || 0;
  const createdAt = group?.created_at;
  const privacy = group?.privacy || 'public';

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Prevent background scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Upload handlers
  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setBusy(true);
      const compressed = await compressImage(file, { maxWidth: 512, maxHeight: 512, quality: 0.85 });
      const fd = new FormData();
      fd.append('avatar', compressed);
      await api.updateGroupAvatar(groupId, fd);
      onRefreshGroup(groupId);
      setNotice('Avatar updated!');
    } catch (err) { setNotice('Failed to upload avatar'); }
    finally { setBusy(false); }
  }

  async function handleCoverUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setBusy(true);
      const compressed = await compressImage(file, { maxWidth: 1200, maxHeight: 400, quality: 0.85 });
      const fd = new FormData();
      fd.append('cover', compressed);
      await api.updateGroupCover(groupId, fd);
      onRefreshGroup(groupId);
      setNotice('Cover updated!');
    } catch (err) { setNotice('Failed to upload cover'); }
    finally { setBusy(false); }
  }

  async function handleSaveName() {
    if (!serverName.trim() || serverName === groupName) return;
    try {
      setBusy(true);
      await api.updateGroup(groupId, { name: serverName.trim() });
      onRefreshGroup(groupId);
      setNotice('Server name updated!');
    } catch { setNotice('Failed to update name'); }
    finally { setBusy(false); }
  }

  async function handleSaveDesc() {
    try {
      setBusy(true);
      await api.updateGroup(groupId, { description: serverDesc.trim() });
      onRefreshGroup(groupId);
      setNotice('Description updated!');
    } catch { setNotice('Failed to update description'); }
    finally { setBusy(false); }
  }

  return (
    <div className="ss-overlay" onClick={onClose}>
      <div className="ss-layout" onClick={(e) => e.stopPropagation()}>
        {/* Sidebar */}
        <div className="ss-sidebar">
          <div className="ss-sidebar-scroll">
            {/* Server name heading */}
            <div className="ss-nav-server-name">{groupName.toUpperCase()}</div>

            {NAV_SECTIONS.map((sec, si) => (
              <div key={si} className="ss-nav-group">
                {sec.category && <div className="ss-nav-category">{sec.category}</div>}
                {sec.items.map((item) => (
                  <button
                    key={item.key}
                    className={`ss-nav-item${activeSection === item.key ? ' active' : ''}`}
                    onClick={() => setActiveSection(item.key)}
                  >
                    {item.label}
                    {item.external && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 'auto', opacity: 0.6 }}>
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
                      </svg>
                    )}
                  </button>
                ))}
                {si === 0 && <div className="ss-nav-sep" />}
              </div>
            ))}

            <div className="ss-nav-sep" />
            <button className="ss-nav-item" onClick={() => setActiveSection('community')}>
              Enable Community
            </button>
            <button className="ss-nav-item" onClick={() => setActiveSection('template')}>
              Server Template
            </button>
            {isOwner && (
              <button className="ss-nav-item ss-nav-danger" onClick={() => setActiveSection('delete')}>
                Delete Server
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 'auto' }}>
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="ss-content">
          <button className="ss-close-btn" onClick={onClose}>
            <span className="ss-close-x">✕</span>
            <span className="ss-close-label">ESC</span>
          </button>

          {notice && (
            <div className="ss-notice" onClick={() => setNotice('')}>{notice}</div>
          )}

          {/* ── Server Profile ── */}
          {activeSection === 'profile' && (
            <div className="ss-section">
              <div className="ss-profile-layout">
                <div className="ss-profile-main">
                  <h2>Server Profile</h2>
                  <p className="ss-subtitle">Customize how your server appears in invite links and, if enabled, in Server Discovery and Announcement Channel messages</p>

                  {/* Name */}
                  <div className="ss-field">
                    <label className="ss-label">Name</label>
                    <input
                      type="text"
                      className="ss-input"
                      value={serverName}
                      onChange={(e) => setServerName(e.target.value)}
                      onBlur={handleSaveName}
                    />
                  </div>

                  {/* Icon */}
                  <div className="ss-field">
                    <label className="ss-label">Icon</label>
                    <p className="ss-hint">We recommend an image of at least 512x512.</p>
                    <div className="ss-icon-actions">
                      <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
                      <button className="ss-btn-green" onClick={() => avatarInputRef.current?.click()} disabled={busy}>
                        Change Server Icon
                      </button>
                      <button className="ss-btn-link" onClick={() => {}}>Remove Icon</button>
                    </div>
                  </div>

                  {/* Banner */}
                  <div className="ss-field">
                    <label className="ss-label">Banner</label>
                    <div className="ss-banner-grid">
                      {BANNER_GRADIENTS.map((g, i) => (
                        <div
                          key={i}
                          className={`ss-banner-swatch${selectedBanner === i ? ' active' : ''}`}
                          style={{ background: g }}
                          onClick={() => setSelectedBanner(i)}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Traits */}
                  <div className="ss-field">
                    <label className="ss-label">Traits</label>
                    <p className="ss-hint">Add up to 5 traits to show off your server's interests and personality.</p>
                    <div className="ss-traits-grid">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <div key={i} className="ss-trait-input">
                          <span className="ss-trait-emoji">😀</span>
                          <input type="text" placeholder="" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  <div className="ss-field">
                    <label className="ss-label">Description</label>
                    <p className="ss-hint">How did your server get started? Why should people join?</p>
                    <textarea
                      className="ss-textarea"
                      placeholder="Tell the world a bit about this server."
                      value={serverDesc}
                      onChange={(e) => setServerDesc(e.target.value)}
                      onBlur={handleSaveDesc}
                      rows={4}
                    />
                  </div>

                  {/* Games */}
                  <div className="ss-field">
                    <label className="ss-label">Games</label>
                    <p className="ss-hint">What games does your server play?</p>
                    <div className="ss-game-search">
                      <input type="text" placeholder="Search for a game..." />
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#72767d"><path d="M7 10l5 5 5-5H7z"/></svg>
                    </div>
                  </div>

                  {/* Private Profile */}
                  <div className="ss-field">
                    <div className="ss-toggle-row">
                      <div>
                        <span className="ss-label">Private Profile</span>
                        <p className="ss-hint">When enabled, only server members can view profile content. Non-members won't be able to see this content unless they have an invite.</p>
                      </div>
                      <button className={`notif-toggle${privacy === 'private' ? ' active' : ''}`} onClick={() => {}}>
                        <span className="notif-toggle-knob" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Preview card */}
                <div className="ss-profile-preview">
                  <div className="ss-preview-card">
                    <div className="ss-preview-banner" style={{ background: BANNER_GRADIENTS[selectedBanner] }} />
                    <div className="ss-preview-avatar">
                      {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{(groupName || '?').slice(0, 1).toUpperCase()}</span>}
                    </div>
                    <div className="ss-preview-info">
                      <h3>{serverName || groupName}</h3>
                      <div className="ss-preview-meta">
                        <span className="ss-preview-online">● 4 Online</span>
                        <span className="ss-preview-members">● {memberCount} Members</span>
                      </div>
                      {createdAt && <span className="ss-preview-est">Est. {new Date(createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Members ── */}
          {activeSection === 'members' && (
            <div className="ss-section">
              <h2>Members</h2>
              <p className="ss-subtitle">{memberCount} members in this server</p>
              <div className="ss-member-list">
                {members.map((m, i) => {
                  const uname = m.username || m.user?.username || '';
                  const role = m.role || 'member';
                  const avatar = m.profile_image || m.profileImage || '/default-avatar.png';
                  return (
                    <div key={`${uname}-${i}`} className="ss-member-row">
                      <img src={avatar} alt="" className="ss-member-avatar" onError={e => { e.target.src = '/default-avatar.png'; }} />
                      <span className="ss-member-name">{uname}</span>
                      <span className={`ss-member-role ${role}`}>{role}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Roles ── */}
          {activeSection === 'roles' && (
            <div className="ss-section">
              <h2>Roles</h2>
              <p className="ss-subtitle">Manage server roles and permissions</p>
              <div className="ss-role-list">
                {customRoles.map((r) => (
                  <div key={r.id} className="ss-role-row">
                    <span className="ss-role-dot" style={{ background: r.color || '#99aab5' }} />
                    <span className="ss-role-name">{r.name}</span>
                    <span className="ss-role-count">{r.member_count || 0} members</span>
                  </div>
                ))}
                {customRoles.length === 0 && <p className="ss-muted">No custom roles yet.</p>}
              </div>
            </div>
          )}

          {/* ── Bans ── */}
          {activeSection === 'bans' && (
            <div className="ss-section">
              <h2>Bans</h2>
              <p className="ss-subtitle">Manage banned members</p>
              {bannedMembers.length === 0 ? (
                <p className="ss-muted">No banned members.</p>
              ) : (
                <div className="ss-member-list">
                  {bannedMembers.map((b, i) => {
                    const banName = b.username || b.handle || b.member_username || '';
                    return (
                      <div key={`${banName}-${i}`} className="ss-member-row">
                        <span className="ss-member-name">{banName || 'Banned member'}</span>
                        <button className="ss-btn-small" onClick={() => banName && onUnban(banName)} disabled={busy}>Unban</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Audit Log ── */}
          {activeSection === 'auditLog' && (
            <div className="ss-section">
              <h2>Audit Log</h2>
              <p className="ss-subtitle">Review recent server activity</p>
              <p className="ss-muted">Audit log feature coming soon.</p>
            </div>
          )}

          {/* ── Delete Server ── */}
          {activeSection === 'delete' && isOwner && (
            <div className="ss-section">
              <h2>Delete Server</h2>
              <p className="ss-subtitle">Permanently delete this server and all its data. This action cannot be undone.</p>
              <div className="ss-danger-zone">
                <button className="ss-btn-danger" onClick={onDeleteGroup} disabled={busy}>
                  {busy ? 'Deleting...' : 'Delete Server'}
                </button>
              </div>
            </div>
          )}

          {/* Placeholder tabs */}
          {['engagement', 'boostPerks', 'emoji', 'stickers', 'soundboard', 'invites', 'access', 'integrations', 'appDirectory', 'safetySetup', 'automod', 'community', 'template'].includes(activeSection) && (
            <div className="ss-section">
              <h2>{NAV_SECTIONS.flatMap(s => s.items).find(i => i.key === activeSection)?.label || activeSection}</h2>
              <p className="ss-muted">This feature is coming soon.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
