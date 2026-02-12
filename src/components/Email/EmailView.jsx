// src/components/Email/EmailView.jsx
import { useState } from 'react';
import { IconArrowLeft, IconTrash, IconSend } from '../Icons/Icons';
import emailApi from '../../services/emailApi';
import './Webmail.css';

function IconDownload(props) {
  const size = props.size || 20;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function formatAttSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function IconReply(props) {
  const size = props.size || 20;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

function IconForward(props) {
  const size = props.size || 20;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 17 20 12 15 7" />
      <path d="M4 18v-2a4 4 0 0 1 4-4h12" />
    </svg>
  );
}

function IconStar(props) {
  const size = props.size || 20;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={props.filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export default function EmailView({ message, folder, onBack, onReply, onDelete, onStar, formatDate, getInitials, getAvatarColor }) {
  const [downloading, setDownloading] = useState(null);

  async function handleDownload(att, index) {
    try {
      setDownloading(index);
      const blobUrl = await emailApi.downloadAttachment(message.id, att.index ?? index, folder || 'inbox');
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = att.filename || 'attachment';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(null);
    }
  }
  return (
    <div className="email-view">
      <div className="email-view-toolbar">
        <button className="ev-back-btn" onClick={onBack}>
          <IconArrowLeft size={18} />
          <span>Back</span>
        </button>
        <div className="ev-actions">
          <button className="ev-action-btn" onClick={onReply} title="Reply">
            <IconReply size={18} />
          </button>
          <button
            className={`ev-action-btn ${message.starred ? 'starred' : ''}`}
            onClick={() => onStar(!message.starred)}
            title={message.starred ? 'Unstar' : 'Star'}
          >
            <IconStar size={18} filled={message.starred} />
          </button>
          <button className="ev-action-btn delete" onClick={onDelete} title="Delete">
            <IconTrash size={18} />
          </button>
        </div>
      </div>

      <div className="email-view-content">
        <h1 className="ev-subject">{message.subject || '(no subject)'}</h1>

        <div className="ev-sender-row">
          <div className="ev-sender-avatar" style={{ background: getAvatarColor(message.from) }}>
            {getInitials(message.fromName || message.from)}
          </div>
          <div className="ev-sender-info">
            <div className="ev-sender-name">
              {message.fromName || message.from}
              <span className="ev-sender-email">&lt;{message.from}&gt;</span>
            </div>
            <div className="ev-meta">
              <span>To: {message.to?.join(', ') || 'me'}</span>
              <span className="ev-date">{formatDate(message.date)}</span>
            </div>
          </div>
        </div>

        {message.cc && message.cc.length > 0 && (
          <div className="ev-cc">Cc: {message.cc.join(', ')}</div>
        )}

        <div className="ev-body">
          {message.html ? (
            <div dangerouslySetInnerHTML={{ __html: message.html }} />
          ) : (
            <pre className="ev-body-text">{message.body || ''}</pre>
          )}
        </div>

        {message.attachments && message.attachments.length > 0 && (
          <div className="ev-attachments">
            <h4>Attachments ({message.attachments.length})</h4>
            <div className="ev-attachment-list">
              {message.attachments.map((att, i) => (
                <button
                  key={i}
                  className="ev-attachment"
                  onClick={() => handleDownload(att, i)}
                  disabled={downloading === i}
                >
                  <IconDownload size={14} />
                  <span className="ev-att-name">{att.filename}</span>
                  <span className="ev-att-size">{formatAttSize(att.size)}</span>
                  {downloading === i && <span className="ev-att-downloading">...</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="ev-reply-bar">
        <button className="ev-reply-btn" onClick={() => onReply(message)}>
          <IconReply size={16} />
          Reply
        </button>
        <button className="ev-forward-btn" onClick={() => onReply({ ...message, subject: `Fwd: ${message.subject}` })}>
          <IconForward size={16} />
          Forward
        </button>
      </div>
    </div>
  );
}
