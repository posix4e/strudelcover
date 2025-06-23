/**
 * Base LLM Provider interface
 */
export class BaseLLMProvider {
  constructor(config = {}) {
    this.config = config;
  }

  /**
   * Generate a completion based on messages
   * @param {Array} messages - Array of {role, content} objects
   * @param {Object} options - Provider-specific options
   * @returns {Promise<string>} - Generated text
   */
  async generateCompletion(messages, _options = {}) {
    throw new Error('generateCompletion must be implemented by subclass');
  }

  /**
   * Get provider name
   * @returns {string}
   */
  getProviderName() {
    throw new Error('getProviderName must be implemented by subclass');
  }

  /**
   * Validate configuration
   * @throws {Error} if configuration is invalid
   */
  validateConfig() {
    // Override in subclasses
  }
}