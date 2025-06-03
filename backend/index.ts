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
import { runBackgroundQueuedJobsScraper } from './utils/background-scrape-scheduler';
import { initializeCluster, shutdownCluster } from './utils/puppeteer-cluster';

const port = Number(process.env.PORT) || 5000;
const isDevelopment = process.env.NODE_ENV !== 'production';

console.log("Database url", process.env.DATABASE_URL)
console.log("[🌐 NODE_ENV]", process.env.NODE_ENV)

process.on('unhandledRejection', reason => {
  console.error('🧨 Unhandled Rejection:', reason);
});
process.on('uncaughtException', err => {
  console.error('🧨 Uncaught Exception:', err);
});

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

// Initialize puppeteer cluster before starting background scraper
initializeCluster().then(() => {
  console.log('🚀 [CLUSTER] Puppeteer cluster initialized successfully');
  runBackgroundQueuedJobsScraper();
}).catch((error) => {
  console.error('❌ [CLUSTER] Failed to initialize puppeteer cluster:', error);
  console.log('⚠️  [CLUSTER] Starting background scraper anyway with fallback mode');
  runBackgroundQueuedJobsScraper();
});

if (isDevelopment) {
  app.use('/', createProxyMiddleware({
    target: 'http://localhost:5174',
    changeOrigin: true,
    ws: true,
    proxyTimeout: 0,
  }));
}

const server = app.listen(port, () => {
  console.log(`🌐 [SERVER] Server is running on port ${port}`);
  if (isDevelopment) {
    console.log('💻 [SERVER] Development mode: Proxying non-API requests to Vite dev server');
  }
});

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('🛑 [SERVER] SIGTERM received, starting graceful shutdown...');
  await shutdownCluster();
  server.close(() => {
    console.log('✅ [SERVER] Server shutdown complete');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('🛑 [SERVER] SIGINT received, starting graceful shutdown...');
  await shutdownCluster();
  server.close(() => {
    console.log('✅ [SERVER] Server shutdown complete');
    process.exit(0);
  });
});

