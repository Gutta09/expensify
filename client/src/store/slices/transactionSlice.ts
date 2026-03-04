import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../services/api';

interface Transaction {
  _id: string;
  date: string;
  amount: number;
  type: 'expense' | 'income' | 'transfer';
  category: string;
  merchant: string;
  description?: string;
  isAnomaly: boolean;
  anomalyScore: number;
  anomalyReason?: string;
  suggestedCategory?: string;
  sentiment?: string;
  source: string;
}

interface TransactionState {
  items: Transaction[];
  summary: any[];
  total: number;
  loading: boolean;
  error: string | null;
  filters: {
    startDate?: string;
    endDate?: string;
    category?: string;
    type?: string;
    page: number;
    limit: number;
  };
}

const initialState: TransactionState = {
  items: [],
  summary: [],
  total: 0,
  loading: false,
  error: null,
  filters: { page: 1, limit: 25 },
};

export const fetchTransactions = createAsyncThunk(
  'transactions/fetch',
  async (filters: Record<string, any>, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams(
        Object.entries(filters).filter(([_, v]) => v !== undefined && v !== '')
      );
      const response = await api.get(`/transactions?${params}`);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to fetch transactions');
    }
  }
);

export const createTransaction = createAsyncThunk(
  'transactions/create',
  async (data: Partial<Transaction>, { rejectWithValue }) => {
    try {
      const response = await api.post('/transactions', data);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to create transaction');
    }
  }
);

export const deleteTransaction = createAsyncThunk(
  'transactions/delete',
  async (id: string, { rejectWithValue }) => {
    try {
      await api.delete(`/transactions/${id}`);
      return id;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to delete transaction');
    }
  }
);

const transactionSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    setFilters(state, action) {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters(state) {
      state.filters = { page: 1, limit: 25 };
    },
    addRealtimeTransaction(state, action) {
      state.items.unshift(action.payload);
      state.total += 1;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTransactions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.transactions;
        state.summary = action.payload.summary;
        state.total = action.payload.pagination.total;
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createTransaction.fulfilled, (state, action) => {
        state.items.unshift(action.payload.transaction);
        state.total += 1;
      })
      .addCase(deleteTransaction.fulfilled, (state, action) => {
        state.items = state.items.filter((t) => t._id !== action.payload);
        state.total -= 1;
      });
  },
});

export const { setFilters, clearFilters, addRealtimeTransaction } = transactionSlice.actions;
export default transactionSlice.reducer;
