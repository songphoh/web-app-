
import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, BookOpen, Loader2, X, LayoutDashboard, Plus, Menu, Settings2, Youtube, User, ImageIcon, Wand2, Zap, Key, Link as LinkIcon, Music } from 'lucide-react';
import { AppState, StoryData, GeneratedSceneMedia, HistoryItem, StoryMode, VoiceGender, VoiceTone } from './types';
import { generateStoryScript, generateSceneImage, generateSceneAudio, mapVoiceConfig, generateAITopic } from './services/geminiService';
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
  
  const [storyMode, setStoryMode] = useState<StoryMode>('short');
  const [voiceGender, setVoiceGender] = useState<VoiceGender>('female');
  const [voiceTone, setVoiceTone] = useState<VoiceTone>('soft');
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(localStorage.getItem('custom_logo_data'));

  const [currentView, setCurrentView] = useState<'create' | 'dashboard' | 'settings'>('create');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const isCancelledRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setCustomLogoUrl(base64);
        localStorage.setItem('custom_logo_data', base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async (forcedPrompt?: string) => {
    const activePrompt = forcedPrompt || prompt;
    if (!activePrompt.trim()) return;

    try {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) { await window.aistudio.openSelectKey(); }
      }

      isCancelledRef.current = false;
      setAppState(AppState.GENERATING_SCRIPT);
      setStatusMessage('AI กำลังวิเคราะห์ Mood และเขียนบทสนทนาที่น่าตื่นเต้น...');
      setProgress(5);

      const storyData = await generateStoryScript(activePrompt, storyMode);
      if (isCancelledRef.current) return;
      
      setAppState(AppState.GENERATING_MEDIA);
      setProgress(15);

      setStatusMessage(`กำลังสร้างหน้าปกแนว ${storyData.mood}...`);
      const thumbnailImg = await generateSceneImage(storyData.scenes[0].imagePrompt, storyData.characterDescription, true);
      storyData.thumbnailUrl = thumbnailImg;
      setProgress(25);

      const mediaItems: GeneratedSceneMedia[] = [];
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const voice = mapVoiceConfig(voiceGender, voiceTone);

      for (let i = 0; i < storyData.scenes.length; i++) {
        if (isCancelledRef.current) return;
        setStatusMessage(`กำลังพากย์เสียงฉากที่ ${i + 1}/${storyData.scenes.length} (Multi-Speaker Mode)...`);
        const scene = storyData.scenes[i];
        
        const img = await generateSceneImage(scene.imagePrompt, storyData.characterDescription);
        const audio = await generateSceneAudio(scene.storyText, voice);
        const buffer = await decodeAudioData(audio, audioCtx);
        
        mediaItems.push({ 
          imageUrl: img, 
          audioBuffer: buffer, 
          text: scene.storyText, 
          textEn: scene.englishTranslation,
          visualEffect: scene.visualEffect || 'dust'
        });
        setProgress(25 + ((i + 1) / storyData.scenes.length) * 75);
      }

      setGeneratedMedia(mediaItems);
      setStoryMeta({ ...storyData });
      setAppState(AppState.READY);
      setHistory(prev => [{ storyData: { ...storyData }, media: mediaItems }, ...prev]);
    } catch (e: any) {
      console.error(e);
      setAppState(AppState.ERROR);
      setStatusMessage(e.message || "เกิดข้อผิดพลาดในการเนรมิตนิทาน");
    }
  };

  return (
    <div className="flex h-screen bg-[#01040f] overflow-hidden font-['Prompt'] text-slate-200">
      <aside className={`fixed md:static inset-y-0 left-0 w-72 bg-slate-900 border-r border-slate-800/50 z-50 transform transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="flex flex-col h-full p-8">
          <div className="flex items-center gap-4 mb-14">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-600/30"><BookOpen className="text-white" size={28} /></div>
            <div><h1 className="font-black text-white text-2xl">NithanAI</h1><p className="text-[10px] text-indigo-400 font-bold uppercase tracking-[0.2em]">Viral Factory 5.0</p></div>
          </div>
          <nav className="flex-1 space-y-2">
            {[
              { id: 'create', icon: Plus, label: 'สร้างนิทานใหม่' },
              { id: 'dashboard', icon: LayoutDashboard, label: 'คลังผลงาน' },
              { id: 'settings', icon: Settings2, label: 'ตั้งค่าระบบ' }
            ].map(item => (
              <button key={item.id} onClick={() => { setCurrentView(item.id as any); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all font-bold text-sm ${currentView === item.id ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-slate-500 hover:bg-slate-800'}`}>
                <item.icon size={22} /><span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="mt-auto bg-slate-800/40 rounded-3xl p-5 border border-slate-700/30 flex items-center gap-4">
             <div className="w-12 h-12 rounded-full bg-slate-700 border-2 border-indigo-500/40 overflow-hidden">
                {customLogoUrl ? <img src={customLogoUrl} className="w-full h-full object-cover" /> : <User size={20}/>}
             </div>
             <div className="flex-1 overflow-hidden">
                <p className="text-xs font-black text-white truncate">Viral Producer</p>
                <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest">Multi-Speaker Active</p>
             </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col relative h-full">
        <header className="h-20 bg-slate-950/40 backdrop-blur-xl border-b border-slate-800/50 flex items-center px-10 justify-between z-30">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-slate-400"><Menu size={26} /></button>
            <div className="hidden md:flex items-center gap-4 text-xs font-black text-slate-500 uppercase tracking-widest">
                <span className="flex items-center gap-2"><Zap size={14} className="text-yellow-400"/> AI Engine Active</span>
                <span className="text-slate-800">|</span>
                <span className="flex items-center gap-2"><Music size={14} className="text-indigo-400"/> BGM Ready</span>
            </div>
            <div className="flex items-center gap-2 bg-indigo-500/10 text-indigo-400 text-[10px] font-black px-4 py-1.5 rounded-full border border-indigo-500/20 uppercase animate-pulse">
                Version 5.0 Multi-Speaker
            </div>
        </header>

        <main className="flex-1 overflow-y-auto">
            {currentView === 'dashboard' ? <Dashboard history={history} onPlay={(i) => { setGeneratedMedia(i.media); setStoryMeta(i.storyData); setAppState(AppState.READY); }} onCreateNew={() => setCurrentView('create')} /> : 
             currentView === 'settings' ? (
                <div className="max-w-4xl mx-auto px-10 py-20 space-y-12 animate-fade-in">
                    <h2 className="text-4xl font-black text-white">ระบบจัดการโรงงาน</h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        <section className="bg-slate-900/60 border border-slate-800 rounded-[3rem] p-10 space-y-8 shadow-2xl">
                            <h3 className="text-xl font-black text-white flex items-center gap-3"><Youtube className="text-red-500" /> Youtube Analytics</h3>
                            <div className="p-8 bg-slate-950 rounded-[2rem] border border-white/5 text-center space-y-4">
                                <p className="text-slate-500 text-xs font-bold uppercase">Ready to connect with YouTube Studio</p>
                                <button className="px-6 py-3 bg-white text-black text-xs font-black uppercase rounded-xl">Connect Channel</button>
                            </div>
                        </section>
                        <section className="bg-slate-900/60 border border-slate-800 rounded-[3rem] p-10 space-y-8 shadow-2xl">
                            <h3 className="text-xl font-black text-white flex items-center gap-3"><ImageIcon className="text-indigo-400" /> Branding Profile</h3>
                            <div className="flex flex-col items-center gap-6">
                                <div className="w-32 h-32 rounded-full bg-slate-950 border-4 border-indigo-500/20 flex items-center justify-center overflow-hidden shadow-2xl">
                                    {customLogoUrl ? <img src={customLogoUrl} className="w-full h-full object-cover" /> : <User size={40} className="text-slate-800"/>}
                                </div>
                                <input type="file" ref={fileInputRef} onChange={handleLogoUpload} className="hidden" accept="image/*" />
                                <button onClick={() => fileInputRef.current?.click()} className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-xs font-black uppercase transition-all shadow-xl">อัปโหลดโลโก้แบรนด์</button>
                            </div>
                        </section>
                    </div>
                </div>
             ) : (
                <div className="flex flex-col items-center justify-center min-h-full px-8 py-12 animate-fade-in max-w-5xl mx-auto w-full">
                    {appState === AppState.IDLE || appState === AppState.ERROR ? (
                        <div className="w-full space-y-12">
                            <div className="text-center space-y-4">
                                <h2 className="text-7xl font-black text-white tracking-tight leading-tight">เนรมิตนิทานไวรัล</h2>
                                <p className="text-slate-500 text-2xl font-medium">" พากย์หลายเสียง ใส่เพลงประกอบ พร้อมปกไวรัลใน 40 วินาที "</p>
                            </div>
                            {appState === AppState.ERROR && <div className="w-full bg-red-500/10 border border-red-500/20 p-6 rounded-[2rem] text-red-400 text-sm font-bold flex items-center gap-3 animate-fade-in"><X size={20}/> Error: {statusMessage}</div>}
                            <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 p-14 rounded-[4.5rem] shadow-2xl space-y-10">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center px-6">
                                        <label className="text-xs font-black text-indigo-400 uppercase tracking-widest">Story Concept</label>
                                        <button onClick={() => generateAITopic().then(setPrompt)} className="text-[11px] flex items-center gap-2 text-slate-500 hover:text-indigo-400 font-black uppercase transition-all"><Wand2 size={16}/> สุ่มไอเดียที่น่าจะปัง</button>
                                    </div>
                                    <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="เช่น ความรักของหุ่นยนต์ในโลกที่ไม่มีมนุษย์..." className="w-full h-48 bg-slate-950 border border-slate-800 rounded-[3rem] p-10 text-white text-3xl outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all resize-none shadow-inner font-bold" />
                                </div>
                                <div className="grid grid-cols-3 gap-6">
                                     <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase px-4">ความยาว</label>
                                        <select value={storyMode} onChange={(e) => setStoryMode(e.target.value as StoryMode)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-bold text-white outline-none">
                                            <option value="short">Short (6 ฉาก)</option>
                                            <option value="medium">Medium (8 ฉาก)</option>
                                        </select>
                                     </div>
                                     <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase px-4">เสียงพากย์หลัก</label>
                                        <select value={voiceGender} onChange={(e) => setVoiceGender(e.target.value as VoiceGender)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-bold text-white outline-none">
                                            <option value="female">เสียงผู้หญิง</option>
                                            <option value="male">เสียงผู้ชาย</option>
                                        </select>
                                     </div>
                                     <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase px-4">โทนเสียง</label>
                                        <select value={voiceTone} onChange={(e) => setVoiceTone(e.target.value as VoiceTone)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-bold text-white outline-none">
                                            <option value="soft">นุ่มนวล</option>
                                            <option value="energetic">ตื่นเต้น</option>
                                            <option value="deep">ทุ้มลึก</option>
                                        </select>
                                     </div>
                                </div>
                                <button onClick={() => handleGenerate()} disabled={!prompt.trim()} className="w-full py-10 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-white font-black text-4xl rounded-[3rem] flex items-center justify-center gap-6 shadow-2xl active:scale-95 disabled:opacity-50">
                                    <Sparkles size={40} /> เริ่มการผลิตวิดีโอ 5.0
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center space-y-12 py-24 animate-fade-in w-full max-w-xl">
                            <div className="relative">
                                <div className="absolute inset-0 bg-indigo-500 blur-[100px] opacity-30 animate-pulse"></div>
                                <Loader2 className="w-32 h-32 text-indigo-500 animate-spin relative z-10" />
                            </div>
                            <div className="text-center space-y-4">
                                <h3 className="text-4xl font-black text-white">Viral Factory is Processing...</h3>
                                <p className="text-slate-400 font-black text-lg italic bg-slate-800/30 px-8 py-2 rounded-3xl border border-white/5">"{statusMessage}"</p>
                            </div>
                            <div className="w-full h-5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-1.5 ring-1 ring-white/5">
                                <div className="h-full bg-gradient-to-r from-indigo-600 to-purple-500 rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
                            </div>
                        </div>
                    )}
                </div>
             )}
        </main>
        {appState === AppState.READY && <StoryPlayer media={generatedMedia} storyData={storyMeta as StoryData} onClose={() => setAppState(AppState.IDLE)} customLogoUrl={customLogoUrl} auth={{ youtubeClientId: '', youtubeAccessToken: null, onConnectYouTube: () => {} }} />}
      </div>
    </div>
  );
}

export default App;
