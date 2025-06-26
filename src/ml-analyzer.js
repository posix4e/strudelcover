import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class MLAnalyzer {
  constructor(options = {}) {
    this.pythonPath = options.pythonPath || 'python3';
    this.device = options.device || 'cpu';
  }

  async checkDependencies() {
    // Check if Python is available
    try {
      await this.execCommand([this.pythonPath, '--version']);
    } catch (error) {
      throw new Error('Python 3 not found. Please install Python 3.8+');
    }

    // Check for required packages using template script
    const checkScriptPath = path.join(__dirname, 'templates', 'python', 'check_dependencies.py');
    
    try {
      const result = await this.execCommand([this.pythonPath, checkScriptPath]);
      if (!result.includes('OK')) {
        throw new Error('Missing ML dependencies. Install with: pip install -r requirements.txt');
      }
    } catch (error) {
      throw new Error('Missing ML dependencies. Install with: pip install -r requirements.txt');
    }

    return true;
  }

  async analyze(audioFile, options = {}) {
    console.log(chalk.blue('🧠 Running ML Analysis...'));
    
    const outputFile = options.outputFile || `${audioFile}.ml_analysis.json`;
    
    // Check dependencies
    const hasDeps = await this.checkDependencies();
    if (!hasDeps) {
      throw new Error('ML dependencies are required. Install with: pip install -r requirements.txt');
    }

    // Use the basic analysis template script
    const scriptPath = path.join(__dirname, 'templates', 'python', 'basic_analysis.py');

    try {
      // Run analysis using template script
      await this.execCommand([this.pythonPath, scriptPath, audioFile, outputFile]);
      
      // Load and return results
      if (existsSync(outputFile)) {
        const results = JSON.parse(await fs.readFile(outputFile, 'utf8'));
        console.log(chalk.green('✓ ML analysis complete'));
        return results;
      }
    } catch (error) {
      console.error(chalk.red(`ML analysis error: ${error.message}`));
      throw error;
    }
  }

  async runFancyAnalysis(audioFile, _options = {}) {
    console.log(chalk.blue.bold('🎩 Fancy ML Analysis Mode'));
    
    // Use the fancy analysis template script
    const scriptPath = path.join(__dirname, 'templates', 'python', 'fancy_analysis.py');

    try {
      const outputFile = `${audioFile}.fancy_analysis.json`;
      await this.execCommand([this.pythonPath, scriptPath, audioFile, outputFile]);
      
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
      console.error(chalk.red(`Fancy analysis error: ${error.message}`));
      throw error;
    }
  }

  execCommand(args) {
    return new Promise((resolve, reject) => {
      const proc = spawn(args[0], args.slice(1));
      let stdout = '';
      let stderr = '';
      
      proc.stdout.on('data', data => {
        stdout += data.toString();
      });
      
      proc.stderr.on('data', data => {
        stderr += data.toString();
        // Print progress messages
        if (data.toString().includes('...')) {
          process.stderr.write(data);
        }
      });
      
      proc.on('close', code => {
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