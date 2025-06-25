#!/usr/bin/env node

// Quick test of ML analysis integration

import { analyzeWithML } from './src/ml-analyzer.js';
import chalk from 'chalk';

async function test() {
  console.log(chalk.blue('Testing ML Analysis Integration'));
  
  const audioFile = process.argv[2] || 'gg.mp3';
  
  // Test basic analysis
  console.log(chalk.yellow('\n1. Basic ML Analysis:'));
  const basic = await analyzeWithML(audioFile);
  console.log(basic);
  
  // Test fancy analysis
  console.log(chalk.yellow('\n2. Fancy ML Analysis:'));
  const fancy = await analyzeWithML(audioFile, { fancy: true });
  if (fancy) {
    console.log(chalk.green('Success!'));
    console.log('Analyses:', Object.keys(fancy.analyses || {}));
  }
}

test().catch(console.error);