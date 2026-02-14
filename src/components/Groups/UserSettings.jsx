import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import './UserSettings.css';

const SECTIONS = [
  { key: 'account', label: 'My Account', category: 'User Settings' },
  { key: 'profile', label: 'Edit Profile', category: 'User Settings' },
  { key: 'status', label: 'Custom Status', category: 'User Settings' },
  { key: 'activity', label: 'Activity Status', category: 'User Settings' },
  { key: 'appearance', label: 'Appearance', category: 'App Settings' },
  { key: 'notifications', label: 'Notifications', category: 'App Settings' },
  { key: 'about', label: 'About', category: 'App Settings' },
];

export default function UserSettings({ onClose }) {
  const { user, setUser, logout } = useAuth();
  const [activeSection, setActiveSection] = useState('account');
  const [bio, setBio] = useState(user?.bio || '');
  const [editingBio, setEditingBio] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [lightMode, setLightMode] = useState(() => document.body.classList.contains('light-mode'));
  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  // Custom status state
  const [statusText, setStatusText] = useState('');
  const [statusEmoji, setStatusEmoji] = useState('😊');
  const [statusExpiry, setStatusExpiry] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);

  // Activity status state
  const [activityType, setActivityType] = useState('');
  const [activityName, setActivityName] = useState('');
  const [activityDetails, setActivityDetails] = useState('');

  // User preferences
  const [compactMode, setCompactMode] = useState(() => localStorage.getItem('hyve-compact') === 'true');
  const [replyPingDefault, setReplyPingDefault] = useState(true);

  // Load custom status
  useEffect(() => {
    if (activeSection === 'status') {
      (async () => {
        setStatusLoading(true);
        try {
          const data = await api.getUserStatus(user?.username);
          setStatusText(data?.custom_status || '');
          setStatusEmoji(data?.status_emoji || '😊');
        } catch { }
        finally { setStatusLoading(false); }
      })();
    }
  }, [activeSection, user?.username]);

  const handleSaveStatus = async () => {
    setSaving(true);
    try {
      await api.updateCustomStatus({ customStatus: statusText, statusEmoji, expiresAt: statusExpiry || null });
      showNotice('Status updated!');
    } catch { showNotice('Failed to update status.'); }
    finally { setSaving(false); }
  };

  const handleClearStatus = async () => {
    setSaving(true);
    try {
      await api.updateCustomStatus({ customStatus: '', statusEmoji: '', expiresAt: null });
      setStatusText('');
      setStatusEmoji('😊');
      setStatusExpiry('');
      showNotice('Status cleared!');
    } catch { showNotice('Failed to clear status.'); }
    finally { setSaving(false); }
  };

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

  const handleSaveBio = async () => {
    setSaving(true);
    try {
      await api.updateProfile({ bio });
      setUser((prev) => ({ ...prev, bio }));
      setEditingBio(false);
      showNotice('Bio updated!');
    } catch (err) {
      showNotice('Failed to update bio.');
    } finally { setSaving(false); }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > 5 * 1024 * 1024) { showNotice('Max 5 MB'); return; }
    setSaving(true);
    try {
      const base64 = await fileToBase64(file);
      await api.updateProfile({ profileImage: base64 });
      setUser((prev) => ({ ...prev, profile_image: base64, profileImage: base64 }));
      showNotice('Avatar updated!');
    } catch { showNotice('Failed to update avatar.'); }
    finally { setSaving(false); }
  };

  const handleBannerChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > 5 * 1024 * 1024) { showNotice('Max 5 MB'); return; }
    setSaving(true);
    try {
      const base64 = await fileToBase64(file);
      await api.updateProfile({ coverImage: base64 });
      setUser((prev) => ({ ...prev, cover_image: base64, coverImage: base64 }));
      showNotice('Banner updated!');
    } catch { showNotice('Failed to update banner.'); }
    finally { setSaving(false); }
  };

  const toggleLightMode = () => {
    const next = !lightMode;
    setLightMode(next);
    if (next) {
      document.body.classList.add('light-mode');
      localStorage.setItem('hyve-theme', 'light');
    } else {
      document.body.classList.remove('light-mode');
      localStorage.setItem('hyve-theme', 'dark');
    }
  };

  const handleLogout = () => {
    logout();
    onClose();
  };

  function showNotice(msg) {
    setNotice(msg);
    setTimeout(() => setNotice(''), 3000);
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const avatarUrl = user?.profile_image || user?.profileImage || '/default-avatar.png';
  const bannerUrl = user?.cover_image || user?.coverImage;
  const username = user?.username || 'Unknown';
  const walletAddress = user?.wallet_address || user?.walletAddress || '';
  const email = user?.email || '';

  // Group sections by category
  const categories = [];
  let lastCat = null;
  for (const s of SECTIONS) {
    if (s.category !== lastCat) {
      categories.push({ category: s.category, items: [] });
      lastCat = s.category;
    }
    categories[categories.length - 1].items.push(s);
  }

  return (
    <div className="us-overlay" onClick={onClose}>
      <div className="us-modal" onClick={(e) => e.stopPropagation()}>
        {/* Sidebar */}
        <div className="us-sidebar">
          <div className="us-sidebar-scroll">
            {categories.map((cat) => (
              <div key={cat.category} className="us-nav-category">
                <div className="us-nav-category-label">{cat.category}</div>
                {cat.items.map((item) => (
                  <button
                    key={item.key}
                    className={`us-nav-item${activeSection === item.key ? ' active' : ''}`}
                    onClick={() => setActiveSection(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
            <div className="us-nav-separator" />
            <button className="us-nav-item us-logout-btn" onClick={handleLogout}>
              Log Out
              <span className="us-logout-icon">⏻</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="us-content">
          <button className="us-close-btn" onClick={onClose}>
            <span className="us-close-x">✕</span>
            <span className="us-close-label">ESC</span>
          </button>

          {notice && <div className="us-notice">{notice}</div>}

          {/* ── My Account ── */}
          {activeSection === 'account' && (
            <div className="us-section">
              <h2>My Account</h2>

              {/* Profile card */}
              <div className="us-profile-card">
                <div className="us-banner" onClick={() => bannerInputRef.current?.click()}>
                  {bannerUrl ? <img src={bannerUrl} alt="" /> : null}
                  <div className="us-banner-hover">Change Banner</div>
                </div>
                <input type="file" ref={bannerInputRef} accept="image/*" style={{ display: 'none' }} onChange={handleBannerChange} />

                <div className="us-profile-row">
                  <div className="us-avatar-large" onClick={() => avatarInputRef.current?.click()}>
                    <img src={avatarUrl} alt="" onError={(e) => { e.target.src = '/default-avatar.png'; }} />
                    <div className="us-avatar-hover">Edit</div>
                  </div>
                  <input type="file" ref={avatarInputRef} accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
                  <span className="us-profile-username">{username}</span>
                </div>

                <div className="us-info-grid">
                  <div className="us-info-row">
                    <div className="us-info-label">Display Name</div>
                    <div className="us-info-value">{username}</div>
                  </div>
                  <div className="us-info-row">
                    <div className="us-info-label">Username</div>
                    <div className="us-info-value">{username}</div>
                  </div>
                  {email && (
                    <div className="us-info-row">
                      <div className="us-info-label">Email</div>
                      <div className="us-info-value">{email}</div>
                    </div>
                  )}
                  <div className="us-info-row">
                    <div className="us-info-label">Wallet Address</div>
                    <div className="us-info-value us-wallet">
                      {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Not connected'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Edit Profile ── */}
          {activeSection === 'profile' && (
            <div className="us-section">
              <h2>Edit Profile</h2>
              <div className="us-profile-card">
                <div className="us-field-group">
                  <label>Avatar</label>
                  <div className="us-avatar-edit-row">
                    <img src={avatarUrl} alt="" className="us-avatar-sm" onError={(e) => { e.target.src = '/default-avatar.png'; }} />
                    <button className="us-btn-small" onClick={() => avatarInputRef.current?.click()} disabled={saving}>Change Avatar</button>
                  </div>
                </div>

                <div className="us-field-group">
                  <label>Bio</label>
                  {editingBio ? (
                    <div className="us-bio-edit">
                      <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={300} />
                      <div className="us-bio-actions">
                        <button className="us-btn-save" onClick={handleSaveBio} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="us-btn-cancel" onClick={() => { setEditingBio(false); setBio(user?.bio || ''); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="us-bio-display">
                      <span>{user?.bio || 'No bio set.'}</span>
                      <button className="us-btn-small" onClick={() => setEditingBio(true)}>Edit</button>
                    </div>
                  )}
                </div>

                <div className="us-field-group">
                  <label>Banner</label>
                  <div className="us-banner-preview">
                    {bannerUrl ? <img src={bannerUrl} alt="" /> : <span className="us-empty-banner">No banner</span>}
                    <button className="us-btn-small" onClick={() => bannerInputRef.current?.click()} disabled={saving}>Change Banner</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Custom Status ── */}
          {activeSection === 'status' && (
            <div className="us-section">
              <h2>Custom Status</h2>
              <p className="us-muted">Set a custom status to let others know what you're up to.</p>
              {statusLoading ? <p className="us-muted">Loading...</p> : (
                <div className="us-profile-card">
                  <div className="us-field-group">
                    <label>Status Emoji</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {['😊', '😎', '🎮', '💻', '🎵', '📚', '🌙', '🔴', '🟡', '🟢', '⏰', '✈️'].map(em => (
                        <button key={em} onClick={() => setStatusEmoji(em)} style={{ fontSize: 24, padding: '4px 8px', background: statusEmoji === em ? '#5865f2' : '#2b2d31', border: 'none', borderRadius: 6, cursor: 'pointer' }}>{em}</button>
                      ))}
                    </div>
                  </div>
                  <div className="us-field-group">
                    <label>Status Text</label>
                    <input type="text" className="us-input" placeholder="What are you up to?" value={statusText} onChange={e => setStatusText(e.target.value)} maxLength={128} style={{ width: '100%' }} />
                  </div>
                  <div className="us-field-group">
                    <label>Clear After</label>
                    <select className="us-input" value={statusExpiry} onChange={e => setStatusExpiry(e.target.value)} style={{ width: '100%' }}>
                      <option value="">Don't clear</option>
                      <option value="30m">30 minutes</option>
                      <option value="1h">1 hour</option>
                      <option value="4h">4 hours</option>
                      <option value="today">Today</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button className="us-btn-save" onClick={handleSaveStatus} disabled={saving}>{saving ? 'Saving...' : 'Save Status'}</button>
                    <button className="us-btn-cancel" onClick={handleClearStatus} disabled={saving}>Clear Status</button>
                  </div>
                  {statusText && (
                    <div style={{ marginTop: 16, padding: '10px 14px', background: '#2b2d31', borderRadius: 8 }}>
                      <span style={{ marginRight: 8 }}>{statusEmoji}</span>
                      <span style={{ color: '#dbdee1' }}>{statusText}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Appearance ── */}
          {activeSection === 'appearance' && (
            <div className="us-section">
              <h2>Appearance</h2>
              <div className="us-profile-card">
                <div className="us-field-group">
                  <label>Theme</label>
                  <div className="us-theme-options">
                    <button
                      className={`us-theme-btn${!lightMode ? ' active' : ''}`}
                      onClick={() => { if (lightMode) toggleLightMode(); }}
                    >
                      <span className="us-theme-preview us-theme-dark" />
                      <span>Dark</span>
                    </button>
                    <button
                      className={`us-theme-btn${lightMode ? ' active' : ''}`}
                      onClick={() => { if (!lightMode) toggleLightMode(); }}
                    >
                      <span className="us-theme-preview us-theme-light" />
                      <span>Light</span>
                    </button>
                  </div>
                </div>
                <div className="us-field-group" style={{ marginTop: 16 }}>
                  <label>Compact Mode</label>
                  <p className="us-muted" style={{ marginBottom: 8 }}>Reduce spacing between messages for a denser layout.</p>
                  <button
                    className={`us-toggle-btn${compactMode ? ' active' : ''}`}
                    onClick={() => {
                      const next = !compactMode;
                      setCompactMode(next);
                      localStorage.setItem('hyve-compact', next ? 'true' : 'false');
                      document.body.classList.toggle('compact-mode', next);
                      api.updateUserPreferences({ compact_mode: next }).catch(() => {});
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', background: compactMode ? '#5865f2' : '#4e5058', border: 'none', borderRadius: 14, color: '#fff', cursor: 'pointer', fontSize: 14 }}
                  >
                    <span style={{ width: 20, height: 20, borderRadius: '50%', background: compactMode ? '#fff' : '#80848e', transition: 'all .2s', transform: compactMode ? 'translateX(12px)' : 'translateX(0)' }} />
                    {compactMode ? 'On' : 'Off'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Activity Status ── */}
          {activeSection === 'activity' && (
            <div className="us-section">
              <h2>Activity Status</h2>
              <p className="us-muted">Let others see what you're doing.</p>
              <div className="us-profile-card">
                <div className="us-field-group">
                  <label>Activity Type</label>
                  <select className="us-input" value={activityType} onChange={e => setActivityType(e.target.value)} style={{ width: '100%' }}>
                    <option value="">None</option>
                    <option value="playing">Playing</option>
                    <option value="listening">Listening to</option>
                    <option value="watching">Watching</option>
                    <option value="streaming">Streaming</option>
                    <option value="competing">Competing in</option>
                  </select>
                </div>
                {activityType && (
                  <>
                    <div className="us-field-group">
                      <label>Activity Name</label>
                      <input type="text" className="us-input" placeholder="e.g. Minecraft" value={activityName} onChange={e => setActivityName(e.target.value)} maxLength={128} style={{ width: '100%' }} />
                    </div>
                    <div className="us-field-group">
                      <label>Details (optional)</label>
                      <input type="text" className="us-input" placeholder="e.g. Building a castle" value={activityDetails} onChange={e => setActivityDetails(e.target.value)} maxLength={128} style={{ width: '100%' }} />
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button className="us-btn-save" onClick={async () => {
                    setSaving(true);
                    try {
                      await api.updateActivityStatus(activityType || null, activityName || null, activityDetails || null);
                      showNotice('Activity updated!');
                    } catch { showNotice('Failed to update activity.'); }
                    finally { setSaving(false); }
                  }} disabled={saving}>{saving ? 'Saving...' : 'Save Activity'}</button>
                  <button className="us-btn-cancel" onClick={async () => {
                    setSaving(true);
                    try {
                      await api.updateActivityStatus(null, null, null);
                      setActivityType(''); setActivityName(''); setActivityDetails('');
                      showNotice('Activity cleared!');
                    } catch { showNotice('Failed to clear activity.'); }
                    finally { setSaving(false); }
                  }} disabled={saving}>Clear</button>
                </div>
                {activityType && activityName && (
                  <div style={{ marginTop: 16, padding: '10px 14px', background: '#2b2d31', borderRadius: 8, color: '#dbdee1' }}>
                    <span style={{ color: '#949ba4', textTransform: 'capitalize' }}>{activityType}</span>{' '}
                    <strong>{activityName}</strong>
                    {activityDetails && <span style={{ color: '#949ba4' }}> — {activityDetails}</span>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Notifications ── */}
          {activeSection === 'notifications' && (
            <div className="us-section">
              <h2>Notifications</h2>
              <div className="us-profile-card">
                <div className="us-field-group">
                  <label>Desktop Notifications</label>
                  <p className="us-muted">Browser notifications are managed in your browser settings.</p>
                </div>
                <div className="us-field-group">
                  <label>Reply Ping Default</label>
                  <p className="us-muted" style={{ marginBottom: 8 }}>When replying to a message, mention the author by default.</p>
                  <button
                    className={`us-toggle-btn${replyPingDefault ? ' active' : ''}`}
                    onClick={() => {
                      const next = !replyPingDefault;
                      setReplyPingDefault(next);
                      api.updateUserPreferences({ reply_ping: next }).catch(() => {});
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', background: replyPingDefault ? '#5865f2' : '#4e5058', border: 'none', borderRadius: 14, color: '#fff', cursor: 'pointer', fontSize: 14 }}
                  >
                    <span style={{ width: 20, height: 20, borderRadius: '50%', background: replyPingDefault ? '#fff' : '#80848e', transition: 'all .2s', transform: replyPingDefault ? 'translateX(12px)' : 'translateX(0)' }} />
                    {replyPingDefault ? 'On' : 'Off'}
                  </button>
                </div>
                <div className="us-field-group">
                  <label>Message Sounds</label>
                  <p className="us-muted">Sound settings coming soon.</p>
                </div>
              </div>
            </div>
          )}

          {/* ── About ── */}
          {activeSection === 'about' && (
            <div className="us-section">
              <h2>About</h2>
              <div className="us-profile-card">
                <div className="us-about-item">
                  <span className="us-about-label">Platform</span>
                  <span className="us-about-value">Hyve Social</span>
                </div>
                <div className="us-about-item">
                  <span className="us-about-label">Network</span>
                  <span className="us-about-value">Hyve Chain</span>
                </div>
                <div className="us-about-item">
                  <span className="us-about-label">Version</span>
                  <span className="us-about-value">2.0.0</span>
                </div>
                <div className="us-about-item">
                  <span className="us-about-label">Website</span>
                  <a href="https://hyvechain.com" target="_blank" rel="noopener noreferrer" className="us-about-link">hyvechain.com</a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
