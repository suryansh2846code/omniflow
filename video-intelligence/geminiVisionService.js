import fs from 'fs';
import path from 'path';

export class GeminiVisionService {
  /**
   * @param {string} [apiKey]
   * @param {string} [modelName]
   */
  constructor(apiKey = process.env.GEMINI_API_KEY, modelName = 'gemini-2.5-flash') {
    this.apiKey = apiKey;
    this.modelName = modelName;
  }

  /**
   * Sends extracted keyframe images to the Gemini API and returns structured analysis.
   * @param {string[]} imagePaths 
   * @param {number} totalDuration 
   * @returns {Promise<Object>}
   */
  async analyzeVideoFrames(imagePaths, totalDuration) {
    if (!this.apiKey) {
      throw new Error("Gemini API key is not configured. Please supply an apiKey in the constructor or process.env.GEMINI_API_KEY.");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;

    // 1. Prepare image parts (encode to base64)
    const imageParts = imagePaths.map((imagePath) => {
      const data = fs.readFileSync(imagePath);
      const base64 = data.toString('base64');
      
      return {
        inlineData: {
          data: base64,
          mimeType: "image/jpeg"
        }
      };
    });

    // 2. Prepare text prompt part
    const promptText = `Analyze these ${imagePaths.length} chronologically extracted keyframes from a video of total duration ${totalDuration} seconds.
Identify the overarching video summary, character profile, locations, key objects, camera style, and construct a scene timeline dividing the video into logical segments.`;

    const systemInstruction = `You are a video analysis AI expert. You are given a sequence of keyframe images extracted from a single video.
Your task is to analyze these visual frames and compile a structured JSON payload describing the video summary, character sheet, locations, objects, camera style, and scene timeline.

For the sceneTimeline array:
- Ensure the sum of segments logically covers the total video duration.
- For each scene, summarize the actions, identify which characters from the Character Sheet appear, and describe the specific location.`;

    const schema = {
      type: "OBJECT",
      properties: {
        videoSummary: { type: "STRING" },
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
        locations: {
          type: "ARRAY",
          items: { type: "STRING" }
        },
        objects: {
          type: "ARRAY",
          items: { type: "STRING" }
        },
        cameraStyle: { type: "STRING" },
        sceneTimeline: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              start: { type: "NUMBER" },
              end: { type: "NUMBER" },
              summary: { type: "STRING" },
              characters: {
                type: "ARRAY",
                items: { type: "STRING" }
              },
              location: { type: "STRING" }
            },
            required: ["start", "end", "summary", "characters", "location"]
          }
        }
      },
      required: ["videoSummary", "characterSheet", "locations", "objects", "cameraStyle", "sceneTimeline"]
    };

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            ...imageParts,
            { text: promptText }
          ]
        }
      ],
      systemInstruction: {
        parts: [{ text: systemInstruction }]
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
      console.error("[GeminiVisionService] Failed to parse candidate text as JSON:", data);
      throw new Error(`Invalid JSON format returned from Gemini Vision: ${err.message}`);
    }
  }
}
