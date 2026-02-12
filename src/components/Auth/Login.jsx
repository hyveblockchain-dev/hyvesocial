// src/components/Auth/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { setE2EESignature } from '../../utils/e2ee';
import { IconShield, IconZap, IconUsers, IconLock, IconChat, IconGlobe, IconMailbox } from '../Icons/Icons';
import './Login.css';

export default function Login() {
  const navigate = useNavigate();
  const { login, loginWithEmail, register, registerWithEmail, connectWallet } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [username, setUsername] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [activeTab, setActiveTab] = useState('social'); // 'social' | 'email'
  const [socialMethod, setSocialMethod] = useState('wallet'); // 'wallet' | 'email'
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  // Email tab state
  const [emailTabMode, setEmailTabMode] = useState('login'); // 'login' | 'signup'
  const [mailUser, setMailUser] = useState('');
  const [mailPass, setMailPass] = useState('');

  async function handleConnect() {
    try {
      setLoading(true);
      setError('');

      console.log('Connecting wallet...');
      const { address, signature } = await connectWallet();
      setWalletAddress(address);
      setE2EESignature(signature);
      
      console.log('Attempting login...');
      const result = await login(address, signature);
      
      if (result.needsRegistration) {
        console.log('User needs to register');
        setNeedsRegistration(true);
      } else {
        console.log('Login successful!');
        navigate('/');
      }
    } catch (err) {
      console.error('Connection error:', err);
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailLogin(e) {
    e.preventDefault();
    if (!emailInput.trim() || !passwordInput.trim()) {
      setError('Please enter your email and password');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const fullEmail = emailInput.includes('@') ? emailInput : `${emailInput}@hyvechain.com`;
      const result = await loginWithEmail(fullEmail, passwordInput);

      if (result.needsRegistration) {
        setPendingEmail(fullEmail);
        setNeedsRegistration(true);
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error('Email login error:', err);
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  // Email tab: direct webmail login
  async function handleMailLogin(e) {
    e.preventDefault();
    if (!mailUser.trim() || !mailPass.trim()) {
      setError('Please enter your email and password');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const fullEmail = mailUser.includes('@') ? mailUser : `${mailUser}@hyvechain.com`;
      const emailApi = (await import('../../services/emailApi')).default;
      const result = await emailApi.emailLogin(fullEmail, mailPass);

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

  async function handleRegister(e) {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    try {
      setLoading(true);
      setError('');

      if (pendingEmail) {
        // Register via email
        await registerWithEmail(pendingEmail, username);
      } else {
        // Register via wallet
        await register(walletAddress, username);
      }
      
      console.log('Registration successful!');
      navigate('/');
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to register');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-hero">
          <div className="login-hero-content">
            <div className="login-brand">
              <img src="/hyvelogo.png" alt="Hyve" className="login-logo" />
              <div>
                <h1>Hyve</h1>
                <p>The decentralized ecosystem</p>
              </div>
            </div>
            <div className="login-hero-copy">
              <h2>Your Community. Your Rules.</h2>
              <p>
                A wallet-powered social platform with encrypted messaging, rich profiles, and real-time conversations — all owned by you.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* Top-level tabs: Hyve Social | Hyve Email */}
        {!needsRegistration ? (
          <>
            <div className="login-tabs">
              <button
                className={`login-tab ${activeTab === 'social' ? 'active' : ''}`}
                onClick={() => { setActiveTab('social'); setError(''); }}
              >
                <IconUsers size={16} />
                Hyve Social
              </button>
              <button
                className={`login-tab ${activeTab === 'email' ? 'active' : ''}`}
                onClick={() => { setActiveTab('email'); setError(''); }}
              >
                <IconMailbox size={16} />
                Hyve Email
              </button>
            </div>

            {activeTab === 'social' ? (
              <div className="login-box">
                {/* Social login method toggle */}
                <div className="login-method-toggle">
                  <button
                    className={`method-btn ${socialMethod === 'wallet' ? 'active' : ''}`}
                    onClick={() => { setSocialMethod('wallet'); setError(''); }}
                  >
                    <IconLock size={14} /> Wallet
                  </button>
                  <button
                    className={`method-btn ${socialMethod === 'email' ? 'active' : ''}`}
                    onClick={() => { setSocialMethod('email'); setError(''); }}
                  >
                    <IconMailbox size={14} /> Email
                  </button>
                </div>

                {socialMethod === 'wallet' ? (
                  <>
                    <button 
                      className="connect-button" 
                      onClick={handleConnect}
                      disabled={loading}
                    >
                      {loading ? (
                        <span className="connect-loading">
                          <span className="connect-spinner"></span>
                          Connecting...
                        </span>
                      ) : (
                        'Connect with MetaMask'
                      )}
                    </button>
                    <p className="login-subtitle">Connect your wallet to get started</p>
                  </>
                ) : (
                  <form className="email-login-form" onSubmit={handleEmailLogin}>
                    <div className="email-login-input-group">
                      <input
                        type="text"
                        placeholder="username"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value.trim())}
                        disabled={loading}
                        autoFocus
                      />
                      <span className="email-login-domain">@hyvechain.com</span>
                    </div>
                    <input
                      type="password"
                      placeholder="Password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      disabled={loading}
                      className="email-login-password"
                    />
                    <button type="submit" className="connect-button" disabled={loading}>
                      {loading ? (
                        <span className="connect-loading">
                          <span className="connect-spinner"></span>
                          Signing in...
                        </span>
                      ) : (
                        'Sign In to Hyve Social'
                      )}
                    </button>
                    <p className="login-subtitle">Use your @hyvechain.com email to access Hyve Social</p>
                  </form>
                )}
              </div>
            ) : (
              <div className="login-box">
                {emailTabMode === 'login' ? (
                  <form className="email-login-form" onSubmit={handleMailLogin}>
                    <h3 className="email-tab-heading">Sign In to HyveMail</h3>
                    <div className="email-login-input-group">
                      <input
                        type="text"
                        placeholder="username"
                        value={mailUser}
                        onChange={(e) => setMailUser(e.target.value.trim())}
                        disabled={loading}
                        autoFocus
                      />
                      <span className="email-login-domain">@hyvechain.com</span>
                    </div>
                    <input
                      type="password"
                      placeholder="Password"
                      value={mailPass}
                      onChange={(e) => setMailPass(e.target.value)}
                      disabled={loading}
                      className="email-login-password"
                    />
                    <button type="submit" className="connect-button" disabled={loading}>
                      {loading ? (
                        <span className="connect-loading">
                          <span className="connect-spinner"></span>
                          Signing in...
                        </span>
                      ) : (
                        'Open My Email'
                      )}
                    </button>
                    <div className="email-login-links">
                      <button type="button" className="email-login-link" onClick={() => { setEmailTabMode('signup'); setError(''); }}>
                        Don't have an email? Create one
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="email-tab-signup">
                    <h3 className="email-tab-heading">Get Your @hyvechain.com Email</h3>
                    <p className="login-subtitle">Create a private, ad-free email account.</p>
                    <button className="connect-button" onClick={() => navigate('/email/signup')}>
                      Create Email Account
                    </button>
                    <div className="email-login-links">
                      <button type="button" className="email-login-link" onClick={() => { setEmailTabMode('login'); setError(''); }}>
                        Already have an account? Sign in
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <form className="register-form" onSubmit={handleRegister}>
            {pendingEmail ? (
              <>
                <h2>Welcome Back!</h2>
                <p className="register-email-note">
                  Signed in as <strong>{pendingEmail}</strong>
                </p>
                <p className="register-email-note" style={{ marginTop: '0', fontSize: '0.85rem', opacity: 0.8 }}>
                  Choose a username to set up your Hyve Social profile.
                </p>
              </>
            ) : (
              <h2>Create Your Profile</h2>
            )}
            <input
              type="text"
              placeholder="Choose a username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              maxLength={20}
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Setting up...' : 'Set Up Profile'}
            </button>
            <button 
              type="button" 
              onClick={() => { setNeedsRegistration(false); setPendingEmail(''); }}
              disabled={loading}
              className="back-button"
            >
              Back
            </button>
          </form>
        )}

        <div className="login-features">
          <div className="feature">
            <div className="feature-icon">
              <IconShield size={22} />
            </div>
            <div className="feature-text">
              <span className="feature-title">End-to-End Encrypted</span>
              <span className="feature-desc">Messages secured by your wallet</span>
            </div>
          </div>
          <div className="feature">
            <div className="feature-icon">
              <IconZap size={22} />
            </div>
            <div className="feature-text">
              <span className="feature-title">Instant Onboarding</span>
              <span className="feature-desc">One click, no passwords needed</span>
            </div>
          </div>
          <div className="feature">
            <div className="feature-icon">
              <IconUsers size={22} />
            </div>
            <div className="feature-text">
              <span className="feature-title">Community First</span>
              <span className="feature-desc">Groups, feeds &amp; real-time chat</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}