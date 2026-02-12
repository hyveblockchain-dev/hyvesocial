// src/components/Email/EmailLogin.jsx
import { useState } from 'react';
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

      navigate('/email');
    } catch (err) {
      setError(err.message || 'Invalid email or password');
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
              <h2>Sign In to Your Email</h2>
              <p>Access your <strong>@hyvechain.com</strong> inbox — private, encrypted, yours.</p>
            </div>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

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

          <div className="password-input-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
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
            <Link to="/email/signup" className="nav-link">Don't have an account? Create one</Link>
          </div>
        </form>

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
