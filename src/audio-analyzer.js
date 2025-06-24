import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createReadStream } from 'fs';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class AudioAnalyzer {
  constructor(options = {}) {
    this.outputDir = options.outputDir || './strudelcover-samples';
    this.enableBPM = options.bpmDetection !== false;
    this.enableSamples = options.sampleExtraction !== false;
    this.enableStructure = options.structureDetection !== false;
  }

  async analyze(audioFile, artist, song) {
    console.log(chalk.blue(`\n🎵 Analyzing audio file: ${audioFile}`));
    
    const results = {
      bpm: null,
      key: null,
      energy: null,
      structure: null,
      samples: [],
      duration: null
    };

    try {
      // Check if ffmpeg is available
      await this.checkDependencies();
      
      // Get basic info
      const info = await this.getAudioInfo(audioFile);
      results.duration = info.duration;
      console.log(chalk.gray(`Duration: ${info.duration}s, Format: ${info.format}`));
      
      // Analyze BPM
      if (this.enableBPM) {
        results.bpm = await this.detectBPM(audioFile);
        console.log(chalk.green(`✓ BPM detected: ${results.bpm}`));
      }
      
      // Extract samples
      if (this.enableSamples) {
        results.samples = await this.extractSamples(audioFile, artist, song);
        console.log(chalk.green(`✓ Extracted ${results.samples.length} samples`));
      }
      
      // Detect structure
      if (this.enableStructure) {
        results.structure = await this.detectStructure(audioFile, results.duration);
        console.log(chalk.green(`✓ Structure detected: ${Object.keys(results.structure).length} sections`));
      }
      
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Audio analysis partially failed: ${error.message}`));
      console.log(chalk.gray('Continuing with estimated values...'));
    }
    
    return results;
  }

  async checkDependencies() {
    try {
      await execAsync('which ffmpeg');
    } catch (error) {
      throw new Error('ffmpeg not found. Please install ffmpeg for audio analysis.');
    }
  }

  async getAudioInfo(audioFile) {
    try {
      const { stdout } = await execAsync(
        `ffprobe -v error -show_format -show_streams -print_format json "${audioFile}"`
      );
      const info = JSON.parse(stdout);
      return {
        duration: parseFloat(info.format.duration),
        format: info.format.format_name,
        bitrate: info.format.bit_rate,
        sampleRate: info.streams[0]?.sample_rate
      };
    } catch (error) {
      console.log(chalk.yellow('Failed to get audio info:', error.message));
      return { duration: 180, format: 'unknown' }; // Default 3 minutes
    }
  }

  async detectBPM(audioFile) {
    // Simple BPM detection using aubio or sonic-annotator if available
    try {
      // Try aubio first
      const { stdout } = await execAsync(`aubiotempo "${audioFile}" 2>/dev/null || echo ""`);
      if (stdout) {
        const bpmMatch = stdout.match(/(\d+\.\d+)/);
        if (bpmMatch) {
          return Math.round(parseFloat(bpmMatch[1]));
        }
      }
    } catch (error) {
      // Aubio not available
    }
    
    // Fallback: estimate BPM from peaks using ffmpeg
    try {
      console.log(chalk.gray('Using FFmpeg-based BPM estimation...'));
      
      // Extract a 30-second sample from the middle of the song
      const tempFile = `/tmp/bpm_sample_${Date.now()}.wav`;
      await execAsync(
        `ffmpeg -i "${audioFile}" -ss 60 -t 30 -ar 44100 -ac 1 -f wav "${tempFile}" -y 2>/dev/null`
      );
      
      // Analyze peaks
      const { stdout } = await execAsync(
        `ffmpeg -i "${tempFile}" -af "dynaudnorm,highpass=f=100,volume=5,silencedetect=n=-30dB:d=0.1" -f null - 2>&1`
      );
      
      // Clean up
      await fs.unlink(tempFile).catch(() => {});
      
      // Count silence detections as rough beat markers
      const silences = stdout.match(/silence_start:/g);
      if (silences && silences.length > 10) {
        // Rough estimate: beats = silences * 2, over 30 seconds
        const estimatedBPM = Math.round((silences.length * 2 * 60) / 30);
        // Clamp to reasonable range
        return Math.max(60, Math.min(200, estimatedBPM));
      }
    } catch (error) {
      console.log(chalk.gray('BPM detection failed, using default'));
    }
    
    // Default BPM
    return 120;
  }

  async extractSamples(audioFile, artist, song) {
    const samples = [];
    
    // Create output directory
    const sampleDir = join(this.outputDir, `${artist}_${song}`.replace(/[^a-z0-9]/gi, '_'));
    await fs.mkdir(sampleDir, { recursive: true });
    
    try {
      // Extract key moments (intro, drop, breakdown)
      const moments = [
        { name: 'intro', start: 0, duration: 5 },
        { name: 'drop', start: 30, duration: 2 },
        { name: 'breakdown', start: 90, duration: 5 },
        { name: 'buildup', start: 120, duration: 3 }
      ];
      
      for (const moment of moments) {
        const outputFile = join(sampleDir, `${moment.name}.wav`);
        try {
          await execAsync(
            `ffmpeg -i "${audioFile}" -ss ${moment.start} -t ${moment.duration} ` +
            `-ar 44100 -ac 2 -f wav "${outputFile}" -y 2>/dev/null`
          );
          samples.push({
            name: moment.name,
            path: outputFile,
            start: moment.start,
            duration: moment.duration
          });
        } catch (error) {
          console.log(chalk.gray(`Failed to extract ${moment.name} sample`));
        }
      }
      
      // Extract percussive elements (kicks, snares)
      await this.extractPercussiveSamples(audioFile, sampleDir, samples);
      
    } catch (error) {
      console.log(chalk.yellow('Sample extraction partially failed:', error.message));
    }
    
    return samples;
  }

  async extractPercussiveSamples(audioFile, sampleDir, samples) {
    try {
      // Extract a section likely to have clear drums (usually after intro)
      const drumsFile = join(sampleDir, 'drums_section.wav');
      await execAsync(
        `ffmpeg -i "${audioFile}" -ss 30 -t 10 -ar 44100 -ac 1 ` +
        `-af "lowpass=f=500,dynaudnorm" "${drumsFile}" -y 2>/dev/null`
      );
      
      // Extract potential kick drum hit
      const kickFile = join(sampleDir, 'kick.wav');
      await execAsync(
        `ffmpeg -i "${drumsFile}" -ss 0 -t 0.1 ` +
        `-af "lowpass=f=200,alimiter" "${kickFile}" -y 2>/dev/null`
      );
      samples.push({ name: 'kick', path: kickFile, type: 'percussion' });
      
      // Extract potential snare hit (higher frequencies)
      const snareFile = join(sampleDir, 'snare.wav');
      await execAsync(
        `ffmpeg -i "${audioFile}" -ss 31 -t 0.1 -ar 44100 -ac 1 ` +
        `-af "highpass=f=200,lowpass=f=8000,alimiter" "${snareFile}" -y 2>/dev/null`
      );
      samples.push({ name: 'snare', path: snareFile, type: 'percussion' });
      
      // Clean up temp file
      await fs.unlink(drumsFile).catch(() => {});
      
    } catch (error) {
      console.log(chalk.gray('Percussive sample extraction skipped'));
    }
  }

  async detectStructure(audioFile, duration) {
    // Simple structure detection based on energy levels
    const structure = {};
    
    try {
      // Analyze energy at different time points
      const segments = Math.min(10, Math.floor(duration / 10));
      const energyLevels = [];
      
      for (let i = 0; i < segments; i++) {
        const start = i * (duration / segments);
        const { stdout } = await execAsync(
          `ffmpeg -i "${audioFile}" -ss ${start} -t 2 ` +
          `-af "volumedetect" -f null - 2>&1 | grep mean_volume || echo "mean_volume: -20 dB"`
        );
        
        const match = stdout.match(/mean_volume: ([-\d.]+) dB/);
        if (match) {
          energyLevels.push({
            time: start,
            energy: parseFloat(match[1])
          });
        }
      }
      
      // Detect structure based on energy changes
      if (energyLevels.length > 0) {
        const avgEnergy = energyLevels.reduce((sum, e) => sum + e.energy, 0) / energyLevels.length;
        
        // Find intro (usually quieter)
        const intro = energyLevels.find(e => e.energy < avgEnergy - 3);
        if (intro) {
          structure.intro = { start: 0, end: intro.time + 10 };
        }
        
        // Find drops (high energy)
        const drops = energyLevels.filter(e => e.energy > avgEnergy + 2);
        if (drops.length > 0) {
          structure.drop = { start: drops[0].time, end: drops[0].time + 20 };
        }
        
        // Find breakdown (low energy in middle)
        const midPoint = duration / 2;
        const breakdown = energyLevels.find(e => 
          e.time > midPoint - 20 && e.time < midPoint + 20 && e.energy < avgEnergy
        );
        if (breakdown) {
          structure.breakdown = { start: breakdown.time, end: breakdown.time + 15 };
        }
      }
      
    } catch (error) {
      console.log(chalk.gray('Structure detection simplified'));
    }
    
    // Fallback structure
    if (Object.keys(structure).length === 0) {
      structure.intro = { start: 0, end: 15 };
      structure.verse = { start: 15, end: 45 };
      structure.chorus = { start: 45, end: 75 };
      structure.outro = { start: duration - 20, end: duration };
    }
    
    return structure;
  }
}

// Export factory function
export async function analyzeAudio(audioFile, artist, song, options = {}) {
  const analyzer = new AudioAnalyzer(options);
  return analyzer.analyze(audioFile, artist, song);
}