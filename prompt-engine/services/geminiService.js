import { SYSTEM_INSTRUCTION, buildUserPrompt } from '../promptTemplates.js';

export class GeminiService {
  /**
   * @param {string} [apiKey]
   * @param {string} [modelName]
   */
  constructor(apiKey = process.env.GEMINI_API_KEY, modelName = 'gemini-2.5-flash') {
    this.apiKey = apiKey;
    this.modelName = modelName;
  }

  /**
   * Sends the structured query to the Gemini API and parses the JSON response.
   * @param {Object} videoMetadata 
   * @param {string} userPrompt 
   * @returns {Promise<Object>}
   */
  async generateStructuredPrompt(videoMetadata, userPrompt) {
    if (!this.apiKey) {
      throw new Error("Gemini API key is not configured. Please supply an apiKey in the constructor or process.env.GEMINI_API_KEY.");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;
    const userPromptContent = buildUserPrompt(videoMetadata, userPrompt);

    const schema = {
      type: "OBJECT",
      properties: {
        masterContext: {
          type: "OBJECT",
          properties: {
            visualGenre: { type: "STRING" },
            overallEnvironment: { type: "STRING" },
            editingStyle: { type: "STRING" }
          },
          required: ["visualGenre", "overallEnvironment", "editingStyle"]
        },
        characterSheet: {
          type: "OBJECT",
          properties: {
            identity: { type: "STRING" },
            clothing: { type: "STRING" },
            face: { type: "STRING" },
            accessories: { type: "STRING" },
            bodyType: { type: "STRING" }
          },
          required: ["identity", "clothing", "face", "accessories", "bodyType"]
        },
        visualDNA: {
          type: "OBJECT",
          properties: {
            colorPalette: { type: "STRING" },
            lighting: { type: "STRING" },
            cameraLanguage: { type: "STRING" },
            editingStyle: { type: "STRING" }
          },
          required: ["colorPalette", "lighting", "cameraLanguage", "editingStyle"]
        },
        clipPrompts: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              clipIndex: { type: "INTEGER" },
              timestamps: {
                type: "OBJECT",
                properties: {
                  start: { type: "NUMBER" },
                  end: { type: "NUMBER" }
                },
                required: ["start", "end"]
              },
              relationship: {
                type: "OBJECT",
                properties: {
                  previousClipSummary: { type: "STRING" },
                  currentClipGoal: { type: "STRING" },
                  nextClipTransition: { type: "STRING" }
                },
                required: ["previousClipSummary", "currentClipGoal", "nextClipTransition"]
              },
              threeLayerPrompt: {
                type: "OBJECT",
                properties: {
                  master: { type: "STRING" },
                  clip: { type: "STRING" },
                  technical: { type: "STRING" }
                },
                required: ["master", "clip", "technical"]
              },
              finalAssembledPrompt: { type: "STRING" }
            },
            required: ["clipIndex", "timestamps", "relationship", "threeLayerPrompt", "finalAssembledPrompt"]
          }
        },
        consistencyRules: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              ruleId: { type: "STRING" },
              propertyName: { type: "STRING" },
              description: { type: "STRING" },
              targetValue: { type: "STRING" }
            },
            required: ["ruleId", "propertyName", "description", "targetValue"]
          }
        }
      },
      required: ["masterContext", "characterSheet", "visualDNA", "clipPrompts", "consistencyRules"]
    };

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: userPromptContent }]
        }
      ],
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }]
      },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.1
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API request failed with status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    try {
      const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!candidateText) {
        throw new Error("No text content returned from Gemini candidate.");
      }
      return JSON.parse(candidateText);
    } catch (err) {
      console.error("[GeminiService] Failed to parse candidate text as JSON:", data);
      throw new Error(`Invalid JSON format returned from Gemini: ${err.message}`);
    }
  }
}
