import { useState, useRef, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/store';
import { sendMessage, runDeepAnalysis, clearChat, addUserMessage } from '../store/slices/aiSlice';
import { Send, Sparkles, Trash2, Brain, Loader2, User, Bot, TrendingUp, AlertTriangle, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const QUICK_PROMPTS = [
  { icon: TrendingUp, text: 'How is my spending trending this month?' },
  { icon: AlertTriangle, text: 'Are there any unusual transactions?' },
  { icon: Lightbulb, text: 'How can I save more money?' },
  { icon: Brain, text: 'Analyze my financial health overall' },
];

export default function AIChatPage() {
  const dispatch = useAppDispatch();
  const { messages, chatLoading, analysis: deepAnalysis, loading: analysisLoading } = useAppSelector((state) => state.ai);
  const [input, setInput] = useState('');
  const [showDeepAnalysis, setShowDeepAnalysis] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = () => {
    if (!input.trim() || chatLoading) return;
    dispatch(addUserMessage(input.trim()));
    dispatch(sendMessage(input.trim()));
    setInput('');
  };

  const handleQuickPrompt = (text: string) => {
    dispatch(addUserMessage(text));
    dispatch(sendMessage(text));
  };

  const handleDeepAnalysis = () => {
    dispatch(runDeepAnalysis('comprehensive'));
    setShowDeepAnalysis(true);
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-neutral-900" /> AI Financial Coach
          </h1>
          <p className="text-neutral-500 mt-1">Powered by GPT-4 · Personalized to your finances</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDeepAnalysis} disabled={analysisLoading} className="btn-secondary flex items-center gap-2 text-sm">
            <Brain className="w-4 h-4" /> Deep Analysis
          </button>
          <button onClick={() => dispatch(clearChat())} className="p-2 text-neutral-400 hover:text-neutral-900 rounded-lg hover:bg-neutral-100" title="Clear chat">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 card overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !showDeepAnalysis && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-neutral-900 flex items-center justify-center">
                  <Bot className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">Your AI Financial Assistant</h3>
                <p className="text-sm text-neutral-500 mb-6">Ask me anything about your finances. I analyze your transactions, budgets, and spending patterns to give personalized advice.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button key={prompt.text} onClick={() => handleQuickPrompt(prompt.text)} className="flex items-center gap-2 p-3 rounded-xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 hover:border-neutral-300 transition-colors text-left">
                      <prompt.icon className="w-4 h-4 text-neutral-900 flex-shrink-0" />
                      <span className="text-xs text-neutral-700">{prompt.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <AnimatePresence>
            {messages.map((msg, idx) => (
              <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-900'}`}>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-neutral-200 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-neutral-600" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {chatLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-neutral-100 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> Analyzing your finances...
                </div>
              </div>
            </div>
          )}

          {showDeepAnalysis && deepAnalysis && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-5 h-5 text-neutral-900" />
                <h3 className="font-semibold text-neutral-900">Deep Financial Analysis</h3>
              </div>
              <div className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">
                {typeof deepAnalysis === 'string' ? deepAnalysis : deepAnalysis.analysis || JSON.stringify(deepAnalysis, null, 2)}
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-neutral-200">
          <div className="flex items-center gap-3">
            <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Ask about your finances..." className="input flex-1" disabled={chatLoading} />
            <button onClick={handleSend} disabled={!input.trim() || chatLoading} className="btn-primary p-3 disabled:opacity-50">
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-neutral-400 mt-2 text-center">AI responses are based on your transaction data and may not constitute financial advice</p>
        </div>
      </div>
    </div>
  );
}
