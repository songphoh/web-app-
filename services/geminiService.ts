
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { StoryData, StoryMode, VoiceGender, VoiceTone } from "../types";

// Initialize Gemini Client
const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please set it in the environment variables.");
  }
  return new GoogleGenAI({ apiKey });
};

// Voice Mapping Logic
export const mapVoiceConfig = (gender: VoiceGender, tone: VoiceTone): string => {
  if (gender === 'female') {
    // Female voices: Kore (Soft), Zephyr (Energetic/Standard)
    if (tone === 'energetic' || tone === 'formal') return 'Zephyr';
    return 'Kore'; // Default Soft/Deep(Fallback)
  } else {
    // Male voices: Puck (Soft/Formal), Charon (Deep), Fenrir (Energetic)
    if (tone === 'deep') return 'Charon';
    if (tone === 'energetic') return 'Fenrir';
    return 'Puck'; // Default Soft/Formal
  }
};

// 1. Generate Story Script (Unified for Short/Medium)
export const generateStoryScript = async (topic: string, mode: StoryMode = 'short'): Promise<StoryData> => {
  const ai = getClient();
  
  let durationPrompt = "";
  let sceneCount = 6;
  
  if (mode === 'medium') {
    durationPrompt = "Total video length should be approx 60-75 seconds. Create exactly 8 scenes.";
    sceneCount = 8;
  } else {
    durationPrompt = "Total video length should be approx 40-50 seconds. Create exactly 6 scenes.";
    sceneCount = 6;
  }

  const prompt = `
    Create a viral short story in Thai for YouTube Shorts/TikTok about: "${topic}".
    
    Requirements:
    1. **Duration:** ${durationPrompt}
    2. **Structure:** The story MUST be complete with a clear beginning, middle, and a satisfying ending/conclusion within exactly ${sceneCount} scenes. 
    3. **Visual Style:** Define a "Photorealistic, Cinematic, 8K resolution, Pixar-style 3D render but realistic lighting" style. 
    4. **Character:** Define a main character with consistent features (e.g., "A cute little girl with a red hoodie and big brown eyes").
    5. **Audio/Mood:** Analyze the story's overall sentiment. Is it Happy, Sad, Exciting, Scary, or Calm?
    6. **Language:** The 'storyText' MUST be in Thai. You MUST also provide an 'englishTranslation' for subtitles.
    7. **FX Analysis:** For each scene, choose a 'visualEffect' (rain, storm, snow, fire, fog, sparkles, none) and a 'soundEffect' (rain, thunder, forest, city, fire, magic, none) that matches the context.
    8. **SEO:**
       - Generate a "Clickbait" style Title in Thai.
       - Generate a compelling Description for YouTube Shorts (Thai).
       - Generate 10 trending Hashtags (Thai & English mixed).
    9. **Scenes:**
       - Create exactly ${sceneCount} scenes.
       - 'storyText': Thai narration (keep it concise, ~8-10 seconds reading time per scene).
       - 'englishTranslation': Accurate English translation of the storyText.
       - 'imagePrompt': Detailed English prompt. START with: "Photorealistic, 8k, cinematic lighting...". Include the character description in every single prompt to ensure consistency.
    
    Output JSON format.
  `;

  return await fetchStoryFromGemini(ai, prompt, mode);
};

// 1.5 Generate Long Story Script (Podcast/Audiobook Mode)
export const generateLongStoryScript = async (topic: string, mode: 'long' | 'mega_long' = 'long'): Promise<StoryData> => {
  const ai = getClient();

  let lengthInstruction = "";
  let chapterCount = 4;
  let wordCountInstruction = "";

  if (mode === 'mega_long') {
    // 30 Min approx target (Simulated via very long chapters and more scenes)
    // Note: True 30 mins is hard with single prompt limits, we maximize content here.
    lengthInstruction = "Target Duration: 30 Minutes Audiobook Style.";
    chapterCount = 12; // Increased scenes
    wordCountInstruction = "EXTREMELY LONG. Each chapter must be 300-400 words. It should take 2-3 minutes to read each scene.";
  } else {
    // 3-5 Min Podcast
    lengthInstruction = "Target Duration: 3-5 Minutes Podcast Style.";
    chapterCount = 4;
    wordCountInstruction = "Long and detailed. Each chapter must be 100-150 words. It should take 45-60 seconds to read each scene.";
  }

  const prompt = `
    Create a detailed, immersive "Audiobook" style story in Thai about: "${topic}".
    
    Requirements:
    1. **Format:** This is a Long Form story. ${lengthInstruction} Focus on deep narration, beautiful language, and immersive storytelling.
    2. **Structure:** Divide the story into exactly ${chapterCount} Chapters (Scenes).
    3. **Length:** ${wordCountInstruction}
    4. **Visuals:** Create distinct image prompts for each chapter.
    5. **Character:** Define a main character with consistent features.
    6. **Language:** The 'storyText' MUST be in Thai. You MUST also provide an 'englishTranslation' for subtitles.
    7. **FX Analysis:** Choose 'visualEffect' (rain, storm, snow, fire, fog, sparkles, none) and 'soundEffect' (rain, thunder, forest, city, fire, magic, none).
    8. **Mood:** Analyze the sentiment.
    9. **SEO:** Title, Description, Hashtags.
    
    Output JSON format with properties: title, seoSummary, tags, characterDescription, mood, scenes (array of {sceneNumber, storyText, englishTranslation, imagePrompt, visualEffect, soundEffect}).
  `;

  return await fetchStoryFromGemini(ai, prompt, mode);
};

// Helper to call Gemini and parse JSON
const fetchStoryFromGemini = async (ai: GoogleGenAI, prompt: string, mode: StoryMode): Promise<StoryData> => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Title in Thai" },
          seoSummary: { type: Type.STRING, description: "Description" },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          characterDescription: { type: Type.STRING },
          mood: { type: Type.STRING },
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                sceneNumber: { type: Type.INTEGER },
                storyText: { type: Type.STRING },
                englishTranslation: { type: Type.STRING },
                imagePrompt: { type: Type.STRING },
                visualEffect: { type: Type.STRING, enum: ['none', 'rain', 'storm', 'snow', 'fire', 'fog', 'sparkles'] },
                soundEffect: { type: Type.STRING, enum: ['none', 'rain', 'thunder', 'forest', 'city', 'fire', 'magic'] },
              },
            },
          },
        },
      },
    },
  });

  const jsonText = response.text;
  if (!jsonText) throw new Error("Failed to generate story script.");

  const data = JSON.parse(jsonText);

  return {
    id: Date.now().toString(),
    createdAt: Date.now(),
    mode: mode,
    ...data
  } as StoryData;
}

// 2. Generate Image for a Scene
export const generateSceneImage = async (imagePrompt: string): Promise<string> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview', // Upgraded to Pro for better quality based on user request for "Realistic"
    contents: {
      parts: [{ text: imagePrompt }],
    },
    config: {
      imageConfig: {
        aspectRatio: "9:16",
        imageSize: "1K"
      },
    },
  });

  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData && part.inlineData.data) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  }
  
  throw new Error("Failed to generate image.");
};

// 3. Generate Audio for a Scene
export const generateSceneAudio = async (text: string, voiceName: string = 'Kore'): Promise<string> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: {
      parts: [{ text }],
    },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voiceName },
        },
      },
    },
  });

  const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audioData) {
    throw new Error("Failed to generate audio.");
  }
  return audioData;
};
