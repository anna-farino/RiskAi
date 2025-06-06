const { spawn } = require('child_process');

console.log('Starting development server...');

const devProcess = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true
});

devProcess.on('error', (error) => {
  console.error('Failed to start dev server:', error);
});

devProcess.on('close', (code) => {
  console.log(`Dev server exited with code ${code}`);
});