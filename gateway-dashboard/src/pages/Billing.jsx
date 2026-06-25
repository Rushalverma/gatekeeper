import { useState, useEffect } from 'react';
import { Check, Zap, Rocket, Building2, ArrowRight, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { getMe, upgradeTier } from '../api/user';
import { useAuth } from '../context/AuthContext';

const TIER_META = {
  FREE: {
    icon:        <Zap size={20} />,
    label:       'Free',
    color:       'gray',
    gradient:    'from-gray-700/30 to-gray-800/10',
    border:      'border-gray-700/50',
    activeBorder:'border-gray-500',
    iconBg:      'bg-gray-700/40',
    iconColor:   'text-gray-300',
    badge:       'bg-gray-700 text-gray-300',
    btnClass:    'bg-gray-700 text-gray-400 cursor-not-allowed',
  },
  PRO: {
    icon:        <Rocket size={20} />,
    label:       'Pro',
    color:       'indigo',
    gradient:    'from-indigo-600/20 to-indigo-900/5',
    border:      'border-indigo-600/30',
    activeBorder:'border-indigo-500',
    iconBg:      'bg-indigo-600/20',
    iconColor:   'text-indigo-400',
    badge:       'bg-indigo-900/60 text-indigo-300',
    btnClass:    'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20',
    popular:     true,
  },
  ENTERPRISE: {
    icon:        <Building2 size={20} />,
    label:       'Enterprise',
    color:       'emerald',
    gradient:    'from-emerald-600/15 to-emerald-900/5',
    border:      'border-emerald-600/25',
    activeBorder:'border-emerald-500',
    iconBg:      'bg-emerald-600/20',
    iconColor:   'text-emerald-400',
    badge:       'bg-emerald-900/60 text-emerald-300',
    btnClass:    'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20',
  },
};

const TIER_FEATURES = {
  FREE:       ['100 req / minute', 'Up to 3 API keys', 'Last 7 days analytics', 'Community support'],
  PRO:        ['10,000 req / minute', 'Up to 20 API keys', 'Last 7 days analytics', 'Priority email support', 'Advanced rate-limit headers'],
  ENTERPRISE: ['100,000 req / minute', 'Up to 100 API keys', 'Last 7 days analytics', 'Dedicated support', 'Advanced rate-limit headers', 'Custom SLA'],
};

function TierCard({ tier, details, isCurrent, canUpgrade, onUpgrade, upgrading }) {
  const meta = TIER_META[tier];
  const features = TIER_FEATURES[tier];

  return (
    <div
      className={`relative flex flex-col bg-gradient-to-b ${meta.gradient} border ${
        isCurrent ? meta.activeBorder : meta.border
      } rounded-2xl p-6 transition-all duration-200 ${canUpgrade ? 'hover:scale-[1.01]' : ''}`}
    >
      {/* Popular badge */}
      {meta.popular && !isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="text-[10px] font-bold uppercase tracking-widest bg-indigo-600 text-white px-3 py-1 rounded-full shadow-lg shadow-indigo-500/30">
            Most Popular
          </span>
        </div>
      )}

      {/* Current badge */}
      {isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${meta.badge}`}>
            Current Plan
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${meta.iconBg} border ${meta.border}`}>
            <span className={meta.iconColor}>{meta.icon}</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-100">{meta.label}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {details.price_usd === 0 ? 'Always free' : `$${details.price_usd} / month`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-50">
            {details.price_usd === 0 ? '$0' : `$${details.price_usd}`}
          </p>
          {details.price_usd > 0 && <p className="text-xs text-gray-500">/mo</p>}
        </div>
      </div>

      {/* Rate limit highlight */}
      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#030712]/50 border ${meta.border} mb-5`}>
        <ShieldCheck size={14} className={meta.iconColor} />
        <span className="text-sm font-semibold text-gray-200">
          {details.rate_limit_per_minute.toLocaleString()}
        </span>
        <span className="text-xs text-gray-500">requests / minute</span>
      </div>

      {/* Features */}
      <ul className="space-y-2.5 flex-1 mb-6">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2.5 text-sm text-gray-300">
            <Check size={13} className={`flex-shrink-0 ${meta.iconColor}`} />
            {f}
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      {isCurrent ? (
        <div className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-medium text-gray-500 bg-[#1f2937]/50 border border-[#374151] rounded-xl">
          <Check size={14} />
          Active Plan
        </div>
      ) : canUpgrade ? (
        <button
          id={`btn-upgrade-${tier.toLowerCase()}`}
          onClick={() => onUpgrade(tier)}
          disabled={upgrading}
          className={`flex items-center justify-center gap-2 w-full py-2.5 text-sm font-semibold rounded-xl transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed ${meta.btnClass}`}
        >
          {upgrading ? (
            <><Loader2 size={14} className="animate-spin" /> Upgrading…</>
          ) : (
            <>Upgrade to {meta.label} <ArrowRight size={14} /></>
          )}
        </button>
      ) : (
        <div className="flex items-center justify-center w-full py-2.5 text-xs text-gray-600 bg-[#1f2937]/30 border border-[#1f2937] rounded-xl">
          Not available from your current plan
        </div>
      )}
    </div>
  );
}

export default function Billing() {
  const { user, signIn } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [upgrading, setUpgrading] = useState(null); // tier name being upgraded to
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');

  useEffect(() => {
    async function fetchProfile() {
      try {
        const data = await getMe();
        setProfile(data);
      } catch (err) {
        setError(err.message || 'Failed to load plan details.');
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  async function handleUpgrade(targetTier) {
    setUpgrading(targetTier);
    setError('');
    setSuccess('');
    try {
      const result = await upgradeTier(targetTier);

      // Update context so sidebar tier badge refreshes immediately
      const updatedUser = { ...user, subscription_tier: targetTier };
      const token = localStorage.getItem('gw_token');
      signIn(token, updatedUser);

      // Refresh the profile data
      const refreshed = await getMe();
      setProfile(refreshed);

      setSuccess(`🎉 Successfully upgraded to ${result.new_tier}! New limits are active immediately.`);
    } catch (err) {
      setError(err.message || 'Upgrade failed. Please try again.');
    } finally {
      setUpgrading(null);
    }
  }

  const currentTier = profile?.user?.subscription_tier || user?.subscription_tier || 'FREE';
  const tiers = profile?.available_tiers || [];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-50">Plans & Billing</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Upgrade your plan to increase rate limits and API key capacity.
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-start gap-2.5 p-4 mb-6 bg-rose-500/10 border border-rose-500/20 rounded-xl text-sm text-rose-400">
          <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2.5 p-4 mb-6 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm text-emerald-400">
          <Check size={15} />
          {success}
        </div>
      )}

      {/* Current plan summary */}
      {!loading && profile && (
        <div className="flex items-center gap-4 p-4 mb-8 bg-[#111827] border border-[#1f2937] rounded-2xl">
          <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${TIER_META[currentTier].iconBg} border ${TIER_META[currentTier].border}`}>
            <span className={TIER_META[currentTier].iconColor}>{TIER_META[currentTier].icon}</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-100">
                {TIER_META[currentTier].label} Plan
              </p>
              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${TIER_META[currentTier].badge}`}>
                {currentTier}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {profile.tier_details?.rate_limit_per_minute?.toLocaleString()} req/min · {profile.tier_details?.max_keys} max keys
            </p>
          </div>
          <p className="text-sm font-semibold text-gray-400">
            {profile.tier_details?.price_usd === 0 ? 'Free' : `$${profile.tier_details?.price_usd}/mo`}
          </p>
        </div>
      )}

      {/* Tier cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-96 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(['FREE', 'PRO', 'ENTERPRISE']).map((tierName) => {
            const tierInfo = tiers.find((t) => t.name === tierName);
            if (!tierInfo) return null;
            return (
              <TierCard
                key={tierName}
                tier={tierName}
                details={tierInfo}
                isCurrent={tierInfo.is_current}
                canUpgrade={tierInfo.can_upgrade_to}
                onUpgrade={handleUpgrade}
                upgrading={upgrading === tierName}
              />
            );
          })}
        </div>
      )}

      {/* Footer note */}
      <p className="mt-8 text-xs text-gray-600 text-center">
        This is a demo SaaS — no real payment is processed. Rate limit changes take effect immediately after upgrade.
      </p>
    </div>
  );
}
