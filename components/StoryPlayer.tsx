
import React, { useEffect, useRef, useState } from 'react';
import { GeneratedSceneMedia, StoryData } from '../types';
import { Play, Pause, X, Sparkles, Download, RotateCcw, Video, Loader2, Music, Copy, Check, Hash, MessageSquareText } from 'lucide-react';

interface StoryPlayerProps {
  media: GeneratedSceneMedia[];
  storyData: StoryData;
  onClose: () => void;
  customLogoUrl?: string | null;
  auth: {
    youtubeClientId: string;
    youtubeAccessToken: string | null;
    onConnectYouTube: () => void;
  };
}

const MOOD_BGM: Record<string, string> = {
  Horror: 'https://cdn.pixabay.com/audio/2022/10/25/audio_732230558b.mp3',
  Adventure: 'https://cdn.pixabay.com/audio/2023/11/04/audio_3d64c1537b.mp3',
  Emotional: 'https://cdn.pixabay.com/audio/2022/11/22/audio_106979244c.mp3',
  Funny: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c350780300.mp3',
  Mystery: 'https://cdn.pixabay.com/audio/2022/11/15/audio_2773410528.mp3'
};

const wrapThaiText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const lines: string[] = [];
  let currentLine = '';
  const chars = Array.from(text);
  const isCombining = (c: string) => /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/.test(c);

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const testLine = currentLine + char;
    if (ctx.measureText(testLine).width > maxWidth) {
      if (isCombining(char)) {
        currentLine += char;
        lines.push(currentLine);
        currentLine = '';
      } else {
        lines.push(currentLine);
        currentLine = char;
      }
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
};

class Particle {
  x: number; y: number; size: number; speedX: number; speedY: number; alpha: number;
  constructor(w: number, h: number) {
    this.x = Math.random() * w; this.y = Math.random() * h;
    this.size = Math.random() * 2 + 1;
    this.speedX = (Math.random() - 0.5) * 0.2;
    this.speedY = (Math.random() - 0.5) * 0.2;
    this.alpha = Math.random() * 0.15;
  }
  update(w: number, h: number) {
    this.x += this.speedX; this.y += this.speedY;
    if (this.x < 0) this.x = w; if (this.x > w) this.x = 0;
    if (this.y < 0) this.y = h; if (this.y > h) this.y = 0;
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = `rgba(255,255,255,${this.alpha})`;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
  }
}

export default function StoryPlayer({ media, storyData, onClose, customLogoUrl }: StoryPlayerProps) {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showCover, setShowCover] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showViralKit, setShowViralKit] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const stateRef = useRef({
    currentSceneIndex: 0,
    prevSceneIndex: -1,
    showCover: true,
    isPlaying: false,
    transitionProgress: 0,
    isTransitioning: false,
    sceneStartTime: performance.now(),
    lastFrameTime: performance.now(),
    audioProgress: 0
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const ttsSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const ttsAnimationFrameRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const logoImgRef = useRef<HTMLImageElement | null>(null);
  const sceneImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const recorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    stateRef.current.currentSceneIndex = currentSceneIndex;
    stateRef.current.showCover = showCover;
    stateRef.current.isPlaying = isPlaying;
  }, [currentSceneIndex, showCover, isPlaying]);

  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioContextRef.current = new AudioContextClass();
    audioStreamDestRef.current = audioContextRef.current.createMediaStreamDestination();
    bgmRef.current = new Audio(MOOD_BGM[storyData.mood] || MOOD_BGM.Adventure);
    bgmRef.current.loop = true;
    bgmRef.current.volume = 0.15;

    if (customLogoUrl) {
        const img = new Image(); img.crossOrigin = "anonymous"; img.src = customLogoUrl;
        img.onload = () => { logoImgRef.current = img; };
    }
    media.forEach((m, idx) => {
        const img = new Image(); img.crossOrigin = "anonymous"; img.src = m.imageUrl;
        sceneImagesRef.current.set(`scene_${idx}`, img);
    });
    if (storyData.thumbnailUrl) {
        const timg = new Image(); timg.crossOrigin = "anonymous"; timg.src = storyData.thumbnailUrl;
        sceneImagesRef.current.set(`thumbnail`, timg);
    }
    return () => { 
        stopAudio(); audioContextRef.current?.close();
        if (bgmRef.current) { bgmRef.current.pause(); bgmRef.current = null; }
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [media, storyData]);

  const startRecording = () => {
    const canvas = canvasRef.current;
    if (!canvas || !audioStreamDestRef.current) return;
    setExporting(true);
    const videoStream = canvas.captureStream(60); 
    const combinedStream = new MediaStream([ ...videoStream.getVideoTracks(), ...audioStreamDestRef.current.stream.getAudioTracks() ]);
    const recorder = new MediaRecorder(combinedStream, { 
      mimeType: 'video/webm;codecs=vp9,opus', 
      videoBitsPerSecond: 30000000 
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `viral-${Date.now()}.webm`; a.click();
        setExporting(false); setShowViralKit(true);
    };
    recorderRef.current = recorder; recorder.start();
    setShowCover(false); setCurrentSceneIndex(0); setProgress(0);
    setTimeout(() => playSceneAudio(0), 1000);
  };

  const downloadCover = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `cover-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  };

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return; 
    const ctx = canvas.getContext('2d', { alpha: false }); if (!ctx) return;
    canvas.width = 1080; canvas.height = 1920;
    if (particlesRef.current.length === 0) {
        for(let i = 0; i < 50; i++) particlesRef.current.push(new Particle(canvas.width, canvas.height));
    }

    const drawFrame = (now: number) => {
        const dt = now - stateRef.current.lastFrameTime;
        stateRef.current.lastFrameTime = now;
        const { currentSceneIndex, prevSceneIndex, showCover, isTransitioning, transitionProgress, sceneStartTime, audioProgress } = stateRef.current;
        const elapsed = now - sceneStartTime;

        ctx.fillStyle = "#000000"; ctx.fillRect(0, 0, canvas.width, canvas.height);

        const drawImageHD = (key: string, time: number, opacity: number) => {
            const img = sceneImagesRef.current.get(key);
            if (img && img.complete) {
                // ULTRA SLOW ZOOM (0.00001)
                const zoom = 1.0 + (time * 0.00001);
                const scale = Math.max(canvas.width / img.width, canvas.height / img.height) * zoom;
                const w = img.width * scale; const h = img.height * scale;
                const x = (canvas.width - w) / 2; const y = (canvas.height - h) / 2;
                ctx.save(); ctx.globalAlpha = opacity;
                ctx.drawImage(img, x, y, w, h); ctx.restore();
            }
        };

        if (isTransitioning) {
            const t = Math.min(transitionProgress, 1);
            const easeT = t * t * (3 - 2 * t); // Smooth cross-fade
            const prev = prevSceneIndex === -1 ? 'thumbnail' : `scene_${prevSceneIndex}`;
            const curr = showCover ? 'thumbnail' : `scene_${currentSceneIndex}`;
            drawImageHD(prev, elapsed + 8000, 1 - easeT);
            drawImageHD(curr, elapsed, easeT);
            stateRef.current.transitionProgress += dt * 0.0012; // Perfectly slow transition
            if (stateRef.current.transitionProgress >= 1) {
                stateRef.current.isTransitioning = false; stateRef.current.transitionProgress = 0;
                stateRef.current.sceneStartTime = now;
            }
        } else {
            drawImageHD(showCover ? 'thumbnail' : `scene_${currentSceneIndex}`, elapsed, 1.0);
        }

        particlesRef.current.forEach(p => { p.update(canvas.width, canvas.height); p.draw(ctx); });

        if (logoImgRef.current && logoImgRef.current.complete) {
            const s = 140; const m = 80;
            ctx.save(); ctx.shadowBlur = 20; ctx.shadowColor = "black";
            ctx.beginPath(); ctx.arc(canvas.width - s/2 - m, s/2 + m, s/2, 0, Math.PI*2); ctx.clip();
            ctx.drawImage(logoImgRef.current, canvas.width-s-m, m, s, s); ctx.restore();
            ctx.strokeStyle = "white"; ctx.lineWidth = 4; ctx.stroke();
        }

        if (showCover) {
            ctx.fillStyle = "rgba(0,0,0,0.65)"; ctx.fillRect(0, canvas.height*0.55, canvas.width, canvas.height*0.45);
            ctx.font = "bold 115px 'Prompt'"; ctx.textAlign = "center";
            const lines = wrapThaiText(ctx, (storyData.thumbnailText || "").toUpperCase(), canvas.width * 0.85);
            lines.forEach((line, i) => {
                const y = canvas.height * 0.68 + (i * 145);
                ctx.strokeStyle = "black"; ctx.lineWidth = 26; ctx.strokeText(line, canvas.width/2, y);
                ctx.fillStyle = "#fbbf24"; ctx.fillText(line, canvas.width/2, y);
            });
        } else if (stateRef.current.isPlaying && !isTransitioning) {
            const fullText = media[currentSceneIndex].text;
            const content = fullText.includes(':') ? fullText.split(':')[1].trim() : fullText;
            
            // SMART MINIMALIST SUBTITLES: Split by '|' or whitespace
            const chunks = content.split(/[\|\.]/).filter(c => c.trim().length > 0);
            const chunkIndex = Math.min(Math.floor(audioProgress * chunks.length), chunks.length - 1);
            const currentChunk = chunks[chunkIndex]?.trim();

            if (currentChunk) {
                ctx.save(); ctx.font = "bold 96px 'Prompt'"; ctx.textAlign = "center";
                const y = canvas.height - 480;
                ctx.strokeStyle = "black"; ctx.lineWidth = 28; ctx.strokeText(currentChunk, canvas.width/2, y);
                ctx.fillStyle = "white";
                // Glowing effect for readability and premium look
                ctx.shadowBlur = 12; ctx.shadowColor = "rgba(0,0,0,0.9)";
                ctx.fillText(currentChunk, canvas.width/2, y);
                ctx.restore();
            }
        }
        animationFrameRef.current = requestAnimationFrame(drawFrame);
    };
    animationFrameRef.current = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [media, storyData]);

  const playSceneAudio = (index: number) => {
    if (!audioContextRef.current || !audioStreamDestRef.current) return;
    const scene = media[index]; if (!scene.audioBuffer) return;
    if (bgmRef.current?.paused) bgmRef.current.play().catch(()=>{});
    if (ttsSourceRef.current) { try { ttsSourceRef.current.stop(); }catch(e){} }
    const source = audioContextRef.current.createBufferSource();
    source.buffer = scene.audioBuffer;
    source.connect(audioContextRef.current.destination);
    source.connect(audioStreamDestRef.current);
    source.start(0); ttsSourceRef.current = source;
    setIsPlaying(true);
    const startT = audioContextRef.current.currentTime;
    const duration = scene.audioBuffer.duration;
    
    const track = () => {
        const elap = audioContextRef.current!.currentTime - startT;
        stateRef.current.audioProgress = elap / duration;
        if (elap >= duration) {
            if (index < media.length - 1) {
                setTimeout(() => {
                    stateRef.current.prevSceneIndex = index;
                    stateRef.current.currentSceneIndex = index + 1;
                    stateRef.current.isTransitioning = true;
                    stateRef.current.transitionProgress = 0;
                    setCurrentSceneIndex(index + 1); playSceneAudio(index + 1);
                }, 400); // Perfect natural gap
            } else {
                setIsPlaying(false); setProgress(100); bgmRef.current?.pause();
                if (recorderRef.current?.state === 'recording') setTimeout(() => recorderRef.current?.stop(), 1200);
            }
        } else {
            setProgress((elap/duration)*100);
            ttsAnimationFrameRef.current = requestAnimationFrame(track);
        }
    };
    cancelAnimationFrame(ttsAnimationFrameRef.current);
    ttsAnimationFrameRef.current = requestAnimationFrame(track);
  };

  const stopAudio = () => {
    if (ttsSourceRef.current) { try { ttsSourceRef.current.stop(); }catch(e){} ttsSourceRef.current = null; }
    if (bgmRef.current) bgmRef.current.pause();
    setIsPlaying(false); cancelAnimationFrame(ttsAnimationFrameRef.current);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#01040f] flex flex-col items-center justify-center p-4">
      <canvas ref={canvasRef} className="fixed top-0 left-0 pointer-events-none opacity-0" />
      <div className="relative w-full h-full max-w-[420px] max-h-[85vh] aspect-[9/16] bg-slate-900 overflow-hidden shadow-[0_0_150px_rgba(0,0,0,1)] rounded-[4rem] border border-white/10 flex flex-col group animate-fade-in">
        <div className="absolute inset-0">
             <img src={(showCover && storyData.thumbnailUrl) ? storyData.thumbnailUrl : media[currentSceneIndex].imageUrl} className="w-full h-full object-cover transition-opacity duration-1000" style={{ opacity: isPlaying ? 0.35 : 1 }} alt="Preview" />
             <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/70"></div>
        </div>
        {showCover ? (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-10 text-center space-y-12">
                <div className="px-6 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-full tracking-widest">Viral Factory Pro</div>
                <h2 className="text-5xl font-black text-yellow-400 italic uppercase drop-shadow-2xl">{storyData.thumbnailText}</h2>
                <div className="flex flex-col gap-6 items-center">
                    <button onClick={() => { setShowCover(false); setCurrentSceneIndex(0); setProgress(0); setTimeout(() => playSceneAudio(0), 100); }} className="w-24 h-24 bg-white text-indigo-950 rounded-full flex items-center justify-center shadow-2xl animate-pulse active:scale-90 transition-transform"><Play size={44} fill="currentColor" className="ml-2" /></button>
                    <div className="flex gap-4">
                        <button onClick={startRecording} className="flex items-center gap-3 px-8 py-4 bg-white/10 backdrop-blur-2xl border border-white/10 rounded-2xl text-[10px] font-black uppercase text-white hover:bg-indigo-600 transition-all">{exporting ? <Loader2 className="animate-spin" size={18}/> : <Video size={18} />} {exporting ? "Recording..." : "Export 4K HD"}</button>
                        <button onClick={downloadCover} className="p-4 bg-white/10 backdrop-blur-2xl border border-white/10 rounded-2xl text-white hover:bg-yellow-500 hover:text-black transition-all"><Download size={22} /></button>
                    </div>
                </div>
            </div>
        ) : (
            <div className="absolute bottom-0 left-0 right-0 p-10 flex flex-col gap-6 pb-24 z-20">
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 shadow-[0_0_20px_indigo] transition-all duration-100" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex items-center justify-between">
                    <button onClick={() => isPlaying ? stopAudio() : playSceneAudio(currentSceneIndex)} className="w-16 h-16 flex items-center justify-center bg-white text-indigo-950 rounded-full shadow-2xl active:scale-90 transition-transform">{isPlaying ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" className="ml-1"/>}</button>
                    <button onClick={() => { stopAudio(); setShowCover(true); }} className="p-4 bg-white/10 rounded-2xl text-white backdrop-blur-lg border border-white/5"><RotateCcw size={22} /></button>
                    <button onClick={() => setShowViralKit(true)} className="px-6 py-4 bg-yellow-500 text-black rounded-2xl font-black text-[10px] uppercase shadow-lg">SEO Toolkit</button>
                </div>
            </div>
        )}
        {showViralKit && (
            <div className="absolute inset-x-0 bottom-0 z-50 bg-slate-900/98 backdrop-blur-3xl rounded-t-[3rem] p-10 border-t border-white/10 animate-fade-in">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-white flex items-center gap-2"><Sparkles className="text-yellow-400" /> Viral Marketing Kit</h3>
                    <button onClick={() => setShowViralKit(false)} className="p-2 text-slate-400"><X size={20}/></button>
                </div>
                <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
                    <div className="p-4 bg-slate-950 rounded-2xl border border-white/5"><label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-2">Click-bait Title</label><p className="text-white font-bold text-sm">{storyData.title}</p></div>
                    <div className="p-4 bg-slate-950 rounded-2xl border border-white/5"><label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-2">Description</label><p className="text-slate-400 text-xs leading-relaxed">{storyData.seoSummary}</p></div>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(`${storyData.title}\n\n${storyData.seoSummary}\n\n${storyData.tags.join(' ')}`); setCopied(true); setTimeout(()=>setCopied(false), 2000); }} className="w-full mt-6 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">{copied ? "COPIED SUCCESS!" : "COPY EVERYTHING"}</button>
            </div>
        )}
        <button onClick={onClose} className="absolute top-10 left-10 z-40 p-4 bg-black/40 rounded-2xl text-white backdrop-blur-xl border border-white/10 hover:bg-red-500 transition-all"><X size={20}/></button>
      </div>
    </div>
  );
}
