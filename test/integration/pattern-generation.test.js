import test from 'node:test';
import assert from 'node:assert';
import { Dazzle } from '../../src/dazzle.js';
import { MockAnthropic } from '../helpers/mock-anthropic.js';

// Note: There's a known issue with Node.js test runner deserialization
// when running these tests in CI. These tests pass locally but fail in CI
// with "Unable to deserialize cloned data" error.

test('Pattern generation - basic test', async () => {
  // Simple test to ensure the module loads
  const dazzle = new Dazzle({ apiKey: 'test-key', port: 0 });
  assert(dazzle);
  
  // Ensure we can create a mock
  const mock = new MockAnthropic({ apiKey: 'test-key' });
  assert(mock);
  
  // Basic pattern extraction test
  const pattern = dazzle.extractCode(`
\`\`\`javascript
setcps(120/60/4)
\`\`\`
  `);
  assert.equal(pattern.trim(), 'setcps(120/60/4)');
});

test('Fallback pattern generation', async () => {
  const dazzle = new Dazzle({ apiKey: 'test-key', port: 0 });
  const pattern = dazzle.getFallbackPattern('Test Song', 'Test Artist');
  
  assert(pattern.includes('Test Song'));
  assert(pattern.includes('Test Artist'));
  assert(pattern.includes('setcps'));
});