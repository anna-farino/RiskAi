import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createProxyMiddleware } from 'http-proxy-middleware';
import router from './router';
import helmet from 'helmet';
import logTime from './middleware/log-time';
import { callId } from './middleware/call-id';
import { corsOptions } from './utils/cors-options';
import { helmetConfig, setNonce } from './utils/helmet-config';

const port = Number(process.env.PORT) || 5000;

const isDevelopment = process.env.NODE_ENV !== 'production';

console.log("[🌐 NODE_ENV]", process.env.NODE_ENV)

const app = express();

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

app.listen(port, async () => {
  console.log(`🌐 [SERVER] Server is running on port ${port}`);
  if (isDevelopment) {
    console.log('💻 [SERVER] Development mode: Proxying non-API requests to Vite dev server');
  }
  
  // Initialize auto-scrape schedulers after server starts
  try {
    const { initializeScheduler: initThreatTracker } = await import('./apps/threat-tracker/services/scheduler.js');
    await initThreatTracker();
    console.log('✅ [SERVER] Threat Tracker auto-scrape scheduler initialized');
  } catch (error) {
    console.error('❌ [SERVER] Error initializing Threat Tracker scheduler:', error);
  }
  
  try {
    const { initializeScheduler: initNewsRadar } = await import('./apps/news-radar/services/scheduler.js');
    await initNewsRadar();
    console.log('✅ [SERVER] News Radar auto-scrape scheduler initialized');
  } catch (error) {
    console.error('❌ [SERVER] Error initializing News Radar scheduler:', error);
  }
});
