
import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, BookOpen, Loader2, Upload, X, LayoutDashboard, Plus, Menu, StopCircle, Mic, Film, Clock, Music, User, Settings2, Subtitles, Languages, Key } from 'lucide-react';
import { AppState, StoryData, GeneratedSceneMedia, HistoryItem, StoryMode, StoryConfig, VoiceGender, VoiceTone, SubtitleLang } from './types';
import { generateStoryScript, generateLongStoryScript, generateSceneImage, generateSceneAudio, mapVoiceConfig } from './services/geminiService';
import { decodeAudioData } from './services/audioUtils';
import StoryPlayer from './components/StoryPlayer';
import Dashboard from './components/Dashboard';

function App() {
  const [prompt, setPrompt] = useState('');
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [statusMessage, setStatusMessage] = useState('');
  const [generatedMedia, setGeneratedMedia] = useState<GeneratedSceneMedia[]>([]);
  const [storyMeta, setStoryMeta] = useState<Partial<StoryData>>({});
  const [progress, setProgress] = useState(0);
  const [customLogo, setCustomLogo] = useState<string | null>(null);
  
  // New Config States
  const [storyMode, setStoryMode] = useState<StoryMode>('short');
  const [voiceGender, setVoiceGender] = useState<VoiceGender>('female');
  const [voiceTone, setVoiceTone] = useState<VoiceTone>('soft');
  const [bgmEnabled, setBgmEnabled] = useState<boolean>(true);
  const [showSubtitles, setShowSubtitles] = useState<boolean>(true);
  const [subtitleLang, setSubtitleLang] = useState<SubtitleLang>('th');

  // View States
  const [currentView, setCurrentView] = useState<'create' | 'dashboard'>('create');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // API Key Selection State
  const [isApiKeyReady, setIsApiKeyReady] = useState(false);

  // Cancellation Ref
  const isCancelledRef = useRef(false);

  // Check for API Key on mount
  useEffect(() => {
    const checkAuth = async () => {
      if ((window as any).aistudio) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        setIsApiKeyReady(hasKey);
      } else {
        // Fallback for local dev or environments without aistudio object
        setIsApiKeyReady(true);
      }
    };
    checkAuth();
  }, []);

  const handleSelectApiKey = async () => {
    if ((window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
      setIsApiKeyReady(true);
    }
  };

  // When a story is fully generated, add it to history
  const addToHistory = (story: StoryData, media: GeneratedSceneMedia[]) => {
    const newItem: HistoryItem = { storyData: story, media };
    setHistory(prev => [newItem, ...prev]);
  };

  const handleCancel = () => {
    isCancelledRef.current = true;
    setAppState(AppState.IDLE);
    setStatusMessage('');
    setProgress(0);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    try {
      isCancelledRef.current = false;
      setAppState(AppState.GENERATING_SCRIPT);
      setStatusMessage(storyMode.includes('long') ? 'กำลังแต่งนิยายเรื่องยาว...' : 'กำลังแต่งนิทาน...');
      setProgress(10);

      // Create Config Object
      const config: StoryConfig = {
          duration: storyMode,
          voiceGender,
          voiceTone,
          bgmEnabled,
          defaultShowSubtitles: showSubtitles,
          defaultSubtitleLang: subtitleLang
      };

      // 1. Generate Script based on Mode
      let storyData: StoryData;
      if (storyMode === 'long' || storyMode === 'mega_long') {
          storyData = await generateLongStoryScript(prompt, storyMode);
      } else {
          storyData = await generateStoryScript(prompt, storyMode);
      }
      
      storyData.config = config; // Save config to story data
      
      if (isCancelledRef.current) return;

      setStoryMeta(storyData); 
      
      setAppState(AppState.GENERATING_MEDIA);
      setStatusMessage(`ได้โครงเรื่องแล้ว: "${storyData.title}" กำลังวาดภาพและอัดเสียง...`);
      setProgress(20);

      const mediaItems: GeneratedSceneMedia[] = [];
      const totalSteps = storyData.scenes.length;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const targetVoiceName = mapVoiceConfig(voiceGender, voiceTone);

      // Process scenes
      for (let i = 0; i < storyData.scenes.length; i++) {
        if (isCancelledRef.current) return;

        const scene = storyData.scenes[i];
        setStatusMessage(`กำลังสร้างฉากที่ ${i + 1}/${totalSteps}: "${scene.storyText.substring(0, 20)}..."`);
        
        const [base64Image, base64Audio] = await Promise.all([
          generateSceneImage(scene.imagePrompt),
          generateSceneAudio(scene.storyText, targetVoiceName)
        ]);

        if (isCancelledRef.current) return;

        const audioBuffer = await decodeAudioData(base64Audio, audioCtx);

        mediaItems.push({
          imageUrl: base64Image,
          audioBuffer: audioBuffer,
          text: scene.storyText,
          textEn: scene.englishTranslation,
          visualEffect: scene.visualEffect,
          soundEffect: scene.soundEffect
        });

        setProgress(20 + ((i + 1) / totalSteps) * 80);
      }

      setGeneratedMedia(mediaItems);
      setAppState(AppState.READY);
      setStatusMessage('เสร็จเรียบร้อย!');
      
      // Save to history
      addToHistory(storyData, mediaItems);

    } catch (error: any) {
      if (!isCancelledRef.current) {
        console.error(error);
        setAppState(AppState.ERROR);
        
        if (error.message?.includes('403') || error.message?.includes('permission') || error.toString().includes('403')) {
             setStatusMessage('เกิดข้อผิดพลาด: สิทธิ์การใช้งานไม่ถูกต้อง (Permission Denied). กรุณาตรวจสอบว่า API Key ของคุณรองรับโมเดล Pro/Flash หรือไม่');
        } else {
             setStatusMessage('เกิดข้อผิดพลาด โปรดลองใหม่อีกครั้ง');
        }
      }
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetApp = () => {
    setAppState(AppState.IDLE);
    setProgress(0);
    document.title = "NithanAI - Story Generator";
  };

  const handlePlayFromHistory = (item: HistoryItem) => {
    setStoryMeta(item.storyData);
    setGeneratedMedia(item.media);
    setAppState(AppState.READY);
    setCurrentView('create');
  };

  // Landing Screen for API Key Selection
  if (!isApiKeyReady) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 font-['Prompt']">
        <div className="max-w-md w-full bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-8 text-center shadow-2xl animate-fade-in-up">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/20">
            <BookOpen className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Nithan<span className="text-indigo-500">AI</span>
          </h1>
          <p className="text-slate-400 mb-8">
            Create magical Thai stories with AI narration and cinematic visuals.
          </p>
          
          <div className="space-y-4">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-left">
               <p className="text-yellow-200 text-sm flex items-start gap-2">
                 <Key size={16} className="mt-0.5 shrink-0" />
                 To use the advanced Gemini 3.0 Pro & 2.5 Flash TTS models, please select a paid API Key.
               </p>
            </div>

            <button
              onClick={handleSelectApiKey}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
            >
              Select API Key
            </button>
            
            <p className="text-xs text-slate-500 mt-4">
              Requires a Google Cloud Project with billing enabled. <br/>
              <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">
                View Billing Documentation
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const renderSidebar = () => (
    <div className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg shadow-lg shadow-indigo-500/20">
                <BookOpen className="text-white" size={24} />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
                Nithan<span className="text-indigo-500">AI</span>
            </h1>
        </div>
        
        <nav className="p-4 space-y-2">
            <button 
                onClick={() => { setCurrentView('create'); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium ${currentView === 'create' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
                <Plus size={20} />
                สร้างนิทาน
            </button>
            <button 
                onClick={() => { setCurrentView('dashboard'); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium ${currentView === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
                <LayoutDashboard size={20} />
                แดชบอร์ด
            </button>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-6">
             <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <p className="text-xs text-slate-400 mb-2">Session Status</p>
                <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    System Online
                </div>
             </div>
        </div>
    </div>
  );

  const renderCreateView = () => (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center justify-center min-h-[calc(100vh-80px)] p-6">
         {appState === AppState.IDLE && (
            <div className="w-full flex flex-col gap-6 animate-fade-in-up">
                <div className="text-center space-y-2 mb-4">
                    <h2 className="text-4xl font-bold text-white">
                        สร้างนิทานด้วย AI
                    </h2>
                    <p className="text-slate-400">
                        ออกแบบเรื่องราว เลือกเสียง และสร้างวิดีโอได้ดั่งใจ
                    </p>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 p-6 rounded-2xl shadow-xl space-y-5">
                    
                    {/* Mode / Duration Selector */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                            <Clock size={16} className="text-indigo-400"/> ความยาว (Duration)
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <button onClick={() => setStoryMode('short')} className={`py-2 px-1 rounded-lg text-xs font-medium transition ${storyMode === 'short' ? 'bg-indigo-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'}`}>
                                Shorts (40s)
                            </button>
                            <button onClick={() => setStoryMode('medium')} className={`py-2 px-1 rounded-lg text-xs font-medium transition ${storyMode === 'medium' ? 'bg-indigo-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'}`}>
                                Medium (1m)
                            </button>
                            <button onClick={() => setStoryMode('long')} className={`py-2 px-1 rounded-lg text-xs font-medium transition ${storyMode === 'long' ? 'bg-indigo-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'}`}>
                                Podcast (5m)
                            </button>
                            <button onClick={() => setStoryMode('mega_long')} className={`py-2 px-1 rounded-lg text-xs font-medium transition ${storyMode === 'mega_long' ? 'bg-indigo-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'}`}>
                                Audiobook (30m)
                            </button>
                        </div>
                    </div>

                    {/* Voice Settings */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                                <User size={16} className="text-pink-400"/> เสียงคนเล่า
                            </label>
                            <div className="flex bg-slate-700/50 rounded-lg p-1">
                                <button onClick={() => setVoiceGender('male')} className={`flex-1 py-1.5 rounded-md text-xs font-medium transition ${voiceGender === 'male' ? 'bg-slate-600 text-white shadow' : 'text-slate-400'}`}>ชาย</button>
                                <button onClick={() => setVoiceGender('female')} className={`flex-1 py-1.5 rounded-md text-xs font-medium transition ${voiceGender === 'female' ? 'bg-slate-600 text-white shadow' : 'text-slate-400'}`}>หญิง</button>
                            </div>
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                                <Settings2 size={16} className="text-blue-400"/> โทนเสียง
                            </label>
                            <select 
                                value={voiceTone}
                                onChange={(e) => setVoiceTone(e.target.value as VoiceTone)}
                                className="w-full bg-slate-700/50 text-white text-sm rounded-lg border-none focus:ring-2 focus:ring-indigo-500 py-2"
                            >
                                <option value="soft">นุ่มนวล (Soft)</option>
                                <option value="energetic">ตื่นเต้น (Energetic)</option>
                                <option value="deep">ทุ้มลึก (Deep)</option>
                                <option value="formal">ทางการ (Formal)</option>
                            </select>
                        </div>
                    </div>

                    {/* Subtitles & BGM Settings */}
                    <div className="grid grid-cols-2 gap-4">
                         <div className="bg-slate-700/30 p-3 rounded-xl border border-slate-700/50 flex flex-col justify-between">
                             <div className="flex items-center gap-2 mb-2">
                                <Music size={16} className={bgmEnabled ? "text-green-400" : "text-slate-500"}/>
                                <span className="text-xs font-medium text-slate-300">เพลงประกอบ</span>
                             </div>
                             <div className="flex items-center justify-between">
                                 <span className="text-xs text-slate-500">{bgmEnabled ? 'เปิด' : 'ปิด'}</span>
                                 <button 
                                    onClick={() => setBgmEnabled(!bgmEnabled)}
                                    className={`w-10 h-5 rounded-full transition-colors relative ${bgmEnabled ? 'bg-green-500' : 'bg-slate-600'}`}
                                >
                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${bgmEnabled ? 'left-6' : 'left-1'}`}></div>
                                </button>
                             </div>
                         </div>

                         <div className="bg-slate-700/30 p-3 rounded-xl border border-slate-700/50 flex flex-col justify-between">
                             <div className="flex items-center gap-2 mb-2">
                                <Subtitles size={16} className={showSubtitles ? "text-indigo-400" : "text-slate-500"}/>
                                <span className="text-xs font-medium text-slate-300">ซับไตเติล</span>
                             </div>
                             <div className="flex items-center justify-between">
                                 <div className="flex gap-1">
                                    <button 
                                        onClick={() => setSubtitleLang('th')} 
                                        className={`px-1.5 py-0.5 rounded text-[10px] ${subtitleLang === 'th' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'}`}
                                    >TH</button>
                                    <button 
                                        onClick={() => setSubtitleLang('en')} 
                                        className={`px-1.5 py-0.5 rounded text-[10px] ${subtitleLang === 'en' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'}`}
                                    >EN</button>
                                 </div>
                                 <button 
                                    onClick={() => setShowSubtitles(!showSubtitles)}
                                    className={`w-10 h-5 rounded-full transition-colors relative ${showSubtitles ? 'bg-indigo-500' : 'bg-slate-600'}`}
                                >
                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${showSubtitles ? 'left-6' : 'left-1'}`}></div>
                                </button>
                             </div>
                         </div>
                    </div>

                    <div className="pt-2 border-t border-slate-700/50">
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            เกี่ยวกับเรื่อง (Prompt)
                        </label>
                        <textarea 
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={storyMode === 'short' ? "เช่น กระต่ายน้อยผจญภัยในเมืองขนมหวาน..." : "เช่น ตำนานลึกลับ..."}
                            className="w-full h-24 bg-slate-900/50 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-none outline-none text-sm"
                        />
                    </div>
                    
                    <div className="flex items-center gap-4">
                       <div className="relative flex-1">
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleLogoUpload}
                            id="logo-upload"
                            className="hidden"
                          />
                          <label 
                            htmlFor="logo-upload"
                            className="flex items-center justify-center gap-2 w-full p-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 border-dashed rounded-lg cursor-pointer text-slate-400 text-xs transition"
                          >
                             {customLogo ? (
                               <>
                                 <div className="w-5 h-5 rounded overflow-hidden bg-black/50">
                                   <img src={customLogo} alt="Logo" className="w-full h-full object-cover" />
                                 </div>
                                 <span className="text-green-400">มีโลโก้แล้ว</span>
                               </>
                             ) : (
                               <>
                                 <Upload size={14} />
                                 <span>อัปโหลดโลโก้ (Optional)</span>
                               </>
                             )}
                          </label>
                       </div>
                    </div>

                    <button 
                        onClick={handleGenerate}
                        disabled={!prompt.trim()}
                        className={`w-full text-white font-semibold py-3.5 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg ${
                            storyMode.includes('long') 
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-purple-500/20'
                            : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 shadow-indigo-500/20' 
                        }`}
                    >
                        <Sparkles size={20} />
                        เริ่มสร้างนิทาน
                    </button>
                </div>
            </div>
        )}

        {(appState === AppState.GENERATING_SCRIPT || appState === AppState.GENERATING_MEDIA) && (
             <div className="w-full flex flex-col items-center gap-6 animate-fade-in">
                <div className="relative">
                    <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 rounded-full"></div>
                    <Loader2 className="w-16 h-16 text-indigo-500 animate-spin relative z-10" />
                </div>
                
                <div className="text-center space-y-2">
                    <h3 className="text-xl font-semibold text-white">กำลังทำงาน...</h3>
                    <p className="text-slate-400 max-w-xs mx-auto animate-pulse">{statusMessage}</p>
                </div>

                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden max-w-xs mt-4">
                    <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <button 
                    onClick={handleCancel}
                    className="mt-6 flex items-center gap-2 px-6 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 text-red-400 rounded-full transition-all group"
                >
                    <StopCircle size={18} className="group-hover:scale-110 transition-transform" />
                    ยกเลิก
                </button>
             </div>
        )}
        
        {appState === AppState.ERROR && (
             <div className="text-center animate-fade-in">
                <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
                    <X className="text-red-400 w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">เกิดข้อผิดพลาด</h2>
                <p className="text-slate-400 mb-6 px-4">{statusMessage}</p>
                <button 
                    onClick={resetApp}
                    className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
                >
                    ลองใหม่อีกครั้ง
                </button>
             </div>
        )}
    </div>
  );

  return (
    <div className="flex h-screen bg-[#0f172a] overflow-hidden font-['Prompt'] text-slate-200 selection:bg-indigo-500/30">
      {renderSidebar()}

      <div className="flex-1 flex flex-col relative h-full overflow-hidden transition-all duration-300 md:ml-64">
        <div className="md:hidden h-16 bg-slate-900 border-b border-slate-800 flex items-center px-4 justify-between z-30 shrink-0">
            <div className="flex items-center gap-2">
                 <BookOpen className="text-indigo-500" size={24} />
                 <span className="font-bold text-white text-lg">NithanAI</span>
            </div>
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-400">
                <Menu size={24} />
            </button>
        </div>

        {isSidebarOpen && (
            <div 
                className="fixed inset-0 bg-black/50 z-30 md:hidden"
                onClick={() => setIsSidebarOpen(false)}
            />
        )}

        <main className="flex-1 overflow-y-auto bg-[#0f172a] relative">
            {currentView === 'dashboard' ? (
                <Dashboard 
                    history={history} 
                    onPlay={handlePlayFromHistory} 
                    onCreateNew={() => setCurrentView('create')}
                />
            ) : (
                renderCreateView()
            )}
        </main>

        {appState === AppState.READY && generatedMedia.length > 0 && (
            <StoryPlayer 
                media={generatedMedia}
                storyData={storyMeta}
                customLogoUrl={customLogo}
                onClose={() => {
                    setAppState(AppState.IDLE);
                }}
            />
        )}
      </div>
    </div>
  );
}

export default App;
