import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/store';
import { register } from '../store/slices/authSlice';
import { Eye, EyeOff, ArrowRight, Check } from 'lucide-react';

export default function RegisterPage() {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { loading, error } = useAppSelector((state) => state.auth);

  const passwordChecks = [
    { label: 'At least 8 characters', valid: form.password.length >= 8 },
    { label: 'Contains uppercase letter', valid: /[A-Z]/.test(form.password) },
    { label: 'Contains number', valid: /\d/.test(form.password) },
    { label: 'Passwords match', valid: form.password === form.confirmPassword && form.confirmPassword.length > 0 },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) return;
    const result = await dispatch(register({ firstName: form.firstName, lastName: form.lastName, email: form.email, password: form.password }));
    if (register.fulfilled.match(result)) {
      navigate('/dashboard');
    }
  };

  const updateField = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

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
          <h2 className="text-4xl font-bold mb-4 leading-tight">Start your financial journey</h2>
          <p className="text-lg text-white/70 max-w-md">
            Join thousands of users who have transformed their financial habits with AI-powered insights.
          </p>
        </div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
      </div>

      {/* Right - register form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center">
              <span className="text-sm font-bold text-white">E</span>
            </div>
            <h1 className="text-2xl font-bold text-neutral-900">ExpenseIQ</h1>
          </div>

          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Create your account</h2>
          <p className="text-neutral-500 mb-8">Get started with AI-powered expense tracking</p>

          {error && (
            <div className="mb-6 p-4 bg-neutral-100 border border-neutral-300 rounded-xl text-sm text-neutral-900">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">First name</label>
              <input type="text" value={form.firstName} onChange={(e) => updateField('firstName', e.target.value)} className="input" placeholder="John" required />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Last name</label>
              <input type="text" value={form.lastName} onChange={(e) => updateField('lastName', e.target.value)} className="input" placeholder="Doe" required />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Email address</label>
              <input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} className="input" placeholder="you@example.com" required />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => updateField('password', e.target.value)}
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

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Confirm password</label>
              <input type="password" value={form.confirmPassword} onChange={(e) => updateField('confirmPassword', e.target.value)} className="input" placeholder="••••••••" required />
            </div>

            {form.password.length > 0 && (
              <div className="space-y-2">
                {passwordChecks.map((check) => (
                  <div key={check.label} className="flex items-center gap-2 text-xs">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center ${check.valid ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-400'}`}>
                      {check.valid && <Check className="w-3 h-3" />}
                    </div>
                    <span className={check.valid ? 'text-neutral-900' : 'text-neutral-500'}>{check.label}</span>
                  </div>
                ))}
              </div>
            )}

            <button type="submit" disabled={loading || !passwordChecks.every((c) => c.valid)} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Create Account
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-500">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-neutral-900 underline hover:no-underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
