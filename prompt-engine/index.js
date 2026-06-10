import { GeminiService } from './services/geminiService.js';
import { validateInput, validateOutput } from './validation.js';
import { ConsistencyEngine } from './consistency.js';

export class PromptIntelligenceEngine {
  /**
   * @param {Object} [config]
   * @param {string} [config.apiKey]
   * @param {string} [config.modelName]
   */
  constructor(config = {}) {
    this.geminiService = new GeminiService(config.apiKey, config.modelName);
  }

  /**
   * Orchestrates the Prompt Intelligence pipeline:
   * 1. Validate the input video metadata and user prompt.
   * 2. Send request to Google Gemini with JSON structure config.
   * 3. Validate and clean response data.
   * 4. Enforce character/DNA rules and stitch three-layer prompts.
   * 
   * @param {Object} input 
   * @returns {Promise<Object>}
   */
  async process(input) {
    // 1. Validate inputs
    validateInput(input);

    // 2. Query Gemini structured output endpoint
    const rawResult = await this.geminiService.generateStructuredPrompt(
      input.videoMetadata,
      input.userPrompt
    );

    // 3. Clean up and validate response structure
    const validatedResult = validateOutput(rawResult);

    // 4. Align clip prompts with master rules and assemble final prompt
    const finalizedResult = ConsistencyEngine.enforce(validatedResult);

    return finalizedResult;
  }
}
