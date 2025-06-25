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
import { spawn } from 'child_process';

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

// Main command with flexible arguments
program
  .argument('[input]', 'Audio file path or artist name')
  .argument('[artistOrSong]', 'Artist name (if audio provided) or song name')
  .argument('[song]', 'Song name (only if audio file provided)')
  .option('-k, --api-key <key>', 'Anthropic API key (or set ANTHROPIC_API_KEY env var)')
  .option('-o, --output <dir>', 'Output directory', './strudelcover-output')
  .option('-r, --record-output <file>', 'Output file for recording (e.g., output.wav)')
  .option('--no-audio', 'AI-only mode without audio file analysis')
  .option('--analyze-audio', 'Enable all audio analysis features (default when MP3 provided)')
  .option('--no-bpm-detection', 'Skip BPM detection from audio')
  .option('--no-sample-extraction', 'Skip sample extraction from audio')
  .option('--no-structure-detection', 'Skip structure detection from audio')
  .option('--fancy-ml', 'Enable fancy ML analysis (source separation, transcription)')
  .action(async (input, artistOrSong, song, options) => {
    console.log(chalk.blue.bold('\n🎸 StrudelCover - AI Song Recreation\n'));
    
    const spinner = ora('Initializing...').start();
    
    try {
      // Get API key
      const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
      
      if (!apiKey) {
        spinner.fail('Anthropic API key required (use --api-key or set ANTHROPIC_API_KEY)');
        process.exit(1);
      }
      
      // Parse arguments flexibly
      let audioFile = null;
      let artist = null;
      let songName = null;
      
      if (!input) {
        spinner.fail('Please provide at least artist and song name');
        console.log(chalk.gray('\nUsage:'));
        console.log(chalk.gray('  strudelcover "Artist" "Song"                    # AI-only mode'));
        console.log(chalk.gray('  strudelcover audio.mp3 "Artist" "Song"          # With audio analysis'));
        process.exit(1);
      }
      
      // Determine argument pattern
      if (song) {
        // Three arguments: audioFile artist song
        if (existsSync(input)) {
          audioFile = input;
          artist = artistOrSong;
          songName = song;
        } else {
          spinner.fail(`Audio file "${input}" not found`);
          process.exit(1);
        }
      } else if (artistOrSong) {
        // Two arguments: must be artist and song
        // Audio file is now required, so this is an error
        spinner.fail('Audio file is required');
        console.log(chalk.gray('Usage: strudelcover audio.mp3 "Artist" "Song"'));
        process.exit(1);
      } else {
        spinner.fail('Please provide audio file, artist and song name');
        console.log(chalk.gray('Usage: strudelcover audio.mp3 "Artist" "Song"'));
        process.exit(1);
      }
      
      // Audio file is required
      if (!audioFile) {
        spinner.fail('Audio file is required');
        process.exit(1);
      }
      
      console.log(chalk.green(`\n🎵 Audio file: ${audioFile}`));
      
      // Run aubio analysis if no existing analysis
      const analysisFile = audioFile.replace(/\.[^.]+$/, '.analysis.json');
      if (!existsSync(analysisFile)) {
        spinner.text = 'Running audio analysis with aubio...';
        try {
          const analyzeScript = resolve(__dirname, '../scripts/analyze-with-aubio.sh');
          await new Promise((resolve, reject) => {
            const proc = spawn('bash', [analyzeScript, audioFile]);
            proc.on('close', (code) => {
              if (code === 0) resolve();
              else reject(new Error(`Analysis failed with code ${code}`));
            });
          });
          spinner.succeed('Audio analysis complete');
        } catch (error) {
          spinner.warn('Audio analysis failed, continuing without it');
        }
      } else {
        console.log(chalk.gray('Using existing analysis: ' + analysisFile));
      }
      
      // Run fancy ML analysis if requested
      if (options.fancyMl) {
        spinner.text = 'Running fancy ML analysis...';
        try {
          const { analyzeWithML } = await import('./ml-analyzer.js');
          const mlResults = await analyzeWithML(audioFile, { fancy: true });
          if (mlResults) {
            spinner.succeed('Fancy ML analysis complete');
          } else {
            spinner.warn('ML analysis incomplete, continuing with basic analysis');
          }
        } catch (error) {
          spinner.warn('ML analysis not available: ' + error.message);
          console.log(chalk.gray('Install with: pip install torch librosa demucs basic-pitch'));
        }
      }
      
      spinner.succeed('Ready to create cover!');
      
      // Create StrudelCover instance
      const coverOptions = {
        apiKey,
        outputDir: options.output,
        audioAnalysis: {
          enabled: audioFile && !options.noAudio,
          bpmDetection: options.bpmDetection !== false,
          sampleExtraction: options.sampleExtraction !== false,
          structureDetection: options.structureDetection !== false
        }
      };
      
      const cover = new StrudelCover(coverOptions);
      
      // Generate cover with recording options
      const coverGenerationOptions = {
        recordOutput: options.recordOutput
      };
      await cover.cover(audioFile, artist, songName, coverGenerationOptions);
      
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
  console.log('Usage:');
  console.log('  strudelcover [audio] <artist> <song> [options]');
  console.log('');
  console.log('Examples:');
  console.log('  # Basic usage with audio analysis');
  console.log('  $ strudelcover song.mp3 "The Beatles" "Hey Jude"');
  console.log('');
  console.log('  # With fancy ML analysis');
  console.log('  $ strudelcover song.mp3 "The Beatles" "Hey Jude" --fancy-ml');
  console.log('');
  console.log('  # Custom output directory');
  console.log('  $ strudelcover "Artist" "Song" --output ./my-covers');
  console.log('');
  console.log('  # Record the output');
  console.log('  $ strudelcover "Artist" "Song" --record-output cover.wav');
  console.log('');
  console.log('  # Skip specific audio features');
  console.log('  $ strudelcover audio.mp3 "Artist" "Song" --no-sample-extraction');
  console.log('');
  console.log('Features:');
  console.log('  - Audio analysis with aubio (automatic)');
  console.log('  - Optional ML analysis for source separation and transcription');
  console.log('  - BPM detection from audio (when available)');
  console.log('  - Sample extraction for use in patterns');
  console.log('  - Song structure detection from waveform');
  console.log('  - Dashboard on http://localhost:8888');
  console.log('  - Pattern generation using Claude Opus 4');
  console.log('  - Automatic playback with Playwright');
  console.log('  - Audio recording of generated patterns');
  console.log('');
  console.log('Audio Analysis Options:');
  console.log('  --no-audio              Disable all audio analysis');
  console.log('  --no-bpm-detection      Skip tempo analysis');
  console.log('  --no-sample-extraction  Skip sample extraction');
  console.log('  --no-structure-detection Skip structure analysis');
  console.log('  --fancy-ml              Enable ML-based source separation and transcription');
  console.log('');
  console.log('Environment Variables:');
  console.log('  ANTHROPIC_API_KEY     Anthropic API key (required)');
});

program.parse();