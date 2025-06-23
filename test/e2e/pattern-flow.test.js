import { test, expect } from '@playwright/test';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  createTestAudioFile, 
  cleanupTestFiles, 
  captureOutput,
  waitForPattern,
  cleanupProcess 
} from '../helpers/test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Pattern Generation Flow E2E', () => {
  let strudelProcess;
  let testAudioPath;
  
  test.beforeEach(async () => {
    await cleanupTestFiles();
    testAudioPath = await createTestAudioFile();
  });
  
  test.afterEach(async () => {
    await cleanupProcess(strudelProcess);
    await cleanupTestFiles();
  });

  test('should generate pattern through CLI', async ({ page }) => {
    // Start strudelcover process
    strudelProcess = spawn('node', [
      'src/cli.js',
      'test-audio.mp3',
      'The Beatles',
      'Let It Be'
    ], {
      cwd: path.join(__dirname, '../..'),
      env: { ...process.env, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || 'test-key' }
    });
    
    const output = captureOutput(strudelProcess);
    
    // Wait for pattern generation
    const patternGenerated = await waitForPattern(output, 60000);
    expect(patternGenerated).toBe(true);
    
    // Check output contains expected elements
    expect(output.stdout).toContain('StrudelCover');
    expect(output.stdout).toContain('Let It Be');
    expect(output.stdout).toContain('The Beatles');
    expect(output.stdout).toContain('Pattern generated');
    expect(output.stdout).toContain('Dazzle running at http://localhost:8888');
  });

  test('should display pattern in dashboard', async ({ page }) => {
    // Start strudelcover process
    strudelProcess = spawn('node', [
      'src/cli.js',
      'test-audio.mp3',
      'Pink Floyd',
      'Wish You Were Here'
    ], {
      cwd: path.join(__dirname, '../..'),
      env: { ...process.env, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || 'test-key' }
    });
    
    const output = captureOutput(strudelProcess);
    
    // Wait for server to start
    await page.waitForTimeout(5000);
    
    // Navigate to dashboard
    await page.goto('http://localhost:8888');
    
    // Wait for pattern generation
    await waitForPattern(output, 60000);
    
    // Check dashboard received pattern
    await page.waitForFunction(() => {
      const status = document.querySelector('#status');
      return status && status.textContent.includes('Pattern received');
    }, { timeout: 10000 });
    
    // Take screenshot of dashboard with pattern
    await page.screenshot({ path: 'test-results/pattern-loaded.png' });
  });

  test('should handle missing audio file gracefully', async ({ page }) => {
    strudelProcess = spawn('node', [
      'src/cli.js',
      'nonexistent.mp3',
      'Artist',
      'Song'
    ], {
      cwd: path.join(__dirname, '../..'),
      env: { ...process.env }
    });
    
    const output = captureOutput(strudelProcess);
    
    // Wait for error
    await new Promise(resolve => {
      strudelProcess.on('exit', resolve);
    });
    
    expect(output.stdout).toContain('Audio file not found');
    expect(strudelProcess.exitCode).toBe(1);
  });

  test('should handle missing API key gracefully', async ({ page }) => {
    // Remove API key from environment
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    
    strudelProcess = spawn('node', [
      'src/cli.js',
      'test-audio.mp3',
      'Artist',
      'Song'
    ], {
      cwd: path.join(__dirname, '../..'),
      env: { ...process.env }
    });
    
    const output = captureOutput(strudelProcess);
    
    // Wait for error
    await new Promise(resolve => {
      strudelProcess.on('exit', resolve);
    });
    
    expect(output.stdout).toContain('Anthropic API key required');
    expect(strudelProcess.exitCode).toBe(1);
    
    // Restore API key
    if (originalKey) {
      process.env.ANTHROPIC_API_KEY = originalKey;
    }
  });

  test('should attempt autoplay', async ({ page }) => {
    strudelProcess = spawn('node', [
      'src/cli.js',
      'test-audio.mp3',
      'The Beatles',
      'Come Together'
    ], {
      cwd: path.join(__dirname, '../..'),
      env: { ...process.env, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || 'test-key' }
    });
    
    const output = captureOutput(strudelProcess);
    
    // Wait for autoplay attempt
    await new Promise(resolve => setTimeout(resolve, 60000));
    
    // Check for autoplay message (may succeed or fail depending on environment)
    const outputText = output.stdout;
    expect(outputText).toMatch(/Attempting autoplay|Autoplay successful|Autoplay failed/);
  });
});