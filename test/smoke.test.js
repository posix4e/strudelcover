#!/usr/bin/env node

// Quick smoke test to verify basic functionality
import { Dazzle } from '../src/dazzle.js';
import { StrudelCover } from '../src/index.js';
import assert from 'assert';

console.log('🔥 Running smoke tests...\n');

async function runSmokeTests() {
  let testsPassed = 0;
  let testsFailed = 0;
  
  // Test 1: Can import classes
  try {
    assert(Dazzle, 'Dazzle class should be importable');
    assert(StrudelCover, 'StrudelCover class should be importable');
    console.log('✅ Module imports work');
    testsPassed++;
  } catch (e) {
    console.log('❌ Module imports failed:', e.message);
    testsFailed++;
  }
  
  // Test 2: Can create instances
  try {
    const dazzle = new Dazzle({ apiKey: 'test' });
    const cover = new StrudelCover({ apiKey: 'test' });
    assert(dazzle, 'Should create Dazzle instance');
    assert(cover, 'Should create StrudelCover instance');
    console.log('✅ Class instantiation works');
    testsPassed++;
  } catch (e) {
    console.log('❌ Class instantiation failed:', e.message);
    testsFailed++;
  }
  
  // Test 3: Server can start
  try {
    const dazzle = new Dazzle({ apiKey: 'test', port: 8891 });
    await dazzle.startServer();
    assert(dazzle.server, 'Server should be created');
    assert(dazzle.wss, 'WebSocket server should be created');
    await dazzle.stop();
    console.log('✅ Server startup works');
    testsPassed++;
  } catch (e) {
    console.log('❌ Server startup failed:', e.message);
    testsFailed++;
  }
  
  // Test 4: Pattern generation helpers work
  try {
    const dazzle = new Dazzle({ apiKey: 'test' });
    const fallback = dazzle.getFallbackPattern('Song', 'Artist');
    assert(fallback.includes('Song'), 'Fallback should include song name');
    assert(fallback.includes('Artist'), 'Fallback should include artist');
    console.log('✅ Pattern helpers work');
    testsPassed++;
  } catch (e) {
    console.log('❌ Pattern helpers failed:', e.message);
    testsFailed++;
  }
  
  // Test 5: Template loading works
  try {
    const dazzle = new Dazzle({ apiKey: 'test' });
    const html = await dazzle.getHTML();
    assert(html.includes('<!DOCTYPE html>'), 'Should load HTML template');
    assert(html.includes('DAZZLE'), 'HTML should contain DAZZLE');
    console.log('✅ Template loading works');
    testsPassed++;
  } catch (e) {
    console.log('❌ Template loading failed:', e.message);
    testsFailed++;
  }
  
  console.log(`\n📊 Smoke Test Results: ${testsPassed} passed, ${testsFailed} failed\n`);
  
  return testsFailed === 0 ? 0 : 1;
}

// Run tests and exit with appropriate code
runSmokeTests().then(exitCode => {
  process.exit(exitCode);
}).catch(error => {
  console.error('💥 Smoke test error:', error);
  process.exit(1);
});