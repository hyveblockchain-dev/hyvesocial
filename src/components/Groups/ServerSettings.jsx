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
  { category: null, items: [{ key: 'profile', label: 'Server Profile' }, { key: 'serverTag', label: 'Server Tag' }] },
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

  const [tagName, setTagName] = useState('');
  const [selectedBadge, setSelectedBadge] = useState(0);
  const [selectedBadgeColor, setSelectedBadgeColor] = useState(0);
  const [showAllBadges, setShowAllBadges] = useState(false);

  // Engagement states
  const [sysWelcome, setSysWelcome] = useState(false);
  const [sysSticker, setSysSticker] = useState(false);
  const [sysBoost, setSysBoost] = useState(true);
  const [sysTips, setSysTips] = useState(true);
  const [activityFeed, setActivityFeed] = useState(true);
  const [defaultNotif, setDefaultNotif] = useState('all');
  const [inactiveChannel, setInactiveChannel] = useState('none');
  const [inactiveTimeout, setInactiveTimeout] = useState('5min');
  const [serverWidget, setServerWidget] = useState(false);

  // Boost Perks states
  const [showBoostBar, setShowBoostBar] = useState(false);

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
                      <input type="text" placeholder="Search for a game..." readOnly />
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#72767d" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
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

          {/* ── Server Tag ── */}
          {activeSection === 'serverTag' && (
            <div className="ss-section">
              <div className="ss-profile-layout">
                <div className="ss-profile-main">
                  <h2>Server Tag</h2>
                  <p className="ss-subtitle">Create a tag that your server members can display next to their name! Anyone outside your server can view your Server Profile through the Server Tag, and if applications are enabled, they can apply to join.</p>

                  {/* Info banner */}
                  <div className="ss-info-banner ss-info-blue">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#5865f2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><text x="12" y="17" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700">i</text></svg>
                    <span>Your Server Profile is private. Users will not be able to see it from a Server Tag. <button className="ss-info-link" onClick={() => setActiveSection('profile')}>Edit Setting</button></span>
                  </div>

                  {/* Unlock button */}
                  <button className="ss-boost-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z"/></svg>
                    Unlock with Boosting
                  </button>

                  {/* Choose Name */}
                  <div className="ss-field" style={{ marginTop: 24 }}>
                    <label className="ss-label">Choose Name</label>
                    <div className="ss-tag-name-preview">
                      <div className="ss-tag-name-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="#b5bac1"><path d="M5.88 21l1.54-5.22L3 12l6.18-.5L12 6l2.82 5.5L21 12l-4.42 3.78L18.12 21 12 17.77 5.88 21z"/></svg>
                      </div>
                      <input
                        type="text"
                        className="ss-tag-name-input"
                        placeholder="WUMP"
                        value={tagName}
                        onChange={(e) => setTagName(e.target.value.toUpperCase())}
                        maxLength={4}
                      />
                      <span className="ss-tag-name-hint">You can use 4 characters, numbers and symbols.</span>
                    </div>
                  </div>

                  {/* Update warning */}
                  <div className="ss-info-banner ss-info-green">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#3ba55c" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><text x="12" y="17" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700">i</text></svg>
                    <span>Updating your Server Tag will require all of your members to manually reapply the tag to their profile. We do this to prevent abuse. <button className="ss-info-link">Learn More</button></span>
                  </div>

                  {/* Choose Badge */}
                  <div className="ss-field" style={{ marginTop: 24 }}>
                    <label className="ss-label" style={{ fontSize: 14 }}>Choose Badge</label>
                    <div className="ss-badge-grid">
                      {['🍃', '⚒️', '🌸', '🔥', '☁️', '😊', '🌙', '⚡', '✨', '🤖'].slice(0, showAllBadges ? 10 : 10).map((emoji, i) => (
                        <button
                          key={i}
                          className={`ss-badge-cell${selectedBadge === i ? ' active' : ''}`}
                          onClick={() => setSelectedBadge(i)}
                        >
                          <span style={{ fontSize: 24 }}>{emoji}</span>
                        </button>
                      ))}
                    </div>
                    {!showAllBadges && (
                      <button className="ss-show-all-btn" onClick={() => setShowAllBadges(true)}>
                        Show all badges <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M4 6l4 4 4-4"/></svg>
                      </button>
                    )}
                  </div>

                  {/* Choose Color */}
                  <div className="ss-field">
                    <label className="ss-label" style={{ fontSize: 14 }}>Choose Color</label>
                    <div className="ss-badge-grid">
                      {[
                        '#57f287', '#fee75c', '#ed4245', '#eb459e', '#5865f2',
                        '#3ba55c', '#faa61a', '#f47b67', '#e882c7', '#7289da',
                        '#2d7d46', '#d09215', '#a12d2f', '#ad357a', '#4752c4',
                      ].map((color, i) => (
                        <button
                          key={i}
                          className={`ss-badge-cell ss-color-cell${selectedBadgeColor === i ? ' active' : ''}`}
                          onClick={() => setSelectedBadgeColor(i)}
                        >
                          <span style={{ fontSize: 22, filter: `drop-shadow(0 0 0 ${color})`, color }}>
                            {['🍃', '⚒️', '🌸', '🔥', '☁️', '😊', '🌙', '⚡', '✨', '🤖'][selectedBadge]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Preview chat */}
                <div className="ss-profile-preview ss-tag-preview">
                  <div className="ss-tag-chat-preview">
                    <div className="ss-tag-msg">
                      <div className="ss-tag-msg-avatar" style={{ background: '#5865f2' }}>O</div>
                      <div className="ss-tag-msg-body">
                        <span className="ss-tag-msg-name" style={{ color: '#57f287' }}>Olivia</span>
                        <span className="ss-tag-msg-text">anyone down for aram</span>
                      </div>
                    </div>
                    <div className="ss-tag-msg">
                      <div className="ss-tag-msg-avatar" style={{ background: '#faa61a' }}>K</div>
                      <div className="ss-tag-msg-body">
                        <span className="ss-tag-msg-name" style={{ color: '#faa61a' }}>Kongo</span>
                        <span className="ss-tag-msg-text">count me in</span>
                      </div>
                    </div>
                    <div className="ss-tag-msg">
                      <div className="ss-tag-msg-avatar" style={{ background: '#eb459e' }}>L</div>
                      <div className="ss-tag-msg-body">
                        <span className="ss-tag-msg-name">
                          <span style={{ color: '#eb459e' }}>Lily</span>
                          <span className="ss-tag-badge" style={{ background: '#5865f2' }}>
                            ✦ {tagName || 'WUMP'}
                          </span>
                        </span>
                        <span className="ss-tag-msg-text">check out my tag!</span>
                      </div>
                    </div>
                    <div className="ss-tag-msg">
                      <div className="ss-tag-msg-avatar" style={{ background: '#3ba55c' }}>S</div>
                      <div className="ss-tag-msg-body">
                        <span className="ss-tag-msg-name" style={{ color: '#3ba55c' }}>Sergio</span>
                        <span className="ss-tag-msg-text">woah how did you get that</span>
                      </div>
                    </div>
                    <div className="ss-tag-msg">
                      <div className="ss-tag-msg-avatar" style={{ background: '#eb459e' }}>L</div>
                      <div className="ss-tag-msg-body">
                        <span className="ss-tag-msg-name" style={{ color: '#eb459e' }}>Lily</span>
                        <span className="ss-tag-msg-text">anyone here can get it!</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Engagement ── */}
          {activeSection === 'engagement' && (
            <div className="ss-section">
              <h2>Engagement</h2>
              <p className="ss-subtitle">Manage settings that help keep your server active.</p>

              {/* System Messages */}
              <div className="ss-subsection">
                <h3 className="ss-subsection-title">System Messages</h3>
                <p className="ss-hint" style={{ marginBottom: 16 }}>Configure system event messages sent to your server.</p>

                <div className="ss-toggle-row" style={{ marginBottom: 14 }}>
                  <span className="ss-toggle-label">Send a random welcome message when someone joins this server.</span>
                  <button className={`notif-toggle${sysWelcome ? ' active' : ''}`} onClick={() => setSysWelcome(!sysWelcome)}><span className="notif-toggle-knob" /></button>
                </div>
                <div className="ss-toggle-row" style={{ marginBottom: 14 }}>
                  <span className="ss-toggle-label">Prompt members to reply to welcome messages with a sticker.</span>
                  <button className={`notif-toggle${sysSticker ? ' active' : ''}`} onClick={() => setSysSticker(!sysSticker)}><span className="notif-toggle-knob" /></button>
                </div>
                <div className="ss-toggle-row" style={{ marginBottom: 14 }}>
                  <span className="ss-toggle-label">Send a message when someone boosts this server.</span>
                  <button className={`notif-toggle${sysBoost ? ' active' : ''}`} onClick={() => setSysBoost(!sysBoost)}><span className="notif-toggle-knob" /></button>
                </div>
                <div className="ss-toggle-row" style={{ marginBottom: 14 }}>
                  <span className="ss-toggle-label"><strong>Send helpful tips</strong> for server setup.</span>
                  <button className={`notif-toggle${sysTips ? ' active' : ''}`} onClick={() => setSysTips(!sysTips)}><span className="notif-toggle-knob" /></button>
                </div>

                <div className="ss-toggle-row" style={{ marginBottom: 8 }}>
                  <div>
                    <span className="ss-toggle-label" style={{ fontWeight: 600 }}>System Messages Channel</span>
                    <p className="ss-hint" style={{ margin: '2px 0 0' }}>This is the channel we send system event messages to.</p>
                  </div>
                  <div className="ss-channel-selector">
                    <span className="ss-channel-pill">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#b5bac1"><path d="M5.88 21l1.54-5.22L3 12l6.18-.5L12 6l2.82 5.5L21 12l-4.42 3.78L18.12 21 12 17.77 5.88 21z"/></svg>
                    </span>
                    <select className="ss-select-inline" defaultValue="general">
                      {channels.map(ch => (
                        <option key={ch.id} value={ch.name}># {ch.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="ss-divider" />

              {/* Activity Feed Settings */}
              <div className="ss-subsection">
                <h3 className="ss-subsection-title">Activity Feed Settings</h3>
                <p className="ss-hint" style={{ marginBottom: 16 }}>Shows a feed of activity from games and connected apps in this server.</p>
                <div className="ss-toggle-row">
                  <span className="ss-toggle-label" style={{ fontWeight: 600 }}>Display Activity Feed in this server</span>
                  <button className={`notif-toggle${activityFeed ? ' active' : ''}`} onClick={() => setActivityFeed(!activityFeed)}><span className="notif-toggle-knob" /></button>
                </div>
              </div>

              <div className="ss-divider" />

              {/* Default Notification Settings */}
              <div className="ss-subsection">
                <h3 className="ss-subsection-title">Default Notification Settings</h3>
                <p className="ss-hint" style={{ marginBottom: 16 }}>This will determine whether members who have not explicitly set their notification settings receive a notification for every message sent in this server or not.</p>

                <label className="ss-radio-row">
                  <input type="radio" name="defaultNotif" checked={defaultNotif === 'all'} onChange={() => setDefaultNotif('all')} />
                  <span className="ss-radio-custom" />
                  <span>All Messages</span>
                </label>
                <label className="ss-radio-row">
                  <input type="radio" name="defaultNotif" checked={defaultNotif === 'mentions'} onChange={() => setDefaultNotif('mentions')} />
                  <span className="ss-radio-custom" />
                  <span>Only @mentions</span>
                </label>
                <p className="ss-hint" style={{ marginTop: 4 }}>We highly recommend setting this to only @mentions for a Community Server.</p>
              </div>

              <div className="ss-divider" />

              {/* Inactive Channel & Timeout */}
              <div className="ss-subsection">
                <div className="ss-inline-fields">
                  <div className="ss-inline-field">
                    <label className="ss-label">Inactive Channel</label>
                    <select className="ss-select" value={inactiveChannel} onChange={(e) => setInactiveChannel(e.target.value)}>
                      <option value="none">No Inactive Channel</option>
                      {channels.map(ch => (
                        <option key={ch.id} value={ch.name}># {ch.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="ss-inline-field">
                    <label className="ss-label">Inactive Timeout</label>
                    <select className="ss-select" value={inactiveTimeout} onChange={(e) => setInactiveTimeout(e.target.value)}>
                      <option value="1min">1 minute</option>
                      <option value="5min">5 minutes</option>
                      <option value="15min">15 minutes</option>
                      <option value="30min">30 minutes</option>
                      <option value="1hr">1 hour</option>
                    </select>
                  </div>
                </div>
                <p className="ss-hint" style={{ marginTop: 8 }}>Automatically move members to this channel and mute them when they have been idle for longer than the inactive timeout. This does not affect browsers.</p>
              </div>

              <div className="ss-divider" />

              {/* Server Widget */}
              <div className="ss-subsection">
                <h3 className="ss-subsection-title">Server Widget</h3>
                <p className="ss-hint" style={{ marginBottom: 16 }}>Embed an HTML widget on your website to display your online members, voice channels, and invite link.</p>
                <div className="ss-toggle-row">
                  <span className="ss-toggle-label" style={{ fontWeight: 600 }}>Enable Server Widget</span>
                  <button className={`notif-toggle${serverWidget ? ' active' : ''}`} onClick={() => setServerWidget(!serverWidget)}><span className="notif-toggle-knob" /></button>
                </div>
                <p className="ss-hint" style={{ marginTop: 8 }}>By enabling the widget, your server profile will be visible to others outside of this server. You can control Profile privacy in Server Settings &gt; Profile.</p>
              </div>
            </div>
          )}

          {/* ── Boost Perks ── */}
          {activeSection === 'boostPerks' && (
            <div className="ss-section">
              <div className="ss-profile-layout">
                <div className="ss-profile-main">
                  <h2>Boost Perks</h2>

                  {/* Show Boost progress bar */}
                  <div className="ss-toggle-row" style={{ marginBottom: 4 }}>
                    <span className="ss-toggle-label" style={{ fontWeight: 600 }}>Show Boost progress bar</span>
                    <button className={`notif-toggle${showBoostBar ? ' active' : ''}`} onClick={() => setShowBoostBar(!showBoostBar)}><span className="notif-toggle-knob" /></button>
                  </div>
                  <p className="ss-hint" style={{ marginBottom: 28 }}>This progress bar will display in your channel list, attached to your server name (or server banner if you have one set).</p>

                  <div className="ss-divider" />

                  {/* Server Banner Background */}
                  <div className="ss-boost-perk-row">
                    <div className="ss-boost-perk-info">
                      <h3 className="ss-subsection-title">
                        Server Banner Background
                        <span className="ss-boost-lvl">🔒 LVL 2</span>
                      </h3>
                      <p className="ss-hint">This image will display at the top of your channels list.</p>
                      <p className="ss-hint">The recommended minimum size is 960x540 and recommended aspect ratio is 16:9. <button className="ss-info-link">Learn more</button>.</p>
                      <button className="ss-boost-btn" style={{ marginTop: 12 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z"/></svg>
                        Unlock with Boosting
                      </button>
                    </div>
                    <div className="ss-boost-perk-preview">
                      <div className="ss-boost-img-placeholder">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="#72767d"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
                      </div>
                    </div>
                  </div>

                  <div className="ss-divider" />

                  {/* Server Invite Background */}
                  <div className="ss-boost-perk-row">
                    <div className="ss-boost-perk-info">
                      <h3 className="ss-subsection-title">
                        Server Invite Background
                        <span className="ss-boost-lvl">🔒 LVL 1</span>
                      </h3>
                      <p className="ss-hint">This image will display when your server invite is viewed in a browser, as well as in invite confirmation screens and Server Onboarding.</p>
                      <p className="ss-hint">The recommended minimum size is 1920x1080 and recommended aspect ratio is 16:9. <button className="ss-info-link">Learn more</button></p>
                      <button className="ss-boost-btn" style={{ marginTop: 12 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z"/></svg>
                        Unlock with Boosting
                      </button>
                    </div>
                    <div className="ss-boost-perk-preview">
                      <div className="ss-boost-img-placeholder">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="#72767d"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
                      </div>
                    </div>
                  </div>

                  <div className="ss-divider" />

                  {/* Custom Invite Link */}
                  <div className="ss-boost-perk-section">
                    <h3 className="ss-subsection-title">
                      Custom Invite Link
                      <span className="ss-boost-lvl">🔒 LVL 3</span>
                    </h3>
                    <p className="ss-hint">Bring others to your server easily with your own customized invite link. Heads up though, anyone with the link can join and you'll need at least one text channel that is open to all server members. <button className="ss-info-link">Learn more</button>.</p>
                    <button className="ss-boost-btn" style={{ marginTop: 12 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z"/></svg>
                      Unlock with Boosting
                    </button>
                  </div>
                </div>

                {/* Preview card */}
                <div className="ss-profile-preview">
                  <div className="ss-boost-preview-card">
                    <div className="ss-boost-preview-header">
                      <div className="ss-boost-preview-banner" style={{ background: 'linear-gradient(135deg, #5865f2, #eb459e)' }}>
                        <div className="ss-boost-preview-icons">
                          <span style={{ fontSize: 28 }}>🎮</span>
                        </div>
                      </div>
                      <div className="ss-boost-preview-name">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="#3ba55c"><circle cx="12" cy="12" r="10"/></svg>
                        {groupName || 'Wumpus & Co'}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="#72767d"><path d="M7 10l5 5 5-5H7z"/></svg>
                      </div>
                    </div>
                    <div className="ss-boost-preview-progress">
                      <span className="ss-boost-preview-goal">GOAL: LVL 3</span>
                      <span className="ss-boost-preview-count">10/14 Boosts &gt;</span>
                    </div>
                    <div className="ss-boost-preview-channel">
                      <span className="ss-boost-preview-cat">▾ TEXT CHANNEL</span>
                      <span className="ss-boost-preview-ch"># general</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Emoji ── */}
          {activeSection === 'emoji' && (
            <div className="ss-section">
              <h2>Emoji</h2>
              <p className="ss-subtitle">Add up to 50 custom emoji that anyone can use in this server. Animated GIF emoji may be used by members with Discord Nitro.</p>

              <button className="ss-btn-green" style={{ marginBottom: 16 }}>Upload Emoji</button>

              <p className="ss-hint" style={{ marginBottom: 24 }}>If you want to upload multiple emojis or skip the editor, drag and drop the file(s) onto this page. The emojis will be named using the file name.</p>

              {/* Static Emoji */}
              <div className="ss-emoji-section">
                <h3 className="ss-subsection-title">Emoji</h3>
                <p className="ss-hint">48 slots available</p>

                <div className="ss-emoji-table">
                  <div className="ss-emoji-table-header">
                    <span className="ss-emoji-col-img">Image</span>
                    <span className="ss-emoji-col-name">Name</span>
                    <span className="ss-emoji-col-by">Uploaded By</span>
                  </div>
                  <div className="ss-emoji-table-row">
                    <span className="ss-emoji-col-img"><span style={{ fontSize: 28 }}>😎</span></span>
                    <span className="ss-emoji-col-name">HYVE2</span>
                    <span className="ss-emoji-col-by">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#5865f2" style={{ marginRight: 4 }}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2a7.2 7.2 0 01-6-3.22c.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08a7.2 7.2 0 01-6 3.22z"/></svg>
                      tion45
                    </span>
                  </div>
                  <div className="ss-emoji-table-row">
                    <span className="ss-emoji-col-img"><span style={{ fontSize: 28 }}>😄</span></span>
                    <span className="ss-emoji-col-name">HYVE</span>
                    <span className="ss-emoji-col-by">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#5865f2" style={{ marginRight: 4 }}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2a7.2 7.2 0 01-6-3.22c.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08a7.2 7.2 0 01-6 3.22z"/></svg>
                      tion45
                    </span>
                  </div>
                </div>
              </div>

              {/* Animated Emoji */}
              <div className="ss-emoji-section" style={{ marginTop: 32 }}>
                <h3 className="ss-subsection-title">Animated Emoji</h3>
                <p className="ss-hint">50 slots available</p>
                <div className="ss-emoji-table">
                  <div className="ss-emoji-empty">NONE</div>
                </div>
              </div>
            </div>
          )}

          {/* ── Stickers ── */}
          {activeSection === 'stickers' && (
            <div className="ss-section">
              <h2>Stickers</h2>

              {/* Get Boosted banner */}
              <div className="ss-sticker-banner">
                <div className="ss-sticker-banner-bg">
                  <div className="ss-sticker-banner-content">
                    <h3>Get Boosted</h3>
                    <p>Enjoy more stickers and other perks by boosting your server to Level 1. Each Level unlocks more sticker slots and new benefits for everyone.</p>
                    <div className="ss-sticker-banner-btns">
                      <button className="ss-btn-outline">Boost Server</button>
                      <button className="ss-btn-outline">Learn More</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* No Server Boost notice */}
              <div className="ss-sticker-notice">
                <span className="ss-sticker-dot" style={{ background: '#ed4245' }} />
                <div>
                  <strong>No Server Boost</strong>
                  <p className="ss-hint" style={{ margin: 0 }}>No one has bestowed Boosts to this server yet. See if any members would kindly bless your server for server-wide Boost Perks!</p>
                </div>
              </div>

              {/* Free Slots */}
              <div className="ss-sticker-tier">
                <div className="ss-sticker-tier-header">
                  <div className="ss-sticker-tier-left">
                    <span className="ss-sticker-dot" style={{ background: '#f47fff' }} />
                    <div>
                      <strong style={{ color: '#f2f3f5' }}>Free Slots</strong>
                      <p className="ss-hint" style={{ margin: 0 }}>5 of 5 slots available</p>
                    </div>
                  </div>
                  <button className="ss-btn-green" style={{ fontSize: 12, padding: '6px 14px' }}>Upload Sticker</button>
                </div>
                <div className="ss-sticker-grid">
                  {[0,1,2,3,4].map(i => (
                    <div key={i} className="ss-sticker-slot">
                      <span style={{ fontSize: 32, opacity: 0.3 }}>🎟️</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Level tiers with timeline */}
              <div className="ss-sticker-timeline">
                {[
                  { level: 1, boosts: 2, slots: '+10 Sticker Slots', total: '' },
                  { level: 2, boosts: 7, slots: '+15 Sticker Slots', total: '(30 total)' },
                  { level: 3, boosts: 14, slots: '+30 Sticker Slots', total: '(60 total)' },
                ].map((tier) => (
                  <div key={tier.level} className="ss-sticker-level">
                    <div className="ss-sticker-timeline-dot" />
                    <div className="ss-sticker-level-card">
                      <div className="ss-sticker-level-header">
                        <div className="ss-sticker-level-title">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="#72767d"><circle cx="12" cy="12" r="10" fill="none" stroke="#72767d" strokeWidth="2"/></svg>
                          <span>Level {tier.level}</span>
                        </div>
                        <div className="ss-sticker-level-boosts">
                          {tier.boosts} Boosts
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="#72767d"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/></svg>
                        </div>
                      </div>
                      <div className="ss-sticker-level-body">
                        <span style={{ fontSize: 36, opacity: 0.4 }}>🎟️</span>
                        <p className="ss-sticker-level-slots">{tier.slots} {tier.total}</p>
                        <button className="ss-btn-green" style={{ fontSize: 13, padding: '8px 20px' }}>Buy Level</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Placeholder tabs */}
          {['soundboard', 'invites', 'access', 'integrations', 'appDirectory', 'safetySetup', 'automod', 'community', 'template'].includes(activeSection) && (
            <div className="ss-section">
              <h2>{NAV_SECTIONS.flatMap(s => s.items).find(i => i.key === activeSection)?.label || activeSection}</h2>
              <p className="ss-muted">This feature is coming soon.</p>
            </div>
          )}
        </div>

        {/* Close area */}
        <div className="ss-close-area">
          <button className="ss-close-btn" onClick={onClose}>
            <span className="ss-close-x">✕</span>
            <span className="ss-close-label">ESC</span>
          </button>
        </div>
      </div>
    </div>
  );
}
