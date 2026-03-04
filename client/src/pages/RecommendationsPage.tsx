import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/store';
import { fetchRecommendations, generateRecommendations } from '../store/slices/aiSlice';
import { api } from '../services/api';
import { Lightbulb, TrendingDown, ThumbsUp, ThumbsDown, ArrowRight, RefreshCw, Loader2 } from 'lucide-react';
import { exportSingleSheet, recommendationColumns } from '../utils/exportToExcel';
import { exportSingleSheetPdf, recommendationColumns as pdfRecCols } from '../utils/exportToPdf';
import ExportDropdown from '../components/ui/ExportDropdown';

export default function RecommendationsPage() {
  const dispatch = useAppDispatch();
  const { recommendations, loading } = useAppSelector((state) => state.ai);
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down'>>({});

  useEffect(() => {
    dispatch(fetchRecommendations());
  }, [dispatch]);

  const handleGenerate = () => {
    dispatch(generateRecommendations());
  };

  const handleFeedback = async (recId: string, type: 'up' | 'down') => {
    setFeedback((prev) => ({ ...prev, [recId]: type }));
    try {
      await api.put(`/recommendations/${recId}/feedback`, {
        helpful: type === 'up',
        status: type === 'down' ? 'dismissed' : 'active',
      });
    } catch {
      setFeedback((prev) => {
        const copy = { ...prev };
        delete copy[recId];
        return copy;
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Recommendations</h1>
          <p className="text-neutral-500 mt-1">AI-powered suggestions to optimize your spending</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportDropdown
            disabled={recommendations.length === 0}
            size="sm"
            onExportExcel={() => exportSingleSheet(recommendations, 'Recommendations', 'ExpenseIQ_Recommendations', recommendationColumns)}
            onExportPdf={() => exportSingleSheetPdf(recommendations, 'Recommendations', 'ExpenseIQ_Recommendations', pdfRecCols, { title: 'Recommendations Report' })}
          />
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Generate New
          </button>
        </div>
      </div>

      {loading && recommendations.length === 0 ? (
        <div className="card p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-neutral-400" />
          <p className="text-neutral-500">Analyzing your spending patterns...</p>
        </div>
      ) : recommendations.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-neutral-900 flex items-center justify-center mx-auto mb-6">
            <Lightbulb className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">No Recommendations Yet</h2>
          <p className="text-neutral-500 max-w-md mx-auto mb-6">
            Add more transactions so our AI can analyze your spending patterns and generate personalized recommendations.
          </p>
          <button onClick={handleGenerate} disabled={loading} className="btn-primary text-sm px-6 py-2 disabled:opacity-50">
            {loading ? 'Generating...' : 'Generate Recommendations'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {recommendations.map((rec: any) => {
            const recId = rec._id || rec.id;
            return (
              <div key={recId} className="card border border-neutral-200 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center flex-shrink-0">
                      <Lightbulb className="w-5 h-5 text-neutral-900" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-sm font-semibold text-neutral-900">{rec.title || rec.category}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 font-medium">
                          {rec.priority || 'medium'}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-600 leading-relaxed">{rec.description || rec.suggestion}</p>

                      {rec.potentialSavings && (
                        <div className="flex items-center gap-2 mt-3">
                          <TrendingDown className="w-4 h-4 text-neutral-500" />
                          <span className="text-sm font-bold text-neutral-900">
                            Save up to ${rec.potentialSavings.toLocaleString()}/month
                          </span>
                        </div>
                      )}

                      {rec.impact && (
                        <div className="flex items-center gap-2 mt-2">
                          <ArrowRight className="w-4 h-4 text-neutral-500" />
                          <span className="text-sm text-neutral-600">
                            Could reduce spending by {rec.impact}%
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleFeedback(recId, 'up')}
                        className={`p-2 rounded-lg transition-colors ${feedback[recId] === 'up' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-400 hover:text-neutral-700'}`}
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleFeedback(recId, 'down')}
                        className={`p-2 rounded-lg transition-colors ${feedback[recId] === 'down' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-400 hover:text-neutral-700'}`}
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
