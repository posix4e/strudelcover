#!/usr/bin/env node

// Simple test to verify minimal dazzle mode setup

import { StrudelCover, DazzleGenerator, DazzleDashboard, LLMProviderFactory } from './src/index.js';

console.log('Testing minimal dazzle mode setup...\n');

// Test imports
console.log('✓ StrudelCover imported');
console.log('✓ DazzleGenerator imported');
console.log('✓ DazzleDashboard imported');
console.log('✓ LLMProviderFactory imported');

// Test instantiation
try {
  const dashboard = new DazzleDashboard();
  console.log('✓ DazzleDashboard instantiated');
  
  const llmProvider = LLMProviderFactory.create('openai', { apiKey: 'test-key' });
  console.log('✓ LLM provider created');
  
  const generator = new DazzleGenerator({ 
    llmProvider,
    dashboard 
  });
  console.log('✓ DazzleGenerator instantiated');
  
  const cover = new StrudelCover({
    apiKey: 'test-key',
    dazzle: true
  });
  console.log('✓ StrudelCover instantiated with dazzle mode');
  
  console.log('\n✅ All components loaded successfully!');
  console.log('\nTo run dazzle mode:');
  console.log('npm run cover <audio-file> <artist> <song> -- --dazzle');
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
}