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
  .description('AI-powered tool to recreate songs as Strudel patterns from audio analysis')
  .version('0.1.0');

// Main command requires audio file
program
  .argument('<audioFile>', 'Audio file path (MP3, WAV, etc.)')
  .argument('<artist>', 'Artist name')
  .argument('<song>', 'Song name')
  .option('-k, --api-key <key>', 'Anthropic API key (or set ANTHROPIC_API_KEY env var)')
  .option('-o, --output <dir>', 'Output directory', './strudelcover-output')
  .option('-r, --record-output <file>', 'Output file for recording (e.g., output.webm)')
  .option('--no-bpm-detection', 'Skip BPM detection from audio')
  .option('--no-sample-extraction', 'Skip sample extraction from audio')
  .option('--no-structure-detection', 'Skip structure detection from audio')
  .action(async (audioFile, artist, song, options) => {
    console.log(chalk.blue.bold('\n🎸 StrudelCover - AI Song Recreation from Audio\n'));
    
    const spinner = ora('Initializing...').start();
    
    try {
      // Get API key
      const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
      
      if (!apiKey) {
        spinner.fail('Anthropic API key required (use --api-key or set ANTHROPIC_API_KEY)');
        process.exit(1);
      }
      
      // Validate audio file exists
      if (!existsSync(audioFile)) {
        spinner.fail(`Audio file not found: ${audioFile}`);
        console.log(chalk.gray('\nUsage:'));
        console.log(chalk.gray('  strudelcover <audio.mp3> "Artist" "Song"'));
        console.log(chalk.gray('\nExample:'));
        console.log(chalk.gray('  strudelcover song.mp3 "Pink Floyd" "Wish You Were Here"'));
        process.exit(1);
      }
      
      // Validate file is audio
      const validExtensions = ['.mp3', '.wav', '.m4a', '.flac', '.ogg', '.aac'];
      const fileExt = audioFile.toLowerCase().substring(audioFile.lastIndexOf('.'));
      if (!validExtensions.includes(fileExt)) {
        spinner.fail(`Invalid audio file format: ${fileExt}`);
        console.log(chalk.gray(`\nSupported formats: ${validExtensions.join(', ')}`));
        process.exit(1);
      }
      
      // Log inputs
      console.log(chalk.green(`\n🎵 Audio file: ${audioFile}`));
      console.log(chalk.blue(`🎤 Artist: ${artist}`));
      console.log(chalk.blue(`🎶 Song: ${song}`));
      
      // Check for pre-analyzed data or run analysis
      const analysisFile = `${audioFile}.analysis.json`;
      if (!existsSync(analysisFile)) {
        spinner.text = 'Running comprehensive audio analysis...';
        console.log(chalk.yellow('\n⚠ No analysis file found. Running aubio analysis...'));
        console.log(chalk.gray('This may take a moment for long audio files...\n'));
        
        try {
          const { execSync } = await import('child_process');
          execSync(`./scripts/analyze-with-aubio.sh "${audioFile}"`, { stdio: 'inherit' });
          console.log(chalk.green('\n✓ Audio analysis complete!'));
        } catch (error) {
          spinner.fail('Audio analysis failed');
          console.log(chalk.red('\nError: Could not analyze audio file'));
          console.log(chalk.gray('Make sure aubio is installed: brew install aubio'));
          console.log(chalk.gray('Or pre-analyze with: npm run analyze "' + audioFile + '"'));
          process.exit(1);
        }
      } else {
        console.log(chalk.green('✓ Pre-analyzed data found'));
      }
      
      spinner.succeed('Ready to create cover!');
      
      // Create StrudelCover instance with audio analysis always enabled
      const coverOptions = {
        apiKey,
        outputDir: options.output,
        audioAnalysis: {
          enabled: true,
          bpmDetection: options.bpmDetection !== false,
          sampleExtraction: options.sampleExtraction !== false,
          structureDetection: options.structureDetection !== false
        }
      };
      
      if (options.recordOutput) {
        coverOptions.recordOutput = options.recordOutput;
      }
      
      const strudelCover = new StrudelCover(coverOptions);
      
      console.log(chalk.blue('\nStarting pattern generation...\n'));
      
      const result = await strudelCover.cover(
        audioFile,
        artist,
        song
      );
      
      if (result.success) {
        console.log(chalk.green.bold('\n✨ Pattern generation complete!'));
        console.log(chalk.gray(`\nDashboard: ${result.dashboardUrl}`));
        console.log(chalk.gray('Pattern is playing in the browser'));
        console.log(chalk.gray('\nPress Ctrl+C to stop'));
        
        // Keep the process alive
        await new Promise(() => {});
      } else {
        console.error(chalk.red('\n❌ Pattern generation failed'));
        process.exit(1);
      }
      
    } catch (error) {
      spinner.fail('An error occurred');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program.addHelpText('after', `
${chalk.bold('Examples:')}
  $ strudelcover song.mp3 "The Beatles" "Hey Jude"
  $ strudelcover track.wav "Pink Floyd" "Comfortably Numb"
  $ strudelcover audio.m4a "Daft Punk" "One More Time" --record-output video.webm

${chalk.bold('Audio Analysis:')}
  StrudelCover requires an audio file to analyze BPM, structure, and musical features.
  The analysis creates patterns that match your source audio's tempo and sections.
  
  Pre-analyze audio files with:
  $ npm run analyze song.mp3
  
  Or let StrudelCover analyze automatically when you run it.

${chalk.bold('Requirements:')}
  - Audio file (MP3, WAV, M4A, FLAC, OGG, AAC)
  - Anthropic API key
  - aubio (install with: brew install aubio)
  - ffmpeg (install with: brew install ffmpeg)

${chalk.bold('Environment Variables:')}
  ANTHROPIC_API_KEY     Anthropic API key (required)
`);

program.parse();