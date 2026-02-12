// src/components/Email/EmailLogin.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import emailApi from '../../services/emailApi';
import { IconMailbox, IconShield, IconLock } from '../Icons/Icons';
import './EmailSignup.css';

export default function EmailLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const peekRef = useRef(null);

  // Forgot password state
  const [forgotMode, setForgotMode] = useState(false);
  const [resetUsername, setResetUsername] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [newRecoveryCodes, setNewRecoveryCodes] = useState([]);
  const [codeCopied, setCodeCopied] = useState(false);

  const startPeek = useCallback((setter) => {
    setter(true);
    clearTimeout(peekRef.current);
    peekRef.current = setTimeout(() => setter(false), 3000);
  }, []);
  const stopPeek = useCallback((setter) => {
    setter(false);
    clearTimeout(peekRef.current);
  }, []);

  useEffect(() => {
    const hide = () => { setShowPassword(false); setShowNewPassword(false); clearTimeout(peekRef.current); };
    window.addEventListener('blur', hide);
    const onVis = () => { if (document.hidden) hide(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { window.removeEventListener('blur', hide); document.removeEventListener('visibilitychange', onVis); clearTimeout(peekRef.current); };
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Auto-append @hyvechain.com if not present
      const fullEmail = email.includes('@') ? email : `${email}@hyvechain.com`;
      const result = await emailApi.emailLogin(fullEmail, password);

      if (result.token) {
        localStorage.setItem('email_token', result.token);
      }

      // If email account is linked to social, store social token too
      if (result.socialToken) {
        localStorage.setItem('token', result.socialToken);
      }

      navigate('/email');
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (!resetUsername.trim() || !resetCode.trim() || !newPassword.trim()) {
      setError('All fields are required');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await emailApi.resetPasswordWithCode({
        username: resetUsername.trim(),
        recoveryCode: resetCode.trim(),
        newPassword,
      });
      setNewRecoveryCodes(result.newRecoveryCodes || []);
      setResetSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="email-signup-page">
      <div className="email-signup-container">
        <div className="email-signup-hero">
          <div className="email-signup-hero-content">
            <div className="email-signup-brand">
              <img src="/hyvelogo.png" alt="Hyve" className="email-signup-logo" />
              <div>
                <h1>HyveMail</h1>
                <p>Private email by Hyve</p>
              </div>
            </div>
            <div className="email-signup-hero-copy">
              <h2>{forgotMode ? 'Reset Your Password' : 'Sign In to Your Email'}</h2>
              <p>{forgotMode ? 'Use your recovery code to regain access.' : 'Access your @hyvechain.com inbox — private, encrypted, yours.'}</p>
            </div>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* Reset success with new recovery code */}
        {resetSuccess ? (
          <div className="email-signup-success">
            <div className="success-icon" style={{ background: 'rgba(76, 175, 80, 0.15)', color: '#4caf50', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>
              ✓
            </div>
            <h2>Password Reset Successfully!</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>You can now sign in with your new password.</p>

            {newRecoveryCodes.length > 0 && (
              <div className="recovery-code-section">
                <div className="recovery-code-warning">
                  <span className="recovery-warning-icon">⚠️</span>
                  <h3>New Recovery Codes</h3>
                  <p>
                    Your old recovery codes have been invalidated. Save these <strong>new recovery codes</strong> — 
                    they are the <strong>only way</strong> to reset your password again. 
                    <strong> They will not be shown again.</strong>
                  </p>
                </div>
                <div className="recovery-codes-list">
                  {newRecoveryCodes.map((code, i) => (
                    <div key={i} className="recovery-code-item">
                      <span className="recovery-code-number">{i + 1}.</span>
                      <code className="recovery-code-value">{code}</code>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="copy-code-btn copy-all-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(newRecoveryCodes.join('\n'));
                    setCodeCopied(true);
                    setTimeout(() => setCodeCopied(false), 3000);
                  }}
                >
                  {codeCopied ? '✓ Copied All!' : '📋 Copy All Codes'}
                </button>
                <ul className="recovery-code-tips">
                  <li>Write them down on paper and store safely</li>
                  <li>Save them in a password manager</li>
                  <li>Do <strong>not</strong> share them with anyone</li>
                </ul>
              </div>
            )}

            <div className="success-actions">
              <button className="primary-btn" onClick={() => { setForgotMode(false); setResetSuccess(false); setResetCode(''); setNewPassword(''); setConfirmNewPassword(''); setNewRecoveryCodes([]); setError(''); }}>
                <IconLock size={18} /> Go to Sign In
              </button>
            </div>
          </div>
        ) : forgotMode ? (
          /* Forgot password form */
          <form className="email-signup-form" onSubmit={handleResetPassword}>
            <h2>Recover Your Account</h2>
            <p className="step-subtitle" style={{ marginBottom: 16 }}>Enter your username and recovery code to set a new password.</p>

            <div className="email-input-group">
              <input
                type="text"
                placeholder="username"
                value={resetUsername}
                onChange={(e) => setResetUsername(e.target.value.trim())}
                autoFocus
              />
              <span className="email-domain">@hyvechain.com</span>
            </div>

            <input
              type="text"
              placeholder="Recovery code"
              value={resetCode}
              onChange={(e) => setResetCode(e.target.value.toUpperCase())}
              style={{ fontFamily: 'monospace', letterSpacing: '1px', textTransform: 'uppercase' }}
              autoComplete="off"
            />

            <div className={`password-input-wrapper${showNewPassword ? ' peeking' : ''}`}>
              <input
                type={showNewPassword ? 'text' : 'password'}
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                className={`password-toggle${showNewPassword ? ' peeking' : ''}`}
                onMouseDown={() => startPeek(setShowNewPassword)}
                onMouseUp={() => stopPeek(setShowNewPassword)}
                onMouseLeave={() => stopPeek(setShowNewPassword)}
                onTouchStart={(e) => { e.preventDefault(); startPeek(setShowNewPassword); }}
                onTouchEnd={() => stopPeek(setShowNewPassword)}
                tabIndex={-1}
                title="Hold to peek"
              >
                {showNewPassword ? '🙈' : '👁️'}
              </button>
            </div>

            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
            />

            <button type="submit" disabled={loading}>
              {loading ? (
                <span className="btn-loading">
                  <span className="btn-spinner" />
                  Resetting...
                </span>
              ) : (
                'Reset Password'
              )}
            </button>

            <div className="signup-nav-links">
              <button type="button" className="nav-link" onClick={() => { setForgotMode(false); setError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                ← Back to Sign In
              </button>
            </div>
          </form>
        ) : (
          /* Normal login form */
          <form className="email-signup-form" onSubmit={handleLogin}>
          <h2>Email Sign In</h2>

          <div className="email-input-group">
            <input
              type="text"
              placeholder="username"
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
              autoFocus
            />
            <span className="email-domain">@hyvechain.com</span>
          </div>

          <div className={`password-input-wrapper${showPassword ? ' peeking' : ''}`}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className={`password-toggle${showPassword ? ' peeking' : ''}`}
              onMouseDown={() => startPeek(setShowPassword)}
              onMouseUp={() => stopPeek(setShowPassword)}
              onMouseLeave={() => stopPeek(setShowPassword)}
              onTouchStart={(e) => { e.preventDefault(); startPeek(setShowPassword); }}
              onTouchEnd={() => stopPeek(setShowPassword)}
              tabIndex={-1}
              title="Hold to peek"
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? (
              <span className="btn-loading">
                <span className="btn-spinner" />
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>

          <div className="signup-nav-links">
            <button type="button" className="nav-link" onClick={() => { setForgotMode(true); setError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              Forgot password?
            </button>
            <Link to="/email/signup" className="nav-link">Don't have an account? Create one</Link>
          </div>
        </form>
        )}

        <div className="email-features">
          <div className="email-feature">
            <div className="email-feature-icon">
              <IconShield size={22} />
            </div>
            <div className="email-feature-text">
              <span className="email-feature-title">Encrypted</span>
              <span className="email-feature-desc">End-to-end security</span>
            </div>
          </div>
          <div className="email-feature">
            <div className="email-feature-icon">
              <IconLock size={22} />
            </div>
            <div className="email-feature-text">
              <span className="email-feature-title">Private</span>
              <span className="email-feature-desc">No ads, no tracking</span>
            </div>
          </div>
          <div className="email-feature">
            <div className="email-feature-icon">
              <IconMailbox size={22} />
            </div>
            <div className="email-feature-text">
              <span className="email-feature-title">Integrated</span>
              <span className="email-feature-desc">Works with Hyve Social</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
