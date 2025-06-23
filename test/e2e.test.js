import { test, expect } from '@playwright/test';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('StrudelCover E2E Tests', () => {
  let strudelProcess;
  
  test.beforeEach(async () => {
    // Clean up any existing recordings
    try {
      await fs.rm(path.join(__dirname, '../recordings'), { recursive: true, force: true });
    } catch (e) {
      // Directory might not exist
    }
  });
  
  test.afterEach(async () => {
    // Kill the process if it's still running
    if (strudelProcess && !strudelProcess.killed) {
      strudelProcess.kill('SIGINT');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  });
  
  test('Pattern Generation', async ({ page }) => {
    // Start strudelcover process
    strudelProcess = spawn('node', [
      'src/cli.js',
      'test-audio.mp3',
      'The Beatles',
      'Let It Be'
    ], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env }
    });
    
    let patternGenerated = false;
    
    strudelProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(output);
      if (output.includes('Pattern generated')) {
        patternGenerated = true;
      }
    });
    
    // Wait for pattern generation
    await new Promise(resolve => setTimeout(resolve, 45000));
    
    expect(patternGenerated).toBe(true);
  });
  
  test('Dashboard Launch', async ({ page }) => {
    // Start strudelcover process
    strudelProcess = spawn('node', [
      'src/cli.js',
      'test-audio.mp3',
      'The Beatles',
      'Yesterday'
    ], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env }
    });
    
    // Wait for dashboard to start
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Navigate to dashboard
    await page.goto('http://localhost:8888');
    
    // Check dashboard elements
    await expect(page.locator('h1')).toContainText('DAZZLE');
    await expect(page.locator('#status')).toBeVisible();
    await expect(page.locator('#visualizer')).toBeVisible();
    await expect(page.locator('iframe#strudel')).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/dashboard.png' });
  });
  
  test('Autoplay Functionality', async ({ page }) => {
    // Start strudelcover process
    strudelProcess = spawn('node', [
      'src/cli.js',
      'test-audio.mp3',
      'The Beatles',
      'Come Together'
    ], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env }
    });
    
    let autoplaySuccessful = false;
    
    strudelProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Autoplay successful')) {
        autoplaySuccessful = true;
      }
    });
    
    // Wait for autoplay
    await new Promise(resolve => setTimeout(resolve, 50000));
    
    expect(autoplaySuccessful).toBe(true);
  });
  
  test('Recording Functionality', async ({ page }) => {
    const outputFile = 'test-output.wav';
    
    // Start strudelcover with recording
    strudelProcess = spawn('node', [
      'src/cli.js',
      'test-audio.mp3',
      'The Beatles',
      'Hey Jude',
      '--record-output',
      outputFile
    ], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env }
    });
    
    let recordingStarted = false;
    let recordingStopped = false;
    
    strudelProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Recording started')) {
        recordingStarted = true;
      }
      if (output.includes('Recording stopped')) {
        recordingStopped = true;
      }
    });
    
    // Wait for recording to complete (10 second timeout in test mode)
    await new Promise(resolve => setTimeout(resolve, 60000));
    
    expect(recordingStarted).toBe(true);
    expect(recordingStopped).toBe(true);
    
    // Check if recording file was created (either .wav or .webm)
    const recordingsDir = path.join(__dirname, '../recordings');
    try {
      const files = await fs.readdir(recordingsDir);
      expect(files.length).toBeGreaterThan(0);
    } catch (e) {
      // Recording might have been converted to output file
      try {
        await fs.access(path.join(__dirname, '..', outputFile));
      } catch (e2) {
        // At least one should exist
        throw new Error('No recording file found');
      }
    }
  });
});