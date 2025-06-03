import { spawn } from 'child_process';
import path from 'path';

interface WorkerInput {
  url: string;
  isArticlePage?: boolean;
  scrapingConfig?: any;
}

interface WorkerOutput {
  type: 'article' | 'links';
  html: string;
  error?: boolean;
  message?: string;
}

/**
 * Execute Puppeteer scraping in an isolated worker process
 * This completely eliminates memory leaks by running Puppeteer in a separate process
 */
export async function runPuppeteerWorker(data: WorkerInput): Promise<string> {
  const jsonData = JSON.stringify(data);
  const b64Data = Buffer.from(jsonData).toString('base64');
  let stdoutData = '';
  let stderrData = '';

  return new Promise((resolve, reject) => {
    // Find backend directory dynamically
    const backendDir = path.resolve(__dirname, '..');
    const workerPath = path.join(backendDir, 'workers', 'puppeteer-worker.ts');
    
    // Production-optimized worker execution
    console.log(`[PuppeteerWorker] Starting worker in ${backendDir}`);
    console.log(`[PuppeteerWorker] Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Use tsx to run TypeScript directly, set cwd to backend directory
    const proc = spawn('npx', [
      'tsx',
      'workers/puppeteer-worker.ts',  // Relative to backend dir
      `--input-data=${b64Data}`,
    ], { 
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: backendDir,
      env: {
        ...process.env,
        NODE_OPTIONS: '--max-old-space-size=512'  // Limit memory for worker
      }
    });

    proc.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderrData += data.toString();
      console.error(`[PuppeteerWorker] STDERR: ${data}`);
    });

    proc.on('error', (error) => {
      console.error(`[PuppeteerWorker] Process error:`, error);
      reject(new Error(`Worker process error: ${error.message}`));
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        console.error(`[PuppeteerWorker] Process exited with code ${code}`);
        console.error(`[PuppeteerWorker] STDERR output:`, stderrData);
        reject(new Error(`Worker process exited with code ${code}. STDERR: ${stderrData}`));
        return;
      }

      try {
        const result: WorkerOutput = JSON.parse(stdoutData);
        
        if (result.error) {
          reject(new Error(`Puppeteer worker error: ${result.message}`));
        } else {
          resolve(result.html);
        }
      } catch (parseError) {
        console.error(`[PuppeteerWorker] Failed to parse output:`, stdoutData);
        reject(new Error(`Failed to parse worker output: ${parseError}`));
      }
    });

    proc.on('exit', () => {
      // Ensure process is killed
      proc.kill('SIGKILL');
    });

    // Set a longer timeout to accommodate better content extraction
    const timeout = setTimeout(() => {
      console.error(`[PuppeteerWorker] Timeout - killing process`);
      proc.kill('SIGKILL');
      reject(new Error('Puppeteer worker timeout'));
    }, 90000); // 90 second timeout for better content quality

    proc.on('close', () => {
      clearTimeout(timeout);
    });
  });
}