# HyveMail — Private Email Service for hyvechain.com

## Overview

HyveMail is a private email service that provides `@hyvechain.com` email accounts to users, with full integration into Hyve Social for authentication.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   React App     │────>│  HyveMail API    │────>│  Mail Server    │
│  (Frontend)     │     │  (Node.js)       │     │  (Postfix/      │
│                 │     │  Port 4500       │     │   Dovecot)      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                       │
        │                       │
        v                       v
┌─────────────────┐     ┌──────────────────┐
│  Hyve Social    │     │    MongoDB       │
│  API Server     │     │  (Accounts DB)   │
└─────────────────┘     └──────────────────┘
```

## Components

### 1. Frontend (React)
- **Email Signup** (`/email/signup`) — Create @hyvechain.com accounts
- **Email Login** (`/email/login`) — Sign into webmail
- **Webmail** (`/email`) — Full webmail client (inbox, compose, read)
- **Social Login** — Use @hyvechain.com email to login to Hyve Social

### 2. HyveMail API Server (`email-server/`)
- Account management (signup, login, settings)
- IMAP proxy for reading emails
- SMTP proxy for sending emails
- Hyve Social token integration

### 3. Mail Server Infrastructure
You need a mail server handling IMAP/SMTP for hyvechain.com. Recommended options:

#### Option A: Mailcow (Recommended)
```bash
# On your mail server (Ubuntu/Debian)
git clone https://github.com/mailcow/mailcow-dockerized
cd mailcow-dockerized
./generate_config.sh    # Set mail hostname to mail.hyvechain.com
docker compose up -d
```

#### Option B: Mail-in-a-Box
```bash
curl -s https://mailinabox.email/setup.sh | sudo bash
```

#### Option C: Manual (Postfix + Dovecot)
```bash
sudo apt install postfix dovecot-imapd dovecot-pop3d
# Configure for hyvechain.com domain
```

## DNS Records Required

Add these DNS records for `hyvechain.com`:

| Type | Name | Value | Notes |
|------|------|-------|-------|
| MX | @ | `mail.hyvechain.com` (priority 10) | Required for receiving |
| A | mail | `68.168.218.138` | Points to mail server |
| TXT | @ | `v=spf1 mx a:mail.hyvechain.com ip4:68.168.218.138 -all` | **Required for sending** |
| TXT | _dmarc | `v=DMARC1; p=quarantine; rua=mailto:postmaster@hyvechain.com; fo=1` | **Required for sending** |
| TXT | mail._domainkey | `v=DKIM1; k=rsa; p=YOUR_DKIM_PUBLIC_KEY` | **Required for sending** |
| PTR | 68.168.218.138 | `mail.hyvechain.com` | **Required — set via hosting provider** |
| CNAME | autoconfig | `mail.hyvechain.com` | Optional |
| SRV | _imaps._tcp | `0 1 993 mail.hyvechain.com` | Optional |
| SRV | _submission._tcp | `0 1 587 mail.hyvechain.com` | Optional |

> **CRITICAL**: Without SPF, DKIM, DMARC, and PTR records, external providers (Gmail, Outlook, Yahoo) will reject your outbound emails. The PTR (reverse DNS) record must be set through your hosting provider's control panel.

## Setup Instructions

### 1. Set up the Mail Server

Choose one of the options above and configure it for `hyvechain.com`.

### 2. Configure DNS

Add all the DNS records listed above.

### 3. Deploy HyveMail API

```bash
cd email-server
cp .env.example .env
# Edit .env with your actual values
npm install
npm start
```

### 4. Run Diagnostics

After setup, check that everything is configured correctly:

```bash
curl http://localhost:4500/api/email/diagnostics
```

This will verify: SMTP connectivity, DNS records (MX, SPF, DKIM, DMARC, PTR), and outbound port 25 status.

### 5. Configure SMTP Relay (if port 25 is blocked)

Most cloud providers (AWS, GCP, Azure, DigitalOcean) **block outbound port 25** by default, which prevents direct email delivery to external servers. If the diagnostics show port 25 is blocked, you need an SMTP relay.

#### Option A: SendGrid (Free tier: 100 emails/day)
```env
SMTP_RELAY_HOST=smtp.sendgrid.net
SMTP_RELAY_PORT=587
SMTP_RELAY_USER=apikey
SMTP_RELAY_PASS=your-sendgrid-api-key
```

#### Option B: Mailgun
```env
SMTP_RELAY_HOST=smtp.mailgun.org
SMTP_RELAY_PORT=587
SMTP_RELAY_USER=postmaster@hyvechain.com
SMTP_RELAY_PASS=your-mailgun-password
```

#### Option C: Amazon SES
```env
SMTP_RELAY_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_RELAY_PORT=587
SMTP_RELAY_USER=your-ses-smtp-username
SMTP_RELAY_PASS=your-ses-smtp-password
```

#### Option D: Request port 25 unblock
Contact your hosting provider and request outbound port 25 to be unblocked. This allows direct delivery without a relay.

### 6. Configure Frontend

Add to your React app's `.env`:
```
VITE_EMAIL_API_URL=https://mail-api.hyvechain.com
```

### 5. Set up Reverse Proxy (Nginx)

```nginx
# /etc/nginx/sites-available/mail-api.hyvechain.com
server {
    listen 443 ssl http2;
    server_name mail-api.hyvechain.com;

    ssl_certificate /etc/letsencrypt/live/mail-api.hyvechain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mail-api.hyvechain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:4500;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## How Email Login Works with Hyve Social

1. User creates `@hyvechain.com` email via HyveMail signup
2. User goes to Hyve Social login → clicks "Email" tab
3. Enters their `@hyvechain.com` email and password
4. HyveMail API verifies credentials
5. If the email is linked to a Social account → returns a social session token
6. If not linked → prompts user to create a Social profile (username)
7. Social profile is created and linked to the email account

## Security Features

- **Bcrypt** password hashing (12 rounds)
- **JWT** tokens with 24h expiry
- **Rate limiting** on auth and send endpoints
- **Helmet** security headers
- **CORS** whitelisting
- **TLS** for IMAP/SMTP connections

## API Endpoints

### Auth
- `GET /api/email/check/:username` — Check availability
- `POST /api/email/signup` — Create account
- `POST /api/email/login` — Login

### Account
- `GET /api/email/account` — Get account info
- `PUT /api/email/account` — Update settings
- `PUT /api/email/account/password` — Change password

### Mailbox
- `GET /api/email/messages?folder=inbox` — List messages
- `GET /api/email/messages/:id` — Read message
- `POST /api/email/send` — Send email
- `POST /api/email/drafts` — Save draft
- `PUT /api/email/messages/:id/read` — Mark read/unread
- `PUT /api/email/messages/:id/star` — Star/unstar
- `PUT /api/email/messages/:id/move` — Move to folder
- `DELETE /api/email/messages/:id` — Delete permanently
- `GET /api/email/unread` — Unread counts
- `GET /api/email/search?q=term` — Search

### Social Integration
- `POST /api/email/social-login` — Login to Social via email
- `POST /api/email/link-social` — Link email to Social account

## File Structure

```
email-server/
  server.js          # Main API server
  package.json       # Dependencies
  .env.example       # Environment template

src/
  services/
    emailApi.js      # Frontend email API client
  components/
    Email/
      EmailSignup.jsx    # Account creation (3-step wizard)
      EmailSignup.css
      EmailLogin.jsx     # Email sign-in page
      Webmail.jsx        # Full webmail interface
      Webmail.css
      ComposeEmail.jsx   # Email composer
      EmailView.jsx      # Read email view
  hooks/
    useAuth.jsx      # Updated with loginWithEmail, registerWithEmail
  components/
    Auth/
      Login.jsx      # Updated with wallet/email tab switcher
      Login.css      # Updated with email login styles
```
