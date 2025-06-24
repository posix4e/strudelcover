#!/usr/bin/env node

import { program } from 'commander';
import { StrudelCover } from './index.js';
import chalk from 'chalk';
import ora from 'ora';
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
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

// Default cover generation command
program
  .command('cover <audioFile> <artist> <song>', { isDefault: true })
  .description('Generate a Strudel cover of a song using Claude AI')
  .option('-k, --api-key <key>', 'Anthropic API key (or set ANTHROPIC_API_KEY env var)')
  .option('-o, --output <dir>', 'Output directory', './strudelcover-output')
  .option('-r, --record-output <file>', 'Output file for recording (e.g., output.webm)')
  .action(async (audioFile, artist, song, options) => {
    console.log(chalk.blue.bold('\n🎸 StrudelCover - AI Song Recreation\n'));
    
    const spinner = ora('Initializing...').start();
    
    try {
      // Get API key
      const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
      
      if (!apiKey) {
        spinner.fail('Anthropic API key required (use --api-key or set ANTHROPIC_API_KEY)');
        process.exit(1);
      }
      
      // Check if audioFile is actually a file or if user is in AI-only mode
      let actualAudioFile = audioFile;
      if (audioFile === '--ai-only' || audioFile === '--no-audio' || !existsSync(audioFile)) {
        actualAudioFile = null;
        if (audioFile !== '--ai-only' && audioFile !== '--no-audio') {
          console.log(chalk.yellow(`Audio file "${audioFile}" not found - running in AI-only mode`));
        } else {
          console.log(chalk.yellow('🤖 Running in AI-only mode (no audio analysis)'));
        }
      }
      
      spinner.succeed('Ready to create cover!');
      
      // Create StrudelCover instance
      const coverOptions = {
        apiKey,
        outputDir: options.output
      };
      
      const cover = new StrudelCover(coverOptions);
      
      // Generate cover with recording options
      const coverGenerationOptions = {
        recordOutput: options.recordOutput
      };
      await cover.cover(actualAudioFile, artist, song, coverGenerationOptions);
      
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
  console.log('  cover <input> <artist> <song>  Generate a Strudel cover using Claude AI');
  console.log('');
  console.log('Examples:');
  console.log('  # Basic usage with audio file');
  console.log('  $ strudelcover song.mp3 "The Beatles" "Hey Jude"');
  console.log('');
  console.log('  # AI-only mode (no audio file)');
  console.log('  $ strudelcover --ai-only "The Beatles" "Hey Jude"');
  console.log('');
  console.log('  # Custom output directory');
  console.log('  $ strudelcover song.mp3 "Artist" "Song" --output ./my-covers');
  console.log('');
  console.log('  # Record the output');
  console.log('  $ strudelcover --ai-only "Artist" "Song" --record-output output.webm');
  console.log('');
  console.log('Features:');
  console.log('  - AI-only mode - generate patterns without audio files');
  console.log('  - Dashboard on http://localhost:8888');
  console.log('  - Pattern generation using Claude Opus 4');
  console.log('  - Song structure analysis and timing');
  console.log('  - Automatic playback with Playwright');
  console.log('  - Embedded Strudel.cc player');
  console.log('  - Audio recording of generated patterns');
  console.log('');
  console.log('Environment Variables:');
  console.log('  ANTHROPIC_API_KEY     Anthropic API key (required)');
});

program.parse();