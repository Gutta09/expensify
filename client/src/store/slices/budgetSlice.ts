import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../services/api';

interface Budget {
  _id: string;
  category: string;
  period: string;
  limitAmount: number;
  currentSpend: number;
  remainingAmount: number;
  utilizationPercent: number;
  aiSuggestedLimit?: number;
  alertThreshold?: number;
  isActive: boolean;
  startDate?: string;
  endDate?: string;
}

interface BudgetState {
  items: Budget[];
  variance: any[];
  suggestions: any[];
  loading: boolean;
  error: string | null;
}

const initialState: BudgetState = {
  items: [],
  variance: [],
  suggestions: [],
  loading: false,
  error: null,
};

export const fetchBudgets = createAsyncThunk('budgets/fetch', async (_, { rejectWithValue }) => {
  try {
    const response = await api.get('/budgets?isActive=true');
    return response.data.budgets;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || 'Failed to fetch budgets');
  }
});

export const fetchBudgetVariance = createAsyncThunk('budgets/variance', async (_, { rejectWithValue }) => {
  try {
    const response = await api.get('/budgets/variance');
    return response.data.variance;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error);
  }
});

export const fetchBudgetSuggestions = createAsyncThunk('budgets/suggestions', async (_, { rejectWithValue }) => {
  try {
    const response = await api.get('/budgets/ai-suggestions');
    return response.data.suggestions;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error);
  }
});

export const createBudget = createAsyncThunk('budgets/create', async (data: Partial<Budget>, { rejectWithValue }) => {
  try {
    const response = await api.post('/budgets', data);
    return response.data.budget;
  } catch (err: any) {
    // Handle validation errors (array) and single error string
    const respData = err.response?.data;
    if (respData?.errors && Array.isArray(respData.errors)) {
      const messages = respData.errors.map((e: any) => e.msg || e.message).join(', ');
      return rejectWithValue(messages);
    }
    return rejectWithValue(respData?.error || 'Failed to create budget');
  }
});

const budgetSlice = createSlice({
  name: 'budgets',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchBudgets.pending, (state) => { state.loading = true; })
      .addCase(fetchBudgets.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchBudgets.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchBudgetVariance.fulfilled, (state, action) => {
        state.variance = action.payload;
      })
      .addCase(fetchBudgetSuggestions.fulfilled, (state, action) => {
        state.suggestions = action.payload;
      })
      .addCase(createBudget.fulfilled, (state, action) => {
        state.items.push(action.payload);
        state.error = null;
      })
      .addCase(createBudget.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export default budgetSlice.reducer;
