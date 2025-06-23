import { test, expect } from '@playwright/test';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { cleanupProcess } from '../helpers/test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('CLI E2E Tests', () => {
  let cliProcess;
  
  test.afterEach(async () => {
    await cleanupProcess(cliProcess);
  });

  test('should show help when --help is passed', async () => {
    cliProcess = spawn('node', [
      'src/cli.js',
      '--help'
    ], {
      cwd: path.join(__dirname, '../..')
    });
    
    const output = await new Promise((resolve) => {
      let stdout = '';
      cliProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      cliProcess.on('close', () => resolve(stdout));
    });
    
    expect(output).toContain('strudelcover');
    expect(output).toContain('Generate a Strudel cover');
    expect(output).toContain('Examples:');
    expect(output).toContain('--api-key');
    expect(output).toContain('--record-output');
    expect(output).toContain('Environment Variables:');
    expect(output).toContain('ANTHROPIC_API_KEY');
  });

  test('should show version when --version is passed', async () => {
    cliProcess = spawn('node', [
      'src/cli.js',
      '--version'
    ], {
      cwd: path.join(__dirname, '../..')
    });
    
    const output = await new Promise((resolve) => {
      let stdout = '';
      cliProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      cliProcess.on('close', () => resolve(stdout));
    });
    
    expect(output).toMatch(/\d+\.\d+\.\d+/); // Semantic version
  });

  test('should require audio file argument', async () => {
    cliProcess = spawn('node', [
      'src/cli.js'
    ], {
      cwd: path.join(__dirname, '../..')
    });
    
    const result = await new Promise((resolve) => {
      let stderr = '';
      cliProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      cliProcess.on('close', (code) => resolve({ code, stderr }));
    });
    
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('missing required argument');
  });

  test('should require artist and song arguments', async () => {
    cliProcess = spawn('node', [
      'src/cli.js',
      'test.mp3'
    ], {
      cwd: path.join(__dirname, '../..')
    });
    
    const result = await new Promise((resolve) => {
      let stderr = '';
      cliProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      cliProcess.on('close', (code) => resolve({ code, stderr }));
    });
    
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('missing required argument');
  });

  test('should accept all required arguments', async () => {
    cliProcess = spawn('node', [
      'src/cli.js',
      'test.mp3',
      'Artist',
      'Song'
    ], {
      cwd: path.join(__dirname, '../..'),
      env: { ...process.env, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || 'test-key' }
    });
    
    // Should start without immediate error
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Process should still be running (unless file not found)
    if (!cliProcess.killed) {
      cliProcess.kill();
    }
  });

  test('should accept custom output directory', async () => {
    cliProcess = spawn('node', [
      'src/cli.js',
      'test.mp3',
      'Artist',
      'Song',
      '--output',
      './custom-output'
    ], {
      cwd: path.join(__dirname, '../..'),
      env: { ...process.env, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || 'test-key' }
    });
    
    // Should accept the flag without error
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (!cliProcess.killed) {
      cliProcess.kill();
    }
  });

  test('should accept API key via flag', async () => {
    cliProcess = spawn('node', [
      'src/cli.js',
      'test.mp3',
      'Artist',
      'Song',
      '--api-key',
      'test-api-key'
    ], {
      cwd: path.join(__dirname, '../..'),
      env: { ...process.env, ANTHROPIC_API_KEY: undefined }
    });
    
    // Should accept the flag and not complain about missing API key
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (!cliProcess.killed) {
      cliProcess.kill();
    }
  });

  test('should handle Ctrl+C gracefully', async () => {
    cliProcess = spawn('node', [
      'src/cli.js',
      'test.mp3',
      'Artist',
      'Song'
    ], {
      cwd: path.join(__dirname, '../..'),
      env: { ...process.env, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || 'test-key' }
    });
    
    // Wait a bit then send SIGINT
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    cliProcess.kill('SIGINT');
    
    const output = await new Promise((resolve) => {
      let stdout = '';
      cliProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      cliProcess.on('close', () => resolve(stdout));
    });
    
    // Should show shutdown message
    expect(output).toMatch(/Shutting down|exit/i);
  });
});