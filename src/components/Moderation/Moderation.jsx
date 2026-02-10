// src/components/Moderation/Moderation.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import { formatDate } from '../../utils/date';
import { ShieldIcon, CloseIcon, TrashIcon, CheckIcon, FlagIcon } from '../Icons/Icons';
import './Moderation.css';

const REASON_LABELS = {
  inappropriate: 'Inappropriate Content',
  nsfw: 'NSFW / Sexual Content',
  spam: 'Spam',
  harassment: 'Harassment / Bullying',
  hate_speech: 'Hate Speech',
  violence: 'Violence / Threats',
  illegal: 'Illegal Content',
  other: 'Other',
};

export default function Moderation() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [counts, setCounts] = useState({ pending: 0, reviewed: 0, removed: 0, dismissed: 0 });
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportContent, setReportContent] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('reports');
  const [bannedWallets, setBannedWallets] = useState([]);
  const [bannedLoading, setBannedLoading] = useState(false);
  const [unbanningWallet, setUnbanningWallet] = useState(null);

  useEffect(() => {
    checkAdmin();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadReports();
      loadCounts();
    }
  }, [isAdmin, statusFilter]);

  useEffect(() => {
    if (isAdmin && activeTab === 'banned') {
      loadBannedWallets();
    }
  }, [isAdmin, activeTab]);

  async function checkAdmin() {
    try {
      const admin = await api.checkIsAdmin();
      setIsAdmin(admin);
    } catch (err) {
      console.error('Admin check error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadReports() {
    try {
      const data = await api.getReports(statusFilter);
      setReports(data.reports || []);
    } catch (err) {
      console.error('Load reports error:', err);
    }
  }

  async function loadCounts() {
    try {
      const data = await api.getReportCounts();
      setCounts(data);
    } catch (err) {
      console.error('Load counts error:', err);
    }
  }

  async function loadBannedWallets() {
    try {
      setBannedLoading(true);
      const data = await api.adminGetBannedWallets();
      setBannedWallets(data.banned || []);
    } catch (err) {
      console.error('Load banned wallets error:', err);
    } finally {
      setBannedLoading(false);
    }
  }

  async function handleUnban(walletAddress) {
    if (!confirm(`Are you sure you want to unban wallet ${walletAddress}? They will be able to create a new account.`)) return;
    try {
      setUnbanningWallet(walletAddress);
      await api.adminUnbanWallet(walletAddress);
      setBannedWallets((prev) => prev.filter((b) => b.wallet_address !== walletAddress));
    } catch (err) {
      console.error('Unban error:', err);
      alert(err.message || 'Failed to unban wallet');
    } finally {
      setUnbanningWallet(null);
    }
  }

  async function handleViewReport(report) {
    try {
      const data = await api.getReportDetail(report.id);
      setSelectedReport(data.report);
      setReportContent(data.content);
      setAdminNotes('');
      setMessage('');
    } catch (err) {
      console.error('View report error:', err);
    }
  }

  async function handleAction(action) {
    if (!selectedReport) return;
    try {
      setProcessing(true);
      await api.actionReport(selectedReport.id, action, adminNotes);
      setMessage(action === 'remove' ? 'Content removed successfully.' : 'Report dismissed.');
      setTimeout(() => {
        setSelectedReport(null);
        setReportContent(null);
        setMessage('');
        loadReports();
        loadCounts();
      }, 1500);
    } catch (err) {
      setMessage(err.message || 'Failed to process report');
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="moderation-page">
        <div className="moderation-loading">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="moderation-page">
        <div className="moderation-denied">
          <ShieldIcon size={48} />
          <h2>Access Denied</h2>
          <p>You do not have admin permissions to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="moderation-page">
      <div className="moderation-tabs">
        <button
          className={`mod-tab${activeTab === 'reports' ? ' active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          <FlagIcon size={16} /> Reports
        </button>
        <button
          className={`mod-tab${activeTab === 'banned' ? ' active' : ''}`}
          onClick={() => setActiveTab('banned')}
        >
          <ShieldIcon size={16} /> Banned Wallets{bannedWallets.length > 0 ? ` (${bannedWallets.length})` : ''}
        </button>
      </div>

      {activeTab === 'reports' && (<>
      <div className="moderation-header">
        <div className="moderation-title">
          <FlagIcon size={24} />
          <h1>Content Reports</h1>
        </div>
        <div className="moderation-counts">
          <button
            className={`count-badge${statusFilter === 'pending' ? ' active' : ''}${counts.pending > 0 ? ' has-items' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            Pending <span>{counts.pending}</span>
          </button>
          <button
            className={`count-badge${statusFilter === 'removed' ? ' active' : ''}`}
            onClick={() => setStatusFilter('removed')}
          >
            Removed <span>{counts.removed}</span>
          </button>
          <button
            className={`count-badge${statusFilter === 'dismissed' ? ' active' : ''}`}
            onClick={() => setStatusFilter('dismissed')}
          >
            Dismissed <span>{counts.dismissed}</span>
          </button>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="moderation-empty">
          <FlagIcon size={40} />
          <p>No {statusFilter} reports.</p>
        </div>
      ) : (
        <div className="reports-list">
          {reports.map((report) => (
            <div key={report.id} className="report-card" onClick={() => handleViewReport(report)}>
              <div className="report-card-left">
                <div className={`report-type-badge ${report.content_type}`}>
                  {report.content_type}
                </div>
                <div className="report-info">
                  <div className="report-reason">
                    {REASON_LABELS[report.reason] || report.reason}
                  </div>
                  <div className="report-meta">
                    Reported by <strong>{report.reporter_username || 'Unknown'}</strong>
                    {' · '}
                    {formatDate(report.created_at)}
                  </div>
                  {report.details && (
                    <div className="report-details-preview">
                      {report.details.length > 100 ? report.details.slice(0, 100) + '...' : report.details}
                    </div>
                  )}
                </div>
              </div>
              <div className="report-card-right">
                <span className={`report-status-badge ${report.status}`}>{report.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      </>)}

      {activeTab === 'banned' && (
        <div className="banned-wallets-section">
          <div className="moderation-header">
            <div className="moderation-title">
              <ShieldIcon size={24} />
              <h1>Banned Wallets</h1>
            </div>
          </div>
          {bannedLoading ? (
            <div className="moderation-loading">Loading banned wallets...</div>
          ) : bannedWallets.length === 0 ? (
            <div className="moderation-empty">
              <ShieldIcon size={40} />
              <p>No banned wallets.</p>
            </div>
          ) : (
            <div className="banned-list">
              {bannedWallets.map((ban) => (
                <div key={ban.wallet_address} className="banned-card">
                  <div className="banned-card-info">
                    <div className="banned-wallet-address">
                      {ban.wallet_address}
                    </div>
                    <div className="banned-meta">
                      Banned by <strong>{ban.banned_by_username || ban.banned_by || 'Admin'}</strong>
                      {' · '}
                      {formatDate(ban.banned_at)}
                    </div>
                    {ban.reason && (
                      <div className="banned-reason">{ban.reason}</div>
                    )}
                  </div>
                  <button
                    className="btn-unban"
                    onClick={() => handleUnban(ban.wallet_address)}
                    disabled={unbanningWallet === ban.wallet_address}
                  >
                    {unbanningWallet === ban.wallet_address ? 'Unbanning...' : 'Remove Ban'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedReport && (
        <div className="report-detail-overlay" onClick={() => { setSelectedReport(null); setReportContent(null); }}>
          <div className="report-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="report-detail-header">
              <h2>Report #{selectedReport.id}</h2>
              <button className="close-btn" onClick={() => { setSelectedReport(null); setReportContent(null); }}>
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="report-detail-body">
              <div className="report-detail-section">
                <h3>Report Information</h3>
                <div className="report-detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Type</span>
                    <span className={`report-type-badge ${selectedReport.content_type}`}>
                      {selectedReport.content_type}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Reason</span>
                    <span>{REASON_LABELS[selectedReport.reason] || selectedReport.reason}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Reported by</span>
                    <span>{selectedReport.reporter_username || 'Unknown'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Date</span>
                    <span>{formatDate(selectedReport.created_at)}</span>
                  </div>
                </div>
                {selectedReport.details && (
                  <div className="detail-full-text">
                    <span className="detail-label">Details</span>
                    <p>{selectedReport.details}</p>
                  </div>
                )}
              </div>

              <div className="report-detail-section">
                <h3>Reported Content</h3>
                {reportContent ? (
                  <div className="reported-content-preview">
                    {/* Post content */}
                    {selectedReport.content_type === 'post' && (
                      <div className="content-card">
                        <div className="content-card-header">
                          <strong>{reportContent.username || 'Unknown'}</strong>
                        </div>
                        {reportContent.content && (
                          <p className="content-text">{reportContent.content}</p>
                        )}
                        {reportContent.image_url && (
                          <div className="content-image">
                            <img src={reportContent.image_url} alt="Reported content" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Comment content */}
                    {selectedReport.content_type === 'comment' && (
                      <div className="content-card">
                        <div className="content-card-header">
                          <strong>{reportContent.username || 'Unknown'}</strong> commented:
                        </div>
                        {reportContent.content && (
                          <p className="content-text">{reportContent.content}</p>
                        )}
                        {reportContent.media_url && (
                          <div className="content-image">
                            <img src={reportContent.media_url} alt="Reported content" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Story content */}
                    {selectedReport.content_type === 'story' && (
                      <div className="content-card">
                        <div className="content-card-header">
                          <strong>{reportContent.username || 'Unknown'}</strong>&apos;s story
                        </div>
                        {reportContent.media_url && (
                          <div className="content-image">
                            <img src={reportContent.media_url} alt="Reported story" />
                          </div>
                        )}
                        {reportContent.text && <p className="content-text">{reportContent.text}</p>}
                      </div>
                    )}

                    {/* Profile content */}
                    {selectedReport.content_type === 'profile' && (
                      <div className="content-card">
                        <div className="content-card-header">
                          <strong>{reportContent.username || 'Unknown'}</strong>&apos;s profile
                        </div>
                        {reportContent.profile_image && (
                          <div className="content-image">
                            <img src={reportContent.profile_image} alt="Profile" />
                          </div>
                        )}
                        {reportContent.bio && <p className="content-text">{reportContent.bio}</p>}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="content-deleted">Content has been deleted or is no longer available.</p>
                )}
              </div>

              {selectedReport.status === 'pending' && (
                <div className="report-detail-section">
                  <h3>Admin Action</h3>
                  <textarea
                    className="admin-notes"
                    placeholder="Add admin notes (optional)..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows="2"
                  />
                  {message && <div className="action-message">{message}</div>}
                  <div className="action-buttons">
                    <button
                      className="btn-danger"
                      onClick={() => handleAction('remove')}
                      disabled={processing}
                    >
                      <TrashIcon size={16} /> {processing ? 'Processing...' : 'Remove Content'}
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => handleAction('dismiss')}
                      disabled={processing}
                    >
                      <CheckIcon size={16} /> Dismiss Report
                    </button>
                  </div>
                </div>
              )}

              {selectedReport.status !== 'pending' && (
                <div className="report-detail-section">
                  <h3>Resolution</h3>
                  <div className="report-detail-grid">
                    <div className="detail-item">
                      <span className="detail-label">Status</span>
                      <span className={`report-status-badge ${selectedReport.status}`}>{selectedReport.status}</span>
                    </div>
                    {selectedReport.reviewer_username && (
                      <div className="detail-item">
                        <span className="detail-label">Reviewed by</span>
                        <span>{selectedReport.reviewer_username}</span>
                      </div>
                    )}
                    {selectedReport.admin_notes && (
                      <div className="detail-full-text">
                        <span className="detail-label">Admin Notes</span>
                        <p>{selectedReport.admin_notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
