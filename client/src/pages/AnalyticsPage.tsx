import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/store';
import { fetchTrends, fetchCategories, fetchAnomalies, fetchRecurring, fetchVelocity } from '../store/slices/analyticsSlice';
import { TrendingUp, AlertTriangle, Repeat, Zap, PieChart as PieIcon } from 'lucide-react';
import { exportToExcel, trendColumns, categoryBreakdownColumns, anomalyColumns, recurringColumns } from '../utils/exportToExcel';
import { exportToPdf, trendColumns as pdfTrendCols, categoryBreakdownColumns as pdfCatCols, anomalyColumns as pdfAnomalyCols, recurringColumns as pdfRecurCols } from '../utils/exportToPdf';
import ExportDropdown from '../components/ui/ExportDropdown';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#171717', '#404040', '#525252', '#737373', '#a3a3a3', '#d4d4d4', '#e5e5e5', '#171717', '#404040', '#525252'];

type Tab = 'trends' | 'categories' | 'anomalies' | 'recurring' | 'velocity';

export default function AnalyticsPage() {
  const dispatch = useAppDispatch();
  const { trends, categories, anomalies, recurring, velocity } = useAppSelector((state) => state.analytics);
  const [activeTab, setActiveTab] = useState<Tab>('trends');
  const [trendPeriod, setTrendPeriod] = useState<'monthly' | 'weekly'>('monthly');

  useEffect(() => {
    dispatch(fetchTrends({ period: trendPeriod, months: 12 }));
    dispatch(fetchCategories({ months: 3 }));
    dispatch(fetchAnomalies());
    dispatch(fetchRecurring());
    dispatch(fetchVelocity());
  }, [dispatch, trendPeriod]);

  const tabs = [
    { id: 'trends' as Tab, label: 'Trends', icon: TrendingUp },
    { id: 'categories' as Tab, label: 'Categories', icon: PieIcon },
    { id: 'anomalies' as Tab, label: 'Anomalies', icon: AlertTriangle },
    { id: 'recurring' as Tab, label: 'Recurring', icon: Repeat },
    { id: 'velocity' as Tab, label: 'Velocity', icon: Zap },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Analytics</h1>
          <p className="text-neutral-500 mt-1">Deep insights into your spending patterns</p>
        </div>
        <ExportDropdown
          size="sm"
          label="Export All"
          onExportExcel={() => {
            const sheets: any[] = [];
            if (trends?.length) sheets.push({ name: 'Spending Trends', data: trends, columns: trendColumns });
            if (categories?.length) sheets.push({ name: 'Category Breakdown', data: categories, columns: categoryBreakdownColumns });
            if (anomalies?.length) sheets.push({ name: 'Anomalies', data: anomalies, columns: anomalyColumns });
            if (recurring?.length) sheets.push({ name: 'Recurring', data: recurring, columns: recurringColumns });
            if (velocity) sheets.push({ name: 'Velocity', data: [velocity] });
            if (sheets.length > 0) exportToExcel(sheets, 'ExpenseIQ_Analytics');
          }}
          onExportPdf={() => {
            const sheets: any[] = [];
            if (trends?.length) sheets.push({ name: 'Spending Trends', data: trends, columns: pdfTrendCols });
            if (categories?.length) sheets.push({ name: 'Category Breakdown', data: categories, columns: pdfCatCols });
            if (anomalies?.length) sheets.push({ name: 'Anomalies', data: anomalies, columns: pdfAnomalyCols });
            if (recurring?.length) sheets.push({ name: 'Recurring', data: recurring, columns: pdfRecurCols });
            if (velocity) sheets.push({ name: 'Velocity', data: [velocity] });
            if (sheets.length > 0) exportToPdf(sheets, 'ExpenseIQ_Analytics', { title: 'Analytics Report' });
          }}
        />
      </div>

      <div className="flex overflow-x-auto gap-1 bg-neutral-100 rounded-xl p-1">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'trends' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-900">Spending Trends</h3>
            <div className="flex bg-neutral-100 rounded-lg p-1">
              {(['monthly', 'weekly'] as const).map((p) => (
                <button key={p} onClick={() => setTrendPeriod(p)} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${trendPeriod === p ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'}`}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="card p-6">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends || []}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#171717" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#171717" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="_id" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid #e5e5e5', borderRadius: '12px' }} />
                  <Area type="monotone" dataKey="total" stroke="#171717" strokeWidth={2} fill="url(#trendGrad)" name="Total Spend" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-neutral-900 mb-4">Category Breakdown</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categories || []} dataKey="total" nameKey="_id" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2}>
                    {(categories || []).map((_: any, idx: number) => (<Cell key={idx} fill={COLORS[idx % COLORS.length]} />))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-neutral-900 mb-4">Details</h3>
            <div className="space-y-3">
              {(categories || []).map((cat: any, idx: number) => (
                <div key={cat._id} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="flex-1 text-sm text-neutral-700">{cat._id}</span>
                  <span className="text-sm font-semibold text-neutral-900">${cat.total?.toLocaleString()}</span>
                  <span className="text-xs text-neutral-500 w-12 text-right">{cat.percentage?.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'anomalies' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-neutral-100">
            <h3 className="text-sm font-semibold text-neutral-900">Detected Anomalies</h3>
            <p className="text-xs text-neutral-500 mt-1">Transactions flagged by our ML anomaly detection</p>
          </div>
          {(anomalies || []).length === 0 ? (
            <div className="text-center py-12 text-neutral-400"><AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>No anomalies detected</p></div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {(anomalies || []).map((tx: any) => (
                <div key={tx._id} className="flex items-center gap-4 p-4 hover:bg-neutral-50">
                  <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-neutral-900" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900">{tx.merchant || tx.description}</p>
                    <p className="text-xs text-neutral-500">{tx.category} · {new Date(tx.date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-neutral-900">${tx.amount?.toLocaleString()}</p>
                    <p className="text-xs text-neutral-500">Score: {(tx.anomalyScore * 100).toFixed(0)}%</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'recurring' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-neutral-100">
            <h3 className="text-sm font-semibold text-neutral-900">Recurring Transactions</h3>
            <p className="text-xs text-neutral-500 mt-1">Auto-detected subscription and recurring payments</p>
          </div>
          {(recurring || []).length === 0 ? (
            <div className="text-center py-12 text-neutral-400"><Repeat className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>No recurring transactions detected yet</p></div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {(recurring || []).map((item: any, idx: number) => (
                <div key={idx} className="flex items-center gap-4 p-4">
                  <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center">
                    <Repeat className="w-5 h-5 text-neutral-900" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900">{item._id || item.merchant}</p>
                    <p className="text-xs text-neutral-500">{item.frequency} · {item.count} occurrences</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-neutral-900">${item.avgAmount?.toFixed(2)}</p>
                    <p className="text-xs text-neutral-500">avg/payment</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'velocity' && (
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-neutral-900 mb-4">Spending Velocity</h3>
          {velocity ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="text-center p-6 bg-neutral-50 rounded-xl">
                <p className="text-3xl font-bold text-neutral-900">${(velocity as any).currentPeriod?.toLocaleString() || '0'}</p>
                <p className="text-sm text-neutral-500 mt-1">Last 30 days</p>
              </div>
              <div className="text-center p-6 bg-neutral-50 rounded-xl">
                <p className="text-3xl font-bold text-neutral-900">${(velocity as any).previousPeriod?.toLocaleString() || '0'}</p>
                <p className="text-sm text-neutral-500 mt-1">Previous 30 days</p>
              </div>
              <div className="text-center p-6 bg-neutral-50 rounded-xl">
                <p className={`text-3xl font-bold ${((velocity as any).changePercent || 0) > 0 ? 'text-neutral-900' : 'text-neutral-500'}`}>
                  {((velocity as any).changePercent || 0) > 0 ? '+' : ''}{((velocity as any).changePercent || 0).toFixed(1)}%
                </p>
                <p className="text-sm text-neutral-500 mt-1">Change</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-neutral-400"><Zap className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>Not enough data to calculate velocity</p></div>
          )}
        </div>
      )}
    </div>
  );
}
