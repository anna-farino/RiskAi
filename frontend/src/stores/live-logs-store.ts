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

  // Computed
  getLogsByLevel: (level: LogEntry['level']) => LogEntry[];
  getLogsBySource: (source: string) => LogEntry[];
  searchLogs: (query: string) => LogEntry[];
  exportLogs: () => string;
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