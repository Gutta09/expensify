import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { logout } from '../../store/slices/authSlice';
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  TrendingUp,
  Bot,
  BarChart3,
  BarChart,
  Lightbulb,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronDown,
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/transactions', label: 'Transactions', icon: Receipt },
  { path: '/budgets', label: 'Budgets', icon: Wallet },
  { path: '/forecast', label: 'Forecast', icon: TrendingUp },
  { path: '/ai-coach', label: 'AI Coach', icon: Bot },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/powerbi', label: 'Power BI', icon: BarChart },
  { path: '/recommendations', label: 'Recommendations', icon: Lightbulb },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-white dark:bg-neutral-950">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-white dark:bg-neutral-950 border-r border-neutral-200 dark:border-neutral-800 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-neutral-200 dark:border-neutral-800">
          <div className="w-9 h-9 rounded-lg bg-neutral-900 flex items-center justify-center">
            <span className="text-white text-sm font-bold">E</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-neutral-900 dark:text-white">ExpenseIQ</h1>
            <p className="text-[10px] text-neutral-400 tracking-wider uppercase">
              Finance Tracker
            </p>
          </div>
          <button
            className="ml-auto lg:hidden text-neutral-500 hover:text-neutral-700"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User info at bottom */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-neutral-900 dark:bg-white flex items-center justify-center">
              <span className="text-sm font-semibold text-white dark:text-neutral-900">
                {user?.firstName?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                {user ? `${user.firstName} ${user.lastName}` : 'User'}
              </p>
              <p className="text-xs text-neutral-400 truncate">
                {user?.email || ''}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-4 px-4 sm:px-6 py-3 bg-white dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800">
          <button
            className="lg:hidden text-neutral-500 hover:text-neutral-700"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex-1" />

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => { setNotificationsOpen(!notificationsOpen); setProfileOpen(false); }}
              className="relative p-2 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-neutral-900 rounded-full" />
            </button>

            {notificationsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} />
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Notifications</h3>
                    <button onClick={() => setNotificationsOpen(false)} className="text-xs text-neutral-500 hover:text-neutral-700">
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {[
                      { title: 'Budget Alert', desc: 'Food & Dining budget is at 85%', time: '2h ago', unread: true },
                      { title: 'Anomaly Detected', desc: 'Unusual transaction of $450 at Electronics Store', time: '5h ago', unread: true },
                      { title: 'Monthly Report', desc: 'Your February spending report is ready', time: '1d ago', unread: false },
                    ].map((notif, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setNotificationsOpen(false); navigate(notif.title.includes('Budget') ? '/budgets' : notif.title.includes('Anomaly') ? '/transactions' : '/analytics'); }}
                        className={`w-full text-left px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800 border-b border-neutral-100 dark:border-neutral-800 last:border-0 ${notif.unread ? 'bg-neutral-50/50 dark:bg-neutral-800/50' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          {notif.unread && <span className="w-2 h-2 rounded-full bg-neutral-900 mt-1.5 flex-shrink-0" />}
                          {!notif.unread && <span className="w-2 h-2 rounded-full bg-transparent mt-1.5 flex-shrink-0" />}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-neutral-900 dark:text-white">{notif.title}</p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">{notif.desc}</p>
                            <p className="text-[10px] text-neutral-400 mt-1">{notif.time}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="px-4 py-2 border-t border-neutral-200 dark:border-neutral-700">
                    <button onClick={() => { setNotificationsOpen(false); navigate('/settings'); }} className="w-full text-center text-xs text-neutral-500 hover:text-neutral-700 py-1">
                      Notification Settings
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Profile dropdown */}
          <div className="relative">
            <button
              onClick={() => { setProfileOpen(!profileOpen); setNotificationsOpen(false); }}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <div className="w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center">
                <span className="text-sm font-semibold text-white">
                  {user?.firstName?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <ChevronDown className="w-4 h-4 text-neutral-500" />
            </button>

            {profileOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setProfileOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 py-1 z-50">
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      navigate('/settings');
                    }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </button>
                  <hr className="my-1 border-neutral-200 dark:border-neutral-700" />
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-neutral-50 dark:bg-neutral-900">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
