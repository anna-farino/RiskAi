import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createProxyMiddleware } from 'http-proxy-middleware';
import router from './router';
import helmet from 'helmet';
import { migrate } from 'drizzle-orm/node-postgres/migrator'; 
import { db } from './db/db';
import { fileURLToPath } from 'url';
import path from 'path';
import logTime from './middleware/log-time';
import { callId } from './middleware/call-id';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsFolder = __dirname + "/db/migrations"

console.log("Migrations folder: ", migrationsFolder)
await migrate(db, { migrationsFolder })

const app = express();
const port = Number(process.env.PORT) || 5000;
const isDevelopment = process.env.NODE_ENV !== 'production';
const corsOptions = {
  origin: [
    'http://localhost:5174',
    'http://0.0.0.0:5174',
    /\.replit\.dev$/,
    /\.repl\.co$/,
    /\.spock\.replit\.dev$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'x-csrf-token'
  ],
};

app.use(callId);
app.use(logTime);
app.use(helmet());
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

app.listen(port, () => {
  console.log(`🌐 [SERVER] Server is running on port ${port}`);
  if (isDevelopment) {
    console.log('💻 [SERVER] Development mode: Proxying non-API requests to Vite dev server');
  }
});
