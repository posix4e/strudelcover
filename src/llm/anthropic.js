import Anthropic from '@anthropic-ai/sdk';
import { BaseLLMProvider } from './base.js';

/**
 * Anthropic Claude LLM Provider
 */
export class AnthropicProvider extends BaseLLMProvider {
  constructor(config) {
    super(config);
    this.validateConfig();
    
    this.client = new Anthropic({ 
      apiKey: config.apiKey,
      baseURL: config.baseURL
    });
    
    this.model = config.model || 'claude-3-5-sonnet-20241022';
    this.temperature = config.temperature || 0.3;
    this.maxTokens = config.maxTokens || 4096;
  }

  async generateCompletion(messages, options = {}) {
    // Convert OpenAI format to Anthropic format
    const systemMessage = messages.find(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');
    
    const response = await this.client.messages.create({
      model: options.model || this.model,
      system: systemMessage?.content,
      messages: nonSystemMessages,
      temperature: options.temperature ?? this.temperature,
      max_tokens: options.maxTokens || this.maxTokens,
      ...options
    });
    
    return response.content[0].text;
  }

  getProviderName() {
    return 'Anthropic';
  }

  validateConfig() {
    if (!this.config.apiKey) {
      throw new Error('Anthropic provider requires apiKey');
    }
  }
}