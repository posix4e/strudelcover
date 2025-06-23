import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Dazzle } from '../../src/dazzle.js';
import { MockAnthropic } from '../helpers/mock-anthropic.js';

describe('Pattern generation integration', () => {
  let dazzle;
  
  beforeEach(() => {
    // Use mock for integration tests to avoid API calls
    dazzle = new Dazzle({ apiKey: 'test-key' });
    dazzle.anthropic = new MockAnthropic({ apiKey: 'test-key' });
    // Mock autoplay to avoid setTimeout
    dazzle.autoplay = () => {};
  });

  describe('generatePattern', () => {
    it('should generate pattern with song details', async () => {
      dazzle.broadcast = () => {}; // Mock broadcast
      
      const pattern = await dazzle.generatePattern('test.mp3', 'Test Artist', 'Test Song');
      
      assert(pattern);
      assert(pattern.includes('Test Song'));
      assert(pattern.includes('Test Artist'));
      assert(pattern.includes('setcps'));
    });

    it('should extract pattern from API response', async () => {
      dazzle.broadcast = () => {}; // Mock broadcast
      
      const pattern = await dazzle.generatePattern('test.mp3', 'Artist', 'Song');
      
      // Should not include markdown code block markers
      assert(!pattern.includes('```'));
      assert(pattern.includes('setcps'));
    });

    it('should handle API errors with fallback', async () => {
      dazzle.broadcast = () => {}; // Mock broadcast
      
      // Make API throw error
      dazzle.anthropic.messages.create = async () => {
        throw new Error('API Error');
      };
      
      const pattern = await dazzle.generatePattern('test.mp3', 'Fallback Artist', 'Fallback Song');
      
      assert(pattern);
      assert(pattern.includes('Fallback pattern'));
      assert(pattern.includes('Fallback Artist'));
      assert(pattern.includes('Fallback Song'));
    });

    it('should broadcast pattern after generation', async () => {
      let broadcastCalled = false;
      let broadcastData = null;
      
      dazzle.broadcast = (data) => {
        broadcastCalled = true;
        broadcastData = data;
      };
      
      await dazzle.generatePattern('test.mp3', 'Artist', 'Song');
      
      assert(broadcastCalled);
      assert.equal(broadcastData.type, 'pattern');
      assert(broadcastData.data.includes('setcps'));
    });

    it('should validate generated patterns contain required elements', async () => {
      dazzle.broadcast = () => {};
      
      const pattern = await dazzle.generatePattern('test.mp3', 'Artist', 'Song');
      
      // Check for essential Strudel elements
      assert(pattern.includes('setcps'), 'Pattern should include setcps');
      assert(pattern.includes('stack') || pattern.includes('cat'), 'Pattern should include stack or cat');
      assert(pattern.includes('//'), 'Pattern should include comments');
    });
  });

  describe('template loading', () => {
    it('should load and process prompt template', async () => {
      dazzle.broadcast = () => {};
      
      // The generatePattern method should load the template
      const pattern = await dazzle.generatePattern('test.mp3', 'Template Artist', 'Template Song');
      
      // If template loading works, the pattern should be generated
      assert(pattern);
      assert(typeof pattern === 'string');
      assert(pattern.length > 0);
    });
  });
});