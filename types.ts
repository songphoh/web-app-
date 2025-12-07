
export interface StoryScene {
  storyText: string; // The Thai text for narration
  englishTranslation?: string; // English translation for subtitles
  imagePrompt: string; // The prompt for the image generator
  sceneNumber: number;
  visualEffect?: 'none' | 'rain' | 'storm' | 'snow' | 'fire' | 'fog' | 'sparkles';
  soundEffect?: 'none' | 'rain' | 'thunder' | 'forest' | 'city' | 'fire' | 'magic';
}

export type StoryMode = 'short' | 'medium' | 'long' | 'mega_long';
export type VoiceGender = 'male' | 'female';
export type VoiceTone = 'soft' | 'energetic' | 'deep' | 'formal';
export type SubtitleLang = 'th' | 'en';

export interface StoryConfig {
  duration: StoryMode;
  voiceGender: VoiceGender;
  voiceTone: VoiceTone;
  bgmEnabled: boolean;
  defaultShowSubtitles: boolean;
  defaultSubtitleLang: SubtitleLang;
}

export interface StoryData {
  id: string; // Unique ID for history
  createdAt: number; // Timestamp
  title: string;
  seoSummary: string; // Short catchy summary for SEO description
  tags: string[]; // Hashtags for social media
  characterDescription: string; // Visual description to enforce consistency
  mood: string; // "Happy", "Sad", "Exciting", "Scary", "Calm"
  mode: StoryMode; // 'short', 'medium' or 'long'
  scenes: StoryScene[];
  config?: StoryConfig;
}

export interface GeneratedSceneMedia {
  imageUrl: string;
  audioBuffer: AudioBuffer | null;
  text: string;
  textEn?: string; // Store English text if available
  visualEffect?: string;
  soundEffect?: string;
}

export interface HistoryItem {
  storyData: StoryData;
  media: GeneratedSceneMedia[];
}

export enum AppState {
  IDLE = 'IDLE',
  GENERATING_SCRIPT = 'GENERATING_SCRIPT',
  GENERATING_MEDIA = 'GENERATING_MEDIA',
  READY = 'READY',
  ERROR = 'ERROR',
}
