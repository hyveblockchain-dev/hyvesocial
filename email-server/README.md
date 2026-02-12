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

| Type | Name | Value |
|------|------|-------|
| MX | @ | `mail.hyvechain.com` (priority 10) |
| A | mail | `YOUR_MAIL_SERVER_IP` |
| TXT | @ | `v=spf1 mx a:mail.hyvechain.com -all` |
| TXT | _dmarc | `v=DMARC1; p=quarantine; rua=mailto:postmaster@hyvechain.com` |
| TXT | mail._domainkey | `v=DKIM1; k=rsa; p=YOUR_DKIM_PUBLIC_KEY` |
| CNAME | autoconfig | `mail.hyvechain.com` |
| SRV | _imaps._tcp | `0 1 993 mail.hyvechain.com` |
| SRV | _submission._tcp | `0 1 587 mail.hyvechain.com` |

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

### 4. Configure Frontend

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
