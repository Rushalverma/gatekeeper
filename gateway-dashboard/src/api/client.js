const DEFAULT_API_URL = import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin;
const BASE_URL = import.meta.env.VITE_API_URL || DEFAULT_API_URL;

/**
 * Base fetch wrapper.
 * - Injects Authorization header from localStorage automatically.
 * - On 401 → clears auth state and redirects to /login.
 */
export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('gw_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('gw_token');
    localStorage.removeItem('gw_user');
    window.location.href = '/login';
    return;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data;
}
