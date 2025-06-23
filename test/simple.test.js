// Simple test to verify pattern generation
import { config } from 'dotenv';
config();

import { SimpleDazzle } from '../src/dazzle.js';
import { LLMProviderFactory } from '../src/llm/index.js';

async function testPatternGeneration() {
  console.log('Testing pattern generation...');
  
  try {
    const llmProvider = await LLMProviderFactory.create('anthropic', {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-3-opus-20240229'
    });
    
    const dazzle = new SimpleDazzle({ llmProvider });
    
    // Just test pattern generation without starting server
    dazzle.pattern = null;
    
    // Mock the broadcast method
    dazzle.broadcast = () => {};
    
    // Call generatePattern directly
    const pattern = await dazzle.generatePattern('test.mp3', 'Test Artist', 'Test Song');
    
    console.log('Pattern generated successfully!');
    console.log('Pattern length:', pattern.length, 'characters');
    console.log('Contains setcps:', pattern.includes('setcps'));
    console.log('Contains stack:', pattern.includes('stack'));
    
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

testPatternGeneration();