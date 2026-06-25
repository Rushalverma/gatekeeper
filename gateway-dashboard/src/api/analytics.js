import { apiRequest } from './client';

export async function getUsage() {
  return apiRequest('/api/analytics/usage');
}
