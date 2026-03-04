import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../services/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  insights?: string[];
  suggestedActions?: string[];
  timestamp: string;
}

interface AIState {
  messages: Message[];
  recommendations: any[];
  forecast: any | null;
  analysis: any | null;
  loading: boolean;
  chatLoading: boolean;
  error: string | null;
}

const initialState: AIState = {
  messages: [],
  recommendations: [],
  forecast: null,
  analysis: null,
  loading: false,
  chatLoading: false,
  error: null,
};

export const sendMessage = createAsyncThunk(
  'ai/sendMessage',
  async (message: string, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { ai: AIState };
      const conversationHistory = state.ai.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const response = await api.post('/ai-chat', { message, conversationHistory });
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'AI service unavailable');
    }
  }
);

export const fetchRecommendations = createAsyncThunk(
  'ai/recommendations',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/recommendations');
      return response.data.recommendations;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error);
    }
  }
);

export const generateRecommendations = createAsyncThunk(
  'ai/generateRecommendations',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.post('/recommendations/generate');
      return response.data.recommendations;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error);
    }
  }
);

export const fetchForecast = createAsyncThunk(
  'ai/forecast',
  async (params: { category?: string } = {}, { rejectWithValue }) => {
    try {
      const searchParams = new URLSearchParams(Object.entries(params).filter(([_, v]) => v));
      const response = await api.get(`/forecast?${searchParams}`);
      return response.data.forecast;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error);
    }
  }
);

export const runDeepAnalysis = createAsyncThunk(
  'ai/deepAnalysis',
  async (analysisType: string = 'comprehensive', { rejectWithValue }) => {
    try {
      const response = await api.post('/ai-chat/analyze', { analysisType });
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error);
    }
  }
);

const aiSlice = createSlice({
  name: 'ai',
  initialState,
  reducers: {
    clearChat(state) {
      state.messages = [];
    },
    addUserMessage(state, action) {
      state.messages.push({
        role: 'user',
        content: action.payload,
        timestamp: new Date().toISOString(),
      });
    },
  },
  extraReducers: (builder) => {
    builder
      // Chat
      .addCase(sendMessage.pending, (state) => {
        state.chatLoading = true;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.chatLoading = false;
        state.messages.push({
          role: 'assistant',
          content: action.payload.response,
          insights: action.payload.insights,
          suggestedActions: action.payload.suggestedActions,
          timestamp: new Date().toISOString(),
        });
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.chatLoading = false;
        state.messages.push({
          role: 'assistant',
          content: (action.payload as string) || 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date().toISOString(),
        });
      })
      // Recommendations
      .addCase(fetchRecommendations.fulfilled, (state, action) => {
        state.recommendations = action.payload;
      })
      .addCase(generateRecommendations.pending, (state) => { state.loading = true; })
      .addCase(generateRecommendations.fulfilled, (state, action) => {
        state.loading = false;
        state.recommendations = action.payload;
      })
      .addCase(generateRecommendations.rejected, (state) => { state.loading = false; })
      // Forecast
      .addCase(fetchForecast.fulfilled, (state, action) => {
        state.forecast = action.payload;
      })
      // Deep Analysis
      .addCase(runDeepAnalysis.pending, (state) => { state.loading = true; })
      .addCase(runDeepAnalysis.fulfilled, (state, action) => {
        state.loading = false;
        state.analysis = action.payload;
      })
      .addCase(runDeepAnalysis.rejected, (state) => { state.loading = false; });
  },
});

export const { clearChat, addUserMessage } = aiSlice.actions;
export default aiSlice.reducer;
