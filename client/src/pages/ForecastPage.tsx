import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/store';
import { fetchForecast } from '../store/slices/aiSlice';
import { TrendingUp, Calendar, Target, AlertCircle, RefreshCw } from 'lucide-react';
import { exportToExcel, forecastColumns } from '../utils/exportToExcel';
import { exportToPdf, forecastColumns as pdfForecastCols } from '../utils/exportToPdf';
import ExportDropdown from '../components/ui/ExportDropdown';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Legend } from 'recharts';

export default function ForecastPage() {
  const dispatch = useAppDispatch();
  const { forecast, loading } = useAppSelector((state) => state.ai);
  const [timeRange, setTimeRange] = useState<'30' | '60' | '90'>('30');

  useEffect(() => { dispatch(fetchForecast({})); }, [dispatch]);

  const forecastData = forecast?.forecastData || [];
  const accuracy = forecast?.accuracy || {};
  const filteredData = forecastData.slice(0, parseInt(timeRange));
  const totalPredicted = filteredData.reduce((s: number, d: any) => s + (d.predicted || 0), 0);
  const avgDaily = filteredData.length > 0 ? totalPredicted / filteredData.length : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Spending Forecast</h1>
          <p className="text-neutral-500 mt-1">AI-powered predictions using Facebook Prophet</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-neutral-100 rounded-lg p-1">
            {(['30', '60', '90'] as const).map((r) => (
              <button key={r} onClick={() => setTimeRange(r)} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${timeRange === r ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>{r}d</button>
            ))}
          </div>
          <ExportDropdown
            disabled={filteredData.length === 0}
            onExportExcel={() => {
              const sheets: any[] = [{ name: 'Forecast Data', data: filteredData, columns: forecastColumns }];
              if (forecast) {
                sheets.push({ name: 'Model Details', data: [{
                  Model: forecast.model || 'Prophet',
                  'Training Points': forecast.trainingDataPoints || '—',
                  MAPE: accuracy.mape ? `${(accuracy.mape * 100).toFixed(1)}%` : '—',
                  RMSE: accuracy.rmse ? `$${accuracy.rmse.toFixed(2)}` : '—',
                  'R² Score': accuracy.r2?.toFixed(3) || '—',
                  'Generated At': forecast.generatedAt ? new Date(forecast.generatedAt).toLocaleDateString() : '—',
                  'Predicted Total': `$${totalPredicted.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
                  'Avg Daily Spend': `$${avgDaily.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
                }] });
              }
              exportToExcel(sheets, 'ExpenseIQ_Forecast');
            }}
            onExportPdf={() => {
              const sheets: any[] = [{ name: 'Forecast Data', data: filteredData, columns: pdfForecastCols }];
              if (forecast) {
                sheets.push({ name: 'Model Details', data: [{
                  Model: forecast.model || 'Prophet',
                  'Training Points': forecast.trainingDataPoints || '—',
                  MAPE: accuracy.mape ? `${(accuracy.mape * 100).toFixed(1)}%` : '—',
                  RMSE: accuracy.rmse ? `$${accuracy.rmse.toFixed(2)}` : '—',
                  'R² Score': accuracy.r2?.toFixed(3) || '—',
                  'Generated At': forecast.generatedAt ? new Date(forecast.generatedAt).toLocaleDateString() : '—',
                  'Predicted Total': `$${totalPredicted.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
                  'Avg Daily Spend': `$${avgDaily.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
                }] });
              }
              exportToPdf(sheets, 'ExpenseIQ_Forecast', { title: 'Spending Forecast Report' });
            }}
          />
          <button onClick={() => dispatch(fetchForecast({}))} className="btn-secondary flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: TrendingUp, value: `$${totalPredicted.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, label: `Predicted ${timeRange}-day total` },
          { icon: Calendar, value: `$${avgDaily.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, label: 'Average daily spend' },
          { icon: Target, value: accuracy.mape ? `${(accuracy.mape * 100).toFixed(1)}%` : '—', label: 'Model accuracy (MAPE)' },
          { icon: AlertCircle, value: accuracy.r2 ? accuracy.r2.toFixed(3) : '—', label: 'R² score' },
        ].map((stat, i) => (
          <div key={i} className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-900">
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-bold text-neutral-900">{stat.value}</p>
            <p className="text-xs text-neutral-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <h3 className="text-sm font-semibold text-neutral-900 mb-4">Predicted Spending ({timeRange} days)</h3>
        <div className="h-80">
          {filteredData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={filteredData}>
                <defs>
                  <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#171717" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#171717" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorBounds" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a3a3a3" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#a3a3a3" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid #e5e5e5', borderRadius: '12px', fontSize: '13px' }} labelFormatter={(v) => new Date(v).toLocaleDateString()} formatter={(value: number) => [`$${value.toFixed(2)}`, '']} />
                <Legend />
                <Area type="monotone" dataKey="upperBound" name="Upper Bound" stroke="#a3a3a3" strokeWidth={1} strokeDasharray="4 4" fill="url(#colorBounds)" />
                <Area type="monotone" dataKey="predicted" name="Predicted" stroke="#171717" strokeWidth={2} fill="url(#colorPredicted)" />
                <Area type="monotone" dataKey="lowerBound" name="Lower Bound" stroke="#a3a3a3" strokeWidth={1} strokeDasharray="4 4" fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-neutral-400">
              <div className="text-center">
                <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Not enough data to generate a forecast</p>
                <p className="text-sm mt-1">Add more transactions to unlock predictions</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {forecast && (
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-neutral-900 mb-4">Model Details</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div><p className="text-neutral-500">Model</p><p className="font-medium text-neutral-900">{forecast.model || 'Prophet'}</p></div>
            <div><p className="text-neutral-500">Training Points</p><p className="font-medium text-neutral-900">{forecast.trainingDataPoints || '—'}</p></div>
            <div><p className="text-neutral-500">RMSE</p><p className="font-medium text-neutral-900">{accuracy.rmse ? `$${accuracy.rmse.toFixed(2)}` : '—'}</p></div>
            <div><p className="text-neutral-500">Last Trained</p><p className="font-medium text-neutral-900">{forecast.generatedAt ? new Date(forecast.generatedAt).toLocaleDateString() : '—'}</p></div>
          </div>
        </div>
      )}
    </div>
  );
}
