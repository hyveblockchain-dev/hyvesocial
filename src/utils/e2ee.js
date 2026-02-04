// src/utils/e2ee.js
import sodium from 'libsodium-wrappers';

const PUBLIC_KEY_KEY = 'e2ee_public_key';
const PRIVATE_KEY_KEY = 'e2ee_private_key_encrypted';
const PRIVATE_KEY_NONCE_KEY = 'e2ee_private_key_nonce';

let cachedPublicKey = null;
let cachedSecretKey = null;
let cachedUnlockKey = null;

async function getUnlockKey() {
  if (cachedUnlockKey) return cachedUnlockKey;
  await sodium.ready;
  if (!window.ethereum) {
    throw new Error('Wallet not available');
  }
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  const address = accounts?.[0];
  if (!address) {
    throw new Error('Wallet not connected');
  }
  const message = 'Hyve Social E2EE Key Access v1';
  const signature = await window.ethereum.request({
    method: 'personal_sign',
    params: [message, address]
  });
  const key = sodium.crypto_generichash(32, signature);
  cachedUnlockKey = key;
  return key;
}

function toBase64(bytes) {
  return sodium.to_base64(bytes, sodium.base64_variants.ORIGINAL);
}

function fromBase64(value) {
  return sodium.from_base64(value, sodium.base64_variants.ORIGINAL);
}

export async function ensureKeypair() {
  await sodium.ready;

  if (!cachedPublicKey) {
    const storedPublic = localStorage.getItem(PUBLIC_KEY_KEY);
    if (storedPublic) {
      cachedPublicKey = fromBase64(storedPublic);
    }
  }

  if (cachedSecretKey && cachedPublicKey) {
    return { publicKey: toBase64(cachedPublicKey), isNew: false };
  }

  const encryptedSecret = localStorage.getItem(PRIVATE_KEY_KEY);
  const encryptedNonce = localStorage.getItem(PRIVATE_KEY_NONCE_KEY);

  if (encryptedSecret && encryptedNonce && cachedPublicKey) {
    const unlockKey = await getUnlockKey();
    const secret = sodium.crypto_secretbox_open_easy(
      fromBase64(encryptedSecret),
      fromBase64(encryptedNonce),
      unlockKey
    );
    cachedSecretKey = secret;
    return { publicKey: toBase64(cachedPublicKey), isNew: false };
  }

  const keyPair = sodium.crypto_box_keypair();
  const unlockKey = await getUnlockKey();
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const encryptedSecretKey = sodium.crypto_secretbox_easy(keyPair.privateKey, nonce, unlockKey);

  localStorage.setItem(PUBLIC_KEY_KEY, toBase64(keyPair.publicKey));
  localStorage.setItem(PRIVATE_KEY_KEY, toBase64(encryptedSecretKey));
  localStorage.setItem(PRIVATE_KEY_NONCE_KEY, toBase64(nonce));

  cachedPublicKey = keyPair.publicKey;
  cachedSecretKey = keyPair.privateKey;

  return { publicKey: toBase64(keyPair.publicKey), isNew: true };
}

export async function encryptMessageForRecipient(recipientPublicKeyBase64, message) {
  await sodium.ready;
  if (!recipientPublicKeyBase64) {
    throw new Error('Recipient has no public key');
  }
  const recipientKey = fromBase64(recipientPublicKeyBase64);
  const cipher = sodium.crypto_box_seal(sodium.from_string(message), recipientKey);
  return toBase64(cipher);
}

export async function decryptMessageContent(cipherBase64) {
  await sodium.ready;
  if (!cachedSecretKey || !cachedPublicKey) {
    await ensureKeypair();
  }
  const cipher = fromBase64(cipherBase64);
  const plain = sodium.crypto_box_seal_open(cipher, cachedPublicKey, cachedSecretKey);
  return sodium.to_string(plain);
}

export function resetE2EESession() {
  cachedUnlockKey = null;
  cachedSecretKey = null;
  cachedPublicKey = null;
}
