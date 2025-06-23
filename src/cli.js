#!/usr/bin/env node

import { program } from 'commander';
import { StrudelCover } from './index.js';
import chalk from 'chalk';
import ora from 'ora';
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from project root and local
config({ path: resolve(__dirname, '../../../.env') });
config({ path: resolve(__dirname, '../.env') });
config(); // Also try current directory

// Handle clean shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Shutting down dashboard...'));
  process.exit(0);
});

// Main program
program
  .name('strudelcover')
  .description('AI-powered tool to recreate songs as Strudel patterns')
  .version('0.1.0');

// Removed Spotify commands - using SoundCloud instead

// Default cover generation command (Dazzle mode only)
const coverCommand = program
  .command('cover <audioFile> <artist> <song>', { isDefault: true })
  .description('Generate a Strudel cover of a song using Dazzle mode')
  .option('-k, --api-key <key>', 'OpenAI API key (or set OPENAI_API_KEY env var)')
  .option('-o, --output <dir>', 'Output directory', './strudelcover-output')
  .option('--llm <provider>', 'LLM provider: openai, anthropic, ollama', 'anthropic')
  .option('--model <model>', 'LLM model to use')
  .option('--llm-base-url <url>', 'Custom LLM API endpoint')
  .option('-r, --record-output <file>', 'Output file for recording (e.g., output.wav)')
  .action(async (audioFile, artist, song, options) => {
    console.log(chalk.blue.bold('\n🎸 StrudelCover - AI Song Recreation\n'));
    
    const spinner = ora('Initializing...').start();
    
    try {
      // Configure LLM
      const llmProvider = options.llm || 'anthropic';
      const envKeyName = `${llmProvider.toUpperCase()}_API_KEY`;
      const apiKey = options.apiKey || process.env[envKeyName] || process.env.OPENAI_API_KEY;
      
      if (!apiKey && llmProvider !== 'ollama') {
        spinner.fail(`${llmProvider} API key required (use --api-key or set ${envKeyName})`);
        process.exit(1);
      }
      
      // Check audio file exists
      if (!existsSync(audioFile)) {
        spinner.fail(`Audio file not found: ${audioFile}`);
        process.exit(1);
      }
      
      spinner.succeed('Ready to create cover!');
      
      // Create StrudelCover instance (always dazzle mode)
      const coverOptions = {
        llm: llmProvider,
        llmConfig: {
          apiKey,
          model: options.model || (llmProvider === 'anthropic' ? 'claude-3-opus-20240229' : undefined),
          baseURL: options.llmBaseUrl
        },
        outputDir: options.output,
        dazzle: true // Always use dazzle mode
      };
      
      const cover = new StrudelCover(coverOptions);
      
      // Generate cover with recording options
      const coverGenerationOptions = {
        recordOutput: options.recordOutput
      };
      const results = await cover.cover(audioFile, artist, song, coverGenerationOptions);
      
      // Keep the process running
      console.log(chalk.cyan('\n📊 Dashboard is running. Press Ctrl+C to exit.\n'));
      
    } catch (error) {
      spinner.fail('Cover generation failed');
      console.error(chalk.red('Error:'), error.message);
      console.error(chalk.gray(error.stack));
      process.exit(1);
    }
  });

// Add examples to help
program.on('--help', () => {
  console.log('');
  console.log('Commands:');
  console.log('  cover <input> <artist> <song>  Generate a Strudel cover using Dazzle mode');
  console.log('');
  console.log('Examples:');
  console.log('  # Basic usage');
  console.log('  $ strudelcover song.mp3 "The Beatles" "Hey Jude"');
  console.log('');
  console.log('  # Using different LLM providers');
  console.log('  $ strudelcover song.mp3 "Artist" "Song" --llm anthropic');
  console.log('  $ strudelcover song.mp3 "Artist" "Song" --llm ollama --model llama2');
  console.log('');
  console.log('  # Custom output directory');
  console.log('  $ strudelcover song.mp3 "Artist" "Song" --output ./my-covers');
  console.log('');
  console.log('  # Record the output');
  console.log('  $ strudelcover song.mp3 "Artist" "Song" --record-output output.wav');
  console.log('');
  console.log('Dazzle Mode Features:');
  console.log('  - Simple dashboard on http://localhost:8888');
  console.log('  - Direct pattern generation using LLM');
  console.log('  - Automatic playback with Playwright');
  console.log('  - Embedded Strudel.cc for testing');
  console.log('');
  console.log('LLM Providers:');
  console.log('  anthropic (default) - Claude 3 Opus, requires ANTHROPIC_API_KEY');
  console.log('  openai             - GPT-4o, requires OPENAI_API_KEY');
  console.log('  ollama            - Local models, no API key needed');
  console.log('');
  console.log('Environment Variables:');
  console.log('  OPENAI_API_KEY        OpenAI API key');
  console.log('  ANTHROPIC_API_KEY     Anthropic API key');
});

program.parse();