// src/components/Email/ComposeEmail.jsx
import { useState } from 'react';
import emailApi from '../../services/emailApi';
import { IconSend, IconClose, IconArrowLeft } from '../Icons/Icons';
import './Webmail.css';

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

          <div className="compose-footer">
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
