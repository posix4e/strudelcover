import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function waitForServer(port = 8888, timeout = 10000) {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(`http://localhost:${port}`);
      if (response.ok) return true;
    } catch (e) {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error(`Server did not start within ${timeout}ms`);
}

export async function cleanupProcess(process) {
  if (process && !process.killed) {
    process.kill('SIGINT');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

export async function createTestAudioFile(filename = 'test-audio.mp3') {
  const filepath = path.join(__dirname, '../../', filename);
  await fs.writeFile(filepath, Buffer.from('fake audio data'));
  return filepath;
}

export async function cleanupTestFiles() {
  const testFiles = ['test-audio.mp3', 'test-output.wav', 'test-output.webm'];
  const dirs = ['recordings', 'strudelcover-output'];
  
  for (const file of testFiles) {
    try {
      await fs.unlink(path.join(__dirname, '../../', file));
    } catch (e) {
      // File might not exist
    }
  }
  
  for (const dir of dirs) {
    try {
      await fs.rm(path.join(__dirname, '../../', dir), { recursive: true, force: true });
    } catch (e) {
      // Directory might not exist
    }
  }
}

export function captureOutput(process) {
  const output = { stdout: '', stderr: '' };
  
  process.stdout.on('data', (data) => {
    output.stdout += data.toString();
  });
  
  process.stderr.on('data', (data) => {
    output.stderr += data.toString();
  });
  
  return output;
}

export async function waitForPattern(output, timeout = 30000) {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    if (output.stdout.includes('Pattern generated')) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return false;
}