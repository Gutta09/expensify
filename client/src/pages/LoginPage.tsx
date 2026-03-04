import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/store';
import { login } from '../store/slices/authSlice';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { loading, error } = useAppSelector((state) => state.auth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await dispatch(login({ email, password }));
    if (login.fulfilled.match(result)) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left - branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-neutral-900 relative overflow-hidden">
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <span className="text-xl font-bold">E</span>
            </div>
            <h1 className="text-3xl font-bold">ExpenseIQ</h1>
          </div>
          <h2 className="text-4xl font-bold mb-4 leading-tight">
            Smart Financial Intelligence
          </h2>
          <p className="text-lg text-white/70 mb-8 max-w-md">
            Predictive analytics, anomaly detection, and personalized recommendations
            to transform how you manage your finances.
          </p>
          <div className="space-y-4">
            {[
              'Smart transaction categorization with ML',
              'Spending forecasts powered by Prophet',
              'Real-time anomaly detection',
              'GPT-4 financial coaching',
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
                <span className="text-sm text-white/80">{feature}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-white/5" />
      </div>

      {/* Right - login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center">
              <span className="text-sm font-bold text-white">E</span>
            </div>
            <h1 className="text-2xl font-bold text-neutral-900">ExpenseIQ</h1>
          </div>

          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Welcome back</h2>
          <p className="text-neutral-500 mb-8">Sign in to continue to your dashboard</p>

          {error && (
            <div className="mb-6 p-4 bg-neutral-100 border border-neutral-300 rounded-xl text-sm text-neutral-900">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-500">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="font-medium text-neutral-900 underline hover:no-underline">
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
