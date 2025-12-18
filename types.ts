
export interface StoryScene {
  storyText: string;
  englishTranslation?: string;
  imagePrompt: string;
  sceneNumber: number;
  speaker?: string; // เช่น 'Narrator', 'Character1', 'Character2'
  visualEffect?: 'none' | 'rain' | 'storm' | 'snow' | 'fire' | 'fog' | 'sparkles' | 'dust';
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
  customLogoUrl?: string | null;
}

export interface StoryData {
  id: string;
  createdAt: number;
  title: string;
  thumbnailText: string; 
  thumbnailUrl?: string; 
  seoSummary: string;
  tags: string[];
  characterDescription: string;
  mood: 'Horror' | 'Adventure' | 'Emotional' | 'Funny' | 'Mystery';
  mode: StoryMode;
  scenes: StoryScene[];
  config?: StoryConfig;
  status?: 'draft' | 'rendering' | 'completed' | 'failed';
}

export interface GeneratedSceneMedia {
  imageUrl: string;
  audioBuffer: AudioBuffer | null;
  text: string;
  textEn?: string;
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

export interface YTChannel {
  id: string;
  name: string;
  accessToken: string;
  profileImg?: string;
}

export interface AutomationSettings {
  isEnabled: boolean;
  dailyCount: number;
  lastPostDate?: string;
  postTimes: string[];
  preferredMode: StoryMode;
  targetChannelId?: string;
  lastRunTimestamp?: number; 
}
