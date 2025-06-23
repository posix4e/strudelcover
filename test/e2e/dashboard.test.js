import { test, expect } from '@playwright/test';
import { Dazzle } from '../../src/dazzle.js';
import { waitForServer, cleanupTestFiles } from '../helpers/test-utils.js';

test.describe('Dashboard E2E Tests', () => {
  let dazzle;
  const testPort = 8890;
  
  test.beforeAll(async () => {
    await cleanupTestFiles();
    dazzle = new Dazzle({ apiKey: 'test-key', port: testPort });
    await dazzle.start();
    await waitForServer(testPort);
  });
  
  test.afterAll(async () => {
    if (dazzle) {
      await dazzle.stop();
    }
    await cleanupTestFiles();
  });

  test('should load dashboard with all elements', async ({ page }) => {
    await page.goto(`http://localhost:${testPort}`);
    
    // Check title
    await expect(page).toHaveTitle('Dazzle');
    
    // Check all main elements are present
    await expect(page.locator('h1')).toContainText('DAZZLE');
    await expect(page.locator('#status')).toBeVisible();
    await expect(page.locator('#visualizer')).toBeVisible();
    await expect(page.locator('#canvas')).toBeVisible();
    await expect(page.locator('#strudel-container')).toBeVisible();
    await expect(page.locator('#strudel')).toBeVisible();
    
    // Check controls
    await expect(page.locator('#recordBtn')).toBeVisible();
    await expect(page.locator('#recordBtn')).toBeDisabled();
    await expect(page.locator('#downloadBtn')).toBeVisible();
    await expect(page.locator('#downloadBtn')).toBeDisabled();
  });

  test('should show WebSocket connection status', async ({ page }) => {
    await page.goto(`http://localhost:${testPort}`);
    
    // Wait for WebSocket connection
    await page.waitForFunction(() => {
      const status = document.querySelector('#status');
      return status && status.textContent.includes('Connected');
    }, { timeout: 5000 });
    
    const statusText = await page.locator('#status').textContent();
    expect(statusText).toContain('Connected - waiting for pattern');
  });

  test('should display visualizer animation', async ({ page }) => {
    await page.goto(`http://localhost:${testPort}`);
    
    // Check canvas is rendering
    const canvas = page.locator('#canvas');
    await expect(canvas).toBeVisible();
    
    // Take screenshot to verify visualizer is rendering
    await page.screenshot({ 
      path: 'test-results/visualizer.png',
      clip: await canvas.boundingBox()
    });
  });

  test('should load Strudel iframe', async ({ page }) => {
    await page.goto(`http://localhost:${testPort}`);
    
    const iframe = page.locator('#strudel');
    await expect(iframe).toBeVisible();
    await expect(iframe).toHaveAttribute('src', 'https://strudel.cc');
  });

  test('should handle pattern broadcast', async ({ page }) => {
    await page.goto(`http://localhost:${testPort}`);
    
    // Wait for connection
    await page.waitForFunction(() => {
      const status = document.querySelector('#status');
      return status && status.textContent.includes('Connected');
    });
    
    // Broadcast a test pattern
    const testPattern = 'setcps(120/60/4)\\nstack(sound("bd*4"))';
    dazzle.broadcast({ type: 'pattern', data: testPattern });
    
    // Wait for status update
    await page.waitForFunction(() => {
      const status = document.querySelector('#status');
      return status && status.textContent.includes('Pattern received');
    }, { timeout: 5000 });
    
    const statusText = await page.locator('#status').textContent();
    expect(statusText).toContain('Pattern received');
  });

  test('should update UI for recording states', async ({ page }) => {
    await page.goto(`http://localhost:${testPort}`);
    
    // Simulate autoplay started
    dazzle.broadcast({ type: 'autoplayStarted' });
    
    await page.waitForFunction(() => {
      const recordBtn = document.querySelector('#recordBtn');
      return recordBtn && !recordBtn.disabled;
    });
    
    const recordBtn = page.locator('#recordBtn');
    await expect(recordBtn).toBeEnabled();
    await expect(recordBtn).toHaveText('Start Recording');
    
    // Simulate recording started
    dazzle.broadcast({ type: 'recordingStarted' });
    
    await page.waitForFunction(() => {
      const status = document.querySelector('#status');
      return status && status.textContent.includes('Recording...');
    });
    
    // Simulate recording stopped
    dazzle.broadcast({ type: 'recordingStopped' });
    
    await page.waitForFunction(() => {
      const status = document.querySelector('#status');
      return status && status.textContent.includes('Recording complete');
    });
    
    const downloadBtn = page.locator('#downloadBtn');
    await expect(downloadBtn).toBeEnabled();
  });
});