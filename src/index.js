import { Dazzle } from './dazzle.js';
import { existsSync, mkdirSync } from 'fs';
import chalk from 'chalk';

/**
 * StrudelCover - AI-powered song recreation in Strudel (Dazzle Mode Only)
 */
export class StrudelCover {
  constructor(options = {}) {
    this.options = options;
    this.outputDir = options.outputDir || './strudelcover-output';
    this.apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
    
    // Create output directory
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
  }


  /**
   * Main cover generation function
   */
  async cover(songPath, artistName, songName, options = {}) {
    if (!this.apiKey) {
      throw new Error('Anthropic API key required');
    }
    
    console.log(chalk.blue(`\n🎵 StrudelCover: "${songName}" by ${artistName}\n`));
    
    try {
      // Create dazzle instance
      const dazzle = new Dazzle({
        apiKey: this.apiKey,
        recordOutput: options.recordOutput
      });
      
      await dazzle.start();
      await dazzle.generatePattern(songPath, artistName, songName);
      
      // Handle cleanup on exit
      process.on('SIGINT', async () => {
        console.log(chalk.yellow('\n\nShutting down...'));
        await dazzle.stop();
        process.exit(0);
      });
      
      // Keep process running
      return new Promise(() => {
        console.log(chalk.yellow('\nPress Ctrl+C to exit\n'));
      });
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      throw error;
    }
  }

}

// Export everything
export { Dazzle, dazzle } from './dazzle.js';
export default StrudelCover;