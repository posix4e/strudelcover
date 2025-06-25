import { test, expect } from '@playwright/test';
import { getSongStructure, estimateBPM } from '../../src/lyrics.js';
import { promises as fs } from 'fs';
import { join } from 'path';

test.describe('Pre-analyzed data loading', () => {
  const testAudioFile = 'test-song.mp3';
  const analysisFile = `${testAudioFile}.analysis.json`;
  
  const mockAnalysisData = {
    bpm: 128,
    duration: 240,
    structure: {
      intro: { start: 0, end: 16, description: 'Test intro' },
      verse1: { start: 16, end: 48, description: 'Test verse' },
      chorus1: { start: 48, end: 80, description: 'Test chorus' }
    }
  };
  
  test.beforeEach(async () => {
    // Create mock analysis file
    await fs.writeFile(analysisFile, JSON.stringify(mockAnalysisData, null, 2));
  });
  
  test.afterEach(async () => {
    // Clean up
    try {
      await fs.unlink(analysisFile);
    } catch (e) {
      // File might not exist
    }
  });
  
  test('should load BPM from pre-analyzed data', async () => {
    const bpm = await estimateBPM('Test Artist', 'Test Song', testAudioFile);
    expect(bpm).toBe(128);
  });
  
  test('should fall back to default BPM when no analysis file exists', async () => {
    // Remove the analysis file
    await fs.unlink(analysisFile);
    
    const bpm = await estimateBPM('Test Artist', 'Test Song', testAudioFile);
    expect(bpm).toBe(120); // Default BPM
  });
  
  test('should load song structure from pre-analyzed data', async () => {
    const structure = await getSongStructure('Test Artist', 'Test Song', testAudioFile);
    
    expect(structure.intro).toBeDefined();
    expect(structure.intro.start).toBe(0);
    expect(structure.intro.duration).toBe(16);
    expect(structure.intro.description).toBe('Test intro');
    
    expect(structure.verse1).toBeDefined();
    expect(structure.verse1.start).toBe(16);
    expect(structure.verse1.duration).toBe(32);
  });
  
  test('should handle malformed analysis files gracefully', async () => {
    // Write invalid JSON
    await fs.writeFile(analysisFile, 'invalid json content');
    
    const bpm = await estimateBPM('Test Artist', 'Test Song', testAudioFile);
    expect(bpm).toBe(120); // Should fall back to default
    
    const structure = await getSongStructure('Test Artist', 'Test Song', testAudioFile);
    expect(structure.intro).toBeDefined(); // Should have default structure
  });
  
  test('should check multiple file locations for analysis', async () => {
    // Test that it also checks for files without double extension
    const altAnalysisFile = 'test-song.analysis.json';
    await fs.writeFile(altAnalysisFile, JSON.stringify(mockAnalysisData, null, 2));
    
    try {
      const bpm = await estimateBPM('Test Artist', 'Test Song', testAudioFile);
      expect(bpm).toBe(128);
    } finally {
      await fs.unlink(altAnalysisFile).catch(() => {});
    }
  });
});