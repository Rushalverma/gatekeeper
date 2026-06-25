import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Activity, ShieldX, Gauge, Clock, RefreshCw, BarChart2,
  Wifi, TrendingUp, TrendingDown,
} from 'lucide-react';
import StatCard from '../components/StatCard';
import TrafficGenerator from '../components/TrafficGenerator';
import { getUsage } from '../api/analytics';
import { listKeys } from '../api/keys';
import { useAuth } from '../context/AuthContext';

const TIER_LIMITS    = { FREE: 100, PRO: 10000, ENTERPRISE: 100000 };
const AUTO_POLL_MS   = 30_000; // auto-refresh every 30 seconds

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function sumKey(data, key) {
  return data.reduce((acc, row) => acc + (Number(row[key]) || 0), 0);
}
function timeAgo(date) {
  if (!date) return null;
  const s = Math.floor((Date.now() - date) / 1000);
  if (s < 5)  return 'just now';
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

// ── Custom chart tooltip ─────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-3 shadow-2xl text-xs">
      <p className="text-gray-400 font-medium mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-300">{p.name}:</span>
          <span className="font-semibold text-gray-100">{p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

// ── Empty state ──────────────────────────────────────────────────────────────
const EmptyState = ({ apiKey }) => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  return (
    <div className="flex flex-col items-center justify-center h-72 text-center">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 mb-4">
        <BarChart2 size={28} className="text-indigo-400 opacity-60" />
      </div>
      <p className="text-gray-400 font-medium">No traffic data yet</p>
      <p className="text-sm text-gray-600 mt-1 max-w-xs">
        Make requests through the gateway using your API key to see analytics here.
      </p>
      <code className="mt-4 text-xs bg-[#1f2937] border border-[#374151] text-indigo-300 px-3 py-2 rounded-lg">
        curl -H &quot;X-Api-Key: {apiKey || 'gw_live_...'}&quot; {apiUrl}/v1/posts
      </code>
    </div>
  );
};

// ── Live status dot ──────────────────────────────────────────────────────────
function LiveDot({ active }) {
  return (
    <span className="relative flex h-2 w-2">
      {active && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      )}
      <span className={`relative inline-flex rounded-full h-2 w-2 ${active ? 'bg-emerald-500' : 'bg-gray-600'}`} />
    </span>
  );
}

// ── Auto-refresh countdown ring ───────────────────────────────────────────────
function CountdownRing({ progress }) {
  const r  = 9;
  const cx = 10;
  const circumference = 2 * Math.PI * r;
  return (
    <svg width="20" height="20" className="rotate-[-90deg]">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#1f2937" strokeWidth="2" />
      <circle
        cx={cx} cy={cx} r={r}
        fill="none"
        stroke="#6366f1"
        strokeWidth="2"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - progress)}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s linear' }}
      />
    </svg>
  );
}

export default function Dashboard() {
  const { user }                    = useAuth();
  const [analyticsData, setData]    = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [apiKeys, setApiKeys]       = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(AUTO_POLL_MS / 1000);
  const [tick, setTick]             = useState(0);  // forces re-render for timeAgo
  const pollTimerRef                = useRef(null);
  const countdownRef                = useRef(null);

  // ── fetch analytics ────────────────────────────────────────────────────────
  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else           setLoading(true);
    setError('');
    try {
      const result = await getUsage();
      setData(result);
      setLastUpdated(Date.now());
    } catch (err) {
      setError(err.message || 'Failed to load analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ── mount: fetch data + keys, start auto-poll ─────────────────────────────
  useEffect(() => {
    fetchData();
    listKeys().then(d => setApiKeys(d.keys || [])).catch(() => {});

    // auto-poll every 30s
    pollTimerRef.current = setInterval(() => {
      fetchData(true);
      setSecondsLeft(AUTO_POLL_MS / 1000);
    }, AUTO_POLL_MS);

    return () => clearInterval(pollTimerRef.current);
  }, [fetchData]);

  // ── countdown ticker (updates every second) ───────────────────────────────
  useEffect(() => {
    setSecondsLeft(AUTO_POLL_MS / 1000);
    countdownRef.current = setInterval(() => {
      setSecondsLeft(s => (s <= 1 ? AUTO_POLL_MS / 1000 : s - 1));
      setTick(t => t + 1);  // also refreshes timeAgo
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, []);

  // ── manual refresh — resets countdown ─────────────────────────────────────
  function handleManualRefresh() {
    fetchData(true);
    setSecondsLeft(AUTO_POLL_MS / 1000);
    // restart the auto-poll timer so we don't get double fires
    clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(() => {
      fetchData(true);
      setSecondsLeft(AUTO_POLL_MS / 1000);
    }, AUTO_POLL_MS);
  }

  // ── derived data ──────────────────────────────────────────────────────────
  const tier      = analyticsData?.tier || user?.subscription_tier || 'FREE';
  const rateLimit = analyticsData?.rate_limit_per_minute || TIER_LIMITS[tier] || 100;

  const chartData = (analyticsData?.data || [])
    .slice().reverse()
    .map(row => ({
      ...row,
      date:                  formatDate(row.date),
      successful_requests:   Number(row.successful_requests)  || 0,
      blocked_requests:      Number(row.blocked_requests)     || 0,
      avg_response_time_ms:  Number(row.avg_response_time_ms) || 0,
    }));

  const totalReqs   = sumKey(chartData, 'successful_requests') + sumKey(chartData, 'blocked_requests');
  const blockedReqs = sumKey(chartData, 'blocked_requests');
  const avgRespTime = chartData.length
    ? (chartData.reduce((a, r) => a + r.avg_response_time_ms, 0) / chartData.length).toFixed(1)
    : null;

  const countdownProgress = 1 - (secondsLeft / (AUTO_POLL_MS / 1000));
  const ago = timeAgo(lastUpdated);

  return (
    <div className="p-8 max-w-6xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-2xl font-bold text-gray-50">Analytics</h1>
            <LiveDot active={!loading && !error} />
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Last 7 days · {tier} tier</span>
            {ago && (
              <>
                <span className="text-gray-700">·</span>
                <span className="text-gray-600">Updated {ago}</span>
              </>
            )}
          </div>
        </div>

        {/* Refresh button with countdown ring */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <CountdownRing progress={countdownProgress} />
            <span className="tabular-nums w-6">{secondsLeft}s</span>
          </div>
          <button
            id="btn-refresh-analytics"
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 text-sm text-gray-400 hover:text-gray-100 bg-[#111827] hover:bg-[#1f2937] border border-[#374151] rounded-lg transition-all duration-150 disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 mb-6 bg-rose-500/10 border border-rose-500/20 rounded-xl text-sm text-rose-400">
          <Wifi size={14} className="flex-shrink-0" />
          {error}
          <button onClick={handleManualRefresh} className="ml-auto underline underline-offset-2 text-xs">
            Retry
          </button>
        </div>
      )}

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Activity size={18} />}
          label="Total Requests"
          value={loading ? '—' : totalReqs.toLocaleString()}
          rawValue={loading ? undefined : totalReqs}
          sub="Last 7 days"
          accent="indigo"
          loading={loading}
        />
        <StatCard
          icon={<ShieldX size={18} />}
          label="Blocked (429)"
          value={loading ? '—' : blockedReqs.toLocaleString()}
          rawValue={loading ? undefined : blockedReqs}
          sub="Rate limited"
          accent="rose"
          loading={loading}
        />
        <StatCard
          icon={<Gauge size={18} />}
          label="Rate Limit"
          value={loading ? '—' : `${rateLimit.toLocaleString()}/min`}
          rawValue={loading ? undefined : rateLimit}
          sub={`${tier} plan`}
          accent="emerald"
          loading={loading}
        />
        <StatCard
          icon={<Clock size={18} />}
          label="Avg Response"
          value={loading || !avgRespTime ? '—' : `${avgRespTime} ms`}
          rawValue={loading ? undefined : Number(avgRespTime) || 0}
          sub="7-day average"
          accent="amber"
          loading={loading}
        />
      </div>

      {/* ── Traffic Generator ──────────────────────────────────────────────── */}
      <div className="mb-6">
        <TrafficGenerator
          apiKeys={apiKeys}
          onComplete={() => { fetchData(true); setSecondsLeft(AUTO_POLL_MS / 1000); }}
        />
      </div>

      {/* ── Request Volume Chart ───────────────────────────────────────────── */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-semibold text-gray-200">Request Volume</h2>
            <p className="text-xs text-gray-500 mt-0.5">Successful vs. rate-limited requests</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/70" /> Successful
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/70" /> Blocked
            </span>
          </div>
        </div>

        {loading ? (
          <div className="skeleton h-72 w-full rounded-xl" />
        ) : chartData.length === 0 ? (
          <EmptyState apiKey={apiKeys?.[0]?.key_masked} />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradSuccess" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradBlocked" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f43f5e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} width={45} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#374151', strokeWidth: 1 }} />
              <Area type="monotone" dataKey="successful_requests" name="Successful"
                stroke="#10b981" strokeWidth={2} fill="url(#gradSuccess)"
                dot={false} activeDot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
                isAnimationActive={true} animationDuration={600}
              />
              <Area type="monotone" dataKey="blocked_requests" name="Blocked"
                stroke="#f43f5e" strokeWidth={2} fill="url(#gradBlocked)"
                dot={false} activeDot={{ r: 4, fill: '#f43f5e', strokeWidth: 0 }}
                isAnimationActive={true} animationDuration={600}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Avg Response Time Chart ────────────────────────────────────────── */}
      {!loading && chartData.length > 0 && (
        <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-6">
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-gray-200">Avg Response Time</h2>
            <p className="text-xs text-gray-500 mt-0.5">Milliseconds per day</p>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} width={45} unit=" ms" />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1f2937' }} />
              <Bar dataKey="avg_response_time_ms" name="Avg Response" fill="#6366f1"
                radius={[4, 4, 0, 0]} maxBarSize={40}
                isAnimationActive={true} animationDuration={600}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
