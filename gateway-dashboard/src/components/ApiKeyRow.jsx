import { useState } from 'react';
import { Copy, Check, Trash2, ShieldCheck } from 'lucide-react';

export default function ApiKeyRow({ keyObj, onRevoke }) {
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(keyObj.key_masked || keyObj.key_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRevoke() {
    if (!confirmRevoke) {
      setConfirmRevoke(true);
      return;
    }
    setRevoking(true);
    try {
      await onRevoke(keyObj.key_id);
    } finally {
      setRevoking(false);
      setConfirmRevoke(false);
    }
  }

  const created = keyObj.created_at
    ? new Date(keyObj.created_at).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      })
    : '—';

  return (
    <tr className="border-b border-[#1f2937] group hover:bg-[#1f2937]/40 transition-colors duration-100">
      {/* Key (masked) */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-indigo-600/15 border border-indigo-500/20 flex-shrink-0">
            <ShieldCheck size={13} className="text-indigo-400" />
          </div>
          <code className="text-sm font-mono text-gray-200 truncate max-w-[260px]">
            {keyObj.key_masked || keyObj.key_id}
          </code>
        </div>
      </td>

      {/* Status */}
      <td className="px-5 py-4">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
          {keyObj.status}
        </span>
      </td>

      {/* Created */}
      <td className="px-5 py-4 text-sm text-gray-400">{created}</td>

      {/* Actions */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-2">
          <button
            id={`btn-copy-${keyObj.key_id?.slice(-8)}`}
            onClick={handleCopy}
            title="Copy key"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-400 hover:text-gray-100 bg-[#1f2937] hover:bg-[#374151] border border-[#374151] rounded-lg transition-all duration-150"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>

          <button
            id={`btn-revoke-${keyObj.key_id?.slice(-8)}`}
            onClick={handleRevoke}
            disabled={revoking}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-all duration-150
              ${confirmRevoke
                ? 'text-white bg-rose-600 border-rose-500 animate-pulse'
                : 'text-rose-400 hover:text-white hover:bg-rose-600/80 bg-rose-500/10 border-rose-500/20'
              }`}
          >
            <Trash2 size={12} />
            {revoking ? 'Revoking…' : confirmRevoke ? 'Confirm?' : 'Revoke'}
          </button>
        </div>
      </td>
    </tr>
  );
}
