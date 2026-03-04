import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../services/api';

interface AnalyticsState {
  trends: any[];
  monthlyTotals: any[];
  categories: any[];
  anomalies: any[];
  recurring: any[];
  velocity: any | null;
  loading: boolean;
  error: string | null;
}

const initialState: AnalyticsState = {
  trends: [],
  monthlyTotals: [],
  categories: [],
  anomalies: [],
  recurring: [],
  velocity: null,
  loading: false,
  error: null,
};

export const fetchTrends = createAsyncThunk('analytics/trends', async (params: Record<string, any> = {}, { rejectWithValue }) => {
  try {
    const searchParams = new URLSearchParams(Object.entries(params).filter(([_, v]) => v));
    const response = await api.get(`/analytics/trends?${searchParams}`);
    return response.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error);
  }
});

export const fetchCategories = createAsyncThunk('analytics/categories', async (params: Record<string, any> = {}, { rejectWithValue }) => {
  try {
    const searchParams = new URLSearchParams(Object.entries(params).filter(([_, v]) => v));
    const response = await api.get(`/analytics/categories?${searchParams}`);
    return response.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error);
  }
});

export const fetchAnomalies = createAsyncThunk('analytics/anomalies', async (_, { rejectWithValue }) => {
  try {
    const response = await api.get('/analytics/anomalies');
    return response.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error);
  }
});

export const fetchRecurring = createAsyncThunk('analytics/recurring', async (_, { rejectWithValue }) => {
  try {
    const response = await api.get('/analytics/recurring');
    return response.data.recurring;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error);
  }
});

export const fetchVelocity = createAsyncThunk('analytics/velocity', async (_, { rejectWithValue }) => {
  try {
    const response = await api.get('/analytics/spending-velocity');
    return response.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error);
  }
});

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTrends.pending, (state) => { state.loading = true; })
      .addCase(fetchTrends.fulfilled, (state, action) => {
        state.loading = false;
        state.trends = action.payload.trends;
        state.monthlyTotals = action.payload.monthlyTotals;
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.categories = action.payload.categories;
      })
      .addCase(fetchAnomalies.fulfilled, (state, action) => {
        state.anomalies = action.payload.anomalies;
      })
      .addCase(fetchRecurring.fulfilled, (state, action) => {
        state.recurring = action.payload;
      })
      .addCase(fetchVelocity.fulfilled, (state, action) => {
        state.velocity = action.payload;
      });
  },
});

export default analyticsSlice.reducer;
