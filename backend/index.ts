import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createServer } from 'http';
import router from './router';
import helmet from 'helmet';
import logTime from './middleware/log-time';
import { callId } from './middleware/call-id';
import { corsOptions } from './utils/cors-options';
import { helmetConfig, setNonce } from './utils/helmet-config';
import { initializeSocketIO } from './services/live-logs/socket-server';
import { initializeLogInterception } from './services/live-logs/log-interceptor';

const port = Number(process.env.PORT) || 5000;

const isDevelopment = process.env.NODE_ENV !== 'production';

console.log("[🌐 NODE_ENV]", process.env.NODE_ENV)

// Debug: Check CycleTLS availability at startup
try {
  const cycletls = require('cycletls');
  console.log('✅ [STARTUP] CycleTLS loaded successfully, version:', require('cycletls/package.json').version);
} catch(e) {
  console.log('❌ [STARTUP] CycleTLS failed to load:', e.message);
}

const app = express();
const httpServer = createServer(app);

app.set('trust-proxy', 1);
app.use(helmet(helmetConfig));
app.use(callId);
app.use(logTime);
app.use(setNonce)
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use('/api', router);

if (isDevelopment) {
  app.use('/', createProxyMiddleware({
    target: 'http://localhost:5174',
    changeOrigin: true,
    ws: true,
    proxyTimeout: 0,
  }));
}

// Initialize live logs system (staging only)
initializeLogInterception();
initializeSocketIO(httpServer);

httpServer.listen(port, async () => {
  console.log(`🌐 [SERVER] Server is running on port ${port}`);
  if (isDevelopment) {
    console.log('💻 [SERVER] Development mode: Proxying non-API requests to Vite dev server');
  }
  
  // Phase 2.1: Initialize UNIFIED global scheduler (replaces separate app schedulers)
  try {
    const { initializeGlobalScheduler } = await import('./services/global-scheduler.js');
    await initializeGlobalScheduler();
    console.log('✅ [SERVER] Unified global scheduler initialized (News Radar + Threat Tracker)');
  } catch (error) {
    console.error('❌ [SERVER] Error initializing unified global scheduler:', error);
  }
  
  // DEPRECATED: Individual app schedulers are no longer used for global scraping
  // The unified global scheduler handles both News Radar and Threat Tracker
  // Keeping scheduler files for potential future per-user scheduling features
});
