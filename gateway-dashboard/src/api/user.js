import { apiRequest } from './client';

export async function getMe() {
  return apiRequest('/api/user/me');
}

export async function upgradeTier(tier) {
  return apiRequest('/api/user/tier', {
    method: 'PATCH',
    body: JSON.stringify({ tier }),
  });
}
