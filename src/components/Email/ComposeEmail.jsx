// src/components/Email/ComposeEmail.jsx
import { useState, useRef, useEffect, useCallback } from 'react';
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

/* ── Contact memory helpers ── */
const CONTACTS_KEY = 'hyve_email_contacts';

function loadContacts() {
  try {
    const raw = localStorage.getItem(CONTACTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveContacts(list) {
  try {
    // dedupe, keep most recent first, cap at 200
    const seen = new Set();
    const unique = [];
    for (const c of list) {
      const key = c.email.toLowerCase();
      if (!seen.has(key)) { seen.add(key); unique.push(c); }
    }
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(unique.slice(0, 200)));
  } catch { /* quota */ }
}

function rememberEmails(emails) {
  if (!emails?.length) return;
  const existing = loadContacts();
  const now = Date.now();
  const newEntries = emails
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
    .map(email => ({ email, lastUsed: now }));
  // put new ones first so they rank higher
  saveContacts([...newEntries, ...existing]);
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

  /* ── Autocomplete state ── */
  const [acResults, setAcResults] = useState([]);
  const [acField, setAcField] = useState(null); // 'to' | 'cc' | 'bcc'
  const [acIndex, setAcIndex] = useState(-1);
  const acRef = useRef(null);

  // Seed contacts from inbox/sent on mount
  useEffect(() => {
    async function seedContacts() {
      try {
        const [inbox, sent] = await Promise.all([
          emailApi.getMessages('inbox', 1, 50).catch(() => ({ messages: [] })),
          emailApi.getMessages('sent', 1, 50).catch(() => ({ messages: [] })),
        ]);
        const emails = new Set();
        for (const m of (inbox.messages || [])) {
          if (m.from) emails.add(m.from.toLowerCase());
        }
        for (const m of (sent.messages || [])) {
          const toList = Array.isArray(m.to) ? m.to : (m.to ? [m.to] : []);
          toList.forEach(e => emails.add(e.toLowerCase()));
        }
        if (emails.size) rememberEmails([...emails]);
      } catch { /* silent */ }
    }
    seedContacts();
  }, []);

  // Close autocomplete on outside click / touch
  useEffect(() => {
    function handleClick(e) {
      if (acRef.current && !acRef.current.contains(e.target)) {
        setAcResults([]);
        setAcField(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, []);

  function handleFieldBlur() {
    // Small delay so suggestion click/tap can register first
    setTimeout(() => {
      setAcResults([]);
      setAcField(null);
      setAcIndex(-1);
    }, 200);
  }

  const getAutocomplete = useCallback((value) => {
    // get the part after the last comma
    const parts = value.split(',');
    const query = (parts[parts.length - 1] || '').trim().toLowerCase();
    if (query.length < 1) return [];
    const contacts = loadContacts();
    return contacts
      .filter(c => c.email.toLowerCase().includes(query))
      .slice(0, 8);
  }, []);

  function handleFieldChange(value, setter, fieldName) {
    setter(value);
    const results = getAutocomplete(value);
    setAcResults(results);
    setAcField(results.length > 0 ? fieldName : null);
    setAcIndex(-1);
  }

  function selectSuggestion(email, fieldValue, setter) {
    const parts = fieldValue.split(',');
    parts[parts.length - 1] = ' ' + email;
    setter(parts.join(',').replace(/^[\s,]+/, '') + ', ');
    setAcResults([]);
    setAcField(null);
    setAcIndex(-1);
  }

  function handleFieldKeyDown(e, fieldValue, setter) {
    if (acResults.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAcIndex(i => (i + 1) % acResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAcIndex(i => (i <= 0 ? acResults.length - 1 : i - 1));
    } else if (e.key === 'Enter' && acIndex >= 0) {
      e.preventDefault();
      selectSuggestion(acResults[acIndex].email, fieldValue, setter);
    } else if (e.key === 'Escape') {
      setAcResults([]);
      setAcField(null);
    }
  }

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
      // Remember all recipient emails
      const allRecipients = [
        ...to.split(',').map(s => s.trim()).filter(Boolean),
        ...cc.split(',').map(s => s.trim()).filter(Boolean),
        ...bcc.split(',').map(s => s.trim()).filter(Boolean),
      ];
      rememberEmails(allRecipients);
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

          <div className="compose-field compose-field-ac" ref={acField === 'to' ? acRef : undefined}>
            <label>To</label>
            <input
              type="text"
              placeholder="recipient@example.com"
              value={to}
              onChange={(e) => handleFieldChange(e.target.value, setTo, 'to')}
              onKeyDown={(e) => handleFieldKeyDown(e, to, setTo)}
              onFocus={() => { const r = getAutocomplete(to); setAcResults(r); setAcField(r.length ? 'to' : null); }}
              onBlur={handleFieldBlur}
              autoFocus={!replyTo}
              autoComplete="off"
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
            {acField === 'to' && acResults.length > 0 && (
              <div className="email-ac-dropdown">
                {acResults.map((c, i) => (
                  <button
                    key={c.email}
                    type="button"
                    className={`email-ac-option${i === acIndex ? ' email-ac-active' : ''}`}
                    onMouseDown={(e) => { e.preventDefault(); selectSuggestion(c.email, to, setTo); }}
                  >
                    <span className="email-ac-icon">@</span>
                    <span className="email-ac-email">{c.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {showCcBcc && (
            <>
              <div className="compose-field compose-field-ac" ref={acField === 'cc' ? acRef : undefined}>
                <label>Cc</label>
                <input
                  type="text"
                  placeholder="cc@example.com"
                  value={cc}
                  onChange={(e) => handleFieldChange(e.target.value, setCc, 'cc')}
                  onKeyDown={(e) => handleFieldKeyDown(e, cc, setCc)}
                  onFocus={() => { const r = getAutocomplete(cc); setAcResults(r); setAcField(r.length ? 'cc' : null); }}
                  onBlur={handleFieldBlur}
                  autoComplete="off"
                />
                {acField === 'cc' && acResults.length > 0 && (
                  <div className="email-ac-dropdown">
                    {acResults.map((c, i) => (
                      <button
                        key={c.email}
                        type="button"
                        className={`email-ac-option${i === acIndex ? ' email-ac-active' : ''}`}
                        onMouseDown={(e) => { e.preventDefault(); selectSuggestion(c.email, cc, setCc); }}
                      >
                        <span className="email-ac-icon">@</span>
                        <span className="email-ac-email">{c.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="compose-field compose-field-ac" ref={acField === 'bcc' ? acRef : undefined}>
                <label>Bcc</label>
                <input
                  type="text"
                  placeholder="bcc@example.com"
                  value={bcc}
                  onChange={(e) => handleFieldChange(e.target.value, setBcc, 'bcc')}
                  onKeyDown={(e) => handleFieldKeyDown(e, bcc, setBcc)}
                  onFocus={() => { const r = getAutocomplete(bcc); setAcResults(r); setAcField(r.length ? 'bcc' : null); }}
                  onBlur={handleFieldBlur}
                  autoComplete="off"
                />
                {acField === 'bcc' && acResults.length > 0 && (
                  <div className="email-ac-dropdown">
                    {acResults.map((c, i) => (
                      <button
                        key={c.email}
                        type="button"
                        className={`email-ac-option${i === acIndex ? ' email-ac-active' : ''}`}
                        onMouseDown={(e) => { e.preventDefault(); selectSuggestion(c.email, bcc, setBcc); }}
                      >
                        <span className="email-ac-icon">@</span>
                        <span className="email-ac-email">{c.email}</span>
                      </button>
                    ))}
                  </div>
                )}
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
