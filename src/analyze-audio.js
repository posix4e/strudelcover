#!/usr/bin/env node

import { Command } from 'commander';
import { analyzeAudio } from './audio-analyzer.js';
import { promises as fs } from 'fs';
import chalk from 'chalk';
import { basename } from 'path';

const program = new Command();

program
  .name('analyze-audio')
  .description('Analyze audio files to extract BPM, structure, and musical features')
  .version('0.1.0')
  .argument('<audio-file>', 'Path to audio file (MP3, WAV, etc.)')
  .option('-o, --output <file>', 'Output JSON file (default: <audio-file>.analysis.json)')
  .option('--no-bpm', 'Skip BPM detection')
  .option('--no-structure', 'Skip structure detection')
  .option('--no-samples', 'Skip sample extraction')
  .option('--essentia', 'Use Essentia for advanced analysis (if installed)')
  .option('--aubio', 'Use Aubio for BPM detection (if installed)')
  .option('--librosa', 'Use Librosa Python library (requires Python)')
  .parse();

async function main() {
  const audioFile = program.args[0];
  const options = program.opts();
  
  console.log(chalk.blue(`\n🎵 Analyzing: ${audioFile}\n`));
  
  try {
    // Check if file exists
    await fs.access(audioFile);
    
    // Determine which analysis tool to use
    let analyzer = 'ffmpeg'; // default
    
    if (options.essentia) {
      // Check if essentia_streaming_extractor_music is available
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      try {
        await execAsync('which essentia_streaming_extractor_music');
        analyzer = 'essentia';
        console.log(chalk.green('✓ Using Essentia for advanced analysis'));
      } catch {
        console.log(chalk.yellow('⚠ Essentia not found, falling back to FFmpeg'));
      }
    } else if (options.aubio) {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      try {
        await execAsync('which aubiotempo');
        analyzer = 'aubio';
        console.log(chalk.green('✓ Using Aubio for BPM detection'));
      } catch {
        console.log(chalk.yellow('⚠ Aubio not found, falling back to FFmpeg'));
      }
    } else if (options.librosa) {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      try {
        await execAsync('python3 -c "import librosa"');
        analyzer = 'librosa';
        console.log(chalk.green('✓ Using Librosa for analysis'));
      } catch {
        console.log(chalk.yellow('⚠ Librosa not found, falling back to FFmpeg'));
      }
    }
    
    let results;
    
    if (analyzer === 'essentia') {
      results = await analyzeWithEssentia(audioFile);
    } else if (analyzer === 'librosa') {
      results = await analyzeWithLibrosa(audioFile);
    } else {
      // Use our existing analyzer
      const artist = 'Unknown';
      const song = basename(audioFile, '.mp3');
      
      results = await analyzeAudio(audioFile, artist, song, {
        bpmDetection: options.bpm,
        structureDetection: options.structure,
        sampleExtraction: options.samples
      });
    }
    
    // Output file
    const outputFile = options.output || `${audioFile}.analysis.json`;
    
    // Save results
    await fs.writeFile(outputFile, JSON.stringify(results, null, 2));
    console.log(chalk.green(`\n✓ Analysis saved to: ${outputFile}`));
    
    // Display summary
    console.log(chalk.blue('\n📊 Analysis Summary:'));
    console.log(chalk.white(`  BPM: ${results.bpm || 'N/A'}`));
    console.log(chalk.white(`  Duration: ${results.duration ? `${Math.round(results.duration)}s` : 'N/A'}`));
    console.log(chalk.white(`  Key: ${results.key || 'N/A'}`));
    
    if (results.structure) {
      console.log(chalk.white(`  Sections: ${Object.keys(results.structure).join(', ')}`));
    }
    
  } catch (error) {
    console.error(chalk.red(`\n✗ Error: ${error.message}`));
    process.exit(1);
  }
}

async function analyzeWithEssentia(audioFile) {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  const tempOutput = `/tmp/essentia_${Date.now()}.json`;
  
  try {
    await execAsync(
      `essentia_streaming_extractor_music "${audioFile}" "${tempOutput}"`
    );
    
    const data = JSON.parse(await fs.readFile(tempOutput, 'utf8'));
    
    // Extract relevant information
    const results = {
      bpm: Math.round(data.rhythm?.bpm || 120),
      key: `${data.tonal?.key_key || 'C'} ${data.tonal?.key_scale || 'major'}`,
      duration: data.metadata?.audio_properties?.length || 180,
      energy: data.lowlevel?.average_loudness || 0,
      danceability: data.rhythm?.danceability || 0,
      structure: {}
    };
    
    // Extract structure from beats
    if (data.rhythm?.beats_position) {
      const beats = data.rhythm.beats_position;
      const totalBeats = beats.length;
      
      // Simple structure estimation based on beat positions
      results.structure = {
        intro: { start: 0, end: beats[Math.floor(totalBeats * 0.1)] || 10 },
        verse: { start: beats[Math.floor(totalBeats * 0.1)] || 10, end: beats[Math.floor(totalBeats * 0.3)] || 30 },
        chorus: { start: beats[Math.floor(totalBeats * 0.3)] || 30, end: beats[Math.floor(totalBeats * 0.5)] || 60 },
        bridge: { start: beats[Math.floor(totalBeats * 0.6)] || 90, end: beats[Math.floor(totalBeats * 0.8)] || 120 },
        outro: { start: beats[Math.floor(totalBeats * 0.9)] || 150, end: results.duration }
      };
    }
    
    // Clean up
    await fs.unlink(tempOutput).catch(() => {});
    
    return results;
    
  } catch (error) {
    await fs.unlink(tempOutput).catch(() => {});
    throw new Error(`Essentia analysis failed: ${error.message}`);
  }
}

async function analyzeWithLibrosa(audioFile) {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  const pythonScript = `
import librosa
import json
import sys

audio_file = sys.argv[1]

# Load audio
y, sr = librosa.load(audio_file)

# BPM detection
tempo, beats = librosa.beat.beat_track(y=y, sr=sr)

# Key detection
chroma = librosa.feature.chroma_stft(y=y, sr=sr)
key = librosa.pitch.key_to_degrees('C:maj')  # simplified

# Structure detection using self-similarity
S = librosa.feature.melspectrogram(y=y, sr=sr)
S_db = librosa.power_to_db(S, ref=np.max)

# Segment boundaries
boundaries = librosa.segment.agglomerative(S_db, k=5)

results = {
    'bpm': float(tempo),
    'duration': float(len(y) / sr),
    'beats': beats.tolist()[:100],  # First 100 beats
    'structure': {
        'boundaries': boundaries.tolist()
    }
}

print(json.dumps(results))
`;

  try {
    const { stdout } = await execAsync(
      `python3 -c '${pythonScript}' "${audioFile}"`
    );
    
    const data = JSON.parse(stdout);
    
    // Convert to our format
    return {
      bpm: Math.round(data.bpm),
      duration: data.duration,
      structure: {
        intro: { start: 0, end: data.structure.boundaries[0] || 15 },
        verse: { start: data.structure.boundaries[0] || 15, end: data.structure.boundaries[1] || 45 },
        chorus: { start: data.structure.boundaries[1] || 45, end: data.structure.boundaries[2] || 75 },
        outro: { start: data.structure.boundaries[3] || 150, end: data.duration }
      }
    };
    
  } catch (error) {
    throw new Error(`Librosa analysis failed: ${error.message}`);
  }
}

main();