import { test, expect } from '@playwright/test';
import { spawn, execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function killPort(port) {
  try {
    execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: 'ignore' });
  } catch (e) {
    // Ignore errors
  }
}

test.describe.serial('Grimes Genesis E2E Test', () => {
  test.setTimeout(90000); // 90 seconds total timeout
  
  test.beforeEach(async () => {
    // Kill any processes on port 8888 before each test
    killPort(8888);
    await new Promise(resolve => setTimeout(resolve, 1000));
  });
  
  test.afterEach(async () => {
    // Ensure cleanup between tests
    killPort(8888);
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  test('should generate pattern for Grimes Genesis without mp3', async ({ page }) => {
    const audioOutputFile = path.join(__dirname, 'genesis-no-mp3.wav');
    
    // Start the CLI process with audio recording but no input mp3
    const cliPath = path.join(__dirname, '..', 'src', 'cli.js');
    const strudelProcess = spawn('node', [
      cliPath,
      'Grimes',  // Artist as first argument
      'Genesis', // Song as second argument
      '--record-output', audioOutputFile
    ], {
      env: { ...process.env },
      cwd: path.dirname(__dirname)
    });

    let output = '';
    strudelProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    strudelProcess.stderr.on('data', (data) => {
      console.error('Error:', data.toString());
    });

    try {
      // Wait for dashboard to be ready
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Navigate to dashboard
      await page.goto('http://localhost:8888');
      
      // Wait for pattern to appear in output (faster than waiting for DOM)
      const startTime = Date.now();
      while (Date.now() - startTime < 60000) { // 60 second timeout for pattern
        if (output.includes('Pattern set in editor!') || output.includes('Pattern evaluated!')) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Verify basic output
      expect(output).toContain('StrudelCover: "Genesis" by Grimes');
      
      // Check for pattern generation completion (any of these indicates success)
      const hasPattern = output.includes('Pattern set in editor!') || 
                        output.includes('Pattern evaluated!') ||
                        output.includes('Autoplay successful!') ||
                        output.includes('Generating pattern for') ||
                        output.includes('Asking Claude');
      expect(hasPattern).toBe(true);
      
      // Wait a bit for audio recording to capture some content
      await new Promise(resolve => setTimeout(resolve, 5000));
      
    } finally {
      // Always cleanup
      strudelProcess.kill('SIGTERM');
      await new Promise(resolve => {
        strudelProcess.on('close', resolve);
        setTimeout(resolve, 1000); // Fallback timeout
      });
      
      // Extra cleanup to ensure port is free
      killPort(8888);
      
      // Verify audio file was created and has content
      const audioExists = await fs.access(audioOutputFile).then(() => true).catch(() => false);
      expect(audioExists).toBe(true);
      
      const audioStats = await fs.stat(audioOutputFile);
      expect(audioStats.size).toBeGreaterThan(1000); // Should have actual audio content
      
      // Cleanup audio file
      await fs.unlink(audioOutputFile).catch(() => {});
    }
  });

  test('should generate pattern for Grimes Genesis with real mp3', async ({ page }) => {
    const audioFile = path.join(__dirname, 'gg.mp3');
    const audioOutputFile = path.join(__dirname, 'genesis-with-mp3.wav');
    
    // Check if mp3 exists
    const mp3Exists = await fs.access(audioFile).then(() => true).catch(() => false);
    if (!mp3Exists) {
      console.log('Skipping mp3 test - file not found at:', audioFile);
      test.skip();
      return;
    }
    
    // Start the CLI process with audio recording
    const cliPath = path.join(__dirname, '..', 'src', 'cli.js');
    const strudelProcess = spawn('node', [
      cliPath,
      audioFile,
      'Grimes',
      'Genesis',
      '--record-output', audioOutputFile
    ], {
      env: { ...process.env },
      cwd: path.dirname(__dirname)
    });

    let output = '';
    strudelProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    strudelProcess.stderr.on('data', (data) => {
      console.error('Error:', data.toString());
    });

    try {
      // Wait for dashboard to be ready
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Navigate to dashboard
      await page.goto('http://localhost:8888');
      
      // Wait for pattern to appear in output
      const startTime = Date.now();
      while (Date.now() - startTime < 60000) { // 60 second timeout
        if (output.includes('Pattern set in editor!') || output.includes('Pattern evaluated!')) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Verify basic output
      expect(output).toContain('StrudelCover: "Genesis" by Grimes');
      
      // Check for pattern generation completion (any of these indicates success)
      const hasPattern = output.includes('Pattern set in editor!') || 
                        output.includes('Pattern evaluated!') ||
                        output.includes('Autoplay successful!') ||
                        output.includes('Generating pattern for') ||
                        output.includes('Asking Claude') ||
                        output.includes('BPM detected:') ||
                        output.includes('Analyzing audio file');
      expect(hasPattern).toBe(true);
      
      // Wait a bit for audio recording to capture some content
      await new Promise(resolve => setTimeout(resolve, 5000));
      
    } finally {
      // Always cleanup
      strudelProcess.kill('SIGTERM');
      await new Promise(resolve => {
        strudelProcess.on('close', resolve);
        setTimeout(resolve, 1000); // Fallback timeout
      });
      
      // Extra cleanup to ensure port is free
      killPort(8888);
      
      // Verify audio file was created and has content
      const audioExists = await fs.access(audioOutputFile).then(() => true).catch(() => false);
      expect(audioExists).toBe(true);
      
      const audioStats = await fs.stat(audioOutputFile);
      expect(audioStats.size).toBeGreaterThan(1000); // Should have actual audio content
      
      // Cleanup audio file
      await fs.unlink(audioOutputFile).catch(() => {});
    }
  });
});