import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import chalk from 'chalk';
import path from 'path';

export class MLAnalyzer {
  constructor(options = {}) {
    this.pythonPath = options.pythonPath || 'python3';
    this.device = options.device || 'cpu';
    this.useDocker = options.useDocker || false;
  }

  async checkDependencies() {
    // Check if Python is available
    try {
      await this.execCommand([this.pythonPath, '--version']);
    } catch (error) {
      throw new Error('Python 3 not found. Please install Python 3.8+');
    }

    // Check for required packages
    const requiredPackages = ['torch', 'librosa', 'numpy'];
    const checkScript = `
import sys
try:
    import torch
    import librosa
    import numpy
    print("OK")
except ImportError as e:
    print(f"MISSING: {e.name}")
    sys.exit(1)
`;
    
    try {
      const result = await this.execCommand([this.pythonPath, '-c', checkScript]);
      if (!result.includes('OK')) {
        throw new Error(`Missing ML dependencies. Install with: pip install torch librosa numpy`);
      }
    } catch (error) {
      console.log(chalk.yellow('⚠️  ML dependencies not installed'));
      console.log(chalk.gray('Run: pip install torch librosa demucs basic-pitch'));
      return false;
    }

    return true;
  }

  async analyze(audioFile, options = {}) {
    console.log(chalk.blue('🧠 Running ML Analysis...'));
    
    const outputFile = options.outputFile || `${audioFile}.ml_analysis.json`;
    
    // Check if we should use Docker for isolation
    if (this.useDocker) {
      return this.analyzeWithDocker(audioFile, outputFile);
    }

    // Otherwise, try to run locally
    const hasDeps = await this.checkDependencies();
    if (!hasDeps && !options.force) {
      console.log(chalk.yellow('Skipping ML analysis due to missing dependencies'));
      return null;
    }

    // Create inline Python script for basic analysis
    const analysisScript = `
import json
import sys
import warnings
warnings.filterwarnings('ignore')

audio_file = sys.argv[1]
output_file = sys.argv[2]

results = {
    "audio_file": audio_file,
    "ml_available": False,
    "features": {}
}

# Basic analysis with librosa
try:
    import librosa
    import numpy as np
    
    print("Loading audio...", file=sys.stderr)
    y, sr = librosa.load(audio_file, sr=None)
    duration = len(y) / sr
    
    print("Extracting features...", file=sys.stderr)
    
    # Tempo and beats
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
    
    # Chroma features for harmony
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    
    # Onset detection
    onset_frames = librosa.onset.onset_detect(y=y, sr=sr)
    onset_times = librosa.frames_to_time(onset_frames, sr=sr)
    
    # Structure analysis using self-similarity
    hop_length = 512
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13, hop_length=hop_length)
    sim_matrix = librosa.segment.recurrence_matrix(mfcc, mode='affinity')
    
    results["features"] = {
        "duration": float(duration),
        "tempo": float(tempo),
        "beat_count": len(beats),
        "onset_count": len(onset_times),
        "key_estimate": int(np.argmax(chroma.mean(axis=1))),
        "energy_mean": float(np.mean(np.abs(y))),
        "energy_std": float(np.std(np.abs(y)))
    }
    results["ml_available"] = True
    
    # Try advanced features if available
    try:
        import torch
        results["features"]["torch_available"] = True
    except:
        pass
        
    # Try source separation if available
    try:
        import demucs.api
        print("Demucs available for source separation", file=sys.stderr)
        results["features"]["demucs_available"] = True
    except:
        pass
        
    # Try transcription if available  
    try:
        from basic_pitch.inference import predict
        print("Basic-pitch available for transcription", file=sys.stderr)
        results["features"]["basic_pitch_available"] = True
    except:
        pass

except Exception as e:
    print(f"Error in ML analysis: {e}", file=sys.stderr)
    
# Save results
with open(output_file, 'w') as f:
    json.dump(results, f, indent=2)
    
print(f"Analysis saved to {output_file}", file=sys.stderr)
`;

    try {
      // Write script to temp file
      const scriptPath = `/tmp/ml_analysis_${Date.now()}.py`;
      await fs.writeFile(scriptPath, analysisScript);
      
      // Run analysis
      await this.execCommand([this.pythonPath, scriptPath, audioFile, outputFile]);
      
      // Clean up
      await fs.unlink(scriptPath).catch(() => {});
      
      // Load and return results
      if (existsSync(outputFile)) {
        const results = JSON.parse(await fs.readFile(outputFile, 'utf8'));
        console.log(chalk.green('✓ ML analysis complete'));
        return results;
      }
    } catch (error) {
      console.log(chalk.yellow(`ML analysis error: ${error.message}`));
    }
    
    return null;
  }

  async analyzeWithDocker(audioFile, outputFile) {
    console.log(chalk.blue('🐳 Running ML analysis in Docker...'));
    
    // Use pre-built Docker image with all ML dependencies
    const dockerImage = 'strudelcover/ml-analyzer:latest';
    const audioDir = path.dirname(path.resolve(audioFile));
    const audioBasename = path.basename(audioFile);
    
    const dockerCmd = [
      'docker', 'run', '--rm',
      '-v', `${audioDir}:/data`,
      dockerImage,
      'python', '/app/analyze.py',
      `/data/${audioBasename}`,
      `/data/${path.basename(outputFile)}`
    ];
    
    try {
      await this.execCommand(dockerCmd);
      
      if (existsSync(outputFile)) {
        const results = JSON.parse(await fs.readFile(outputFile, 'utf8'));
        console.log(chalk.green('✓ ML analysis complete (Docker)'));
        return results;
      }
    } catch (error) {
      console.log(chalk.yellow('Docker ML analysis not available'));
      console.log(chalk.gray('Build with: docker build -t strudelcover/ml-analyzer docker/ml-analyzer'));
    }
    
    return null;
  }

  async runFancyAnalysis(audioFile, options = {}) {
    console.log(chalk.blue.bold('🎩 Fancy ML Analysis Mode'));
    
    const fancyScript = `
import json
import sys
import os
import warnings
warnings.filterwarnings('ignore')

audio_file = sys.argv[1]
output_file = sys.argv[2]

print("🎵 Fancy analysis starting...", file=sys.stderr)

results = {
    "audio_file": audio_file,
    "fancy_mode": True,
    "analyses": {}
}

# 1. Try source separation
try:
    import demucs.api
    print("🎸 Separating sources with Demucs...", file=sys.stderr)
    
    separator = demucs.api.Separator(model="htdemucs_ft")
    origin, separated = separator.separate_audio_file(audio_file)
    
    stems_dir = audio_file.replace('.mp3', '_stems')
    os.makedirs(stems_dir, exist_ok=True)
    
    stems = {}
    for stem_name, audio in separated.items():
        stem_path = os.path.join(stems_dir, f"{stem_name}.wav")
        demucs.api.save_audio(audio, stem_path, separator.samplerate)
        stems[stem_name] = stem_path
        print(f"  ✓ {stem_name} saved", file=sys.stderr)
    
    results["analyses"]["source_separation"] = {
        "success": True,
        "stems": stems,
        "model": "htdemucs_ft"
    }
except Exception as e:
    print(f"  ✗ Source separation failed: {e}", file=sys.stderr)
    results["analyses"]["source_separation"] = {"success": False, "error": str(e)}

# 2. Try MIDI transcription
try:
    from basic_pitch.inference import predict
    from basic_pitch import ICASSP_2022_MODEL_PATH
    
    print("🎹 Transcribing to MIDI with Basic Pitch...", file=sys.stderr)
    
    model_output, midi_data, note_events = predict(audio_file)
    midi_path = audio_file.replace('.mp3', '.mid')
    midi_data.write(midi_path)
    
    results["analyses"]["transcription"] = {
        "success": True,
        "midi_file": midi_path,
        "note_count": len(note_events),
        "first_notes": [
            {"pitch": int(n[0]), "start": float(n[1]), "duration": float(n[2]-n[1])} 
            for n in note_events[:10]
        ]
    }
    print(f"  ✓ Transcribed {len(note_events)} notes", file=sys.stderr)
except Exception as e:
    print(f"  ✗ MIDI transcription failed: {e}", file=sys.stderr)
    results["analyses"]["transcription"] = {"success": False, "error": str(e)}

# 3. Advanced audio features
try:
    import librosa
    import numpy as np
    
    print("📊 Extracting advanced features...", file=sys.stderr)
    
    y, sr = librosa.load(audio_file)
    
    # Detailed tempo analysis
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
    
    # Harmonic analysis
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    key_strengths = chroma.mean(axis=1)
    estimated_key = int(np.argmax(key_strengths))
    
    # Structure detection
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    bounds = librosa.segment.agglomerative(mfcc, k=8)
    bound_times = librosa.frames_to_time(bounds, sr=sr)
    
    results["analyses"]["advanced_features"] = {
        "success": True,
        "tempo": float(tempo),
        "estimated_key": estimated_key,
        "key_confidence": float(key_strengths[estimated_key]),
        "section_boundaries": bound_times.tolist(),
        "section_count": len(bounds)
    }
    print(f"  ✓ Detected {len(bounds)} sections", file=sys.stderr)
except Exception as e:
    print(f"  ✗ Advanced features failed: {e}", file=sys.stderr)
    results["analyses"]["advanced_features"] = {"success": False, "error": str(e)}

# Save results
with open(output_file, 'w') as f:
    json.dump(results, f, indent=2)
    
print(f"✨ Fancy analysis complete: {output_file}", file=sys.stderr)

# Print summary
successful = sum(1 for a in results["analyses"].values() if a.get("success", False))
print(f"\\n📊 Summary: {successful}/3 analyses succeeded", file=sys.stderr)
`;

    try {
      const scriptPath = `/tmp/fancy_ml_analysis_${Date.now()}.py`;
      await fs.writeFile(scriptPath, fancyScript);
      
      const outputFile = `${audioFile}.fancy_analysis.json`;
      await this.execCommand([this.pythonPath, scriptPath, audioFile, outputFile]);
      
      await fs.unlink(scriptPath).catch(() => {});
      
      if (existsSync(outputFile)) {
        const results = JSON.parse(await fs.readFile(outputFile, 'utf8'));
        
        // Print nice summary
        console.log(chalk.green('\n✨ Fancy Analysis Results:'));
        
        if (results.analyses.source_separation?.success) {
          console.log(chalk.green('  ✓ Source separation complete'));
          Object.entries(results.analyses.source_separation.stems).forEach(([stem, path]) => {
            console.log(chalk.gray(`    - ${stem}: ${path}`));
          });
        }
        
        if (results.analyses.transcription?.success) {
          console.log(chalk.green(`  ✓ MIDI transcription: ${results.analyses.transcription.note_count} notes`));
        }
        
        if (results.analyses.advanced_features?.success) {
          const feat = results.analyses.advanced_features;
          console.log(chalk.green(`  ✓ Advanced features: ${feat.tempo} BPM, ${feat.section_count} sections`));
        }
        
        return results;
      }
    } catch (error) {
      console.log(chalk.red(`Fancy analysis error: ${error.message}`));
    }
    
    return null;
  }

  execCommand(args) {
    return new Promise((resolve, reject) => {
      const proc = spawn(args[0], args.slice(1));
      let stdout = '';
      let stderr = '';
      
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
        // Print progress messages
        if (data.toString().includes('...')) {
          process.stderr.write(data);
        }
      });
      
      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Command failed: ${stderr}`));
        } else {
          resolve(stdout);
        }
      });
    });
  }
}

// Factory function
export async function analyzeWithML(audioFile, options = {}) {
  const analyzer = new MLAnalyzer(options);
  
  if (options.fancy) {
    return analyzer.runFancyAnalysis(audioFile, options);
  }
  
  return analyzer.analyze(audioFile, options);
}