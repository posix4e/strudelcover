import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { Dazzle } from '../../src/dazzle.js';
import { MockAnthropic } from '../helpers/mock-anthropic.js';

describe('Dazzle class', () => {
  let dazzle;
  
  afterEach(async () => {
    if (dazzle?.server) {
      await dazzle.stop();
    }
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      dazzle = new Dazzle();
      assert.equal(dazzle.port, 8888);
      assert.equal(dazzle.pattern, null);
      assert.equal(dazzle.isRecording, false);
    });

    it('should accept custom port', () => {
      dazzle = new Dazzle({ port: 9999 });
      assert.equal(dazzle.port, 9999);
    });

    it('should use API key from options', () => {
      dazzle = new Dazzle({ apiKey: 'test-key' });
      assert.equal(dazzle.anthropic.apiKey, 'test-key');
    });

    it('should use API key from environment', () => {
      process.env.ANTHROPIC_API_KEY = 'env-key';
      dazzle = new Dazzle();
      assert.equal(dazzle.anthropic.apiKey, 'env-key');
      delete process.env.ANTHROPIC_API_KEY;
    });
  });

  describe('extractCode', () => {
    beforeEach(() => {
      dazzle = new Dazzle({ apiKey: 'test' });
    });

    it('should extract code from markdown code block', () => {
      const response = '```javascript\nconst test = true;\n```';
      const result = dazzle.extractCode(response);
      assert.equal(result, 'const test = true;\n');
    });

    it('should extract code from strudel code block', () => {
      const response = '```strudel\nsetcps(120/60/4)\n```';
      const result = dazzle.extractCode(response);
      assert.equal(result, 'setcps(120/60/4)\n');
    });

    it('should return response as-is if no code block', () => {
      const response = '  setcps(120/60/4)  ';
      const result = dazzle.extractCode(response);
      assert.equal(result, '  setcps(120/60/4)  ');
    });
  });

  describe('getFallbackPattern', () => {
    beforeEach(() => {
      dazzle = new Dazzle({ apiKey: 'test' });
    });

    it('should generate fallback pattern with song info', () => {
      const pattern = dazzle.getFallbackPattern('Test Song', 'Test Artist');
      assert(pattern.includes('Test Song'));
      assert(pattern.includes('Test Artist'));
      assert(pattern.includes('setcps'));
      assert(pattern.includes('stack'));
    });
  });

  describe('broadcast', () => {
    beforeEach(() => {
      dazzle = new Dazzle({ apiKey: 'test' });
    });

    it('should not throw when wss is null', () => {
      assert.doesNotThrow(() => {
        dazzle.broadcast({ type: 'test' });
      });
    });
  });

  describe('server methods', () => {
    beforeEach(() => {
      dazzle = new Dazzle({ apiKey: 'test' });
    });

    it('should start server on specified port', async () => {
      await dazzle.startServer();
      assert(dazzle.server);
      assert(dazzle.wss);
      
      // Check server is listening
      const address = dazzle.server.address();
      assert.equal(address.port, 8888);
    });

    it('should serve HTML on root path', async () => {
      await dazzle.startServer();
      
      const response = await fetch(`http://localhost:${dazzle.port}/`);
      assert.equal(response.status, 200);
      
      const html = await response.text();
      assert(html.includes('<!DOCTYPE html>'));
      assert(html.includes('StrudelCover'));
    });
  });
});