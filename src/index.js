import { LLMProviderFactory } from './llm/index.js';
import { SimpleDazzle } from './dazzle.js';
import { existsSync, mkdirSync } from 'fs';
import chalk from 'chalk';

/**
 * StrudelCover - AI-powered song recreation in Strudel (Dazzle Mode Only)
 */
export class StrudelCover {
  constructor(options = {}) {
    this.options = options;
    this.outputDir = options.outputDir || './strudelcover-output';
    
    // Create output directory
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Initialize LLM provider
   */
  async initializeLLM() {
    if (this.llmProvider) return; // Already initialized
    
    let llmProvider;
    
    // Legacy support - if openaiKey provided, use OpenAI
    if (this.options.openaiKey) {
      llmProvider = await LLMProviderFactory.create('openai', { 
        apiKey: this.options.openaiKey,
        model: this.options.model 
      });
    } 
    // New way - explicit provider configuration
    else if (this.options.llm) {
      if (typeof this.options.llm === 'string') {
        // Simple provider name, must have API key in env or config
        const envKey = `${this.options.llm.toUpperCase()}_API_KEY`;
        const apiKey = this.options.llmConfig?.apiKey || process.env[envKey];
        
        if (!apiKey && this.options.llm !== 'ollama') {
          throw new Error(`${this.options.llm} requires API key via llmConfig.apiKey or ${envKey} env var`);
        }
        
        llmProvider = await LLMProviderFactory.create(this.options.llm, {
          apiKey,
          ...this.options.llmConfig
        });
      } else {
        // Direct provider instance
        llmProvider = this.options.llm;
      }
    } else {
      throw new Error('LLM configuration required. Use options.openaiKey (legacy) or options.llm');
    }
    
    this.llmProvider = llmProvider;
  }

  /**
   * Main cover generation function
   */
  async cover(songPath, artistName, songName, options = {}) {
    // Initialize LLM provider if not already done
    await this.initializeLLM();
    
    console.log(chalk.blue(`\n🎵 StrudelCover: "${songName}" by ${artistName}\n`));
    
    try {
      // Use simplified dazzle mode
      const dazzle = new SimpleDazzle({
        llmProvider: this.llmProvider,
        recordOutput: options.recordOutput
      });
      
      await dazzle.start();
      const pattern = await dazzle.generatePattern(songPath, artistName, songName);
      
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
export { LLMProviderFactory, BaseLLMProvider } from './llm/index.js';
export { SimpleDazzle, dazzle } from './dazzle.js';
export default StrudelCover;