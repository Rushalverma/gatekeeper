import { useEffect, useRef, useState } from 'react';

/**
 * Animates a numeric value from its previous value to its new value
 * over `duration` ms using requestAnimationFrame.
 */
function useCountUp(target, duration = 800) {
  const [display, setDisplay] = useState(target);
  const prev     = useRef(target);
  const rafRef   = useRef(null);

  useEffect(() => {
    const from = prev.current;
    const to   = typeof target === 'number' ? target : parseFloat(target) || 0;
    if (from === to) return;

    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + (to - from) * eased);
      setDisplay(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prev.current = to;
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return display;
}

export default function StatCard({
  icon,
  label,
  value,          // string like "1,234" or "234 ms" or number
  rawValue,       // optional raw number for animation
  sub,
  accent = 'indigo',
  loading = false,
  trend,          // optional: { direction: 'up'|'down', pct: 12 }
}) {
  const accentMap = {
    indigo:  { ring: 'border-indigo-500/20',  iconBg: 'bg-indigo-600/15',  iconColor: 'text-indigo-400',  glow: 'shadow-indigo-500/10'  },
    emerald: { ring: 'border-emerald-500/20', iconBg: 'bg-emerald-600/15', iconColor: 'text-emerald-400', glow: 'shadow-emerald-500/10' },
    rose:    { ring: 'border-rose-500/20',    iconBg: 'bg-rose-600/15',    iconColor: 'text-rose-400',    glow: 'shadow-rose-500/10'    },
    amber:   { ring: 'border-amber-500/20',   iconBg: 'bg-amber-600/15',   iconColor: 'text-amber-400',   glow: 'shadow-amber-500/10'   },
  };
  const { ring, iconBg, iconColor, glow } = accentMap[accent] || accentMap.indigo;

  // Animate the rawValue if provided; otherwise just show `value` as-is
  const animatedRaw = useCountUp(typeof rawValue === 'number' ? rawValue : 0);

  // Flash effect when value changes
  const [flash, setFlash] = useState(false);
  const prevValue = useRef(value);
  useEffect(() => {
    if (!loading && prevValue.current !== value && prevValue.current !== undefined) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 600);
      prevValue.current = value;
      return () => clearTimeout(t);
    }
    prevValue.current = value;
  }, [value, loading]);

  const displayValue = rawValue !== undefined
    ? animatedRaw.toLocaleString()
    : value;

  return (
    <div
      className={`
        relative bg-[#111827] border ${ring} rounded-xl p-5
        shadow-lg ${glow}
        transition-all duration-300
        ${flash ? 'ring-1 ring-inset ' + ring : ''}
      `}
    >
      {/* Subtle top-edge accent line */}
      <div className={`absolute top-0 left-4 right-4 h-px ${iconBg} opacity-80 rounded-full`} />

      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">{label}</p>
          {loading ? (
            <div className="skeleton h-7 w-28 mt-2" />
          ) : (
            <p className={`mt-1.5 text-2xl font-bold text-gray-50 tabular-nums transition-all duration-300 ${flash ? 'scale-105' : 'scale-100'}`}>
              {displayValue}
            </p>
          )}
          {sub && !loading && (
            <p className="mt-1 text-xs text-gray-500">{sub}</p>
          )}
        </div>
        <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${iconBg} border ${ring} flex-shrink-0`}>
          <span className={iconColor}>{icon}</span>
        </div>
      </div>
    </div>
  );
}
