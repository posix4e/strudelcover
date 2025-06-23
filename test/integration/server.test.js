import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { Dazzle } from '../../src/dazzle.js';
import WebSocket from 'ws';
import { waitForServer } from '../helpers/test-utils.js';

describe('Dazzle server integration', () => {
  let dazzle;
  const testPort = 8899; // Use different port to avoid conflicts
  
  beforeEach(async () => {
    dazzle = new Dazzle({ apiKey: 'test-key', port: testPort });
    await dazzle.startServer();
    await waitForServer(testPort);
  });
  
  afterEach(async () => {
    if (dazzle) {
      await dazzle.stop();
      // Wait a bit for port to be released
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  });

  describe('WebSocket communication', () => {
    it('should accept WebSocket connections', async () => {
      const ws = new WebSocket(`ws://localhost:${testPort}`);
      
      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });
      
      assert.equal(ws.readyState, WebSocket.OPEN);
      ws.close();
    });

    it('should handle ready message', async () => {
      const ws = new WebSocket(`ws://localhost:${testPort}`);
      
      await new Promise((resolve) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({ type: 'ready' }));
          resolve();
        });
      });
      
      // Server should accept the message without error
      await new Promise(resolve => setTimeout(resolve, 100));
      ws.close();
    });

    it('should broadcast pattern to connected clients', async () => {
      const ws = new WebSocket(`ws://localhost:${testPort}`);
      const testPattern = 'setcps(120/60/4)\\nstack(sound("bd*4"))';
      
      const messagePromise = new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'pattern') {
            resolve(message);
          }
        });
      });
      
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
      
      // Broadcast pattern
      dazzle.pattern = testPattern;
      dazzle.broadcast({ type: 'pattern', data: testPattern });
      
      const message = await messagePromise;
      assert.equal(message.type, 'pattern');
      assert.equal(message.data, testPattern);
      
      ws.close();
    });

    it('should handle multiple concurrent connections', async () => {
      const clients = [];
      const messagePromises = [];
      
      // Connect 3 clients
      for (let i = 0; i < 3; i++) {
        const ws = new WebSocket(`ws://localhost:${testPort}`);
        clients.push(ws);
        
        messagePromises.push(new Promise((resolve) => {
          ws.on('message', (data) => {
            const message = JSON.parse(data.toString());
            if (message.type === 'test') {
              resolve(message);
            }
          });
        }));
        
        await new Promise((resolve) => {
          ws.on('open', resolve);
        });
      }
      
      // Broadcast to all
      dazzle.broadcast({ type: 'test', data: 'broadcast' });
      
      const messages = await Promise.all(messagePromises);
      assert.equal(messages.length, 3);
      messages.forEach(msg => {
        assert.equal(msg.type, 'test');
        assert.equal(msg.data, 'broadcast');
      });
      
      // Clean up
      clients.forEach(ws => ws.close());
    });
  });

  describe('HTTP server', () => {
    it('should return 200 for root path', async () => {
      const response = await fetch(`http://localhost:${testPort}/`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'text/html');
    });

    it('should return dashboard HTML with correct elements', async () => {
      const response = await fetch(`http://localhost:${testPort}/`);
      const html = await response.text();
      
      // Check for key elements
      assert(html.includes('<title>Dazzle</title>'));
      assert(html.includes('id="status"'));
      assert(html.includes('id="visualizer"'));
      assert(html.includes('id="strudel"'));
      assert(html.includes(`ws://localhost:${testPort}`));
    });

  });
});