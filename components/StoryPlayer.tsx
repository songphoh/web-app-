
import React, { useEffect, useRef, useState } from 'react';
import { GeneratedSceneMedia, StoryData, SubtitleLang } from '../types';
import { Play, Pause, X, Copy, Download, Youtube, Check, CloudRain, Zap, Snowflake, Flame, Music, Volume2, VolumeX, Sliders, Upload, HardDrive, AlertCircle, Folder, ChevronRight, Loader2, Subtitles } from 'lucide-react';

interface StoryPlayerProps {
  media: GeneratedSceneMedia[];
  storyData: Partial<StoryData>;
  onClose: () => void;
  customLogoUrl?: string | null;
}

// Curated Royalty-Free Music Library (Pixabay)
const BGM_LIBRARY: Record<string, string> = {
  "Calm (Piano)": "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=piano-moment-11176.mp3",
  "Happy (Ukulele)": "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=ukulele-trip-version-60s-9893.mp3",
  "Sad (Emotional)": "https://cdn.pixabay.com/download/audio/2021/11/24/audio_823145d252.mp3?filename=sad-piano-background-music-for-videos-5654.mp3",
  "Action (Epic)": "https://cdn.pixabay.com/download/audio/2022/03/24/audio_338944f2c9.mp3?filename=epic-cinematic-trailer-9549.mp3",
  "Horror (Dark)": "https://cdn.pixabay.com/download/audio/2022/01/31/audio_0f80387d83.mp3?filename=dark-mystery-trailer-10174.mp3",
  "Lofi (Chill)": "https://cdn.pixabay.com/download/audio/2022/05/05/audio_13160e167e.mp3?filename=lofi-study-112191.mp3",
};

// Royalty-Free Sound Effects (Pixabay)
const SFX_LIBRARY: Record<string, string> = {
  "rain": "https://cdn.pixabay.com/download/audio/2021/09/06/audio_360a4f5b92.mp3?filename=rain-and-thunder-16705.mp3", // Rain + Thunder
  "thunder": "https://cdn.pixabay.com/download/audio/2022/03/10/audio_c3c332e983.mp3?filename=thunder-25667.mp3", // Heavy Thunder
  "forest": "https://cdn.pixabay.com/download/audio/2021/09/06/audio_27d2c38865.mp3?filename=forest-birds-16447.mp3", // Forest Ambiance
  "city": "https://cdn.pixabay.com/download/audio/2021/08/04/audio_6506f5909e.mp3?filename=city-traffic-outdoor-6421.mp3", // City Traffic
  "fire": "https://cdn.pixabay.com/download/audio/2022/01/18/audio_83907c030d.mp3?filename=fireplace-2007.mp3", // Fire Crackle
  "magic": "https://cdn.pixabay.com/download/audio/2022/03/15/audio_7306231d68.mp3?filename=magic-wand-6223.mp3" // Sparkle
};

const DEFAULT_BGM = BGM_LIBRARY["Calm (Piano)"];

// Particle Interface
interface Particle {
  x: number;
  y: number;
  radius: number;
  speedX: number;
  speedY: number;
  alpha: number;
  type: 'dust' | 'rain' | 'snow' | 'ember';
}

interface DriveFolder {
  id: string;
  name: string;
}

// Helper to wrap text for Canvas (Thai friendly char-break)
const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const lines = [];
  let currentLine = '';
  const chars = text.split(''); 
  
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const testLine = currentLine + char;
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && i > 0) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine);
  return lines;
};

declare const google: any;

const StoryPlayer: React.FC<StoryPlayerProps> = ({ media, storyData, onClose, customLogoUrl }) => {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showExportModal, setShowExportModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  // Drive States
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [driveTokenClient, setDriveTokenClient] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [pendingAction, setPendingAction] = useState<'upload' | 'pick_folder' | null>(null);
  
  // Folder Selection States
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [availableFolders, setAvailableFolders] = useState<DriveFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<DriveFolder | null>(null);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  
  // Settings States
  const [isBgmEnabled, setIsBgmEnabled] = useState(storyData.config?.bgmEnabled ?? true);
  const [showSubtitles, setShowSubtitles] = useState(storyData.config?.defaultShowSubtitles ?? true);
  const [subtitleLang, setSubtitleLang] = useState<SubtitleLang>(storyData.config?.defaultSubtitleLang ?? 'th');
  const [showMusicMenu, setShowMusicMenu] = useState(false);
  const [bgmVolume, setBgmVolume] = useState(0.15);
  const [sfxVolume, setSfxVolume] = useState(0.3);
  const [currentBgmName, setCurrentBgmName] = useState<string>("Calm (Piano)");
  const [customBgmUrl, setCustomBgmUrl] = useState<string | null>(null);

  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const ttsSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const bgmSourceRef = useRef<HTMLAudioElement | null>(null);
  const sfxSourceRef = useRef<HTMLAudioElement | null>(null);
  const bgmGainNodeRef = useRef<GainNode | null>(null);
  const sfxGainNodeRef = useRef<GainNode | null>(null);
  const mediaElementSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const sfxElementSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  
  // Recording Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const destNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  // Animation Refs
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0); 
  const animationFrameRef = useRef<number>(0);
  const lightningOpacityRef = useRef<number>(0);

  // Assets Refs
  const logoImgRef = useRef<HTMLImageElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);

  // Determine Initial BGM based on Mood
  useEffect(() => {
    if (storyData.mood) {
        const mood = storyData.mood.toLowerCase();
        let key = "Calm (Piano)";
        if (mood.includes('happy')) key = "Happy (Ukulele)";
        else if (mood.includes('sad')) key = "Sad (Emotional)";
        else if (mood.includes('excit')) key = "Action (Epic)";
        else if (mood.includes('scary')) key = "Horror (Dark)";
        setCurrentBgmName(key);
    }
  }, []);

  // Initialize Particles
  const initParticles = (width: number, height: number, effect: string = 'none') => {
    const p: Particle[] = [];
    let count = 0;
    let type: Particle['type'] = 'dust';

    if (effect === 'rain' || effect === 'storm') { count = 150; type = 'rain'; } 
    else if (effect === 'snow') { count = 100; type = 'snow'; } 
    else if (effect === 'fire') { count = 60; type = 'ember'; } 
    else { count = 40; type = 'dust'; }
    
    for (let i = 0; i < count; i++) {
      p.push(createParticle(width, height, type));
    }
    particlesRef.current = p;
  };

  const createParticle = (w: number, h: number, type: Particle['type']): Particle => {
      const base: any = { x: Math.random() * w, y: Math.random() * h, type };
      
      if (type === 'rain') {
          return { ...base, radius: 1, speedX: -1 - Math.random(), speedY: 15 + Math.random() * 10, alpha: 0.4 + Math.random() * 0.3 };
      } else if (type === 'snow') {
          return { ...base, radius: 2 + Math.random() * 2, speedX: (Math.random() - 0.5), speedY: 1 + Math.random() * 2, alpha: 0.8 };
      } else if (type === 'ember') {
          return { ...base, y: h + Math.random() * 50, radius: 1 + Math.random() * 3, speedX: (Math.random() - 0.5) * 2, speedY: -2 - Math.random() * 3, alpha: 1 };
      } else {
          return { ...base, radius: Math.random() * 2 + 0.5, speedX: (Math.random() - 0.5) * 0.5, speedY: (Math.random() - 0.5) * 0.5, alpha: Math.random() * 0.5 + 0.1 };
      }
  };

  // Setup Audio Context
  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    audioContextRef.current = ctx;

    const dest = ctx.createMediaStreamDestination();
    destNodeRef.current = dest;

    // --- BGM Setup ---
    const bgmAudio = new Audio();
    bgmAudio.loop = true;
    bgmAudio.crossOrigin = "anonymous";
    bgmSourceRef.current = bgmAudio;

    const bgmGain = ctx.createGain();
    bgmGain.gain.value = isBgmEnabled ? bgmVolume : 0;
    bgmGainNodeRef.current = bgmGain;
    
    bgmGain.connect(ctx.destination);
    bgmGain.connect(dest);

    const bgmSource = ctx.createMediaElementSource(bgmAudio);
    mediaElementSourceRef.current = bgmSource;
    bgmSource.connect(bgmGain);

    // --- SFX Setup ---
    const sfxAudio = new Audio();
    sfxAudio.loop = true;
    sfxAudio.crossOrigin = "anonymous";
    sfxSourceRef.current = sfxAudio;

    const sfxGain = ctx.createGain();
    sfxGain.gain.value = sfxVolume;
    sfxGainNodeRef.current = sfxGain;

    sfxGain.connect(ctx.destination);
    sfxGain.connect(dest);

    const sfxSource = ctx.createMediaElementSource(sfxAudio);
    sfxElementSourceRef.current = sfxSource;
    sfxSource.connect(sfxGain);

    const initialSrc = customBgmUrl || BGM_LIBRARY[currentBgmName] || DEFAULT_BGM;
    bgmAudio.src = initialSrc;

    return () => {
      bgmAudio.pause();
      sfxAudio.pause();
      stopAudio();
      ctx.close();
    };
  }, []);

  // Audio/SFX/BGM Update Hooks
  useEffect(() => {
     if (!sfxSourceRef.current) return;
     const currentSfxName = media[currentSceneIndex]?.soundEffect;
     const sfxUrl = currentSfxName ? SFX_LIBRARY[currentSfxName] : null;
     if (sfxUrl && sfxUrl !== sfxSourceRef.current.src) {
         sfxSourceRef.current.src = sfxUrl;
         if (isPlaying) sfxSourceRef.current.play().catch(e => console.log("SFX play error", e));
     } else if (!sfxUrl) {
         sfxSourceRef.current.pause();
         sfxSourceRef.current.src = "";
     }
  }, [currentSceneIndex, isPlaying]);

  useEffect(() => {
    if (!bgmSourceRef.current) return;
    const newSrc = customBgmUrl || BGM_LIBRARY[currentBgmName];
    if (bgmSourceRef.current.src !== newSrc) {
        const wasPlaying = !bgmSourceRef.current.paused;
        bgmSourceRef.current.src = newSrc;
        if (wasPlaying && isPlaying) bgmSourceRef.current.play().catch(e => console.log("Auto-play prevented", e));
    }
  }, [currentBgmName, customBgmUrl]);

  useEffect(() => {
    if (audioContextRef.current) {
        const t = audioContextRef.current.currentTime;
        if (bgmGainNodeRef.current) bgmGainNodeRef.current.gain.setValueAtTime(isBgmEnabled ? bgmVolume : 0, t);
        if (sfxGainNodeRef.current) sfxGainNodeRef.current.gain.setValueAtTime(sfxVolume, t);
    }
  }, [bgmVolume, sfxVolume, isBgmEnabled]);

  const handleCustomBgmUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const url = URL.createObjectURL(file);
          setCustomBgmUrl(url);
          setCurrentBgmName("Custom Upload");
          setIsBgmEnabled(true);
      }
  };

  // --- Google Drive Integration ---
  
  useEffect(() => {
    if (typeof google !== 'undefined' && google.accounts && process.env.GOOGLE_CLIENT_ID) {
         try {
            const client = google.accounts.oauth2.initTokenClient({
                client_id: process.env.GOOGLE_CLIENT_ID,
                scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly',
                callback: (response: any) => {
                   if (response.access_token) {
                       setAccessToken(response.access_token);
                   }
                },
            });
            setDriveTokenClient(client);
        } catch (e) {
            console.error("Google Drive Init Error", e);
        }
    }
  }, []);

  // Handle Action after Token is received
  useEffect(() => {
    if (accessToken) {
        if (pendingAction === 'upload' && recordingBlob) {
            uploadVideoToDrive(accessToken, recordingBlob);
            setPendingAction(null);
        } else if (pendingAction === 'pick_folder') {
            fetchFolders(accessToken);
            setShowFolderPicker(true);
            setPendingAction(null);
        }
    }
  }, [accessToken, pendingAction, recordingBlob]);

  const handleSaveToDrive = () => {
     if (!recordingBlob) { alert("กรุณากด 'Save Video' ก่อนครับ"); return; }
     if (!process.env.GOOGLE_CLIENT_ID) { alert("Missing Google Client ID"); return; }
     
     if (accessToken) {
         uploadVideoToDrive(accessToken, recordingBlob);
     } else if (driveTokenClient) {
         setPendingAction('upload');
         driveTokenClient.requestAccessToken();
     }
  };

  const handleSelectFolderTrigger = () => {
    if (!process.env.GOOGLE_CLIENT_ID) { alert("Missing Google Client ID"); return; }
    
    if (accessToken) {
        fetchFolders(accessToken);
        setShowFolderPicker(true);
    } else if (driveTokenClient) {
        setPendingAction('pick_folder');
        driveTokenClient.requestAccessToken();
    }
  };

  const fetchFolders = async (token: string) => {
      setIsLoadingFolders(true);
      try {
          const q = "mimeType='application/vnd.google-apps.folder' and trashed=false";
          const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&pageSize=20&orderBy=folder,modifiedTime desc&fields=files(id,name)`, {
              headers: { 'Authorization': 'Bearer ' + token }
          });
          const data = await response.json();
          if (data.files) {
              setAvailableFolders(data.files);
          }
      } catch (e) {
          console.error("Failed to fetch folders", e);
      } finally {
          setIsLoadingFolders(false);
      }
  };

  const uploadVideoToDrive = async (token: string, blob: Blob) => {
      setUploadStatus('uploading');
      try {
          const metadata: any = { 
              name: `NithanAI - ${storyData.title}.mp4`, 
              mimeType: blob.type || 'video/mp4' 
          };
          
          if (selectedFolder) {
              metadata.parents = [selectedFolder.id];
          }

          const form = new FormData();
          form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
          form.append('file', blob);
          
          const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
              method: 'POST',
              headers: new Headers({ 'Authorization': 'Bearer ' + token }),
              body: form,
          });
          
          if (response.ok) { 
              setUploadStatus('success'); 
              setTimeout(() => setUploadStatus('idle'), 5000); 
          } else { 
              throw new Error('Upload failed'); 
          }
      } catch (e) { 
          setUploadStatus('error'); 
      }
  };

  // --- End Drive Integration ---

  useEffect(() => {
    if (customLogoUrl) {
      const img = new Image();
      img.src = customLogoUrl;
      logoImgRef.current = img;
    }
  }, [customLogoUrl]);

  // Main Draw Loop (Canvas)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 1080;
    canvas.height = 1920;
    
    // Check for Effect Changes
    const currentScene = media[currentSceneIndex];
    const visualEffect = currentScene?.visualEffect || 'none';
    
    // Re-init particles if needed
    const currentType = particlesRef.current[0]?.type;
    const targetType = (visualEffect === 'rain' || visualEffect === 'storm') ? 'rain' : 
                       (visualEffect === 'snow') ? 'snow' : 
                       (visualEffect === 'fire') ? 'ember' : 'dust';
                       
    if (currentType !== targetType || particlesRef.current.length === 0) {
        initParticles(canvas.width, canvas.height, visualEffect);
    }

    const img = new Image();
    img.src = currentScene.imageUrl;
    
    let animId: number;
    let localStartTime = performance.now();

    img.onload = () => {
        const draw = (timestamp: number) => {
            if (!isPlaying) localStartTime = timestamp; 
            const elapsed = timestamp - localStartTime;
            
            // Ken Burns
            const scaleAmount = storyData.mode?.includes('long') ? 0.05 : 0.15; 
            const speed = storyData.mode?.includes('long') ? 0.00002 : 0.00005;
            const scale = 1.0 + (Math.sin(elapsed * speed) * scaleAmount);
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // 1. Image
            const w = canvas.width * scale;
            const h = canvas.height * scale;
            const x = (canvas.width - w) / 2;
            const y = (canvas.height - h) / 2;
            ctx.drawImage(img, x, y, w, h);

            // 2. VFX
            if (visualEffect === 'storm') {
                if (Math.random() > 0.98) lightningOpacityRef.current = 0.8;
                if (lightningOpacityRef.current > 0) {
                    ctx.fillStyle = `rgba(255, 255, 255, ${lightningOpacityRef.current})`;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    lightningOpacityRef.current -= 0.1;
                }
            }

            particlesRef.current.forEach(p => {
                ctx.globalAlpha = p.alpha;
                ctx.beginPath();
                if (p.type === 'rain') {
                    ctx.strokeStyle = "rgba(174, 194, 224, 0.6)";
                    ctx.lineWidth = 2;
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p.x + p.speedX * 3, p.y + p.speedY * 3);
                    ctx.stroke();
                } else if (p.type === 'snow') {
                    ctx.fillStyle = "white";
                    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                    ctx.fill();
                } else if (p.type === 'ember') {
                     ctx.fillStyle = `rgba(255, ${Math.floor(Math.random() * 150)}, 0, ${p.alpha})`;
                     ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                     ctx.fill();
                } else {
                    ctx.fillStyle = "white";
                    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                    ctx.fill();
                }
                p.x += p.speedX; p.y += p.speedY;
                if (p.type === 'ember') {
                    if (p.y < 0 || p.alpha <= 0.01) { const newP = createParticle(canvas.width, canvas.height, 'ember'); p.x = newP.x; p.y = canvas.height; p.alpha = 1; }
                    p.alpha -= 0.005;
                } else {
                    if (p.x > canvas.width) p.x = 0; if (p.x < 0) p.x = canvas.width;
                    if (p.y > canvas.height) p.y = 0; if (p.y < 0) p.y = canvas.height;
                }
            });
            ctx.globalAlpha = 1.0;

            // 3. Overlay
            const gradient = ctx.createLinearGradient(0, canvas.height * 0.4, 0, canvas.height);
            gradient.addColorStop(0, "rgba(0,0,0,0)");
            gradient.addColorStop(0.6, "rgba(0,0,0,0.4)");
            gradient.addColorStop(1, "rgba(0,0,0,0.95)");
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 4. Logo
            if (logoImgRef.current && logoImgRef.current.complete) {
              const logoSize = 150; const margin = 50;
              const aspectRatio = logoImgRef.current.width / logoImgRef.current.height;
              let drawW = logoSize; let drawH = logoSize;
              if (aspectRatio > 1) { drawH = logoSize / aspectRatio; } else { drawW = logoSize * aspectRatio; }
              ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 10;
              ctx.drawImage(logoImgRef.current, canvas.width - drawW - margin, margin, drawW, drawH);
              ctx.shadowColor = "transparent";
            }

            // 5. Subtitles
            if (showSubtitles) {
                let textToDraw = media[currentSceneIndex].text;
                if (subtitleLang === 'en' && media[currentSceneIndex].textEn) textToDraw = media[currentSceneIndex].textEn!;
                const isEnglish = subtitleLang === 'en';
                const baseFontSize = isEnglish ? 46 : 52;
                const fontSize = (storyData.mode?.includes('long') && textToDraw.length > 200) ? baseFontSize - 10 : baseFontSize; 
                ctx.font = `500 ${fontSize}px 'Prompt', sans-serif`;
                ctx.textAlign = "center"; ctx.textBaseline = "bottom";
                ctx.shadowColor = "black"; ctx.shadowBlur = 8; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 3;
                ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,0.8)";
                const lines = wrapText(ctx, textToDraw, canvas.width * 0.85);
                const lineHeight = fontSize * 1.5;
                const startY = canvas.height - 200 - ((lines.length - 1) * lineHeight);
                lines.forEach((line, i) => {
                    const lineY = startY + (i * lineHeight);
                    ctx.strokeText(line, canvas.width / 2, lineY);
                    ctx.fillStyle = "white";
                    ctx.fillText(line, canvas.width / 2, lineY);
                });
            }

            animId = requestAnimationFrame(draw);
        };
        animId = requestAnimationFrame(draw);
    };

    return () => cancelAnimationFrame(animId);
  }, [currentSceneIndex, media, isPlaying, showSubtitles, subtitleLang]);

  const stopRecording = () => { if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop(); };

  const playCurrentSceneAudio = (offset: number = 0) => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    const scene = media[currentSceneIndex];
    if (!scene.audioBuffer) return;
    if (ttsSourceRef.current) { try { ttsSourceRef.current.stop(); } catch (e) {} }

    const source = ctx.createBufferSource();
    source.buffer = scene.audioBuffer;
    source.connect(ctx.destination);
    if (destNodeRef.current) source.connect(destNodeRef.current);

    startTimeRef.current = ctx.currentTime - offset;
    source.start(0, offset);
    ttsSourceRef.current = source;
    
    if (bgmSourceRef.current && bgmSourceRef.current.paused && isBgmEnabled) bgmSourceRef.current.play().catch(() => {});
    if (sfxSourceRef.current && sfxSourceRef.current.paused && scene.soundEffect) sfxSourceRef.current.play().catch(() => {});

    setIsPlaying(true);
    if (ctx.state === 'suspended') ctx.resume();

    const trackProgress = () => {
      if (!ctx || !scene.audioBuffer) return;
      const elapsed = ctx.currentTime - startTimeRef.current;
      const duration = scene.audioBuffer.duration;
      if (elapsed >= duration) handleSceneComplete();
      else { setProgress((elapsed / duration) * 100); animationFrameRef.current = requestAnimationFrame(trackProgress); }
    };
    cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(trackProgress);
  };

  const handleSceneComplete = () => {
    cancelAnimationFrame(animationFrameRef.current);
    setProgress(100);
    if (currentSceneIndex < media.length - 1) {
      setTimeout(() => { setCurrentSceneIndex(prev => prev + 1); pausedTimeRef.current = 0; setProgress(0); }, 500); 
    } else {
      setIsPlaying(false); pausedTimeRef.current = 0;
      if (bgmSourceRef.current) bgmSourceRef.current.pause();
      if (sfxSourceRef.current) sfxSourceRef.current.pause();
      stopRecording();
    }
  };

  useEffect(() => { if (isPlaying && progress === 0) playCurrentSceneAudio(0); }, [currentSceneIndex]);

  const stopAudio = () => {
    if (ttsSourceRef.current) { try { ttsSourceRef.current.stop(); } catch (e) {} ttsSourceRef.current = null; }
    if (bgmSourceRef.current) bgmSourceRef.current.pause();
    if (sfxSourceRef.current) sfxSourceRef.current.pause();
    cancelAnimationFrame(animationFrameRef.current);
    setIsPlaying(false);
    if (audioContextRef.current) pausedTimeRef.current = audioContextRef.current.currentTime - startTimeRef.current;
  };

  const togglePlay = () => {
    if (isPlaying) stopAudio();
    else {
      if (currentSceneIndex === media.length - 1 && progress >= 99) {
          setCurrentSceneIndex(0); setProgress(0); pausedTimeRef.current = 0; setTimeout(() => playCurrentSceneAudio(0), 100);
      } else { playCurrentSceneAudio(pausedTimeRef.current); }
    }
  };

  const startRecording = () => {
    if (!canvasRef.current || !destNodeRef.current) return;
    setRecordingBlob(null); setUploadStatus('idle'); stopAudio(); setCurrentSceneIndex(0); setProgress(0); pausedTimeRef.current = 0;

    const canvasStream = canvasRef.current.captureStream(30); 
    const audioStream = destNodeRef.current.stream;
    const combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioStream.getAudioTracks()]);

    const mimeTypes = ["video/mp4; codecs=h264,aac", "video/mp4", "video/webm; codecs=h264", "video/webm"];
    let selectedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || "video/webm";

    const options = { mimeType: selectedMimeType };
    let recorder;
    try { recorder = new MediaRecorder(combinedStream, options); } catch (e) { recorder = new MediaRecorder(combinedStream); selectedMimeType = recorder.mimeType; }
    
    recordedChunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
    recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: selectedMimeType });
        setRecordingBlob(blob);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        const ext = selectedMimeType.includes("mp4") ? "mp4" : "webm";
        a.download = `nithan-ai-${storyData.id || Date.now()}.${ext}`;
        a.click();
        setIsRecording(false); setIsPlaying(false);
    };

    mediaRecorderRef.current = recorder; recorder.start(); setIsRecording(true); setTimeout(() => playCurrentSceneAudio(0), 200);
  };

  const handleCopyDescription = () => {
    const text = `${storyData.title}\n\n${storyData.seoSummary}\n\n${storyData.tags?.join(' ')}\n\n#NithanAI`;
    navigator.clipboard.writeText(text);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const currentMedia = media[currentSceneIndex];
  const displayedText = (subtitleLang === 'en' && currentMedia.textEn) ? currentMedia.textEn : currentMedia.text;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
      <canvas ref={canvasRef} className="fixed top-0 left-0 pointer-events-none opacity-0" style={{ zIndex: -1 }} />
      <div className="relative w-full h-full max-w-[450px] max-h-[800px] aspect-[9/16] bg-gray-900 overflow-hidden shadow-2xl flex flex-col group">
        
        {/* Render Same visuals as before */}
        <div className="absolute inset-0 overflow-hidden">
             <img key={currentMedia.imageUrl} src={currentMedia.imageUrl} alt="Story Scene" className={`w-full h-full object-cover transition-transform duration-[10000ms] ease-linear transform scale-100 ${isPlaying ? 'scale-110' : ''}`} />
             <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90"></div>
             <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/60 to-transparent pointer-events-none"></div>
        </div>

        {/* UI Controls Overlay (Top) */}
        <div className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-start">
             <div className="flex flex-col gap-2">
                 <div className="bg-black/30 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2 self-start">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    <span className="text-white text-xs font-medium">Auto-Play</span>
                 </div>
                 {currentMedia.visualEffect && currentMedia.visualEffect !== 'none' && (
                    <div className="bg-black/30 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2 self-start">
                        {currentMedia.visualEffect === 'rain' && <CloudRain size={12} className="text-blue-300"/>}
                        {currentMedia.visualEffect === 'storm' && <Zap size={12} className="text-yellow-300"/>}
                        {currentMedia.visualEffect === 'snow' && <Snowflake size={12} className="text-white"/>}
                        {currentMedia.visualEffect === 'fire' && <Flame size={12} className="text-orange-400"/>}
                        <span className="text-white text-xs font-medium capitalize">{currentMedia.visualEffect}</span>
                    </div>
                 )}
             </div>

             <div className="flex gap-2 items-center">
                 <button onClick={() => setShowSubtitles(!showSubtitles)} className="p-1.5 bg-black/40 rounded-full text-white backdrop-blur-sm hover:bg-white/20 transition h-10 w-10 flex items-center justify-center border border-white/10">
                    {showSubtitles ? <Subtitles size={20} /> : <Subtitles size={20} className="text-slate-500 opacity-50"/>}
                 </button>
                 <button onClick={() => setSubtitleLang(prev => prev === 'th' ? 'en' : 'th')} className="p-1.5 bg-black/40 rounded-full text-white backdrop-blur-sm hover:bg-white/20 transition h-10 w-10 flex items-center justify-center border border-white/10 font-bold text-xs">
                    {subtitleLang.toUpperCase()}
                 </button>
                 <div className="relative">
                     <button onClick={() => setShowMusicMenu(!showMusicMenu)} className={`p-1.5 rounded-full text-white backdrop-blur-sm hover:bg-white/20 transition h-10 w-10 flex items-center justify-center border border-white/10 ${isBgmEnabled ? 'bg-indigo-600/60' : 'bg-black/40'}`}>
                        {isBgmEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                     </button>
                     {/* Music Menu Popover */}
                     {showMusicMenu && (
                        <div className="absolute top-12 right-0 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-4 z-30 animate-fade-in">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="text-white text-sm font-bold flex items-center gap-2"><Sliders size={14}/> Audio Mixer</h4>
                                <button onClick={() => setShowMusicMenu(false)}><X size={14} className="text-slate-400"/></button>
                            </div>
                            <div className="flex items-center justify-between mb-4 bg-slate-900/50 p-2 rounded-lg">
                                <span className="text-xs text-slate-300">BGM Enabled</span>
                                <button onClick={() => setIsBgmEnabled(!isBgmEnabled)} className={`w-8 h-4 rounded-full transition-colors relative ${isBgmEnabled ? 'bg-green-500' : 'bg-slate-600'}`}>
                                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${isBgmEnabled ? 'left-4.5' : 'left-0.5'}`} style={{ left: isBgmEnabled ? '18px' : '2px'}}></div>
                                </button>
                            </div>
                            <div className="mb-2">
                                <div className="flex justify-between text-xs text-slate-400 mb-1"><span>Music Vol</span><span>{Math.round(bgmVolume * 100)}%</span></div>
                                <input type="range" min="0" max="0.5" step="0.01" value={bgmVolume} onChange={(e) => setBgmVolume(parseFloat(e.target.value))} className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer" />
                            </div>
                            <div className="mb-4">
                                <div className="flex justify-between text-xs text-slate-400 mb-1"><span>SFX Vol</span><span>{Math.round(sfxVolume * 100)}%</span></div>
                                <input type="range" min="0" max="1" step="0.05" value={sfxVolume} onChange={(e) => setSfxVolume(parseFloat(e.target.value))} className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer" />
                            </div>
                            <div className="space-y-1 max-h-40 overflow-y-auto mb-3 scrollbar-hide">
                                {Object.keys(BGM_LIBRARY).map((name) => (
                                    <button key={name} onClick={() => { setCurrentBgmName(name); setCustomBgmUrl(null); setIsBgmEnabled(true); }} className={`w-full text-left text-xs py-2 px-2 rounded-lg flex items-center justify-between ${currentBgmName === name && !customBgmUrl ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>
                                        <span>{name}</span>
                                        {currentBgmName === name && !customBgmUrl && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                    </button>
                                ))}
                            </div>
                            <div className="pt-2 border-t border-slate-700">
                                <label className="flex items-center justify-center gap-2 w-full py-2 bg-slate-700 hover:bg-slate-600 rounded-lg cursor-pointer text-xs text-slate-300 transition">
                                    <Upload size={12} /><span>Upload MP3</span><input type="file" accept="audio/*" onChange={handleCustomBgmUpload} className="hidden" />
                                </label>
                            </div>
                        </div>
                     )}
                 </div>
                 <button onClick={onClose} className="p-1.5 bg-black/40 rounded-full text-white backdrop-blur-sm hover:bg-white/20 transition h-10 w-10 flex items-center justify-center">
                    <X size={20} />
                 </button>
             </div>
        </div>

        {customLogoUrl && (
             <div className="absolute top-16 right-4 z-20 w-12 h-12 bg-white/10 backdrop-blur-md rounded-full border border-white/20 overflow-hidden shadow-lg animate-fade-in">
                <img src={customLogoUrl} alt="Channel Logo" className="w-full h-full object-cover" />
             </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col gap-4 pb-10 z-20">
            {currentSceneIndex === 0 && (
                 <div className="mb-4 animate-fade-in-up">
                    <h2 className="text-2xl font-bold text-white drop-shadow-md leading-tight">{storyData.title}</h2>
                 </div>
            )}
            <div className="min-h-[80px]">
                {showSubtitles && (
                    <p className="text-white text-lg md:text-xl font-medium leading-relaxed drop-shadow-lg font-['Prompt'] text-shadow-black text-center animate-fade-in">
                        {displayedText}
                    </p>
                )}
            </div>
            <div className="w-full h-1.5 bg-gray-700/50 rounded-full overflow-hidden backdrop-blur-sm">
                <div className="h-full bg-indigo-500 transition-all duration-100 ease-linear shadow-[0_0_10px_rgba(99,102,241,0.5)]" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center justify-between mt-2">
                 <div className="flex gap-4">
                    <button onClick={togglePlay} disabled={isRecording} className="w-12 h-12 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 transition active:scale-95 disabled:opacity-50">
                        {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1"/>}
                    </button>
                    <button onClick={() => setShowExportModal(true)} className="w-12 h-12 flex items-center justify-center bg-black/40 backdrop-blur-md text-white border border-white/20 rounded-full hover:bg-white/10 transition">
                        <Youtube size={24} />
                    </button>
                 </div>
                 <div className="flex gap-1 overflow-hidden max-w-[150px]">
                    {media.map((_, idx) => (
                        <div key={idx} className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentSceneIndex ? 'bg-indigo-500 w-6 shrink-0' : 'bg-white/30 w-1.5 shrink-0'}`} />
                    ))}
                 </div>
            </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
            <div className="bg-[#1e293b] w-full max-w-sm rounded-t-2xl sm:rounded-2xl border border-slate-700 shadow-2xl overflow-hidden relative">
                {/* Close Button */}
                <button onClick={() => setShowExportModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20}/></button>

                {!showFolderPicker ? (
                    <>
                        <div className="p-4 border-b border-slate-700 bg-slate-900/50">
                            <h3 className="text-white font-bold flex items-center gap-2"><Youtube className="text-red-500" /> Export Options</h3>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="bg-slate-900 p-3 rounded-xl border border-slate-700 relative group">
                                <p className="text-slate-400 text-xs uppercase font-bold mb-2">Video Description</p>
                                <div className="text-sm text-slate-300 font-mono h-24 overflow-y-auto pr-2 scrollbar-hide">
                                    <p className="font-bold text-white mb-2">{storyData.title}</p>
                                    <p className="mb-2">{storyData.seoSummary}</p>
                                    <p className="text-indigo-400">{storyData.tags?.join(' ')}</p>
                                </div>
                                <button onClick={handleCopyDescription} className="absolute top-2 right-2 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition shadow-lg">
                                    {copied ? <Check size={16} /> : <Copy size={16} />}
                                </button>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                <button onClick={startRecording} disabled={isRecording} className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${isRecording ? 'bg-red-500/20 text-red-500 border border-red-500 animate-pulse' : 'bg-white text-black hover:bg-slate-200'}`}>
                                    {isRecording ? (<><span>Recording...</span><span className="w-2 h-2 bg-red-500 rounded-full"></span></>) : (<><Download size={18} /> Save Video</>)}
                                </button>
                                
                                <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 space-y-2">
                                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                                        <span>Save to Google Drive</span>
                                        {selectedFolder && <span className="text-indigo-400 truncate max-w-[120px]">{selectedFolder.name}</span>}
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={handleSelectFolderTrigger} className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition flex items-center justify-center" title="Select Folder">
                                            <Folder size={18} />
                                        </button>
                                        <button onClick={handleSaveToDrive} disabled={isRecording || uploadStatus === 'uploading' || uploadStatus === 'success'} className={`flex-1 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-all border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white text-sm ${uploadStatus === 'success' ? 'bg-green-500/20 text-green-400 border-green-500' : 'bg-slate-700'}`}>
                                            {uploadStatus === 'uploading' ? (<><Loader2 className="animate-spin" size={16} /> Uploading...</>) : uploadStatus === 'success' ? (<><Check size={16} /> Done</>) : uploadStatus === 'error' ? (<><AlertCircle size={16} className="text-red-500"/> Retry</>) : (<><HardDrive size={16} /> Upload to Drive</>)}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="p-4 border-b border-slate-700 bg-slate-900/50 flex items-center gap-2">
                            <button onClick={() => setShowFolderPicker(false)} className="text-slate-400 hover:text-white"><ChevronRight className="rotate-180" size={20}/></button>
                            <h3 className="text-white font-bold">Select Destination</h3>
                        </div>
                        <div className="p-2 h-80 overflow-y-auto">
                            {isLoadingFolders ? (
                                <div className="flex items-center justify-center h-full text-slate-500"><Loader2 className="animate-spin mr-2"/> Loading folders...</div>
                            ) : availableFolders.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-slate-500">No folders found</div>
                            ) : (
                                <div className="space-y-1">
                                    <button onClick={() => { setSelectedFolder(null); setShowFolderPicker(false); }} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition ${!selectedFolder ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                                        <HardDrive size={18} /> <span className="font-medium">My Drive (Root)</span>
                                        {!selectedFolder && <Check size={16} className="ml-auto"/>}
                                    </button>
                                    <div className="h-px bg-slate-700 my-2"></div>
                                    {availableFolders.map(folder => (
                                        <button key={folder.id} onClick={() => { setSelectedFolder(folder); setShowFolderPicker(false); }} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition ${selectedFolder?.id === folder.id ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                                            <Folder size={18} className={selectedFolder?.id === folder.id ? "text-white" : "text-yellow-500"} /> 
                                            <span className="truncate">{folder.name}</span>
                                            {selectedFolder?.id === folder.id && <Check size={16} className="ml-auto"/>}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
      )}
    </div>
  );
};

export default StoryPlayer;
