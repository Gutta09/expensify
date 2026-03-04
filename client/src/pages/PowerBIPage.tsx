import { useState, useEffect } from 'react';
import { BarChart3, Lock, ExternalLink, Monitor, Loader2 } from 'lucide-react';
import { api } from '../services/api';

export default function PowerBIPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [reports, setReports] = useState([
    { id: 1, name: 'Monthly Overview', description: 'High-level monthly spending summary' },
    { id: 2, name: 'Category Deep Dive', description: 'Detailed category analysis with drill-down' },
    { id: 3, name: 'Budget vs Actual', description: 'Compare budgets against real spending' },
    { id: 4, name: 'Trend Analysis', description: 'Long-term spending trends and patterns' },
  ]);
  const [selectedReport, setSelectedReport] = useState(reports[0]);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data } = await api.get('/powerbi/reports');
      if (data.reports && data.reports.length > 0) {
        setReports(data.reports);
        setSelectedReport(data.reports[0]);
      }
      setIsConnected(true);
    } catch {
      // If the API isn't configured, still show the connected UI with sample reports
      setIsConnected(true);
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    if (isConnected && selectedReport) {
      const fetchEmbed = async () => {
        try {
          const { data } = await api.get(`/powerbi/embed-token?reportId=${selectedReport.id}`);
          setEmbedUrl(data.embedUrl);
        } catch {
          setEmbedUrl(null);
        }
      };
      fetchEmbed();
    }
  }, [isConnected, selectedReport]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Power BI Reports</h1>
          <p className="text-neutral-500 mt-1">Interactive dashboards and advanced visualizations</p>
        </div>
        <a href="https://app.powerbi.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors">
          <ExternalLink className="w-4 h-4" /> Open Power BI
        </a>
      </div>

      {!isConnected ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-neutral-700" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Connect Power BI</h2>
          <p className="text-neutral-500 max-w-md mx-auto mb-8">
            Link your Power BI workspace to view interactive reports and dashboards directly in ExpenseIQ.
          </p>
          <button onClick={handleConnect} disabled={connecting} className="btn-primary px-8 py-3 text-sm flex items-center gap-2 disabled:opacity-50">
            {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
            {connecting ? 'Connecting...' : 'Connect Power BI Workspace'}
          </button>
          <p className="text-xs text-neutral-400 mt-4">Requires a Power BI Pro or Premium license</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="card p-4 space-y-1">
            <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider px-3 mb-2">Reports</h3>
            {reports.map((report) => (
              <button key={report.id} onClick={() => setSelectedReport(report)} className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${selectedReport.id === report.id ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-50 text-neutral-700'}`}>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{report.name}</p>
                    <p className={`text-xs mt-0.5 ${selectedReport.id === report.id ? 'text-neutral-300' : 'text-neutral-400'}`}>{report.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="lg:col-span-3 card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Monitor className="w-5 h-5 text-neutral-500" />
              <h3 className="text-sm font-semibold text-neutral-900">{selectedReport.name}</h3>
            </div>
            {embedUrl ? (
              <iframe src={embedUrl} className="h-96 w-full rounded-xl border border-neutral-200" title={selectedReport.name} allowFullScreen />
            ) : (
              <div className="h-96 bg-neutral-50 rounded-xl flex items-center justify-center border border-neutral-200 border-dashed">
                <div className="text-center text-neutral-400">
                  <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Power BI embed will appear here</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
