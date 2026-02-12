// src/components/Email/ComposeEmail.jsx
import { useState, useRef } from 'react';
import emailApi from '../../services/emailApi';
import { IconSend, IconClose, IconArrowLeft } from '../Icons/Icons';
import './Webmail.css';

function IconAttach({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function ComposeEmail({ account, replyTo, onClose, onSent }) {
  const [to, setTo] = useState(replyTo ? (replyTo.from || '') : '');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject || ''}` : '');
  const [body, setBody] = useState(
    replyTo
      ? `\n\n--- Original Message ---\nFrom: ${replyTo.fromName || replyTo.from}\nDate: ${replyTo.date}\n\n${replyTo.body || ''}`
      : ''
  );
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [attachments, setAttachments] = useState([]);
  const fileInputRef = useRef(null);

  function handleAttach() {
    fileInputRef.current?.click();
  }

  function handleFilesSelected(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Check total size (25MB limit)
    const currentSize = attachments.reduce((sum, f) => sum + f.size, 0);
    const newSize = files.reduce((sum, f) => sum + f.size, 0);
    if (currentSize + newSize > 25 * 1024 * 1024) {
      setError('Total attachments cannot exceed 25 MB');
      return;
    }

    setAttachments(prev => [...prev, ...files]);
    // Reset input so the same file can be re-added if removed
    e.target.value = '';
  }

  function removeAttachment(index) {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!to.trim()) {
      setError('Please enter a recipient');
      return;
    }
    if (!subject.trim() && !window.confirm('Send without a subject?')) {
      return;
    }

    setSending(true);
    setError('');

    try {
      await emailApi.sendEmail({
        to: to.split(',').map((s) => s.trim()).filter(Boolean),
        cc: cc ? cc.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        bcc: bcc ? bcc.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        subject,
        body,
        attachments: attachments.length > 0 ? attachments : undefined,
        replyTo: replyTo?.id,
      });
      onSent();
    } catch (err) {
      setError(err.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  }

  async function handleSaveDraft() {
    try {
      await emailApi.saveDraft({
        to: to.split(',').map((s) => s.trim()).filter(Boolean),
        cc: cc ? cc.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        bcc: bcc ? bcc.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        subject,
        body,
      });
      onClose();
    } catch (err) {
      console.error('Failed to save draft:', err);
    }
  }

  return (
    <div className="compose-overlay">
      <div className="compose-window">
        <div className="compose-header">
          <div className="compose-header-left">
            <button className="compose-back-btn" onClick={onClose}>
              <IconArrowLeft size={18} />
            </button>
            <h3>{replyTo ? 'Reply' : 'New Message'}</h3>
          </div>
          <div className="compose-header-actions">
            <button className="compose-draft-btn" onClick={handleSaveDraft} title="Save as draft">
              Save Draft
            </button>
            <button className="compose-close-btn" onClick={onClose}>
              <IconClose size={18} />
            </button>
          </div>
        </div>

        {error && <div className="compose-error">{error}</div>}

        <form className="compose-form" onSubmit={handleSend}>
          <div className="compose-field">
            <label>From</label>
            <span className="compose-from">{account?.email || 'you@hyvechain.com'}</span>
          </div>

          <div className="compose-field">
            <label>To</label>
            <input
              type="text"
              placeholder="recipient@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              autoFocus={!replyTo}
            />
            {!showCcBcc && (
              <button
                type="button"
                className="cc-toggle"
                onClick={() => setShowCcBcc(true)}
              >
                Cc / Bcc
              </button>
            )}
          </div>

          {showCcBcc && (
            <>
              <div className="compose-field">
                <label>Cc</label>
                <input
                  type="text"
                  placeholder="cc@example.com"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                />
              </div>
              <div className="compose-field">
                <label>Bcc</label>
                <input
                  type="text"
                  placeholder="bcc@example.com"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="compose-field">
            <label>Subject</label>
            <input
              type="text"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              autoFocus={!!replyTo}
            />
          </div>

          <textarea
            className="compose-body"
            placeholder="Write your message..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={16}
          />

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={handleFilesSelected}
          />

          {/* Attachment list */}
          {attachments.length > 0 && (
            <div className="compose-attachments">
              <div className="compose-att-header">
                <IconAttach size={14} />
                <span>{attachments.length} attachment{attachments.length > 1 ? 's' : ''}</span>
                <span className="compose-att-total">
                  ({formatFileSize(attachments.reduce((sum, f) => sum + f.size, 0))})
                </span>
              </div>
              <div className="compose-att-list">
                {attachments.map((file, i) => (
                  <div key={i} className="compose-att-item">
                    <span className="compose-att-name" title={file.name}>{file.name}</span>
                    <span className="compose-att-size">{formatFileSize(file.size)}</span>
                    <button
                      type="button"
                      className="compose-att-remove"
                      onClick={() => removeAttachment(i)}
                      title="Remove"
                    >
                      <IconClose size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="compose-footer">
            <button type="button" className="attach-btn" onClick={handleAttach} title="Attach files">
              <IconAttach size={16} />
              Attach
            </button>
            <button type="submit" className="send-btn" disabled={sending}>
              {sending ? (
                <span className="send-loading">
                  <span className="send-spinner" />
                  Sending...
                </span>
              ) : (
                <>
                  <IconSend size={16} />
                  Send
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
