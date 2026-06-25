import { useState } from 'react';
import { X, Copy, Check, AlertTriangle, Sparkles } from 'lucide-react';

export default function NewKeyModal({ onClose, onGenerate }) {
  const [loading, setLoading] = useState(false);
  const [newKey, setNewKey] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  async function handleGenerate() {
    setLoading(true);
    setError('');
    try {
      const result = await onGenerate();
      setNewKey(result.key.key_id);
    } catch (err) {
      setError(err.message || 'Failed to generate key.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={!newKey ? onClose : undefined} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-[#111827] border border-[#1f2937] rounded-2xl shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#1f2937]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30">
              <Sparkles size={15} className="text-indigo-400" />
            </div>
            <h2 className="text-base font-semibold text-gray-100">Generate New API Key</h2>
          </div>
          {!newKey && (
            <button
              id="btn-close-modal"
              onClick={onClose}
              className="text-gray-500 hover:text-gray-300 transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="px-6 py-5">
          {!newKey ? (
            <>
              <p className="text-sm text-gray-400 mb-5">
                A new cryptographically secure API key will be generated. You can use it in the{' '}
                <code className="text-indigo-400 text-xs bg-indigo-500/10 px-1.5 py-0.5 rounded">X-Api-Key</code>{' '}
                header on all <code className="text-indigo-400 text-xs bg-indigo-500/10 px-1.5 py-0.5 rounded">/v1/*</code> gateway requests.
              </p>

              {error && (
                <div className="flex items-start gap-2 p-3 mb-4 bg-rose-500/10 border border-rose-500/20 rounded-lg text-sm text-rose-400">
                  <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  id="btn-cancel-generate"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 text-sm text-gray-400 bg-[#1f2937] hover:bg-[#374151] border border-[#374151] rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-generate"
                  onClick={handleGenerate}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  {loading ? 'Generating…' : 'Generate Key'}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Warning banner */}
              <div className="flex items-start gap-2.5 p-3.5 mb-5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <AlertTriangle size={15} className="text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-300 leading-relaxed">
                  <span className="font-semibold">Copy this key now.</span> For security reasons, the full key is only shown once and cannot be retrieved again.
                </p>
              </div>

              {/* Key display */}
              <div className="bg-[#030712] border border-[#374151] rounded-xl p-4 mb-4">
                <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">Your new API key</p>
                <code className="text-xs font-mono text-emerald-400 break-all leading-relaxed">{newKey}</code>
              </div>

              <div className="flex gap-3">
                <button
                  id="btn-copy-new-key"
                  onClick={handleCopy}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                    copied
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                  {copied ? 'Copied to clipboard!' : 'Copy Key'}
                </button>
                <button
                  id="btn-done-modal"
                  onClick={onClose}
                  className="px-4 py-2.5 text-sm text-gray-400 bg-[#1f2937] hover:bg-[#374151] border border-[#374151] rounded-lg transition-colors"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
