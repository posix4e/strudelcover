// Lazy load providers to avoid missing dependencies
const providerLoaders = {
  openai: () => import('./openai.js').then(m => m.OpenAIProvider),
  anthropic: () => import('./anthropic.js').then(m => m.AnthropicProvider),
  ollama: () => import('./ollama.js').then(m => m.OllamaProvider)
};

/**
 * LLM Provider Factory
 */
export class LLMProviderFactory {
  /**
   * Create an LLM provider instance
   * @param {string} provider - Provider name (openai, anthropic, ollama)
   * @param {Object} config - Provider configuration
   * @returns {Promise<BaseLLMProvider>}
   */
  static async create(provider, config) {
    const loader = providerLoaders[provider.toLowerCase()];
    
    if (!loader) {
      throw new Error(`Unknown LLM provider: ${provider}. Available: ${Object.keys(providerLoaders).join(', ')}`);
    }
    
    const Provider = await loader();
    return new Provider(config);
  }

  /**
   * Register a custom provider
   * @param {string} name - Provider name
   * @param {Function} loader - Function that returns provider class
   */
  static registerProvider(name, loader) {
    providerLoaders[name.toLowerCase()] = loader;
  }

  /**
   * Get available providers
   * @returns {string[]}
   */
  static getAvailableProviders() {
    return Object.keys(providerLoaders);
  }
}

// Export everything
export { BaseLLMProvider } from './base.js';
// Individual providers are lazy-loaded, export them through the factory