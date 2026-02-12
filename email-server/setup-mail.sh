#!/bin/bash
set -e

echo "=== Setting up Postfix virtual mailbox maps ==="

# Create virtual mailbox map
cat > /etc/postfix/vmailbox << 'EOF'
postmaster@hyvechain.com hyvechain.com/postmaster/
EOF

# Create virtual alias map
cat > /etc/postfix/virtual << 'EOF'
postmaster@hyvechain.com postmaster@hyvechain.com
abuse@hyvechain.com postmaster@hyvechain.com
EOF

postmap /etc/postfix/vmailbox
postmap /etc/postfix/virtual
echo "Postfix maps created"

echo "=== Configuring Postfix master.cf ==="

# Enable submission port (587) in master.cf
cat > /etc/postfix/master.cf << 'MASTER'
# ==========================================================================
# service type  private unpriv  chroot  wakeup  maxproc command + args
# ==========================================================================
smtp      inet  n       -       y       -       -       smtpd
submission inet n       -       y       -       -       smtpd
  -o syslog_name=postfix/submission
  -o smtpd_tls_security_level=encrypt
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_tls_auth_only=yes
  -o smtpd_reject_unlisted_recipient=no
  -o smtpd_recipient_restrictions=permit_sasl_authenticated,reject
  -o milter_macro_daemon_name=ORIGINATING
smtps     inet  n       -       y       -       -       smtpd
  -o syslog_name=postfix/smtps
  -o smtpd_tls_wrappermode=yes
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_reject_unlisted_recipient=no
  -o smtpd_recipient_restrictions=permit_sasl_authenticated,reject
  -o milter_macro_daemon_name=ORIGINATING
pickup    unix  n       -       y       60      1       pickup
cleanup   unix  n       -       y       -       0       cleanup
qmgr      unix  n       -       n       300     1       qmgr
tlsmgr    unix  -       -       y       1000?   1       tlsmgr
rewrite   unix  -       -       y       -       -       trivial-rewrite
bounce    unix  -       -       y       -       0       bounce
defer     unix  -       -       y       -       0       bounce
trace     unix  -       -       y       -       0       bounce
verify    unix  -       -       y       -       1       verify
flush     unix  n       -       y       1000?   0       flush
proxymap  unix  -       -       n       -       -       proxymap
proxywrite unix -       -       n       -       1       proxymap
smtp      unix  -       -       y       -       -       smtp
relay     unix  -       -       y       -       -       smtp
  -o syslog_name=postfix/$service_name
showq     unix  n       -       y       -       -       showq
error     unix  -       -       y       -       -       error
retry     unix  -       -       y       -       -       error
discard   unix  -       -       y       -       -       discard
local     unix  -       n       n       -       -       local
virtual   unix  -       n       n       -       -       virtual
lmtp      unix  -       -       y       -       -       lmtp
anvil     unix  -       -       y       -       1       anvil
scache    unix  -       -       y       -       1       scache
postlog   unix-dgram n  -       n       -       1       postlogd
MASTER
echo "master.cf written"

echo "=== Configuring Dovecot ==="

# Main dovecot config
cat > /etc/dovecot/dovecot.conf << 'DOVECOTCONF'
protocols = imap lmtp
listen = *, ::
dict {
}
!include conf.d/*.conf
DOVECOTCONF

# Mail location - Maildir format
cat > /etc/dovecot/conf.d/10-mail.conf << 'MAILCONF'
mail_location = maildir:/var/vmail/%d/%n/Maildir
mail_privileged_group = vmail
mail_uid = 5000
mail_gid = 5000
first_valid_uid = 5000
last_valid_uid = 5000

namespace inbox {
  inbox = yes
  separator = /

  mailbox Drafts {
    auto = subscribe
    special_use = \Drafts
  }
  mailbox Sent {
    auto = subscribe
    special_use = \Sent
  }
  mailbox Spam {
    auto = subscribe
    special_use = \Junk
  }
  mailbox Trash {
    auto = subscribe
    special_use = \Trash
  }
  mailbox Starred {
    auto = subscribe
  }
}
MAILCONF

# Authentication - passwd-file for virtual users
cat > /etc/dovecot/conf.d/10-auth.conf << 'AUTHCONF'
disable_plaintext_auth = yes
auth_mechanisms = plain login

passdb {
  driver = passwd-file
  args = scheme=BLF-CRYPT username_format=%u /etc/dovecot/users
}

userdb {
  driver = static
  args = uid=5000 gid=5000 home=/var/vmail/%d/%n
}
AUTHCONF

# SSL config
cat > /etc/dovecot/conf.d/10-ssl.conf << 'SSLCONF'
ssl = required
ssl_cert = </etc/letsencrypt/live/mail-api.hyvechain.com/fullchain.pem
ssl_key = </etc/letsencrypt/live/mail-api.hyvechain.com/privkey.pem
ssl_min_protocol = TLSv1.2
ssl_prefer_server_ciphers = yes
SSLCONF

# Master config - LMTP socket for Postfix, auth socket for Postfix SASL
cat > /etc/dovecot/conf.d/10-master.conf << 'MASTERCONF'
service imap-login {
  inet_listener imap {
    port = 143
  }
  inet_listener imaps {
    port = 993
    ssl = yes
  }
}

service imap {
}

service lmtp {
  unix_listener /var/spool/postfix/private/dovecot-lmtp {
    mode = 0600
    user = postfix
    group = postfix
  }
}

service auth {
  unix_listener /var/spool/postfix/private/auth {
    mode = 0660
    user = postfix
    group = postfix
  }
  unix_listener auth-userdb {
    mode = 0660
    user = vmail
    group = vmail
  }
}

service auth-worker {
  user = vmail
}
MASTERCONF

# Logging
cat > /etc/dovecot/conf.d/10-logging.conf << 'LOGCONF'
log_path = /var/log/dovecot.log
info_log_path = /var/log/dovecot-info.log
LOGCONF

# Create empty users file
touch /etc/dovecot/users
chown root:dovecot /etc/dovecot/users
chmod 640 /etc/dovecot/users

echo "Dovecot configured"

echo "=== Creating postmaster account ==="
# Create a postmaster password (use doveadm to hash)
POSTMASTER_PASS=$(openssl rand -base64 16)
POSTMASTER_HASH=$(doveadm pw -s BLF-CRYPT -p "$POSTMASTER_PASS")
echo "postmaster@hyvechain.com:${POSTMASTER_HASH}" > /etc/dovecot/users

# Create postmaster maildir
mkdir -p /var/vmail/hyvechain.com/postmaster/Maildir/{cur,new,tmp}
mkdir -p /var/vmail/hyvechain.com/postmaster/Maildir/.Sent/{cur,new,tmp}
mkdir -p /var/vmail/hyvechain.com/postmaster/Maildir/.Drafts/{cur,new,tmp}
mkdir -p /var/vmail/hyvechain.com/postmaster/Maildir/.Trash/{cur,new,tmp}
mkdir -p /var/vmail/hyvechain.com/postmaster/Maildir/.Spam/{cur,new,tmp}
mkdir -p /var/vmail/hyvechain.com/postmaster/Maildir/.Starred/{cur,new,tmp}
chown -R vmail:vmail /var/vmail/hyvechain.com

echo "Postmaster password: $POSTMASTER_PASS"
echo "(Save this somewhere safe!)"

echo "=== Restarting services ==="
systemctl restart postfix
systemctl restart dovecot
echo "=== Checking services ==="
systemctl is-active postfix dovecot
echo "=== Testing Postfix config ==="
postfix check 2>&1 || true
echo "=== Done ==="
echo "Postfix and Dovecot configured for hyvechain.com"
