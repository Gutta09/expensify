import { useEffect, useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/store';
import { fetchTransactions, createTransaction, deleteTransaction } from '../store/slices/transactionSlice';
import {
  Plus,
  Search,
  Trash2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { exportSingleSheet, transactionColumns } from '../utils/exportToExcel';
import { exportSingleSheetPdf, transactionColumns as pdfTransactionCols } from '../utils/exportToPdf';
import ExportDropdown from '../components/ui/ExportDropdown';

const CATEGORIES = [
  'Food & Dining', 'Shopping', 'Transportation', 'Entertainment', 'Bills & Utilities',
  'Healthcare', 'Education', 'Travel', 'Groceries', 'Personal Care',
  'Gifts & Donations', 'Insurance', 'Investments', 'Income', 'Other',
];

export default function TransactionsPage() {
  const dispatch = useAppDispatch();
  const { items: transactions, loading, total } = useAppSelector((state) => state.transactions);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const loadTransactions = useCallback(() => {
    dispatch(
      fetchTransactions({
        page, limit, sortBy: 'date', sortOrder: 'desc',
        ...(search && { search }),
        ...(categoryFilter && { category: categoryFilter }),
        ...(typeFilter && { type: typeFilter }),
      })
    );
  }, [dispatch, page, search, categoryFilter, typeFilter]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  const handleDelete = async (id: string) => {
    if (confirm('Delete this transaction?')) {
      await dispatch(deleteTransaction(id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Transactions</h1>
          <p className="text-neutral-500 mt-1">{total || 0} total transactions</p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <ExportDropdown
            disabled={transactions.length === 0}
            onExportExcel={() => exportSingleSheet(transactions, 'Transactions', 'ExpenseIQ_Transactions', transactionColumns)}
            onExportPdf={() => exportSingleSheetPdf(transactions, 'Transactions', 'ExpenseIQ_Transactions', pdfTransactionCols, { title: 'Transactions Report' })}
          />
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Transaction
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input type="text" placeholder="Search transactions..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="input pl-10" />
          </div>
          <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} className="input w-full sm:w-48">
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} className="input w-full sm:w-36">
            <option value="">All Types</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>
      </div>

      {/* Transaction list */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Transaction</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-500 uppercase tracking-wider">AI</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading && transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-neutral-400">
                    <div className="w-6 h-6 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-neutral-400">No transactions found</td></tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx._id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${tx.type === 'income' ? 'bg-neutral-100 text-neutral-600' : 'bg-neutral-100 text-neutral-900'}`}>
                          {tx.type === 'income' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-neutral-900 truncate">{tx.merchant || tx.description}</p>
                          {tx.merchant && <p className="text-xs text-neutral-500 truncate">{tx.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className="badge badge-default text-xs">{tx.category}</span></td>
                    <td className="px-4 py-3 text-sm text-neutral-500">{new Date(tx.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-semibold ${tx.type === 'income' ? 'text-neutral-500' : 'text-neutral-900'}`}>
                        {tx.type === 'income' ? '+' : '-'}${tx.amount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {tx.isAnomaly && <span title="Anomaly detected" className="anomaly-glow inline-flex"><AlertTriangle className="w-4 h-4 text-neutral-900" /></span>}
                      {tx.suggestedCategory && tx.suggestedCategory !== tx.category && <span title={`AI suggests: ${tx.suggestedCategory}`} className="text-xs text-neutral-500">💡</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(tx._id)} className="text-neutral-400 hover:text-neutral-900 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-100">
            <p className="text-xs text-neutral-500">Page {page} of {totalPages}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-neutral-100 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg hover:bg-neutral-100 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {showCreate && <CreateTransactionModal onClose={() => setShowCreate(false)} onCreated={loadTransactions} />}
    </div>
  );
}

function CreateTransactionModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const dispatch = useAppDispatch();
  const [form, setForm] = useState({ description: '', amount: '', type: 'expense' as 'expense' | 'income' | 'transfer', category: 'Other', merchant: '', date: new Date().toISOString().split('T')[0] });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await dispatch(createTransaction({ ...form, amount: parseFloat(form.amount), date: form.date })).unwrap();
      onCreated();
      onClose();
    } catch { /* handled */ } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-neutral-900">New Transaction</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Description</label>
            <input type="text" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="input" placeholder="Coffee at Starbucks" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Amount</label>
              <input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="input" placeholder="0.00" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Type</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'expense' | 'income' | 'transfer' }))} className="input">
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Category</label>
              <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="input">
                {['Food & Dining', 'Shopping', 'Transportation', 'Entertainment', 'Bills & Utilities', 'Healthcare', 'Education', 'Travel', 'Groceries', 'Personal Care', 'Gifts & Donations', 'Insurance', 'Investments', 'Income', 'Other'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="input" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Merchant (optional)</label>
            <input type="text" value={form.merchant} onChange={(e) => setForm((f) => ({ ...f, merchant: e.target.value }))} className="input" placeholder="Starbucks" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1">{submitting ? 'Saving...' : 'Save Transaction'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
