import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, KeyRound, LogOut, Zap, Activity, CreditCard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const TIER_COLORS = {
  FREE:       'bg-gray-700 text-gray-300',
  PRO:        'bg-indigo-900/60 text-indigo-300',
  ENTERPRISE: 'bg-emerald-900/60 text-emerald-300',
};

export default function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    signOut();
    navigate('/login');
  }

  const tierClass = TIER_COLORS[user?.subscription_tier] || TIER_COLORS.FREE;

  return (
    <div className="flex h-screen bg-[#030712] overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="w-64 flex-shrink-0 flex flex-col bg-[#111827] border-r border-[#1f2937]">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-[#1f2937]">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30">
            <Zap size={18} className="text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-700 text-gray-50 leading-tight font-semibold">API Gateway</p>
            <p className="text-xs text-gray-500">Developer Portal</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavItem to="/dashboard" icon={<LayoutDashboard size={17} />} label="Analytics" />
          <NavItem to="/keys" icon={<KeyRound size={17} />} label="API Keys" />
          <NavItem to="/billing" icon={<CreditCard size={17} />} label="Plans & Billing" />
        </nav>

        {/* User card at bottom */}
        <div className="px-3 pb-4 border-t border-[#1f2937] pt-4">
          <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-[#1f2937]/50">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex-shrink-0">
              <Activity size={14} className="text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-200 truncate">{user?.email}</p>
              <span className={`inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide ${tierClass}`}>
                {user?.subscription_tier || 'FREE'}
              </span>
            </div>
          </div>
          <button
            id="btn-logout"
            onClick={handleLogout}
            className="mt-2 flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-150"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ` +
        (isActive
          ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20'
          : 'text-gray-400 hover:text-gray-100 hover:bg-[#1f2937]')
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}
