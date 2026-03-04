import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useEffect } from 'react';
import type { RootState } from './store/store';
import { useSocket } from './hooks/useSocket';

// Layout
import DashboardLayout from './components/layout/DashboardLayout';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import TransactionsPage from './pages/TransactionsPage';
import BudgetsPage from './pages/BudgetsPage';
import ForecastPage from './pages/ForecastPage';
import AIChatPage from './pages/AIChatPage';
import AnalyticsPage from './pages/AnalyticsPage';
import PowerBIPage from './pages/PowerBIPage';
import RecommendationsPage from './pages/RecommendationsPage';
import SettingsPage from './pages/SettingsPage';

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useSelector((state: RootState) => state.auth);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  // Initialize Socket.IO connection for real-time updates
  useSocket();

  // Apply theme globally on app mount and listen for changes
  useEffect(() => {
    const applyTheme = (theme: string) => {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else if (theme === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        // System mode - match OS preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', prefersDark);
      }
    };

    // Apply saved theme from localStorage
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    // Listen for OS preference changes when in system mode
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const osHandler = (e: MediaQueryListEvent) => {
      const current = localStorage.getItem('theme') || 'light';
      if (current === 'system') {
        document.documentElement.classList.toggle('dark', e.matches);
      }
    };
    mq.addEventListener('change', osHandler);

    // Listen for theme changes from SettingsPage via storage event
    const storageHandler = (e: StorageEvent) => {
      if (e.key === 'theme' && e.newValue) {
        applyTheme(e.newValue);
      }
    };
    window.addEventListener('storage', storageHandler);

    // Also listen for custom event dispatched within same tab
    const customHandler = () => {
      const current = localStorage.getItem('theme') || 'light';
      applyTheme(current);
    };
    window.addEventListener('theme-change', customHandler);

    return () => {
      mq.removeEventListener('change', osHandler);
      window.removeEventListener('storage', storageHandler);
      window.removeEventListener('theme-change', customHandler);
    };
  }, []);

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected Routes */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/budgets" element={<BudgetsPage />} />
        <Route path="/forecast" element={<ForecastPage />} />
        <Route path="/ai-coach" element={<AIChatPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/powerbi" element={<PowerBIPage />} />
        <Route path="/recommendations" element={<RecommendationsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
