// src/components/Email/EmailSignup.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import emailApi from '../../services/emailApi';
import { IconShield, IconLock, IconMailbox, IconCheck, IconClose, IconArrowLeft } from '../Icons/Icons';
import './EmailSignup.css';

export default function EmailSignup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1); // 1: choose username, 2: set password, 3: optional details, 4: success
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [createdEmail, setCreatedEmail] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const peekRef = useRef(null);

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
    const hide = () => { setShowPassword(false); setShowConfirmPassword(false); clearTimeout(peekRef.current); };
    window.addEventListener('blur', hide);
    const onVis = () => { if (document.hidden) hide(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { window.removeEventListener('blur', hide); document.removeEventListener('visibilitychange', onVis); clearTimeout(peekRef.current); };
  }, []);
  const debounceRef = useRef(null);

  // Check username availability with debounce
  useEffect(() => {
    if (!username || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    // Validate format
    if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
      setUsernameAvailable(false);
      setError('Username can only contain letters, numbers, dots, hyphens, and underscores');
      return;
    }

    setCheckingUsername(true);
    setError('');

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await emailApi.checkEmailAvailability(username);
        setUsernameAvailable(result.available);
        if (!result.available) {
          setError('This username is already taken');
        }
      } catch (err) {
        // If API isn't ready yet, assume available for development
        setUsernameAvailable(true);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [username]);

  // Calculate password strength
  useEffect(() => {
    if (!password) {
      setPasswordStrength(0);
      return;
    }
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    setPasswordStrength(strength);
  }, [password]);

  function getStrengthLabel() {
    if (passwordStrength <= 1) return { label: 'Weak', color: '#ef4444' };
    if (passwordStrength <= 2) return { label: 'Fair', color: '#f59e0b' };
    if (passwordStrength <= 3) return { label: 'Good', color: '#3b82f6' };
    return { label: 'Strong', color: '#22c55e' };
  }

  async function handleStep1(e) {
    e.preventDefault();
    if (!username || username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (usernameAvailable === false) {
      setError('This username is not available');
      return;
    }
    setError('');
    setStep(2);
  }

  async function handleStep2(e) {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (passwordStrength < 2) {
      setError('Please choose a stronger password');
      return;
    }
    setError('');
    setStep(3);
  }

  async function handleCreateAccount(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await emailApi.emailSignup({
        username,
        password,
        displayName: displayName || username,
      });

      // Store email token
      if (result.token) {
        localStorage.setItem('email_token', result.token);
      }

      // Store recovery code to show on success page
      if (result.recoveryCode) {
        setRecoveryCode(result.recoveryCode);
      }

      setCreatedEmail(`${username}@hyvechain.com`);

      // If user is logged into Hyve Social, auto-link accounts
      if (user && result.token) {
        try {
          const socialToken = localStorage.getItem('token');
          if (socialToken) {
            await emailApi.linkToSocial(socialToken);
          }
        } catch (linkErr) {
          console.warn('Auto-link to social failed:', linkErr);
        }
      }

      setStep(4);
    } catch (err) {
      setError(err.message || 'Failed to create email account');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="email-signup-page">
      <div className="email-signup-container">
        {/* Header */}
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
              <h2>Your Private Email, Your Identity</h2>
              <p>
                Create your <strong>@hyvechain.com</strong> email — end-to-end encrypted, 
                ad-free, and integrated with Hyve Social.
              </p>
            </div>
          </div>
        </div>

        {/* Progress indicator */}
        {step < 4 && (
          <div className="signup-progress">
            <div className={`progress-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
              <span className="progress-number">{step > 1 ? <IconCheck size={14} /> : '1'}</span>
              <span className="progress-label">Username</span>
            </div>
            <div className="progress-line" />
            <div className={`progress-step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
              <span className="progress-number">{step > 2 ? <IconCheck size={14} /> : '2'}</span>
              <span className="progress-label">Password</span>
            </div>
            <div className="progress-line" />
            <div className={`progress-step ${step >= 3 ? 'active' : ''}`}>
              <span className="progress-number">3</span>
              <span className="progress-label">Finalize</span>
            </div>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        {/* Step 1: Choose Username */}
        {step === 1 && (
          <form className="email-signup-form" onSubmit={handleStep1}>
            <h2>Choose Your Email Address</h2>
            <div className="email-input-group">
              <input
                type="text"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                maxLength={30}
                autoFocus
              />
              <span className="email-domain">@hyvechain.com</span>
            </div>
            {username.length >= 3 && (
              <div className={`availability-status ${checkingUsername ? 'checking' : usernameAvailable ? 'available' : 'taken'}`}>
                {checkingUsername ? (
                  <><span className="availability-spinner" /> Checking availability...</>
                ) : usernameAvailable ? (
                  <><IconCheck size={14} /> <strong>{username}@hyvechain.com</strong> is available!</>
                ) : usernameAvailable === false ? (
                  <><IconClose size={14} /> This username is taken</>
                ) : null}
              </div>
            )}
            <p className="input-hint">
              At least 3 characters. Letters, numbers, dots, hyphens, and underscores only.
            </p>
            <button type="submit" disabled={!username || username.length < 3 || usernameAvailable === false || checkingUsername}>
              Continue
            </button>
            <div className="signup-nav-links">
              <Link to="/email/login" className="nav-link">Already have an account? Sign in</Link>
            </div>
          </form>
        )}

        {/* Step 2: Set Password */}
        {step === 2 && (
          <form className="email-signup-form" onSubmit={handleStep2}>
            <button type="button" className="form-back-btn" onClick={() => { setStep(1); setError(''); }}>
              <IconArrowLeft size={16} /> Back
            </button>
            <h2>Create Your Password</h2>
            <p className="step-subtitle">
              Your email: <strong>{username}@hyvechain.com</strong>
            </p>
            <div className={`password-input-wrapper${showPassword ? ' peeking' : ''}`}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
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
            {password && (
              <div className="password-strength">
                <div className="strength-bars">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="strength-bar"
                      style={{
                        backgroundColor: i <= passwordStrength ? getStrengthLabel().color : 'rgba(255,255,255,0.1)',
                      }}
                    />
                  ))}
                </div>
                <span className="strength-label" style={{ color: getStrengthLabel().color }}>
                  {getStrengthLabel().label}
                </span>
              </div>
            )}
            <div className={`password-input-wrapper${showConfirmPassword ? ' peeking' : ''}`}>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button
                type="button"
                className={`password-toggle${showConfirmPassword ? ' peeking' : ''}`}
                onMouseDown={() => startPeek(setShowConfirmPassword)}
                onMouseUp={() => stopPeek(setShowConfirmPassword)}
                onMouseLeave={() => stopPeek(setShowConfirmPassword)}
                onTouchStart={(e) => { e.preventDefault(); startPeek(setShowConfirmPassword); }}
                onTouchEnd={() => stopPeek(setShowConfirmPassword)}
                tabIndex={-1}
                title="Hold to peek"
              >
                {showConfirmPassword ? '🙈' : '👁️'}
              </button>
            </div>
            <p className="input-hint">
              Minimum 8 characters. Use uppercase, numbers, and symbols for a stronger password.
            </p>
            <button type="submit" disabled={!password || !confirmPassword}>
              Continue
            </button>
          </form>
        )}

        {/* Step 3: Optional Details */}
        {step === 3 && (
          <form className="email-signup-form" onSubmit={handleCreateAccount}>
            <button type="button" className="form-back-btn" onClick={() => { setStep(2); setError(''); }}>
              <IconArrowLeft size={16} /> Back
            </button>
            <h2>Almost Done!</h2>
            <p className="step-subtitle">
              Creating: <strong>{username}@hyvechain.com</strong>
            </p>
            <input
              type="text"
              placeholder="Display name (optional)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
              autoFocus
            />
            <p className="input-hint">
              A display name is shown on emails you send. If left blank, your username will be used.
            </p>
            <button type="submit" disabled={loading}>
              {loading ? (
                <span className="btn-loading">
                  <span className="btn-spinner" />
                  Creating Account...
                </span>
              ) : (
                'Create My Email Account'
              )}
            </button>
          </form>
        )}

        {/* Step 4: Success + Recovery Code */}
        {step === 4 && (
          <div className="email-signup-success">
            <div className="success-icon">
              <IconCheck size={32} />
            </div>
            <h2>Welcome to HyveMail!</h2>
            <p className="success-email">{createdEmail}</p>

            {recoveryCode && (
              <div className="recovery-code-section">
                <div className="recovery-code-warning">
                  <span className="recovery-warning-icon">⚠️</span>
                  <h3>Save Your Recovery Code</h3>
                  <p>
                    This is your <strong>one-time recovery code</strong>. If you lose your password, 
                    this is the <strong>only way</strong> to regain access to your account. 
                    <strong> It will not be shown again.</strong>
                  </p>
                </div>
                <div className="recovery-code-display">
                  <code className="recovery-code-value">{recoveryCode}</code>
                  <button
                    type="button"
                    className="copy-code-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(recoveryCode);
                      setCodeCopied(true);
                      setTimeout(() => setCodeCopied(false), 3000);
                    }}
                  >
                    {codeCopied ? '✓ Copied!' : '📋 Copy'}
                  </button>
                </div>
                <ul className="recovery-code-tips">
                  <li>Write it down on paper and store it safely</li>
                  <li>Save it in a password manager</li>
                  <li>Do <strong>not</strong> share it with anyone</li>
                  <li>This code is single-use — after a reset, a new code is issued</li>
                </ul>
              </div>
            )}

            <div className="success-actions">
              <button className="primary-btn" onClick={() => navigate('/email')}>
                <IconMailbox size={18} /> Open Webmail
              </button>
            </div>
          </div>
        )}

        {/* Feature Cards */}
        <div className="email-features">
          <div className="email-feature">
            <div className="email-feature-icon">
              <IconShield size={22} />
            </div>
            <div className="email-feature-text">
              <span className="email-feature-title">End-to-End Encrypted</span>
              <span className="email-feature-desc">Your emails are private by default</span>
            </div>
          </div>
          <div className="email-feature">
            <div className="email-feature-icon">
              <IconLock size={22} />
            </div>
            <div className="email-feature-text">
              <span className="email-feature-title">No Ads, No Tracking</span>
              <span className="email-feature-desc">We never read or monetize your data</span>
            </div>
          </div>
          <div className="email-feature">
            <div className="email-feature-icon">
              <IconMailbox size={22} />
            </div>
            <div className="email-feature-text">
              <span className="email-feature-title">Your Own Domain</span>
              <span className="email-feature-desc">A real @hyvechain.com address</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
