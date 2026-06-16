import { useState, useRef, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../store/store';
import { fetchCurrentUser } from '../store/slices/authSlice';
import { api } from '../services/api';
import { User, Bell, Shield, Palette, CreditCard, Save, Loader2, Check, Upload } from 'lucide-react';

type Tab = 'profile' | 'notifications' | 'security' | 'appearance' | 'billing';

export default function SettingsPage() {
  const { user } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifPush, setNotifPush] = useState(true);
  const [notifBudget, setNotifBudget] = useState(true);
  const [notifAnomalies, setNotifAnomalies] = useState(false);
  const [currency, setCurrency] = useState(user?.preferences?.currency || 'USD');
  const [language, setLanguage] = useState('en');
  const [profileName, setProfileName] = useState(user?.firstName || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null;
    return saved || 'light';
  });
  const [connectingAccount, setConnectingAccount] = useState<string | null>(null);
  const [connectedAccounts, setConnectedAccounts] = useState<Record<string, boolean>>({ Google: true, 'Plaid (Bank)': false });
  const [, setNotifSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Apply theme on mount and when it changes
  useEffect(() => {
    const applyTheme = (t: 'light' | 'dark' | 'system') => {
      if (t === 'dark') {
        document.documentElement.classList.add('dark');
      } else if (t === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', prefersDark);
      }
    };
    applyTheme(theme);

    // Listen for OS preference changes when in system mode
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => {
        document.documentElement.classList.toggle('dark', e.matches);
      };
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      await api.put('/auth/preferences', {
        currency,
        notificationsEnabled: notifEmail,
      });
      dispatch(fetchCurrentUser());
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      // handle error silently
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('File must be under 2MB');
      return;
    }
    // Avatar upload would go to a file upload endpoint
    alert(`Avatar "${file.name}" selected. Upload endpoint not configured yet.`);
  };

  const handleUpdatePassword = async () => {
    setPasswordError('');
    setPasswordSuccess(false);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All password fields are required');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    setPasswordSaving(true);
    try {
      await api.put('/auth/preferences', { password: newPassword });
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch {
      setPasswordError('Failed to update password. Please try again.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleConnectAccount = async (accountName: string) => {
    setConnectingAccount(accountName);
    try {
      if (accountName === 'Plaid (Bank)') {
        if (connectedAccounts[accountName]) {
          // Disconnect
          setConnectedAccounts((prev) => ({ ...prev, [accountName]: false }));
        } else {
          // Initiate Plaid link
          const { data } = await api.post('/plaid/create-link-token');
          if (data.linkToken) {
            alert('Plaid Link token created. Plaid Link UI integration required.');
          }
          setConnectedAccounts((prev) => ({ ...prev, [accountName]: true }));
        }
      } else {
        // Toggle Google connection (placeholder)
        setConnectedAccounts((prev) => ({ ...prev, [accountName]: !prev[accountName] }));
      }
    } catch {
      alert(`Failed to ${connectedAccounts[accountName] ? 'disconnect' : 'connect'} ${accountName}`);
    } finally {
      setConnectingAccount(null);
    }
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    // Dispatch custom event so App.tsx applies the theme immediately
    window.dispatchEvent(new Event('theme-change'));
  };

  const handleSaveNotifications = async () => {
    setNotifSaving(true);
    try {
      await api.put('/auth/preferences', {
        notificationsEnabled: notifEmail,
        budgetAlertPercent: notifBudget ? 80 : 0,
        anomalyAlertThreshold: notifAnomalies ? 0.7 : 1.0,
      });
    } catch {
      // silently handle
    } finally {
      setNotifSaving(false);
    }
  };

  const handleNotifChange = (setter: (v: boolean) => void, value: boolean) => {
    setter(value);
    // Auto-save after a short delay
    setTimeout(() => handleSaveNotifications(), 300);
  };

  const tabs = [
    { id: 'profile' as Tab, label: 'Profile', icon: User },
    { id: 'notifications' as Tab, label: 'Notifications', icon: Bell },
    { id: 'security' as Tab, label: 'Security', icon: Shield },
    { id: 'appearance' as Tab, label: 'Appearance', icon: Palette },
    { id: 'billing' as Tab, label: 'Billing', icon: CreditCard },
  ];

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-neutral-900 dark:bg-white' : 'bg-neutral-300 dark:bg-neutral-600'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-neutral-900 rounded-full transition-transform shadow-sm ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Settings</h1>
        <p className="text-neutral-500 dark:text-neutral-400 mt-1">Manage your account and preferences</p>
      </div>

      <div className="flex gap-6">
        <div className="w-56 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}>
                <tab.icon className="w-4 h-4" /> {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 min-w-0">
          {activeTab === 'profile' && (
            <div className="card p-6 space-y-6">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Profile Information</h2>

              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-2xl bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center">
                  <span className="text-2xl font-bold text-neutral-900 dark:text-white">
                    {user?.firstName?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleAvatarChange} />
                  <button onClick={handleAvatarClick} className="text-sm font-medium text-neutral-900 underline hover:no-underline flex items-center gap-1">
                    <Upload className="w-3 h-3" /> Change avatar
                  </button>
                  <p className="text-xs text-neutral-400 mt-1">JPG, PNG, max 2MB</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Full Name</label>
                  <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} className="input w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Email</label>
                  <input type="email" value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} className="input w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Currency</label>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="input w-full">
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="INR">INR (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Language</label>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)} className="input w-full">
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button onClick={handleSaveProfile} disabled={saving} className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saveSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="card p-6 space-y-6">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Notification Preferences</h2>
              <div className="space-y-4">
                {[
                  { label: 'Email notifications', desc: 'Receive summaries and alerts via email', checked: notifEmail, onChange: (v: boolean) => handleNotifChange(setNotifEmail, v) },
                  { label: 'Push notifications', desc: 'Get instant alerts on your device', checked: notifPush, onChange: (v: boolean) => handleNotifChange(setNotifPush, v) },
                  { label: 'Budget alerts', desc: 'Notify when approaching budget limits', checked: notifBudget, onChange: (v: boolean) => handleNotifChange(setNotifBudget, v) },
                  { label: 'Anomaly alerts', desc: 'Alert when unusual spending is detected', checked: notifAnomalies, onChange: (v: boolean) => handleNotifChange(setNotifAnomalies, v) },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-3 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">{item.label}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{item.desc}</p>
                    </div>
                    <Toggle checked={item.checked} onChange={item.onChange} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="card p-6 space-y-6">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Security</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Current Password</label>
                  <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="input w-full" placeholder="Enter current password" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">New Password</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input w-full" placeholder="Enter new password" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Confirm New Password</label>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input w-full" placeholder="Confirm new password" />
                </div>
                {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
                {passwordSuccess && <p className="text-sm text-green-600">Password updated successfully!</p>}
              </div>
              <div className="flex justify-end">
                <button onClick={handleUpdatePassword} disabled={passwordSaving} className="btn-primary text-sm disabled:opacity-50">
                  {passwordSaving ? 'Updating...' : 'Update Password'}
                </button>
              </div>

              <div className="pt-6 border-t border-neutral-200 dark:border-neutral-700">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3">Connected Accounts</h3>
                <div className="space-y-3">
                  {[
                    { name: 'Google' },
                    { name: 'Plaid (Bank)' },
                  ].map((account) => {
                    const isConnected = connectedAccounts[account.name] || false;
                    const isLoading = connectingAccount === account.name;
                    return (
                      <div key={account.name} className="flex items-center justify-between py-3 px-4 rounded-lg bg-neutral-50 dark:bg-neutral-800">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center">
                            <Shield className="w-4 h-4 text-neutral-900 dark:text-neutral-200" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-neutral-900 dark:text-white">{account.name}</p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">{isConnected ? 'Connected' : 'Not connected'}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleConnectAccount(account.name)}
                          disabled={isLoading}
                          className={`text-sm font-medium disabled:opacity-50 ${isConnected ? 'text-neutral-500 hover:text-neutral-700' : 'text-neutral-900 underline hover:no-underline'}`}
                        >
                          {isLoading ? 'Loading...' : isConnected ? 'Disconnect' : 'Connect'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="card p-6 space-y-6">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Appearance</h2>
              <div>
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">Theme</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'light' as const, label: 'Light', desc: 'Clean white background' },
                    { id: 'dark' as const, label: 'Dark', desc: 'Easy on the eyes' },
                    { id: 'system' as const, label: 'System', desc: 'Match OS preference' },
                  ].map((t) => (
                    <button key={t.id} onClick={() => handleThemeChange(t.id)} className={`p-4 rounded-xl border-2 text-left transition-colors ${t.id === theme ? 'border-neutral-900 dark:border-white' : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500'}`}>
                      <div className={`w-8 h-8 rounded-lg mb-2 ${t.id === 'light' ? 'bg-white border border-neutral-200' : t.id === 'dark' ? 'bg-neutral-900' : 'bg-gradient-to-br from-white to-neutral-900'}`} />
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">{t.label}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="card p-6 space-y-6">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Billing & Plan</h2>
              <div className="p-6 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-neutral-900 dark:text-white">Free Plan</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Basic expense tracking with AI insights</p>
                  </div>
                  <button onClick={() => alert('Pro upgrade coming soon! We\'ll notify you when it\'s available.')} className="btn-primary text-sm">Upgrade to Pro</button>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Plan Features</h3>
                {['Up to 500 transactions/month', 'Basic AI categorization', 'Monthly forecasts', '3 budget categories'].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
                    {f}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
