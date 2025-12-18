
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { StoryData, StoryMode, VoiceGender, VoiceTone } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key is missing.");
  return new GoogleGenAI({ apiKey });
};

export const mapVoiceConfig = (gender: VoiceGender, tone: VoiceTone): string => {
  if (gender === 'female') {
    if (tone === 'energetic' || tone === 'formal') return 'Zephyr';
    return 'Kore';
  } else {
    if (tone === 'deep') return 'Charon';
    if (tone === 'energetic') return 'Fenrir';
    return 'Puck';
  }
};

export const generateAITopic = async (): Promise<string> => {
    const ai = getClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: "Suggest a high-retention viral video topic in Thai. Mix between: 1) Amazing/Cute animal facts, 2) Success & Wealth psychology tips, 3) Mind-blowing real-world secrets. Only return the topic name in Thai."
    });
    return response.text.trim() || "ความลับของความสำเร็จที่โรงเรียนไม่เคยสอน";
};

export const generateStoryScript = async (topic: string, mode: StoryMode = 'short'): Promise<StoryData> => {
  const ai = getClient();
  const sceneCount = mode === 'medium' ? 8 : 6;
  
  const prompt = `Create an ULTRA-VIRAL story script in Thai about: "${topic}".
    TARGET: Clean, high-end professional vertical video (40-50s).
    SCENE COUNT: Exactly ${sceneCount} scenes.
    
    CRITICAL RULES FOR MINIMALISM & FLOW:
    1. TEXT LIMIT: Each scene storyText must be VERY SHORT and IMPACTFUL (Max 10-12 words).
    2. CHUNKING: Use '|' to separate segments that should appear one by one. Example: "รู้หรือไม่ | ว่านกฮูก | มีหูที่ไม่เท่ากัน"
    3. CONSISTENCY: Maintain a stable, professional narrative tone.
    4. HOOK: Scene 1 must be an immediate scroll-stopper.
    5. DIALOGUE: Use 'Narrator: ' for narration.
    
    Output RAW JSON ONLY:
    {
      "title": "Viral Thai Title",
      "thumbnailText": "3-4 POWER WORDS",
      "characterDescription": "Visual consistency details for AI",
      "seoSummary": "Catchy description",
      "tags": ["#สาระ", "#ความรู้", "#สัตว์โลก", "#จิตวิทยา"],
      "mood": "Adventure|Emotional|Funny|Mystery",
      "scenes": [
        {
          "sceneNumber": 1,
          "storyText": "Narrator: ส่วนแรก | ส่วนที่สอง | ส่วนสุดท้าย.",
          "speaker": "Narrator",
          "imagePrompt": "9:16 Cinematic photorealistic description",
          "visualEffect": "none"
        }
      ]
    }`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  const text = response.text.replace(/```json|```/g, "").trim();
  const data = JSON.parse(text);
  if (data.scenes.length > sceneCount) data.scenes = data.scenes.slice(0, sceneCount);
  
  return { id: Date.now().toString(), createdAt: Date.now(), mode, ...data };
};

export const generateSceneImage = async (imagePrompt: string, characterRef: string = "", isThumbnail: boolean = false): Promise<string> => {
  const ai = getClient();
  const style = isThumbnail ? "Dramatic extreme close-up, high contrast, viral poster style" : "Cinematic 8k photography, hyper-realistic, soft depth of field";
  const finalPrompt = `${style}, vertical 9:16 aspect ratio. Character: ${characterRef}. Context: ${imagePrompt}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts: [{ text: finalPrompt }] },
    config: { imageConfig: { aspectRatio: "9:16", imageSize: "1K" } },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  throw new Error("Image generation failed");
};

export const generateSceneAudio = async (text: string, primaryVoice: string): Promise<string> => {
  const ai = getClient();
  const speakerMatch = text.match(/^([^:]+):/);
  const cleanText = speakerMatch ? text.substring(text.indexOf(":") + 1).replace(/\|/g, ' ').trim() : text.replace(/\|/g, ' ').trim();
  
  // เสริมคำสั่งให้รักษาโทนเสียงพากย์ให้นิ่งและต่อเนื่องที่สุด
  const narrativeInstruction = `บรรยายด้วยน้ำเสียงที่นิ่ง มั่นคง เป็นธรรมชาติ และรักษาโทนอารมณ์เดียวกันตลอดทั้งเรื่อง: ${cleanText}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: narrativeInstruction }] }],
    config: { 
      responseModalities: [Modality.AUDIO], 
      speechConfig: { 
        voiceConfig: { 
          prebuiltVoiceConfig: { voiceName: primaryVoice } 
        } 
      } 
    },
  });
  return response.candidates[0].content.parts[0].inlineData.data;
};
