import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface LogEntry {
  timestamp: string;
  message: string;
  source: string;
  level: 'info' | 'error' | 'debug';
  formattedTime: string;
  id: string; // Unique identifier for each log entry
}

// All sources test types
export interface SourceTestResult {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  status: 'pending' | 'testing' | 'passed' | 'failed';
  articlesFound: number;
  articleTestedUrl?: string;
  articleScrapingSuccess: boolean;
  errors: string[];
  testDuration: number;
  timestamp: string;
}

export interface AllSourcesTestProgress {
  totalSources: number;
  testingSources: string[];
  completedSources: SourceTestResult[];
}

interface LiveLogsState {
  // Logs data
  logs: LogEntry[];
  maxLogs: number;

  // Connection state
  isConnected: boolean;
  isStreaming: boolean;
  hasPermission: boolean | null;

  // Test scraping state
  testUrl: string;
  fullTest: boolean;
  isTestRunning: boolean;
  testResult: { success: boolean; message: string } | null;
  
  // All sources test state
  isAllSourcesTestRunning: boolean;
  allSourcesTestProgress: AllSourcesTestProgress | null;
  allSourcesTestResults: SourceTestResult[];

  // Actions
  addLog: (log: Omit<LogEntry, 'id'>) => void;
  clearLogs: () => void;
  setConnectionState: (connected: boolean) => void;
  setStreamingState: (streaming: boolean) => void;
  setPermission: (hasPermission: boolean | null) => void;
  setTestUrl: (url: string) => void;
  setFullTest: (fullTest: boolean) => void;
  setTestRunning: (running: boolean) => void;
  setTestResult: (result: { success: boolean; message: string } | null) => void;
  
  // All sources test actions
  setAllSourcesTestRunning: (running: boolean) => void;
  updateAllSourcesTestProgress: (source: SourceTestResult) => void;
  setAllSourcesTestResults: (results: SourceTestResult[]) => void;
  clearAllSourcesTestResults: () => void;
  
  // Computed
  getLogsByLevel: (level: LogEntry['level']) => LogEntry[];
  getLogsBySource: (source: string) => LogEntry[];
  searchLogs: (query: string) => LogEntry[];
  exportLogs: () => string;
  exportAllSourcesTestResults: () => string;
}

// Generate unique ID for log entries
const generateLogId = () => `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const useLiveLogsStore = create<LiveLogsState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    logs: [],
    maxLogs: 1000, // Limit to prevent memory issues

    isConnected: false,
    isStreaming: false,
    hasPermission: null,

    testUrl: '',
    fullTest: true,
    isTestRunning: false,
    testResult: null,
    
    // All sources test state
    isAllSourcesTestRunning: false,
    allSourcesTestProgress: null,
    allSourcesTestResults: [],

    // Actions
    addLog: (logData) => set((state) => {
      const newLog: LogEntry = {
        ...logData,
        id: generateLogId(),
      };

      const updatedLogs = [...state.logs, newLog];

      // Trim logs if exceeding max limit (keep most recent)
      if (updatedLogs.length > state.maxLogs) {
        updatedLogs.splice(0, updatedLogs.length - state.maxLogs);
      }

      return { logs: updatedLogs };
    }),

    clearLogs: () => set({ logs: [] }),

    setConnectionState: (connected) => set({
      isConnected: connected,
      // Auto-stop streaming if disconnected
      isStreaming: connected ? get().isStreaming : false
    }),

    setStreamingState: (streaming) => set({ isStreaming: streaming }),

    setPermission: (hasPermission) => set({ hasPermission }),

    setTestUrl: (url) => set({ testUrl: url }),

    setFullTest: (fullTest) => set({ fullTest }),

    setTestRunning: (running) => set({ isTestRunning: running }),

    setTestResult: (result) => set({ testResult: result }),
    
    // All sources test actions
    setAllSourcesTestRunning: (running) => set({ isAllSourcesTestRunning: running }),
    
    updateAllSourcesTestProgress: (source) => set((state) => {
      const existingResults = state.allSourcesTestResults || [];
      const index = existingResults.findIndex(s => s.sourceId === source.sourceId);
      
      if (index >= 0) {
        // Update existing source result
        const updatedResults = [...existingResults];
        updatedResults[index] = source;
        return { allSourcesTestResults: updatedResults };
      } else {
        // Add new source result
        return { allSourcesTestResults: [...existingResults, source] };
      }
    }),
    
    setAllSourcesTestResults: (results) => set({ allSourcesTestResults: results }),
    
    clearAllSourcesTestResults: () => set({ 
      allSourcesTestResults: [], 
      allSourcesTestProgress: null 
    }),

    // Computed functions
    getLogsByLevel: (level) => {
      return get().logs.filter(log => log.level === level);
    },

    getLogsBySource: (source) => {
      return get().logs.filter(log => log.source.includes(source));
    },

    searchLogs: (query) => {
      const lowerQuery = query.toLowerCase();
      return get().logs.filter(log =>
        log.message.toLowerCase().includes(lowerQuery) ||
        log.source.toLowerCase().includes(lowerQuery)
      );
    },

    exportLogs: () => {
      const logs = get().logs;
      const exportData = {
        exportDate: new Date().toISOString(),
        totalLogs: logs.length,
        logs: logs.map(log => ({
          timestamp: log.timestamp,
          formattedTime: log.formattedTime,
          level: log.level,
          source: log.source,
          message: log.message
        }))
      };

      return JSON.stringify(exportData, null, 2);
    },
    
    exportAllSourcesTestResults: () => {
      const results = get().allSourcesTestResults;
      const exportData = {
        exportDate: new Date().toISOString(),
        totalSources: results.length,
        passedSources: results.filter(r => r.status === 'passed').length,
        failedSources: results.filter(r => r.status === 'failed').length,
        sources: results.map(source => ({
          name: source.sourceName,
          url: source.sourceUrl,
          status: source.status,
          articlesFound: source.articlesFound,
          articleTestedUrl: source.articleTestedUrl,
          articleScrapingSuccess: source.articleScrapingSuccess,
          errors: source.errors,
          testDuration: source.testDuration,
          timestamp: source.timestamp
        }))
      };

      return JSON.stringify(exportData, null, 2);
    },
  }))
);

// Optional: Add persistence to localStorage
// You can uncomment this if you want logs to persist across browser sessions
/*
import { persist } from 'zustand/middleware';

export const useLiveLogsStore = create<LiveLogsState>()(
  persist(
    subscribeWithSelector((set, get) => ({
      // ... same implementation as above
    })),
    {
      name: 'live-logs-storage',
      // Only persist certain fields, not the entire state
      partialize: (state) => ({
        logs: state.logs.slice(-100), // Only keep last 100 logs in storage
        testUrl: state.testUrl,
        fullTest: state.fullTest,
      }),
    }
  )
);
*/