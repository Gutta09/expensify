import { useEffect, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../store/store';
import { fetchTransactions } from '../store/slices/transactionSlice';
import { fetchBudgets } from '../store/slices/budgetSlice';
import { fetchTrends, fetchCategories, fetchVelocity } from '../store/slices/analyticsSlice';
import { fetchRecommendations } from '../store/slices/aiSlice';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  AlertTriangle,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Link } from 'react-router-dom';

const COLORS = ['#171717', '#404040', '#525252', '#737373', '#a3a3a3', '#d4d4d4', '#e5e5e5', '#171717', '#404040', '#525252'];

export default function DashboardPage() {
  const dispatch = useAppDispatch();
  const { items: transactions } = useAppSelector((state) => state.transactions);
  const { items: budgets } = useAppSelector((state) => state.budgets);
  const { trends, categories, velocity } = useAppSelector((state) => state.analytics);
  const { recommendations } = useAppSelector((state) => state.ai);

  useEffect(() => {
    dispatch(fetchTransactions({ limit: 10, sortBy: 'date', sortOrder: 'desc' }));
    dispatch(fetchBudgets());
    dispatch(fetchTrends({ period: 'monthly', months: 6 }));
    dispatch(fetchCategories({ months: 1 }));
    dispatch(fetchVelocity());
    dispatch(fetchRecommendations());
  }, [dispatch]);

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = transactions.filter((t) => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const totalSpent = thisMonth.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const totalIncome = thisMonth.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const anomalies = thisMonth.filter((t) => t.isAnomaly).length;
    return { totalSpent, totalIncome, transactionCount: thisMonth.length, anomalies };
  }, [transactions]);

  const velocityChange = velocity ? ((velocity as any).changePercent || 0) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
        <p className="text-neutral-500 mt-1">Your financial overview at a glance</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Monthly Spending" value={`$${stats.totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} icon={<DollarSign className="w-5 h-5" />} trend={velocityChange} />
        <StatCard label="Monthly Income" value={`$${stats.totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} icon={<TrendingUp className="w-5 h-5" />} />
        <StatCard label="Transactions" value={stats.transactionCount.toString()} icon={<Receipt className="w-5 h-5" />} />
        <StatCard label="Anomalies" value={stats.anomalies.toString()} icon={<AlertTriangle className="w-5 h-5" />} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6">
          <h3 className="text-sm font-semibold text-neutral-900 mb-4">Spending Trend</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends || []}>
                <defs>
                  <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#171717" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#171717" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="_id" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid #e5e5e5', borderRadius: '12px', fontSize: '13px' }} />
                <Area type="monotone" dataKey="total" stroke="#171717" strokeWidth={2} fill="url(#colorSpend)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-sm font-semibold text-neutral-900 mb-4">Spending by Category</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categories || []} dataKey="total" nameKey="_id" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {(categories || []).map((_: any, idx: number) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {(categories || []).slice(0, 5).map((cat: any, idx: number) => (
              <div key={cat._id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="text-neutral-600">{cat._id}</span>
                </div>
                <span className="font-medium text-neutral-900">${cat.total?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-neutral-900">Budget Progress</h3>
            <Link to="/budgets" className="text-xs text-neutral-900 underline">View all</Link>
          </div>
          <div className="space-y-4">
            {budgets.slice(0, 4).map((budget) => {
              const pct = Math.min(100, (budget.currentSpend / budget.limitAmount) * 100);
              const isOver = pct >= 100;
              return (
                <div key={budget._id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-neutral-600">{budget.category}</span>
                    <span className={`font-medium ${isOver ? 'text-neutral-900 font-bold' : 'text-neutral-900'}`}>
                      ${budget.currentSpend.toLocaleString()} / ${budget.limitAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all bg-neutral-900" style={{ width: `${Math.min(pct, 100)}%`, opacity: isOver ? 1 : pct >= 80 ? 0.7 : 0.4 }} />
                  </div>
                </div>
              );
            })}
            {budgets.length === 0 && <p className="text-xs text-neutral-400 text-center py-4">No budgets set yet</p>}
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-neutral-900">Recent Transactions</h3>
            <Link to="/transactions" className="text-xs text-neutral-900 underline">View all</Link>
          </div>
          <div className="space-y-3">
            {transactions.slice(0, 6).map((tx) => (
              <div key={tx._id} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tx.type === 'income' ? 'bg-neutral-100 text-neutral-600' : 'bg-neutral-100 text-neutral-900'}`}>
                  {tx.type === 'income' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 truncate">{tx.merchant || tx.description}</p>
                  <p className="text-xs text-neutral-500 truncate">{tx.category}</p>
                </div>
                <span className={`text-sm font-semibold ${tx.type === 'income' ? 'text-neutral-500' : 'text-neutral-900'}`}>
                  {tx.type === 'income' ? '+' : '-'}${tx.amount.toLocaleString()}
                </span>
              </div>
            ))}
            {transactions.length === 0 && <p className="text-xs text-neutral-400 text-center py-4">No transactions yet</p>}
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-neutral-900" />
              <h3 className="text-sm font-semibold text-neutral-900">AI Insights</h3>
            </div>
            <Link to="/recommendations" className="text-xs text-neutral-900 underline">View all</Link>
          </div>
          <div className="space-y-3">
            {(recommendations || []).slice(0, 4).map((rec: any) => (
              <div key={rec._id} className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                <p className="text-xs font-medium text-neutral-900 mb-1">{rec.title}</p>
                <p className="text-xs text-neutral-500 line-clamp-2">{rec.description}</p>
              </div>
            ))}
            {(!recommendations || recommendations.length === 0) && (
              <p className="text-xs text-neutral-400 text-center py-4">AI insights will appear as you add transactions</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, trend }: { label: string; value: string; icon: React.ReactNode; trend?: number }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-neutral-100 text-neutral-900">{icon}</div>
        {trend !== undefined && trend !== 0 && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${trend > 0 ? 'text-neutral-900' : 'text-neutral-500'}`}>
            {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-neutral-900">{value}</p>
      <p className="text-xs text-neutral-500 mt-1">{label}</p>
    </div>
  );
}
