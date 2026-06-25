import { useState, useEffect, useCallback } from 'react';
import { Plus, KeyRound, RefreshCw, ShieldOff } from 'lucide-react';
import ApiKeyRow from '../components/ApiKeyRow';
import NewKeyModal from '../components/NewKeyModal';
import { listKeys, generateKey, revokeKey } from '../api/keys';

export default function Keys() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchKeys = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const data = await listKeys();
      setKeys(data.keys || []);
    } catch (err) {
      setError(err.message || 'Failed to load API keys.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  async function handleGenerate() {
    const result = await generateKey();
    // Re-fetch list to show new (masked) key in table
    await fetchKeys();
    return result;
  }

  async function handleRevoke(keyId) {
    await revokeKey(keyId);
    setKeys((prev) => prev.filter((k) => k.key_id !== keyId));
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-50">API Keys</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {keys.length} active {keys.length === 1 ? 'key' : 'keys'} · Add to{' '}
            <code className="text-indigo-400 text-xs bg-indigo-500/10 px-1.5 py-0.5 rounded">X-Api-Key</code> header
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            id="btn-refresh-keys"
            onClick={() => fetchKeys(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 text-sm text-gray-400 hover:text-gray-100 bg-[#111827] hover:bg-[#1f2937] border border-[#374151] rounded-lg transition-all duration-150"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            id="btn-open-generate-modal"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-all duration-150 shadow-lg shadow-indigo-500/20"
          >
            <Plus size={15} />
            Generate New Key
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 mb-6 bg-rose-500/10 border border-rose-500/20 rounded-xl text-sm text-rose-400">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1f2937] flex items-center gap-2">
          <KeyRound size={15} className="text-gray-500" />
          <span className="text-xs font-medium text-gray-500 uppercase tracking-widest">Active Keys</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1f2937]">
                {['Key', 'Status', 'Created', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-widest"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#1f2937]">
                    <td className="px-5 py-4"><div className="skeleton h-4 w-56" /></td>
                    <td className="px-5 py-4"><div className="skeleton h-4 w-16" /></td>
                    <td className="px-5 py-4"><div className="skeleton h-4 w-24" /></td>
                    <td className="px-5 py-4"><div className="skeleton h-4 w-32" /></td>
                  </tr>
                ))
              ) : keys.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#1f2937] border border-[#374151]">
                        <ShieldOff size={22} className="text-gray-600" />
                      </div>
                      <p className="text-sm text-gray-500">No active API keys</p>
                      <button
                        id="btn-generate-first-key"
                        onClick={() => setShowModal(true)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors"
                      >
                        Generate your first key →
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                keys.map((k) => (
                  <ApiKeyRow key={k.key_id} keyObj={k} onRevoke={handleRevoke} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Usage hint */}
      {!loading && keys.length > 0 && (
        <div className="mt-4 p-4 bg-[#111827] border border-[#1f2937] rounded-xl">
          <p className="text-xs text-gray-500 font-medium mb-2">Quick usage example</p>
          <code className="text-xs text-indigo-300 font-mono">
            curl -H "X-Api-Key: {keys[0]?.key_masked}" http://localhost:3000/v1/your-endpoint
          </code>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <NewKeyModal
          onClose={() => setShowModal(false)}
          onGenerate={handleGenerate}
        />
      )}
    </div>
  );
}
