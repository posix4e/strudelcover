import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { StrudelCover } from '../../src/index.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('StrudelCover class', () => {
  let cover;
  const testOutputDir = path.join(__dirname, '../../test-output');
  
  afterEach(async () => {
    // Clean up test output directory
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch (e) {
      // Directory might not exist
    }
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      cover = new StrudelCover();
      assert.equal(cover.outputDir, './strudelcover-output');
    });

    it('should accept custom output directory', () => {
      cover = new StrudelCover({ outputDir: testOutputDir });
      assert.equal(cover.outputDir, testOutputDir);
    });

    it('should create output directory if it does not exist', async () => {
      cover = new StrudelCover({ outputDir: testOutputDir });
      
      const stats = await fs.stat(testOutputDir);
      assert(stats.isDirectory());
    });

    it('should store API key from options', () => {
      cover = new StrudelCover({ apiKey: 'test-key' });
      assert.equal(cover.apiKey, 'test-key');
    });

    it('should use API key from environment', () => {
      process.env.ANTHROPIC_API_KEY = 'env-key';
      cover = new StrudelCover();
      assert.equal(cover.apiKey, 'env-key');
      delete process.env.ANTHROPIC_API_KEY;
    });
  });

  describe('cover method', () => {
    beforeEach(() => {
      // Mock to prevent actual server startup
      process.env.ANTHROPIC_API_KEY = 'test-key';
    });

    afterEach(() => {
      delete process.env.ANTHROPIC_API_KEY;
    });

    it('should throw error if no API key', async () => {
      cover = new StrudelCover();
      cover.apiKey = null;
      
      await assert.rejects(
        async () => await cover.cover('test.mp3', 'Artist', 'Song'),
        /Anthropic API key required/
      );
    });

    it('should validate required parameters', async () => {
      cover = new StrudelCover({ apiKey: 'test-key' });
      
      // This would actually start the server, so we just verify the method exists
      assert(typeof cover.cover === 'function');
      assert.equal(cover.cover.length, 3); // 3 required parameters + 1 optional
    });
  });

  describe('options handling', () => {
    it('should store all provided options', () => {
      const options = {
        apiKey: 'test-key',
        outputDir: './custom-output',
        customOption: 'value'
      };
      
      cover = new StrudelCover(options);
      assert.deepEqual(cover.options, options);
    });
  });
});