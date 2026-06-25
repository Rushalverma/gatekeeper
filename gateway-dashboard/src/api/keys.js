import { apiRequest } from './client';

export async function listKeys() {
  return apiRequest('/api/keys');
}

export async function generateKey() {
  return apiRequest('/api/keys/generate', { method: 'POST' });
}

export async function revokeKey(keyId) {
  return apiRequest(`/api/keys/${encodeURIComponent(keyId)}`, { method: 'DELETE' });
}
