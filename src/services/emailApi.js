// src/services/emailApi.js
import { EMAIL_API_URL } from '../utils/env';

function getToken() {
  return localStorage.getItem('email_token') || localStorage.getItem('token');
}

function authHeaders(extra = {}) {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

// ========================================
// EMAIL ACCOUNT MANAGEMENT
// ========================================

/** Create a new @hyvechain.com email account */
export async function emailSignup({ username, password, displayName }) {
  const response = await fetch(`${EMAIL_API_URL}/api/email/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, displayName }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Email signup failed');
  return data;
}

/** Reset password using recovery code */
export async function resetPasswordWithCode({ username, recoveryCode, newPassword }) {
  const response = await fetch(`${EMAIL_API_URL}/api/email/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, recoveryCode, newPassword }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Password reset failed');
  return data;
}

/** Login to email account */
export async function emailLogin(email, password) {
  const response = await fetch(`${EMAIL_API_URL}/api/email/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Email login failed');
  return data;
}

/** Check if email username is available */
export async function checkEmailAvailability(username) {
  const response = await fetch(`${EMAIL_API_URL}/api/email/check/${encodeURIComponent(username)}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Availability check failed');
  return data;
}

/** Get current email account info */
export async function getEmailAccount() {
  const response = await fetch(`${EMAIL_API_URL}/api/email/account`, {
    headers: authHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to get account');
  return data;
}

/** Update email account settings */
export async function updateEmailAccount(settings) {
  const response = await fetch(`${EMAIL_API_URL}/api/email/account`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(settings),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to update account');
  return data;
}

/** Change email password */
export async function changeEmailPassword(currentPassword, newPassword) {
  const response = await fetch(`${EMAIL_API_URL}/api/email/account/password`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to change password');
  return data;
}

// ========================================
// MAILBOX OPERATIONS
// ========================================

/** Get messages in a folder (inbox, sent, drafts, trash, spam) */
export async function getMessages(folder = 'inbox', page = 1, limit = 50) {
  const response = await fetch(
    `${EMAIL_API_URL}/api/email/messages?folder=${folder}&page=${page}&limit=${limit}`,
    { headers: authHeaders() }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to fetch messages');
  return data;
}

/** Get a single message by ID */
export async function getMessage(messageId, folder = 'inbox') {
  const response = await fetch(`${EMAIL_API_URL}/api/email/messages/${messageId}?folder=${folder}`, {
    headers: authHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to fetch message');
  return data;
}

/** Send an email (uses FormData when attachments are present) */
export async function sendEmail({ to, cc, bcc, subject, body, attachments, replyTo }) {
  const token = getToken();
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  let fetchOptions;

  if (attachments && attachments.length > 0) {
    // Use FormData for file uploads
    const formData = new FormData();
    formData.append('to', JSON.stringify(to));
    if (cc) formData.append('cc', JSON.stringify(cc));
    if (bcc) formData.append('bcc', JSON.stringify(bcc));
    formData.append('subject', subject || '');
    formData.append('body', body || '');
    if (replyTo) formData.append('replyTo', replyTo);

    for (const file of attachments) {
      formData.append('attachments', file, file.name);
    }

    fetchOptions = {
      method: 'POST',
      headers: authHeader, // No Content-Type — browser sets multipart boundary
      body: formData,
    };
  } else {
    fetchOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ to, cc, bcc, subject, body, replyTo }),
    };
  }

  const response = await fetch(`${EMAIL_API_URL}/api/email/send`, fetchOptions);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to send email');
  return data;
}

/** Download an attachment (returns a blob URL) */
export async function downloadAttachment(messageId, attachmentIndex, folder = 'inbox') {
  const response = await fetch(
    `${EMAIL_API_URL}/api/email/messages/${messageId}/attachments/${attachmentIndex}?folder=${folder}`,
    { headers: { Authorization: `Bearer ${getToken()}` } }
  );
  if (!response.ok) throw new Error('Failed to download attachment');
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

/** Save draft */
export async function saveDraft({ to, cc, bcc, subject, body, draftId }) {
  const response = await fetch(`${EMAIL_API_URL}/api/email/drafts`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ to, cc, bcc, subject, body, draftId }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to save draft');
  return data;
}

/** Mark message as read/unread */
export async function markMessage(messageId, read = true) {
  const response = await fetch(`${EMAIL_API_URL}/api/email/messages/${messageId}/read`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ read }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to update message');
  return data;
}

/** Star/unstar a message */
export async function starMessage(messageId, starred = true) {
  const response = await fetch(`${EMAIL_API_URL}/api/email/messages/${messageId}/star`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ starred }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to update message');
  return data;
}

/** Move message to folder (trash, spam, inbox, etc.) */
export async function moveMessage(messageId, folder) {
  const response = await fetch(`${EMAIL_API_URL}/api/email/messages/${messageId}/move`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ folder }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to move message');
  return data;
}

/** Delete message permanently */
export async function deleteMessage(messageId) {
  const response = await fetch(`${EMAIL_API_URL}/api/email/messages/${messageId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to delete message');
  return data;
}

/** Get unread count per folder */
export async function getUnreadCounts() {
  const response = await fetch(`${EMAIL_API_URL}/api/email/unread`, {
    headers: authHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to get unread counts');
  return data;
}

/** Search emails */
export async function searchEmails(query, folder = 'all') {
  const response = await fetch(
    `${EMAIL_API_URL}/api/email/search?q=${encodeURIComponent(query)}&folder=${folder}`,
    { headers: authHeaders() }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Search failed');
  return data;
}

// ========================================
// HYVE SOCIAL INTEGRATION
// ========================================

/** Link email account to Hyve Social account */
export async function linkToSocial(socialToken) {
  const response = await fetch(`${EMAIL_API_URL}/api/email/link-social`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ socialToken }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to link accounts');
  return data;
}

/** Login to Hyve Social using @hyvechain.com email */
export async function socialLoginWithEmail(email, password) {
  const response = await fetch(`${EMAIL_API_URL}/api/email/social-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Social login failed');
  return data;
}

/** Get social auth token from current email session */
export async function getSocialToken() {
  const response = await fetch(`${EMAIL_API_URL}/api/email/social-token`, {
    headers: authHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to get social token');
  return data;
}

const emailApi = {
  emailSignup,
  emailLogin,
  resetPasswordWithCode,
  checkEmailAvailability,
  getEmailAccount,
  updateEmailAccount,
  changeEmailPassword,
  getMessages,
  getMessage,
  sendEmail,
  saveDraft,
  markMessage,
  starMessage,
  moveMessage,
  deleteMessage,
  getUnreadCounts,
  searchEmails,
  downloadAttachment,
  linkToSocial,
  socialLoginWithEmail,
  getSocialToken,
};

export default emailApi;
