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
            hair: { type: "STRING" },
            accessories: { type: "STRING" },
            bodyType: { type: "STRING" }
          },
          required: ["identity", "clothing", "face", "hair", "accessories", "bodyType"]
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

  /**
   * Sends extracted keyframe images to the Gemini API and returns structured analysis.
   * @param {string[]} imagePaths Flat array of extracted keyframe image paths
   * @param {Object[]} clipsMetadata Physical metadata for each clip including frameCount
   * @returns {Promise<Object>}
   */
  async analyzeClips(imagePaths, clipsMetadata) {
    if (!this.apiKey) {
      throw new Error("Gemini API key is not configured. Please supply an apiKey in the constructor or process.env.GEMINI_API_KEY.");
    }

    const totalClipsCount = clipsMetadata.length;
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

    // 2. Prepare text prompt part instructing Gemini Vision about clip frame layout
    let currentImgIndex = 1;
    const imageMappingText = clipsMetadata.map((clip, i) => {
      const count = clip.frameCount || 3;
      const startIdx = currentImgIndex;
      const endIdx = currentImgIndex + count - 1;
      currentImgIndex += count;
      const sceneText = count === 4 ? " (including a detected scene change frame)" : "";
      return `- Clip ID ${i + 1}: Images ${startIdx} to ${endIdx}${sceneText}`;
    }).join('\n');

    const promptText = `Analyze these ${imagePaths.length} chronologically extracted keyframes from a video split into ${totalClipsCount} consecutive clips.
For each clip, we have provided three keyframes in chronological order: first frame, middle frame, last frame (and optionally a fourth scene change frame if detected).
The images are ordered sequentially by clip:
${imageMappingText}

Perform a detailed analysis of all frames to construct a unified character sheet for any recurring human/animated characters, list the environment locations, key objects, camera style, and compile a scene timeline that maps details to each clipId.`;

    const systemInstruction = `You are a video analysis AI expert. You are given a sequence of keyframe images extracted from consecutive split clips of a video.
Your task is to analyze these visual frames and compile a structured JSON payload describing the video summary, a unified character sheet, locations, objects, camera style, and scene timeline.

For the Character Sheet:
- Provide a unified character sheet for the main primary subject.
- Ensure you extract: identity, clothing, face, hair, accessories, bodyType.

For the sceneTimeline array:
- It must contain exactly ${totalClipsCount} elements, corresponding to Clip IDs 1 to ${totalClipsCount} respectively.
- For each item, specify:
  * "clipId" (integer, e.g. 1, 2, ... ${totalClipsCount})
  * "summary" (concise action description visible in that clip's frames)
  * "characters" (array of character names from the Character Sheet appearing in the clip)
  * "location" (the environment context of that specific clip)`;

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
            hair: { type: "STRING" },
            accessories: { type: "STRING" },
            bodyType: { type: "STRING" }
          },
          required: ["identity", "clothing", "face", "hair", "accessories", "bodyType"]
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
              clipId: { type: "INTEGER" },
              summary: { type: "STRING" },
              characters: {
                type: "ARRAY",
                items: { type: "STRING" }
              },
              location: { type: "STRING" }
            },
            required: ["clipId", "summary", "characters", "location"]
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

    let response;
    let retries = 3;
    let delay = 2000;

    while (retries > 0) {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        break;
      }

      const errorText = await response.text();
      if (response.status === 503) {
        console.warn(`[GeminiVisionService] 503 Service Unavailable. Retrying in ${delay}ms... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        retries--;
        delay *= 2;
      } else {
        throw new Error(`Gemini API request failed with status ${response.status}: ${errorText}`);
      }
    }

    if (!response || !response.ok) {
      throw new Error(`Gemini API request failed after retries. Last status ${response?.status}`);
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

  /**
   * Returns a visual analysis schema mock for dry-runs.
   * @param {number} duration 
   * @returns {Object}
   */
  getMockAnalysis(duration) {
    return {
      videoSummary: "A video of a young developer in a hoodie walking down a city sidewalk, talking directly to the camera and pointing out tech ads.",
      characterSheet: {
        identity: "Young developer/creator",
        clothing: "Grey cotton hoodie with blue denim jacket",
        face: "Short beard, light expression",
        hair: "Short dark curly hair, neatly styled",
        accessories: "Smartwatch on wrist",
        bodyType: "Average build"
      },
      locations: ["City sidewalk", "Street corner"],
      objects: ["Smartphone", "Holographic ad boards"],
      cameraStyle: "Eye-level medium shot with organic handheld motion",
      sceneTimeline: [
        {
          start: 0,
          end: Math.round(duration * 0.33),
          summary: "The creator introduces the tech topic while walking down the sidewalk",
          characters: ["Young developer"],
          location: "City sidewalk"
        },
        {
          start: Math.round(duration * 0.33),
          end: Math.round(duration * 0.66),
          summary: "The creator highlights a digital ad board on the wall",
          characters: ["Young developer"],
          location: "Street corner"
        },
        {
          start: Math.round(duration * 0.66),
          end: duration,
          summary: "The creator looks back and walks away towards an alleyway",
          characters: ["Young developer"],
          location: "Narrow street"
        }
      ]
    };
  }

  /**
   * Returns a visual analysis schema mock for dry-runs.
   * @param {number} totalClipsCount 
   * @returns {Object}
   */
  getMockClipsAnalysis(totalClipsCount) {
    const mockSummaries = [
      "The primary subject is seen sitting at a modern desk in an office workspace, actively typing on a laptop and gesturing with their hands.",
      "The subject walks along a bustling city sidewalk, looking around at street art and passing by shop windows.",
      "The subject stands near a quiet park bench, taking a phone call while green foliage is visible in the background.",
      "The subject points towards a tall building in the downtown area, explaining its unique architectural features.",
      "The subject walks towards the camera in a narrow alleyway with overhead string lights."
    ];

    const mockLocations = ["Tech Office", "City Sidewalk", "Green Park", "Downtown Plaza", "Lit Alleyway"];
    
    const timeline = [];
    for (let i = 0; i < totalClipsCount; i++) {
      const location = mockLocations[i % mockLocations.length];
      const summary = mockSummaries[i % mockSummaries.length];
      timeline.push({
        clipId: i + 1,
        summary: summary,
        characters: ["Young Creator"],
        location: location
      });
    }

    return {
      videoSummary: "A multi-scene log tracking a young creator demonstrating productivity tools and exploring urban environments.",
      characterSheet: {
        identity: "Young Creator",
        clothing: "Grey cotton hoodie and fitted dark wash jeans",
        face: "Short beard, light eyes, expressive smiling features",
        hair: "Short dark curly hair, neatly styled",
        accessories: "Smartwatch on left wrist, smart glasses",
        bodyType: "Average height, athletic build"
      },
      locations: Array.from(new Set(timeline.map(t => t.location))),
      objects: ["Laptop", "Coffee cup", "Smartphone", "Smart glasses"],
      cameraStyle: "Eye-level medium tracking shots, clean cinematic composition",
      sceneTimeline: timeline
    };
  }
}
