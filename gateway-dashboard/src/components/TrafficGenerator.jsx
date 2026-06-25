import { useState, useRef, useCallback } from 'react';
import {
  Zap, Play, Square, ChevronDown, ChevronUp,
  CheckCircle2, ShieldX, Wifi, AlertTriangle,
} from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Endpoints to cycle through during traffic generation
const ENDPOINTS = [
  '/v1/posts',
  '/v1/posts/1',
  '/v1/posts/2',
  '/v1/posts/3',
  '/v1/users',
  '/v1/users/1',
  '/v1/todos/1',
  '/v1/albums/1',
];

const PRESETS = [
  { label: '10 req',   count: 10,  delay: 200  },
  { label: '50 req',   count: 50,  delay: 100  },
  { label: '100 req',  count: 100, delay: 50   },
  { label: 'Burst 200',count: 200, delay: 10   },
];

const SPEEDS = [
  { label: 'Slow (200ms)',   delay: 200 },
  { label: 'Normal (100ms)', delay: 100 },
  { label: 'Fast (50ms)',    delay: 50  },
  { label: 'Burst (5ms)',    delay: 5   },
];

export default function TrafficGenerator({ apiKeys, onComplete }) {
  const [open, setOpen]           = useState(false);
  const [selectedKey, setSelectedKey] = useState('');
  const [count, setCount]         = useState(50);
  const [delay, setDelay]         = useState(100);
  const [running, setRunning]     = useState(false);
  const [stats, setStats]         = useState(null);  // { sent, success, blocked, errors }
  const [log, setLog]             = useState([]);     // last 8 request results

  const abortRef = useRef(false);

  const activeKey = selectedKey || apiKeys?.[0]?.key_id || '';
  const maskedKey = apiKeys?.find(k => k.key_id === activeKey)?.key_masked
                 || apiKeys?.[0]?.key_masked
                 || 'No key found';

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const run = useCallback(async () => {
    if (!activeKey) return;

    abortRef.current = false;
    setRunning(true);
    setLog([]);
    setStats({ sent: 0, success: 0, blocked: 0, errors: 0 });

    let sent = 0, success = 0, blocked = 0, errors = 0;

    for (let i = 0; i < count; i++) {
      if (abortRef.current) break;

      const endpoint = ENDPOINTS[i % ENDPOINTS.length];
      const t0 = performance.now();

      try {
        const res = await fetch(`${BASE_URL}${endpoint}`, {
          headers: { 'X-Api-Key': activeKey },
        });

        const ms = Math.round(performance.now() - t0);
        sent++;

        if (res.status === 429) {
          blocked++;
          addLog({ endpoint, status: 429, ms, type: 'blocked' });
        } else if (res.ok) {
          success++;
          addLog({ endpoint, status: res.status, ms, type: 'success' });
        } else {
          errors++;
          addLog({ endpoint, status: res.status, ms, type: 'error' });
        }
      } catch {
        sent++;
        errors++;
        addLog({ endpoint, status: 'ERR', ms: 0, type: 'error' });
      }

      setStats({ sent, success, blocked, errors });

      if (i < count - 1) await sleep(delay);
    }

    setRunning(false);
    if (onComplete) onComplete();   // trigger chart refresh
  }, [activeKey, count, delay, onComplete]);

  function stop() {
    abortRef.current = true;
  }

  function addLog(entry) {
    setLog(prev => [entry, ...prev].slice(0, 8));
  }

  function applyPreset(preset) {
    setCount(preset.count);
    setDelay(preset.delay);
  }

  const progress = stats ? Math.round((stats.sent / count) * 100) : 0;
  const hasKeys = apiKeys && apiKeys.length > 0;

  return (
    <div className="bg-[#111827] border border-[#1f2937] rounded-2xl overflow-hidden">
      {/* ── Header / toggle ─────────────────────────────────────────── */}
      <button
        id="btn-toggle-traffic-gen"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#1f2937]/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30">
            <Zap size={15} className="text-indigo-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-200">Traffic Generator</p>
            <p className="text-xs text-gray-500">Send test requests to populate your analytics chart</p>
          </div>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {/* ── Expanded panel ──────────────────────────────────────────── */}
      {open && (
        <div className="px-6 pb-6 border-t border-[#1f2937]">
          {!hasKeys ? (
            <div className="flex items-center gap-2.5 mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-400">
              <AlertTriangle size={14} className="flex-shrink-0" />
              No active API keys found. Go to{' '}
              <a href="/keys" className="underline underline-offset-2">API Keys</a>{' '}
              and generate one first.
            </div>
          ) : (
            <div className="mt-4 space-y-5">

              {/* Key selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  API Key to use
                </label>
                <select
                  id="select-traffic-key"
                  value={selectedKey || activeKey}
                  onChange={e => setSelectedKey(e.target.value)}
                  disabled={running}
                  className="w-full px-3 py-2 bg-[#030712] border border-[#374151] rounded-lg text-sm text-gray-200 font-mono focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                >
                  {apiKeys.map(k => (
                    <option key={k.key_id} value={k.key_id}>{k.key_masked}</option>
                  ))}
                </select>
              </div>

              {/* Presets + custom */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Request count
                </label>
                <div className="flex gap-2 flex-wrap">
                  {PRESETS.map(p => (
                    <button
                      key={p.label}
                      onClick={() => applyPreset(p)}
                      disabled={running}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all disabled:opacity-50 ${
                        count === p.count && delay === p.delay
                          ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300'
                          : 'bg-[#1f2937] border-[#374151] text-gray-400 hover:text-gray-200 hover:border-[#4b5563]'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                  {/* Custom input */}
                  <input
                    id="input-custom-count"
                    type="number"
                    min={1}
                    max={500}
                    value={count}
                    onChange={e => setCount(Math.max(1, Math.min(500, Number(e.target.value))))}
                    disabled={running}
                    className="w-24 px-2 py-1.5 text-xs bg-[#030712] border border-[#374151] rounded-lg text-gray-200 text-center focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                    placeholder="Custom"
                  />
                </div>
              </div>

              {/* Speed */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Speed
                </label>
                <div className="flex gap-2 flex-wrap">
                  {SPEEDS.map(s => (
                    <button
                      key={s.label}
                      onClick={() => setDelay(s.delay)}
                      disabled={running}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all disabled:opacity-50 ${
                        delay === s.delay
                          ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300'
                          : 'bg-[#1f2937] border-[#374151] text-gray-400 hover:text-gray-200 hover:border-[#4b5563]'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Run / Stop button */}
              <div className="flex items-center gap-3">
                {!running ? (
                  <button
                    id="btn-start-traffic"
                    onClick={run}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-all shadow-lg shadow-indigo-500/20"
                  >
                    <Play size={14} />
                    Send {count} Requests
                  </button>
                ) : (
                  <button
                    id="btn-stop-traffic"
                    onClick={stop}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-all"
                  >
                    <Square size={14} />
                    Stop
                  </button>
                )}
                {stats && !running && (
                  <p className="text-xs text-gray-500">
                    Done · chart refreshed automatically
                  </p>
                )}
              </div>

              {/* Progress bar */}
              {stats && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>{stats.sent} / {count} sent</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-1.5 bg-[#1f2937] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-150"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  {/* Live stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                      <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
                      <div>
                        <p className="text-lg font-bold text-emerald-400 tabular-nums">{stats.success}</p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">200 OK</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                      <ShieldX size={13} className="text-rose-400 flex-shrink-0" />
                      <div>
                        <p className="text-lg font-bold text-rose-400 tabular-nums">{stats.blocked}</p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">429 Blocked</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                      <Wifi size={13} className="text-amber-400 flex-shrink-0" />
                      <div>
                        <p className="text-lg font-bold text-amber-400 tabular-nums">{stats.errors}</p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">Errors</p>
                      </div>
                    </div>
                  </div>

                  {/* Live request log */}
                  {log.length > 0 && (
                    <div className="bg-[#030712] border border-[#1f2937] rounded-xl p-3 font-mono text-[11px] space-y-1 max-h-36 overflow-y-auto">
                      {log.map((entry, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className={
                            entry.type === 'success' ? 'text-emerald-400' :
                            entry.type === 'blocked' ? 'text-rose-400' :
                            'text-amber-400'
                          }>
                            {entry.status}
                          </span>
                          <span className="text-gray-500">{entry.endpoint}</span>
                          <span className="text-gray-600 ml-auto">{entry.ms}ms</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
