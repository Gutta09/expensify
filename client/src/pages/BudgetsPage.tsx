import { useEffect, useState, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../store/store';
import { fetchBudgets, createBudget, fetchBudgetVariance, fetchBudgetSuggestions } from '../store/slices/budgetSlice';
import { Plus, X, Sparkles, TrendingUp, Check } from 'lucide-react';
import { exportToExcel, budgetColumns, varianceColumns } from '../utils/exportToExcel';
import { exportToPdf, budgetColumns as pdfBudgetCols, varianceColumns as pdfVarianceCols } from '../utils/exportToPdf';
import ExportDropdown from '../components/ui/ExportDropdown';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { IosSpinner } from '../components/ui/ios-spinner';

export default function BudgetsPage() {
  const dispatch = useAppDispatch();
  const { items: budgets, variance, suggestions, loading } = useAppSelector((state) => state.budgets);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    dispatch(fetchBudgets());
    dispatch(fetchBudgetVariance());
    dispatch(fetchBudgetSuggestions());
  }, [dispatch]);

  const varianceData = useMemo(() => (variance || []).map((v: any) => ({
    category: v._id || v.category,
    budget: v.budgetLimit || 0,
    actual: v.actualSpend || 0,
    variance: (v.budgetLimit || 0) - (v.actualSpend || 0),
  })), [variance]);

  const tooltipStyle = useMemo(() => ({ background: 'rgba(255,255,255,0.95)', border: '1px solid #e5e5e5', borderRadius: '12px', fontSize: '13px' }), []);
  const xTickStyle = useMemo(() => ({ fontSize: 11 }), []);
  const yTickStyle = useMemo(() => ({ fontSize: 12 }), []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Budgets</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">Track and manage your spending limits</p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <ExportDropdown
            disabled={budgets.length === 0}
            onExportExcel={() => {
              const vd = varianceData.map((v) => ({ ...v, status: v.actual > v.budget ? 'Over Budget' : 'On Track' }));
              exportToExcel(
                [{ name: 'Budgets', data: budgets, columns: budgetColumns }, { name: 'Budget vs Actual', data: vd, columns: varianceColumns }],
                'ExpenseIQ_Budgets'
              );
            }}
            onExportPdf={() => {
              const vd = varianceData.map((v) => ({ ...v, status: v.actual > v.budget ? 'Over Budget' : 'On Track' }));
              exportToPdf(
                [{ name: 'Budgets', data: budgets, columns: pdfBudgetCols }, { name: 'Budget vs Actual', data: vd, columns: pdfVarianceCols }],
                'ExpenseIQ_Budgets',
                { title: 'Budget Report' }
              );
            }}
          />
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Create Budget
          </button>
        </div>
      </div>

      {suggestions && suggestions.length > 0 && (
        <div className="card p-6 border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800/50">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-neutral-900" />
            <h3 className="font-semibold text-neutral-900 dark:text-white">AI Budget Suggestions</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {suggestions.map((s: any) => (
              <div key={s.category} className="p-4 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700">
                <p className="text-sm font-medium text-neutral-900 dark:text-white">{s.category}</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1">${s.suggestedLimit?.toLocaleString() || s.suggestedBudget?.toLocaleString()}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Avg spend: ${s.averageSpend?.toLocaleString() || '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {varianceData.length > 0 && (
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">Budget vs Actual Spending</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={varianceData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="category" tick={xTickStyle} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={yTickStyle} />
                <Tooltip contentStyle={tooltipStyle} isAnimationActive={false} />
                <Legend />
                <Bar dataKey="budget" name="Budget" fill="#171717" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="actual" name="Actual" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {varianceData.map((entry: any, idx: number) => (
                    <Cell key={idx} fill={entry.actual > entry.budget ? '#171717' : '#a3a3a3'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {budgets.map((budget) => {
          const pct = budget.limitAmount > 0 ? Math.min(100, (budget.currentSpend / budget.limitAmount) * 100) : 0;
          const isOver = pct >= 100;
          const isWarning = pct >= 80 && pct < 100;
          return (
            <div key={budget._id} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">{budget.category}</h3>
                <span className={`badge ${isOver ? 'badge-danger' : isWarning ? 'badge-warning' : 'badge-success'}`}>
                  {isOver ? 'Over budget' : isWarning ? 'Warning' : 'On track'}
                </span>
              </div>
              <div className="flex items-end gap-1 mb-2">
                <span className="text-2xl font-bold text-neutral-900 dark:text-white">${budget.currentSpend.toLocaleString()}</span>
                <span className="text-sm text-neutral-500 dark:text-neutral-400 mb-0.5">/ ${budget.limitAmount.toLocaleString()}</span>
              </div>
              <div className="h-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden mb-2">
                <div className="h-full rounded-full transition-all duration-500 bg-neutral-900" style={{ width: `${Math.min(pct, 100)}%`, opacity: isOver ? 1 : isWarning ? 0.7 : 0.4 }} />
              </div>
              <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span>{pct.toFixed(0)}% used</span>
                <span>${Math.max(0, budget.limitAmount - budget.currentSpend).toLocaleString()} remaining</span>
              </div>
              <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                <span className="capitalize">{budget.period}</span>
                {budget.alertThreshold && <span>• Alert at {budget.alertThreshold}%</span>}
              </div>
            </div>
          );
        })}
        {budgets.length === 0 && !loading && (
          <div className="col-span-full text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-neutral-400" />
            </div>
            <p className="text-neutral-500 dark:text-neutral-400 mb-4">No budgets created yet</p>
            <button onClick={() => setShowCreate(true)} className="btn-primary">Create Your First Budget</button>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateBudgetModal onClose={() => setShowCreate(false)} onCreated={() => { dispatch(fetchBudgets()); dispatch(fetchBudgetVariance()); }} />
      )}
    </div>
  );
}

function CreateBudgetModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const dispatch = useAppDispatch();
  const [form, setForm] = useState({ category: 'Food & Dining', limit: '', period: 'monthly', alertThreshold: '80' });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const getDateRange = (period: string) => {
    const now = new Date();
    let start: Date, end: Date;
    switch (period) {
      case 'weekly': {
        const day = now.getDay();
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
        end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
        break;
      }
      case 'quarterly': {
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = new Date(now.getFullYear(), quarter * 3 + 3, 0);
        break;
      }
      case 'annual': {
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
      }
      default: {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      }
    }
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side validation
    const limitVal = parseFloat(form.limit);
    if (!form.limit || isNaN(limitVal) || limitVal <= 0) {
      setError('Please enter a valid budget limit greater than 0');
      return;
    }

    setSubmitting(true);
    try {
      const { startDate, endDate } = getDateRange(form.period);
      await dispatch(createBudget({
        category: form.category,
        limitAmount: limitVal,
        period: form.period as 'weekly' | 'monthly' | 'quarterly' | 'annual',
        alertThreshold: parseInt(form.alertThreshold),
        startDate,
        endDate,
      })).unwrap();
      setSubmitting(false);
      setSuccess(true);
      setTimeout(() => {
        onCreated();
        onClose();
      }, 2000);
    } catch (err: any) {
      setSubmitting(false);
      setError(typeof err === 'string' ? err : 'Failed to create budget. Please try again.');
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-xl w-full max-w-md p-10 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center animate-bounce">
            <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Budget Created!</h2>
          <p className="text-neutral-500 dark:text-neutral-400 mt-2">Your <strong>{form.category}</strong> budget has been added successfully.</p>
          <div className="mt-6">
            <div className="h-1.5 w-40 mx-auto bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full budget-progress-bar" />
            </div>
            <p className="text-xs text-neutral-400 mt-2">Closing automatically…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white">New Budget</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600"><X className="w-5 h-5" /></button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Category</label>
            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="input">
              {['Food & Dining', 'Shopping', 'Transportation', 'Entertainment', 'Bills & Utilities', 'Healthcare', 'Education', 'Travel', 'Groceries', 'Personal Care', 'Gifts & Donations', 'Insurance', 'Investments', 'Other'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Limit ($)</label>
              <input type="number" step="0.01" min="0.01" value={form.limit} onChange={(e) => { setForm((f) => ({ ...f, limit: e.target.value })); setError(''); }} className="input" placeholder="500.00" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Period</label>
              <select value={form.period} onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))} className="input">
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Alert Threshold (%)</label>
            <input type="number" min="1" max="100" value={form.alertThreshold} onChange={(e) => setForm((f) => ({ ...f, alertThreshold: e.target.value }))} className="input" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {submitting ? <><IosSpinner size="sm" className="text-white dark:text-neutral-900" /> Creating...</> : 'Create Budget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
