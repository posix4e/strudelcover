import OpenAI from 'openai';
import { BaseLLMProvider } from './base.js';

/**
 * OpenAI LLM Provider
 */
export class OpenAIProvider extends BaseLLMProvider {
  constructor(config) {
    super(config);
    this.validateConfig();
    
    this.client = new OpenAI({ 
      apiKey: config.apiKey,
      baseURL: config.baseURL // Support custom endpoints
    });
    
    this.model = config.model || 'gpt-4o';
    this.temperature = config.temperature || 0.3;
  }

  async generateCompletion(messages, options = {}) {
    const completion = await this.client.chat.completions.create({
      model: options.model || this.model,
      messages,
      temperature: options.temperature ?? this.temperature,
      ...options
    });
    
    return completion.choices[0].message.content;
  }

  getProviderName() {
    return 'OpenAI';
  }

  validateConfig() {
    if (!this.config.apiKey) {
      throw new Error('OpenAI provider requires apiKey');
    }
  }
}