import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Folder, Sparkles, Settings, Play, Pause, CheckCircle2, 
  FileText, Wand2, RefreshCw, Copy, Layers, Eye,
  Zap, Clock, Sliders, Check, Trash2, Plus, UploadCloud,
  FolderOpen, X, Volume2, VolumeX, Film, ArrowUp, Download, Gauge,
  Key, HelpCircle, ExternalLink, ShieldCheck, CheckCheck, 
  AlertCircle, FolderCheck, Scissors, ChevronLeft, ChevronRight,
  Maximize2, Crosshair, Move, Search, Filter, Smartphone, Monitor, Square,
  RotateCcw, Hash, Type, ArrowRight, ArrowLeft, Palette
} from 'lucide-react';


const THEMES = [
  { id: 'cyber-cyan', name: 'Cyber Cyan', dot: '#00F2FE' },
  { id: 'neon-violet', name: 'Neon Violet', dot: '#c084fc' },
  { id: 'emerald-matrix', name: 'Emerald Matrix', dot: '#10b981' },
  { id: 'sunset-gold', name: 'Sunset Gold', dot: '#f59e0b' },
  { id: 'crimson-red', name: 'Crimson Red', dot: '#ef4444' },
  { id: 'midnight-blue', name: 'Midnight Blue', dot: '#38bdf8' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('browse'); // 'browse', 'rules', 'process'
  const [backendStatus, setBackendStatus] = useState({ online: false, ffmpegAvailable: false, hasGeminiKey: false });
  const [configData, setConfigData] = useState({ isConfigured: false, maskedKey: '', geminiModel: 'gemini-3.8-flash' });
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [configSaveMsg, setConfigSaveMsg] = useState(null);

  // Theme Color System
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem('batch_studio_theme') || 'cyber-cyan';
  });
  const [showThemePicker, setShowThemePicker] = useState(false);
  const themePickerRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('batch_studio_theme', currentTheme);
  }, [currentTheme]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (themePickerRef.current && !themePickerRef.current.contains(e.target)) {
        setShowThemePicker(false);
      }
    };
    if (showThemePicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showThemePicker]);

  // File explorer & batch
  const [currentDir, setCurrentDir] = useState('');
  const [manualPath, setManualPath] = useState('');
  const [folderData, setFolderData] = useState({ folders: [], videos: [], images: [], parent: null });
  const [browseError, setBrowseError] = useState(null);
  const [searchBatch, setSearchBatch] = useState('');
  const [searchExplorer, setSearchExplorer] = useState('');

  // Active Batch Video List & Modals State
  const [batchVideos, setBatchVideos] = useState([]);
  const [cinemaVideo, setCinemaVideo] = useState(null);

  // Quick Trim Studio State (NLE Assisted Video Trimmer)
  const [trimmerIndex, setTrimmerIndex] = useState(null);
  const trimmerVideoRef = useRef(null);
  const [trimmerCurrentTime, setTrimmerCurrentTime] = useState(0);
  const [trimmerDuration, setTrimmerDuration] = useState(0);
  const [trimmerPlaying, setTrimmerPlaying] = useState(false);
  const [trimmerAiLoading, setTrimmerAiLoading] = useState(false);
  const [trimmerAiInfo, setTrimmerAiInfo] = useState(null);
  const [trimmerFilmstrip, setTrimmerFilmstrip] = useState([]);
  const [trimmerFilmstripLoading, setTrimmerFilmstripLoading] = useState(false);
  const [trimmerHoverTime, setTrimmerHoverTime] = useState(null);
  const [trimmerHoverX, setTrimmerHoverX] = useState(null);
  const blobUrlCache = useRef(new Map());


  // Custom Cut Segments Drafting State
  const [segMarkIn, setSegMarkIn] = useState(null);
  const [segMarkOut, setSegMarkOut] = useState(null);
  const [manualSegStart, setManualSegStart] = useState('');
  const [manualSegEnd, setManualSegEnd] = useState('');

  // Live Studio Monitor & Dragging Watermark State
  const monitorCanvasRef = useRef(null);
  const [previewVideoIndex, setPreviewVideoIndex] = useState(0);
  const [isDraggingWatermark, setIsDraggingWatermark] = useState(false);
  const [selectedWatermark, setSelectedWatermark] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // File Input Refs
  const fileInputRef = useRef(null);
  const watermarkFileInputRef = useRef(null);
  const introFileInputRef = useRef(null);
  const outroFileInputRef = useRef(null);

  const [watermarkFileObj, setWatermarkFileObj] = useState(null);
  const [introFileObj, setIntroFileObj] = useState(null);
  const [outroFileObj, setOutroFileObj] = useState(null);

  // Advanced Processing Options
  const [options, setOptions] = useState({
    renamePattern: '{prefix}_{counter}_{original}',
    prefix: 'REEL',
    suffix: '',
    aspectRatio: '9:16', // '9:16', '16:9', '1:1', '4:5', 'original'
    blurredBackground: true,
    speedMode: 'multiplier', // 'multiplier' or 'targetDuration'
    speed: 1.0,
    targetDurationSeconds: 30,
    introCutTime: 0,
    outroCutTime: 0,
    watermarkEnabled: true,
    watermarkPosition: 'bottom-right',
    watermarkX: 86, // 0 to 100%
    watermarkY: 88, // 0 to 100%
    watermarkOpacity: 0.85,
    watermarkScale: 0.15,
    includeAudio: true, // Master audio switch: true = include audio, false = export muted
    normalizeAudio: true,
    
    // Automatic Real AI Vision Rules for trimming
    autoAiVisionRules: true,
    aiRemoveIntroLogo: true,
    aiRemoveOutroLogo: true,

    // Integrated Post-Processing Copy Generation
    generateCopy: true,
    copyTone: 'Profesional', // 'Profesional', 'Storytelling', 'Educativo', 'Directo'
    saveCopyTxt: true
  });

  // Generated Copys and Processed Results
  const [batchCopys, setBatchCopys] = useState([]);
  const [successfulVideos, setSuccessfulVideos] = useState([]);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [outputFolder, setOutputFolder] = useState('');
  const [regeneratingIndex, setRegeneratingIndex] = useState(null);

  // Batch Queue Progress & Telemetry State
  const [batchProgress, setBatchProgress] = useState({
    running: false,
    currentIndex: 0,
    total: 0,
    currentVideo: '',
    status: '',
    percentage: 0,
    elapsedSeconds: 0,
    etaSeconds: null,
    completed: false,
    errors: []
  });

  const [presets, setPresets] = useState([]);

  useEffect(() => {
    fetchStatus();
    fetchConfig();
    loadPresets();
    connectWebSocket();
  }, []);

  // Global mouse event listener for smooth watermark dragging across monitor
  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (!isDraggingWatermark || !monitorCanvasRef.current) return;
      updateWatermarkPositionFromEvent(e);
    };

    const handleGlobalMouseUp = () => {
      if (isDraggingWatermark) {
        setIsDraggingWatermark(false);
      }
    };

    if (isDraggingWatermark) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDraggingWatermark]);

  // Keyboard shortcuts listener for Quick Trim Studio modal
  useEffect(() => {
    if (trimmerIndex === null) return;

    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (!trimmerVideoRef.current) return;
        if (trimmerPlaying) trimmerVideoRef.current.pause();
        else trimmerVideoRef.current.play();
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        updateCurrentVideoCuts({ introCutTime: parseFloat(trimmerCurrentTime.toFixed(2)) });
      } else if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        updateCurrentVideoCuts({ outroCutTime: Math.max(0, parseFloat((trimmerDuration - trimmerCurrentTime).toFixed(2))) });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepVideoTime(e.shiftKey ? -1.0 : -0.1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepVideoTime(e.shiftKey ? 1.0 : 0.1);
      } else if (e.key === 'Escape') {
        closeTrimmer();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [trimmerIndex, trimmerPlaying, trimmerCurrentTime, trimmerDuration]);

  const fetchStatus = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/status');
      const data = await res.json();
      setBackendStatus({
        online: true,
        ffmpegAvailable: data.ffmpegAvailable,
        hasGeminiKey: data.hasGeminiKey
      });
      if (data.cwd && !currentDir) {
        browseDirectory(data.cwd);
      }
    } catch (err) {
      setBackendStatus({ online: false, ffmpegAvailable: false, hasGeminiKey: false });
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/config');
      const data = await res.json();
      setConfigData(data);
      if (!data.isConfigured) {
        const cachedKey = localStorage.getItem('batch_studio_gemini_key');
        if (cachedKey) {
          const autoRes = await fetch('http://localhost:3001/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              geminiApiKey: cachedKey.trim(),
              geminiModel: data.geminiModel || 'gemini-3.8-flash'
            })
          });
          const autoData = await autoRes.json();
          if (autoData.isConfigured) {
            setConfigData(autoData);
            setBackendStatus(prev => ({ ...prev, hasGeminiKey: true }));
          }
        }
      }
    } catch (err) {
      console.error('Error cargando config:', err);
    }
  };

  const saveConfig = async () => {
    try {
      const trimmedKey = apiKeyInput.trim();
      const payload = {
        geminiModel: configData.geminiModel || 'gemini-3.8-flash'
      };
      if (trimmedKey) {
        payload.geminiApiKey = trimmedKey;
      }
      const res = await fetch('http://localhost:3001/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        if (trimmedKey) {
          localStorage.setItem('batch_studio_gemini_key', trimmedKey);
        }
        setConfigData(data);
        setBackendStatus(prev => ({ ...prev, hasGeminiKey: data.isConfigured }));
        setApiKeyInput('');
        setConfigSaveMsg('✅ Configuración guardada con éxito.');
        setTimeout(() => {
          setConfigSaveMsg(null);
          setShowConfigModal(false);
        }, 1200);
      }
    } catch (err) {
      setConfigSaveMsg('❌ Error al guardar: ' + err.message);
    }
  };

  const clearApiKey = async () => {
    if (!window.confirm('¿Seguro que deseas eliminar la API Key de Gemini configurada?')) return;
    try {
      const res = await fetch('http://localhost:3001/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geminiApiKey: '__CLEAR__' })
      });
      const data = await res.json();
      localStorage.removeItem('batch_studio_gemini_key');
      setConfigData(data);
      setBackendStatus(prev => ({ ...prev, hasGeminiKey: false }));
      setConfigSaveMsg('🗑️ API Key eliminada.');
    } catch (err) {
      setConfigSaveMsg('❌ Error: ' + err.message);
    }
  };


  const toggleVideoAudio = (videoIndex) => {
    setBatchVideos(prev => {
      const updated = [...prev];
      const target = updated[videoIndex];
      if (!target) return prev;
      const currentIsMuted = target.muteAudio !== undefined 
        ? target.muteAudio 
        : (options.includeAudio === false);
      updated[videoIndex] = {
        ...target,
        muteAudio: !currentIsMuted
      };
      return updated;
    });
  };

  const browseDirectory = async (pathTarget) => {
    setBrowseError(null);
    try {
      const res = await fetch(`http://localhost:3001/api/browse?path=${encodeURIComponent(pathTarget)}`);
      const data = await res.json();

      if (res.ok && !data.error) {
        setCurrentDir(data.currentPath);
        setManualPath(data.currentPath);
        setFolderData({
          folders: data.folders || [],
          videos: data.videos || [],
          images: data.images || [],
          parent: data.parent || null
        });

        if (batchVideos.length === 0 && data.videos && data.videos.length > 0) {
          setBatchVideos(data.videos);
        }
      } else {
        setBrowseError(data.error || data.accessError || 'No se pudo acceder a la carpeta');
      }
    } catch (err) {
      setBrowseError('Error de conexión al explorar directorio');
    }
  };

  const loadPresets = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/presets');
      const data = await res.json();
      if (Array.isArray(data)) {
        setPresets(data);
      }
    } catch (err) {
      console.error('Error cargando presets:', err);
    }
  };

  const uploadFileLocally = async (fileObj, customFilename) => {
    if (!fileObj) return null;
    try {
      const filename = customFilename || fileObj.name;
      const res = await fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        headers: {
          'x-filename': encodeURIComponent(filename)
        },
        body: fileObj
      });
      const data = await res.json();
      if (data.success) {
        return data.path;
      }
    } catch (err) {
      console.error('Error subiendo archivo local:', err);
    }
    return null;
  };

  const connectWebSocket = () => {
    const ws = new WebSocket('ws://localhost:3001');
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'BATCH_START') {
        setBatchCopys([]);
        setSuccessfulVideos([]);
        setOutputFolder(msg.outputDir || '');
        setBatchProgress({
          running: true,
          currentIndex: 0,
          total: msg.total,
          currentVideo: '',
          status: 'Iniciando procesamiento en lote...',
          percentage: 0,
          elapsedSeconds: 0,
          etaSeconds: null,
          completed: false,
          errors: []
        });
      } else if (msg.type === 'VIDEO_PROGRESS') {
        setBatchProgress(prev => ({
          ...prev,
          running: true,
          currentIndex: msg.currentIndex,
          total: msg.total,
          currentVideo: msg.videoName,
          status: msg.status,
          percentage: msg.percentage,
          elapsedSeconds: msg.elapsedSeconds !== undefined ? msg.elapsedSeconds : prev.elapsedSeconds,
          etaSeconds: msg.etaSeconds !== undefined ? msg.etaSeconds : prev.etaSeconds
        }));
      } else if (msg.type === 'VIDEO_COPY_READY') {
        setBatchCopys(prev => {
          const exists = prev.some(c => c.videoName === msg.copyData.videoName);
          if (exists) {
            return prev.map(c => c.videoName === msg.copyData.videoName ? msg.copyData : c);
          }
          return [...prev, msg.copyData];
        });
      } else if (msg.type === 'VIDEO_ERROR') {
        setBatchProgress(prev => ({
          ...prev,
          errors: [...(prev.errors || []), { videoName: msg.videoName, error: msg.error }],
          status: `⚠️ Error en ${msg.videoName}: ${msg.error}`
        }));
      } else if (msg.type === 'BATCH_COMPLETE') {
        if (msg.copys && Array.isArray(msg.copys) && msg.copys.length > 0) {
          setBatchCopys(msg.copys);
        }
        if (msg.successfulVideos) {
          setSuccessfulVideos(msg.successfulVideos);
        }
        if (msg.outputDir) {
          setOutputFolder(msg.outputDir);
        }
        setBatchProgress(prev => {
          const hasFailures = msg.failedCount > 0;
          return {
            ...prev,
            running: false,
            percentage: 100,
            status: hasFailures 
              ? `⚠️ Lote finalizado con ${msg.failedCount} error(es). ${msg.successCount} procesado(s) en ${msg.outputDir}`
              : `¡Lote completado con éxito! ${msg.total} vídeo(s) procesados en ${msg.outputDir}`,
            completed: true
          };
        });
      }
    };
  };

  const openOutputFolderInExplorer = async () => {
    try {
      await fetch('http://localhost:3001/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: outputFolder })
      });
    } catch (e) {
      console.error('Error abriendo carpeta:', e);
    }
  };

  // Drag & Drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    
    const newVideos = files.filter(f => f.type.startsWith('video/') || f.name.match(/\.(mp4|mov|mkv|avi|webm|m4v)$/i)).map(f => ({
      name: f.name,
      path: f.path || f.name,
      size: f.size,
      ext: f.name.substring(f.name.lastIndexOf('.')),
      fileObj: f,
      customCuts: null
    }));

    if (newVideos.length > 0) {
      addVideosToBatch(newVideos);
    }
  };

  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files);
    const newVideos = files.map(f => ({
      name: f.name,
      path: f.path || f.name,
      size: f.size,
      ext: f.name.substring(f.name.lastIndexOf('.')),
      fileObj: f,
      customCuts: null
    }));
    addVideosToBatch(newVideos);
  };

  const addVideosToBatch = (videosToAdd) => {
    const existingPaths = new Set(batchVideos.map(v => v.path));
    const filtered = videosToAdd.filter(v => !existingPaths.has(v.path));
    setBatchVideos(prev => [...prev, ...filtered]);
  };

  const removeVideoFromBatch = (videoPath) => {
    setBatchVideos(batchVideos.filter(v => v.path !== videoPath));
    if (cinemaVideo && cinemaVideo.path === videoPath) {
      setCinemaVideo(null);
    }
    if (trimmerIndex !== null && batchVideos[trimmerIndex]?.path === videoPath) {
      setTrimmerIndex(null);
    }
  };

  const clearBatch = () => {
    setBatchVideos([]);
    setCinemaVideo(null);
    setTrimmerIndex(null);
  };

  const getVideoSourceUrl = useCallback((video) => {
    if (!video) return '';
    if (video.fileObj) {
      if (!blobUrlCache.current.has(video.fileObj)) {
        blobUrlCache.current.set(video.fileObj, URL.createObjectURL(video.fileObj));
      }
      return blobUrlCache.current.get(video.fileObj);
    }
    const p = video.path || video.name;
    return `http://localhost:3001/api/video-stream?path=${encodeURIComponent(p)}`;
  }, []);


  const getVideoThumbnailUrl = (video) => {
    if (!video || !video.path) return '';
    return `http://localhost:3001/api/thumbnail?path=${encodeURIComponent(video.path)}`;
  };

  const copySingleToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const exportAllCopysText = () => {
    if (batchCopys.length === 0) return;
    let fullText = `# COPYS DE LINKEDIN GENERADOS TRAS PROCESAR EL LOTE (${batchCopys.length} VÍDEOS)\n\n`;
    batchCopys.forEach((item, idx) => {
      fullText += `============================================================\n`;
      fullText += `VÍDEO #${idx + 1}: ${item.videoName}\n`;
      if (item.summary) fullText += `RESUMEN VISUAL: ${item.summary}\n`;
      if (item.detectedText) fullText += `TEXTO EN PANTALLA: ${item.detectedText}\n`;
      fullText += `============================================================\n\n`;
      fullText += `${item.copy}\n\n`;
      if (item.hashtags && item.hashtags.length > 0) {
        fullText += `HASHTAGS: ${item.hashtags.join(' ')}\n\n`;
      }
      fullText += `\n`;
    });

    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `copys_lote_procesado_${Date.now()}.txt`;
    a.click();
  };

  const regenerateSingleCopy = async (index, newTone) => {
    const item = batchCopys[index];
    if (!item || !item.videoPath) return;
    setRegeneratingIndex(index);
    try {
      const res = await fetch('http://localhost:3001/api/ai/generate-copy-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoPath: item.videoPath, tone: newTone })
      });
      const data = await res.json();
      if (data && data.copy) {
        setBatchCopys(prev => {
          const next = [...prev];
          next[index] = { ...next[index], ...data };
          return next;
        });
      }
    } catch (err) {
      console.error('Error regenerando copy:', err);
    } finally {
      setRegeneratingIndex(null);
    }
  };

  // -------------------------------------------------------------
  // Quick Trim Studio Methods (NLE Timeline & Custom Cut Segments)
  // -------------------------------------------------------------
  const loadFilmstripForVideo = async (video) => {
    if (!video) return;
    setTrimmerFilmstripLoading(true);
    setTrimmerFilmstrip([]);
    try {
      let targetPath = video.path || video.name;
      if (video.fileObj && (!video.path || video.path === video.name)) {
        const up = await uploadFileLocally(video.fileObj, video.name);
        if (up) targetPath = up;
      }
      const res = await fetch(`http://localhost:3001/api/video-filmstrip?path=${encodeURIComponent(targetPath)}&count=10`);
      const data = await res.json();
      if (data.frames && Array.isArray(data.frames)) {
        setTrimmerFilmstrip(data.frames);
      }
    } catch (e) {
      console.warn('Filmstrip fetch warning:', e.message);
    } finally {
      setTrimmerFilmstripLoading(false);
    }
  };

  const toggleTrimmerPlay = () => {
    if (!trimmerVideoRef.current) return;
    if (trimmerVideoRef.current.paused) {
      trimmerVideoRef.current.play().then(() => setTrimmerPlaying(true)).catch(() => {});
    } else {
      trimmerVideoRef.current.pause();
      setTrimmerPlaying(false);
    }
  };

  const openTrimmer = (idx) => {
    setTrimmerIndex(idx);
    setTrimmerAiInfo(null);
    setTrimmerCurrentTime(0);
    setTrimmerPlaying(false);
    setSegMarkIn(null);
    setSegMarkOut(null);
    if (batchVideos[idx]) {
      loadFilmstripForVideo(batchVideos[idx]);
    }
  };

  const closeTrimmer = () => {
    if (trimmerVideoRef.current) trimmerVideoRef.current.pause();
    setTrimmerIndex(null);
    setTrimmerAiInfo(null);
    setTrimmerPlaying(false);
    setSegMarkIn(null);
    setSegMarkOut(null);
    setTrimmerFilmstrip([]);
    setTrimmerHoverTime(null);
    setTrimmerHoverX(null);
  };

  useEffect(() => {
    if (trimmerIndex !== null && batchVideos[trimmerIndex]) {
      loadFilmstripForVideo(batchVideos[trimmerIndex]);
    }
  }, [trimmerIndex]);

  useEffect(() => {
    if (trimmerIndex === null) return;
    const handleKeyDown = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        toggleTrimmerPlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        stepVideoTime(e.shiftKey ? -1.0 : -0.1);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        stepVideoTime(e.shiftKey ? 1.0 : 0.1);
      } else if (e.code === 'KeyI') {
        e.preventDefault();
        updateCurrentVideoCuts({ introCutTime: parseFloat(trimmerCurrentTime.toFixed(2)) });
      } else if (e.code === 'KeyO') {
        e.preventDefault();
        const oTime = Math.max(0, trimmerDuration - trimmerCurrentTime);
        updateCurrentVideoCuts({ outroCutTime: parseFloat(oTime.toFixed(2)) });
      } else if (e.code === 'Escape') {
        closeTrimmer();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [trimmerIndex, trimmerCurrentTime, trimmerDuration, trimmerPlaying]);


  const updateCurrentVideoCuts = (updates) => {
    if (trimmerIndex === null) return;
    setBatchVideos(prev => {
      const updated = [...prev];
      const current = updated[trimmerIndex];
      const existingCuts = current.customCuts || { 
        introCutTime: 0, 
        outroCutTime: 0, 
        speed: options.speed,
        deletedSegments: []
      };
      updated[trimmerIndex] = {
        ...current,
        customCuts: { ...existingCuts, ...updates }
      };
      return updated;
    });
  };

  // Add / Remove custom deleted segments (Tramos Intermedios a Eliminar)
  const addDeletedSegment = (startSec, endSec) => {
    if (trimmerIndex === null) return;
    const s = Math.max(0, parseFloat(startSec) || 0);
    const e = Math.min(trimmerDuration || 9999, parseFloat(endSec) || 0);
    if (e <= s + 0.1) return;

    const existingSegments = currentTrimmerCuts.deletedSegments || [];
    const newSeg = {
      id: Date.now().toString(),
      start: parseFloat(s.toFixed(2)),
      end: parseFloat(e.toFixed(2))
    };

    updateCurrentVideoCuts({
      deletedSegments: [...existingSegments, newSeg].sort((a, b) => a.start - b.start)
    });

    setSegMarkIn(null);
    setSegMarkOut(null);
    setManualSegStart('');
    setManualSegEnd('');
  };

  const removeDeletedSegment = (segId) => {
    if (trimmerIndex === null) return;
    const existingSegments = currentTrimmerCuts.deletedSegments || [];
    updateCurrentVideoCuts({
      deletedSegments: existingSegments.filter(s => s.id !== segId)
    });
  };

  const runAiDetectionForCurrentTrimmerVideo = async () => {
    if (trimmerIndex === null) return;
    const v = batchVideos[trimmerIndex];
    setTrimmerAiLoading(true);
    setTrimmerAiInfo(null);

    try {
      let vPath = v.path || v.name;
      if (v.fileObj && (!v.path || v.path === v.name)) {
        const up = await uploadFileLocally(v.fileObj, v.name);
        if (up) vPath = up;
      }

      const res = await fetch('http://localhost:3001/api/ai/analyze-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoPath: vPath })
      });
      const data = await res.json();
      if (data.aiAnalysis) {
        setTrimmerAiInfo(data.aiAnalysis);
        updateCurrentVideoCuts({
          introCutTime: data.aiAnalysis.introCutTimestamp || 0,
          outroCutTime: data.aiAnalysis.outroCutSeconds || 0
        });
        if (data.aiAnalysis.introCutTimestamp > 0 && trimmerVideoRef.current) {
          trimmerVideoRef.current.currentTime = data.aiAnalysis.introCutTimestamp;
          setTrimmerCurrentTime(data.aiAnalysis.introCutTimestamp);
        }
      }
    } catch (e) {
      console.error('Error analizando con IA en trimmer:', e);
    } finally {
      setTrimmerAiLoading(false);
    }
  };

  const previewDeletedSegment = (seg) => {
    if (!trimmerVideoRef.current) return;
    trimmerVideoRef.current.currentTime = seg.start;
    setTrimmerCurrentTime(seg.start);
    trimmerVideoRef.current.play().then(() => setTrimmerPlaying(true)).catch(() => {});
  };


  const stepVideoTime = (delta) => {
    if (trimmerVideoRef.current) {
      const newTime = Math.max(0, Math.min(trimmerDuration, trimmerVideoRef.current.currentTime + delta));
      trimmerVideoRef.current.currentTime = newTime;
      setTrimmerCurrentTime(newTime);
    }
  };

  const previewCutSegment = () => {
    if (!trimmerVideoRef.current) return;
    const introCut = currentTrimmerCuts.introCutTime || 0;
    trimmerVideoRef.current.currentTime = introCut;
    setTrimmerCurrentTime(introCut);
    trimmerVideoRef.current.play();
  };

  // -------------------------------------------------------------
  // Live Studio Monitor (Drag & Drop Watermark Placement)
  // -------------------------------------------------------------
  const updateWatermarkPositionFromEvent = (e) => {
    if (!monitorCanvasRef.current) return;
    const rect = monitorCanvasRef.current.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);
    if (clientX === undefined || clientY === undefined) return;

    let xPct = Math.round(((clientX - rect.left) / rect.width) * 100);
    let yPct = Math.round(((clientY - rect.top) / rect.height) * 100);

    // Magnetic snap to center if within 3.5%
    if (Math.abs(xPct - 50) <= 3.5) xPct = 50;
    if (Math.abs(yPct - 50) <= 3.5) yPct = 50;

    setOptions(prev => ({
      ...prev,
      watermarkX: Math.max(2, Math.min(98, xPct)),
      watermarkY: Math.max(2, Math.min(98, yPct)),
      watermarkPosition: 'custom'
    }));
  };

  const handleMonitorMouseDown = (e) => {
    setIsDraggingWatermark(true);
    updateWatermarkPositionFromEvent(e);
  };

  const setPresetWatermarkPosition = (posKey, xPct, yPct) => {
    setOptions(prev => ({
      ...prev,
      watermarkPosition: posKey,
      watermarkX: xPct,
      watermarkY: yPct
    }));
  };

  const applyVisualPreset = (aspectRatio, speed, blurredBackground, copyTone) => {
    setOptions(prev => ({
      ...prev,
      aspectRatio,
      speed,
      blurredBackground,
      copyTone,
      speedMode: 'multiplier',
      autoAiVisionRules: true,
      generateCopy: true
    }));
  };

  const startBatchProcessing = async () => {
    if (batchVideos.length === 0) return;
    setActiveTab('process');
    setBatchProgress({
      running: true,
      currentIndex: 0,
      total: batchVideos.length,
      currentVideo: '',
      status: 'Verificando y preparando archivos locales para renderizado...',
      percentage: 3,
      elapsedSeconds: 0,
      etaSeconds: null,
      completed: false,
      errors: []
    });

    try {
      const processedVideos = [];
      for (const v of batchVideos) {
        let finalPath = v.path;
        if (v.fileObj) {
          setBatchProgress(prev => ({ ...prev, status: `Subiendo y preparando ${v.name}...` }));
          const uploadedPath = await uploadFileLocally(v.fileObj, v.name);
          if (uploadedPath) finalPath = uploadedPath;
        }
        processedVideos.push({ ...v, path: finalPath });
      }

      let watermarkFinalPath = selectedWatermark;
      if (watermarkFileObj) {
        setBatchProgress(prev => ({ ...prev, status: 'Preparando imagen de marca de agua...' }));
        const uploadedWm = await uploadFileLocally(watermarkFileObj, watermarkFileObj.name);
        if (uploadedWm) watermarkFinalPath = uploadedWm;
      }

      let introFinalPath = options.customIntroPath;
      if (introFileObj) {
        setBatchProgress(prev => ({ ...prev, status: 'Preparando vídeo de intro...' }));
        const uploadedIntro = await uploadFileLocally(introFileObj, introFileObj.name);
        if (uploadedIntro) introFinalPath = uploadedIntro;
      }

      let outroFinalPath = options.customOutroPath;
      if (outroFileObj) {
        setBatchProgress(prev => ({ ...prev, status: 'Preparando vídeo de outro...' }));
        const uploadedOutro = await uploadFileLocally(outroFileObj, outroFileObj.name);
        if (uploadedOutro) outroFinalPath = uploadedOutro;
      }

      await fetch('http://localhost:3001/api/batch/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videos: processedVideos,
          options: {
            ...options,
            watermarkEnabled: !!watermarkFinalPath && options.watermarkEnabled,
            watermarkPath: watermarkFinalPath,
            customIntroPath: introFinalPath,
            customOutroPath: outroFinalPath
          }
        })
      });
    } catch (err) {
      console.error('Error iniciando lote:', err);
      setBatchProgress(prev => ({
        ...prev,
        running: false,
        status: `⚠️ Error al iniciar lote: ${err.message}`
      }));
    }
  };

  const applyPreset = (preset) => {
    setOptions(prev => ({ ...prev, ...preset.options }));
  };

  // Helper formatters
  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds === null || seconds === undefined) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Current trimmer video info
  const currentTrimmerVideo = trimmerIndex !== null ? batchVideos[trimmerIndex] : null;
  const currentTrimmerCuts = currentTrimmerVideo?.customCuts || {
    introCutTime: options.introCutTime || 0,
    outroCutTime: options.outroCutTime || 0,
    speed: options.speed || 1.0,
    deletedSegments: []
  };

  // Net duration calculation considering intro, outro, and all middle deleted segments
  const totalDeletedSegmentsDuration = (currentTrimmerCuts.deletedSegments || []).reduce(
    (sum, seg) => sum + Math.max(0, seg.end - seg.start), 0
  );
  const trimmerNetDuration = Math.max(0, (trimmerDuration || 0) - (currentTrimmerCuts.introCutTime || 0) - (currentTrimmerCuts.outroCutTime || 0) - totalDeletedSegmentsDuration);

  // Filtered batch videos
  const filteredBatch = batchVideos.filter(v => 
    v.name.toLowerCase().includes(searchBatch.toLowerCase())
  );

  // Filtered explorer videos
  const filteredExplorer = (folderData.videos || []).filter(v =>
    v.name.toLowerCase().includes(searchExplorer.toLowerCase())
  );

  // Current preview video for Live Monitor
  const currentPreviewVideo = batchVideos[previewVideoIndex] || batchVideos[0] || null;

  // Frame class based on aspect ratio
  const getDeviceFrameClass = (ar) => {
    switch (ar) {
      case '9:16': return 'device-frame-phone';
      case '16:9': return 'device-frame-widescreen';
      case '1:1': return 'device-frame-square';
      case '4:5': return 'device-frame-portrait';
      default: return 'device-frame-widescreen';
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Studio Header Navigation Bar */}
      <header className="studio-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="brand-pill-icon">
            <Film size={24} color="#000" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 className="gradient-title" style={{ fontSize: '1.35rem' }}>BATCH VIDEO STUDIO AI</h1>
              <span className="badge-pill badge-purple" style={{ fontSize: '0.65rem' }}>v2.5 PRO</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-sub)' }}>
              Suite Profesional • Gemini 3.8 Flash Vision • Recorte NLE Multi-Segmento & Live Canvas
            </p>
          </div>
        </div>

        {/* Wizard Steps Navigation Pills */}
        <div className="nav-tab-container">
          <button className={`nav-tab-button ${activeTab === 'browse' ? 'active' : ''}`} onClick={() => setActiveTab('browse')}>
            <Folder size={16} /> 1. Lote ({batchVideos.length})
          </button>
          <button className={`nav-tab-button ${activeTab === 'rules' ? 'active' : ''}`} onClick={() => setActiveTab('rules')}>
            <Sliders size={16} /> 2. Formato, Tiempos & IA
          </button>
          <button className={`nav-tab-button ${activeTab === 'process' ? 'active' : ''}`} onClick={() => setActiveTab('process')}>
            <Play size={16} /> 3. Procesar & Resultados {batchCopys.length > 0 ? `(${batchCopys.length})` : ''}
          </button>
        </div>

        {/* Status Badges & Config Trigger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {configData.isConfigured ? (
            <button className="badge-pill badge-cyan" onClick={() => setShowConfigModal(true)} style={{ cursor: 'pointer', border: '1px solid rgba(0,242,254,0.4)' }} title="Gemini 3.8 Flash Activo para Visión y Copy">
              <Sparkles size={13} /> Gemini 3.8 Flash OK
            </button>
          ) : (
            <button className="badge-pill badge-amber" onClick={() => setShowConfigModal(true)} style={{ cursor: 'pointer' }} title="Conectar API Key">
              <Key size={13} /> Conectar Gemini API
            </button>
          )}

          {backendStatus.ffmpegAvailable && (
            <div className="badge-pill badge-green" title="Motor FFmpeg detectado en el sistema">
              <Zap size={13} /> FFmpeg OK
            </div>
          )}

          {/* Theme Selector Popover */}
          <div className="theme-picker-container" ref={themePickerRef}>
            <button 
              className="btn-outline" 
              style={{ padding: '7px 11px', display: 'inline-flex', alignItems: 'center', gap: '6px' }} 
              onClick={() => setShowThemePicker(prev => !prev)} 
              title="Cambiar tema de color de la suite"
            >
              <Palette size={16} color="var(--theme-primary)" />
              <span className="theme-color-indicator" style={{ background: 'var(--theme-primary)', width: 10, height: 10 }} />
            </button>

            {showThemePicker && (
              <div className="theme-picker-menu">
                <div style={{ fontSize: '0.68rem', color: 'var(--text-sub)', padding: '4px 8px', fontWeight: 700, textTransform: 'uppercase' }}>
                  Temas de Interfaz
                </div>
                {THEMES.map(th => (
                  <button
                    key={th.id}
                    className={`theme-picker-item ${currentTheme === th.id ? 'active' : ''}`}
                    onClick={() => {
                      setCurrentTheme(th.id);
                      setShowThemePicker(false);
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="theme-color-indicator" style={{ background: th.dot }} />
                      <span>{th.name}</span>
                    </div>
                    {currentTheme === th.id && <Check size={14} color="var(--theme-primary)" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button className="btn-outline" style={{ padding: '7px 11px' }} onClick={() => setShowConfigModal(true)} title="Ajustes de IA y Servidor">
            <Settings size={17} />
          </button>
        </div>
      </header>

      {/* Main Studio Workspace */}
      <main style={{ padding: '24px 28px', maxWidth: '1440px', width: '100%', margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        {/* ============================================================== */}
        {/* TAB 1: BATCH MANAGER & CINEMATIC MEDIA POOL                    */}
        {/* ============================================================== */}
        {activeTab === 'browse' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
            
            {/* Split Screen: File Explorer Left, Active Batch Right */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.25fr)', gap: '24px', alignItems: 'start' }}>
              
              {/* Left Column: Hero Dropzone & Explorer */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', minWidth: 0 }}>
                
                {/* Hero Drag & Drop Box */}
                <div 
                  className={`dropzone-hero ${isDragging ? 'dragging' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  style={{ padding: '32px 20px' }}
                >
                  <input type="file" ref={fileInputRef} onChange={handleFileInputChange} multiple accept="video/*" style={{ display: 'none' }} />
                  <div style={{ background: 'linear-gradient(135deg, rgba(0,242,254,0.18), rgba(139,92,246,0.22))', width: '56px', height: '56px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', boxShadow: '0 0 25px rgba(0,242,254,0.2)' }}>
                    <UploadCloud size={26} color="var(--accent-cyan)" />
                  </div>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '6px' }}>Arrastra aquí tus vídeos para el lote</h2>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>Soporta MP4, MOV, MKV, WebM • Clic para examinar archivos</p>
                </div>

                {/* Folder Breadcrumb Browser */}
                <div className="glass-card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FolderOpen size={17} color="var(--accent-cyan)" /> Explorador de Archivos
                    </h3>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-sub)' }}>{folderData.videos.length} vídeos</span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <input 
                      className="input-field" 
                      value={manualPath} 
                      onChange={e => setManualPath(e.target.value)} 
                      onKeyDown={e => e.key === 'Enter' && browseDirectory(manualPath)}
                      placeholder="Ruta local (ej: C:\Videos)..."
                      style={{ fontSize: '0.82rem' }}
                    />
                    <button className="btn-outline" onClick={() => browseDirectory(manualPath)} style={{ padding: '8px 12px', fontSize: '0.8rem' }}>Ir</button>
                    {folderData.parent && (
                      <button className="btn-outline" onClick={() => browseDirectory(folderData.parent)} style={{ padding: '8px 10px', fontSize: '0.8rem' }}>
                        <ArrowUp size={14} /> Subir
                      </button>
                    )}
                  </div>

                  {browseError && (
                    <div style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#fda4af', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '0.8rem' }}>
                      ⚠️ {browseError}
                    </div>
                  )}

                  {/* Subfolders badges */}
                  {folderData.folders.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px', maxHeight: '72px', overflowY: 'auto' }}>
                      {folderData.folders.map(f => (
                        <button key={f.path} onClick={() => browseDirectory(f.path)} className="btn-outline" style={{ padding: '4px 8px', fontSize: '0.72rem' }}>
                          📁 {f.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Filter and Add All Controls */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-muted)' }} />
                      <input 
                        className="input-field"
                        style={{ paddingLeft: 30, fontSize: '0.78rem', padding: '6px 10px 6px 30px' }}
                        placeholder="Filtrar en carpeta..."
                        value={searchExplorer}
                        onChange={e => setSearchExplorer(e.target.value)}
                      />
                    </div>
                    {filteredExplorer.length > 0 && (
                      <button className="btn-outline" style={{ padding: '6px 10px', fontSize: '0.74rem', color: 'var(--accent-cyan)', borderColor: 'rgba(0,242,254,0.35)', whiteSpace: 'nowrap' }} onClick={() => addVideosToBatch(filteredExplorer)}>
                        <Plus size={13} /> Añadir todos ({filteredExplorer.length})
                      </button>
                    )}
                  </div>

                  {/* Videos in current directory */}
                  <div style={{ display: 'grid', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                    {filteredExplorer.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        No se encontraron vídeos en esta carpeta.
                      </div>
                    ) : (
                      filteredExplorer.map(v => {
                        const inBatch = batchVideos.some(bv => bv.path === v.path);
                        return (
                          <div key={v.path} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '7px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)',
                            border: '1px solid var(--border-glass)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', overflow: 'hidden' }}>
                              <Film size={14} color="var(--accent-cyan)" style={{ flexShrink: 0 }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
                            </div>
                            <button className="btn-outline" style={{ padding: '3px 8px', fontSize: '0.7rem', flexShrink: 0 }} onClick={() => addVideosToBatch([v])} disabled={inBatch}>
                              {inBatch ? '✓ En Lote' : '+ Añadir'}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Active Batch List with Video-by-Video Quick Trim buttons */}
              <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Lista del Lote Activo ({batchVideos.length})</h3>
                    <p style={{ fontSize: '0.76rem', color: 'var(--text-sub)' }}>Ajusta cada vídeo visualmente, define recortes o elimina tramos</p>
                  </div>
                  {batchVideos.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button 
                        className="btn-outline" 
                        style={{ 
                          padding: '5px 10px', 
                          fontSize: '0.74rem', 
                          color: options.includeAudio === false ? '#fda4af' : 'var(--accent-cyan)',
                          borderColor: options.includeAudio === false ? 'rgba(244,63,94,0.35)' : 'rgba(0,242,254,0.3)',
                          background: options.includeAudio === false ? 'rgba(244,63,94,0.1)' : 'rgba(0,242,254,0.06)'
                        }} 
                        onClick={() => setOptions(prev => ({ ...prev, includeAudio: !prev.includeAudio }))}
                        title="Alternar inclusión de sonido para todo el lote"
                      >
                        {options.includeAudio === false ? <VolumeX size={13} /> : <Volume2 size={13} />}
                        {options.includeAudio === false ? 'Lote: Mudo' : 'Lote: Con Audio'}
                      </button>
                      <button className="btn-outline" style={{ color: 'var(--accent-rose)', padding: '5px 10px', fontSize: '0.74rem' }} onClick={clearBatch}>
                        <Trash2 size={13} /> Vaciar
                      </button>
                    </div>
                  )}
                </div>

                {batchVideos.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                      <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                      <input 
                        className="input-field" 
                        style={{ paddingLeft: 30, fontSize: '0.8rem', padding: '7px 10px 7px 30px' }}
                        placeholder="Buscar en el lote..." 
                        value={searchBatch} 
                        onChange={e => setSearchBatch(e.target.value)}
                      />
                    </div>
                    <button 
                      className="btn-glow" 
                      onClick={() => openTrimmer(0)} 
                      style={{ padding: '7px 14px', fontSize: '0.78rem', whiteSpace: 'nowrap', flexShrink: 0 }}
                      title="Abrir editor timeline NLE para cortar tramos"
                    >
                      <Scissors size={14} /> Editor Asistido
                    </button>
                  </div>
                )}

                {/* Batch list cards */}
                <div style={{ display: 'grid', gap: '8px', maxHeight: '430px', overflowY: 'auto', overflowX: 'hidden', flex: 1, marginBottom: '16px' }}>
                  {batchVideos.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
                      <div style={{ background: 'rgba(255,255,255,0.03)', width: '50px', height: '50px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                        <Film size={24} color="var(--text-muted)" />
                      </div>
                      <div>No hay vídeos agregados al lote.</div>
                      <div style={{ fontSize: '0.76rem', marginTop: '4px' }}>Arrastra archivos o añádelos desde el explorador a la izquierda.</div>
                    </div>
                  ) : (
                    filteredBatch.map((v, idx) => {
                      const hasCuts = v.customCuts && (v.customCuts.introCutTime > 0 || v.customCuts.outroCutTime > 0);
                      const hasSegments = v.customCuts?.deletedSegments && v.customCuts.deletedSegments.length > 0;
                      const originalIdx = batchVideos.indexOf(v);
                      const isVideoMuted = v.muteAudio !== undefined ? !!v.muteAudio : (options.includeAudio === false);

                      return (
                        <div key={v.path + idx} className="video-card-cine">
                          {/* Thumbnail / Slate Frame */}
                          <div className="video-card-thumb-box" onClick={() => setCinemaVideo(v)} title="Reproducir en pantalla cine">
                            <video 
                              src={getVideoSourceUrl(v)}
                              preload="metadata"
                              muted
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <div className="video-card-thumb-overlay">
                              <Play size={16} color="#fff" />
                            </div>
                            <div className="video-card-duration-tag">
                              #{originalIdx + 1}
                            </div>
                          </div>

                          {/* Info Column */}
                          <div className="video-card-cine-info">
                            <div className="video-card-cine-title" title={v.name}>
                              {v.name}
                            </div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '3px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-sub)' }}>
                                {v.size ? `${(v.size / (1024 * 1024)).toFixed(1)} MB` : 'Local'}
                              </span>
                              {hasCuts && (
                                <span className="badge-pill badge-cut" style={{ fontSize: '0.64rem', padding: '1px 5px' }}>
                                  ✂️ +{v.customCuts.introCutTime}s / -{v.customCuts.outroCutTime}s
                                </span>
                              )}
                              {hasSegments && (
                                <span className="badge-pill badge-amber" style={{ fontSize: '0.64rem', padding: '1px 5px' }}>
                                  ✂️ {v.customCuts.deletedSegments.length} tramos cortados
                                </span>
                              )}
                              {v.customCuts?.speed && v.customCuts.speed !== 1.0 && (
                                <span className="badge-pill badge-purple" style={{ fontSize: '0.64rem', padding: '1px 5px' }}>
                                  🚀 {v.customCuts.speed}x
                                </span>
                              )}
                              {isVideoMuted ? (
                                <span className="badge-pill" style={{ fontSize: '0.64rem', padding: '1px 6px', background: 'rgba(244,63,94,0.15)', color: '#fda4af', border: '1px solid rgba(244,63,94,0.3)' }} title="Pista de audio silenciada en este vídeo">
                                  🔇 Mudo
                                </span>
                              ) : (
                                <span className="badge-pill" style={{ fontSize: '0.64rem', padding: '1px 6px', background: 'rgba(0,242,254,0.08)', color: 'var(--accent-cyan)', border: '1px solid rgba(0,242,254,0.25)' }} title="Pista de audio activa">
                                  🔊 Audio
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons (Strictly Right Aligned, Never Cut Off) */}
                          <div className="video-card-cine-actions">
                            <button 
                              className="btn-outline" 
                              style={{ 
                                padding: '6px 8px', 
                                color: isVideoMuted ? '#fda4af' : 'var(--accent-cyan)',
                                background: isVideoMuted ? 'rgba(244,63,94,0.12)' : 'rgba(0,242,254,0.06)',
                                borderColor: isVideoMuted ? 'rgba(244,63,94,0.35)' : 'rgba(0,242,254,0.25)'
                              }} 
                              onClick={() => toggleVideoAudio(originalIdx)}
                              title={isVideoMuted ? "Audio silenciado en este vídeo (Clic para activar sonido)" : "Audio activo en este vídeo (Clic para silenciar)"}
                            >
                              {isVideoMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                            </button>
                            <button 
                              className="btn-outline" 
                              style={{ 
                                padding: '6px 8px', 
                                fontSize: '0.74rem',
                                background: (hasCuts || hasSegments) ? 'rgba(0,242,254,0.12)' : 'rgba(255,255,255,0.03)',
                                color: (hasCuts || hasSegments) ? 'var(--accent-cyan)' : 'inherit',
                                borderColor: (hasCuts || hasSegments) ? 'rgba(0,242,254,0.35)' : 'var(--border-glass)'
                              }} 
                              onClick={() => openTrimmer(originalIdx)}
                              title="Ajustar cortes de inicio, fin y eliminar segmentos intermedios"
                            >
                              <Scissors size={14} />
                            </button>
                            <button className="btn-outline" style={{ padding: '6px 8px' }} onClick={() => setCinemaVideo(v)} title="Reproductor de cine">
                              <Eye size={14} />
                            </button>
                            <button className="btn-outline" style={{ padding: '6px 8px', color: 'var(--accent-rose)' }} onClick={() => removeVideoFromBatch(v.path)} title="Quitar del lote">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

              </div>

            </div>

            {/* Bottom Wizard Navigation Footer */}
            <div className="wizard-footer-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="badge-pill badge-cyan" style={{ fontSize: '0.72rem' }}>Paso 1 de 3</span>
                <span style={{ fontSize: '0.84rem', color: 'var(--text-sub)' }}>
                  {batchVideos.length === 0 ? 'Agrega vídeos para comenzar el flujo' : `${batchVideos.length} vídeos preparados en el lote`}
                </span>
              </div>

              <button 
                className="btn-glow" 
                style={{ padding: '10px 22px', fontSize: '0.92rem' }}
                onClick={() => setActiveTab('rules')}
                disabled={batchVideos.length === 0}
              >
                Continuar al Paso 2: Formato, Tiempos & IA <ArrowRight size={17} />
              </button>
            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: LIVE STUDIO CANVAS & AI MASTER ENGINE                   */}
        {/* ============================================================== */}
        {activeTab === 'rules' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
            
            {/* Visual Quick Presets Bar */}
            <div className="glass-card" style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-cyan)', fontWeight: 700, fontSize: '0.82rem' }}>
                <Sparkles size={15} /> Presets Rápidos:
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
                <button 
                  className="btn-outline" 
                  onClick={() => applyVisualPreset('9:16', 1.25, true, 'Storytelling')}
                  style={{ fontSize: '0.76rem', padding: '5px 10px' }}
                >
                  📱 <strong>Reel / TikTok Viral</strong> (9:16 • Blur • 1.25x • Storytelling)
                </button>
                <button 
                  className="btn-outline" 
                  onClick={() => applyVisualPreset('16:9', 1.0, false, 'Educativo')}
                  style={{ fontSize: '0.76rem', padding: '5px 10px' }}
                >
                  💻 <strong>YouTube 16:9</strong> (Sin Blur • 1.0x • Educativo)
                </button>
                <button 
                  className="btn-outline" 
                  onClick={() => applyVisualPreset('4:5', 1.0, true, 'Profesional')}
                  style={{ fontSize: '0.76rem', padding: '5px 10px' }}
                >
                  💼 <strong>LinkedIn Executive</strong> (4:5 • Blur • 1.0x • Profesional)
                </button>
                <button 
                  className="btn-outline" 
                  onClick={() => applyVisualPreset('9:16', 2.0, true, 'Directo')}
                  style={{ fontSize: '0.76rem', padding: '5px 10px' }}
                >
                  ⚡ <strong>Speed Demo</strong> (9:16 • Blur • 2.0x • Directo)
                </button>
              </div>
            </div>

            {/* Split Screen: Live Studio Monitor on Left, Control Rack on Right */}
            <div style={{ display: 'grid', gridTemplateColumns: '460px minmax(0, 1fr)', gap: '24px' }}>
              
              {/* LEFT COLUMN: LIVE STUDIO MONITOR & WATERMARK BRANDING */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* 1. Live Studio Monitor Card */}
                <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '0.92rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Monitor size={16} color="var(--theme-primary)" /> Live Studio Monitor
                    </h3>
                    <span className="badge-pill badge-cyan" style={{ fontSize: '0.66rem' }}>
                      {options.aspectRatio} {options.blurredBackground ? '+ BLUR' : ''}
                    </span>
                  </div>

                  {/* Device Chassis Frame Simulator */}
                  <div className="studio-monitor-wrapper" style={{ width: '100%' }}>
                    <div 
                      ref={monitorCanvasRef}
                      className={getDeviceFrameClass(options.aspectRatio)}
                      onMouseDown={handleMonitorMouseDown}
                      title="Arrastra o haz clic en cualquier zona para ubicar el logo de marca de agua"
                    >
                      {/* Phone Notch/Speaker (only visible on 9:16 phone mockup) */}
                      {options.aspectRatio === '9:16' && <div className="device-notch" />}

                      {/* Simulated Blurred Video Backdrop */}
                      {options.blurredBackground && currentPreviewVideo && (
                        <div className="monitor-blur-backdrop">
                          <video 
                            src={getVideoSourceUrl(currentPreviewVideo)}
                            preload="metadata"
                            muted
                            playsInline
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                      )}

                      {/* Centered Crisp Video Frame */}
                      <div className="monitor-center-video">
                        {currentPreviewVideo ? (
                          <video 
                            src={getVideoSourceUrl(currentPreviewVideo)} 
                            preload="metadata"
                            muted
                            playsInline
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                          />
                        ) : (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '16px' }}>
                            Carga un vídeo para previsualizar el canvas
                          </div>
                        )}
                      </div>

                      {/* Magnetic Crosshair Guidelines */}
                      {isDraggingWatermark && (
                        <>
                          <div className="monitor-guideline-x" />
                          <div className="monitor-guideline-y" />
                        </>
                      )}

                      {/* Watermark Interactive Marker Overlay */}
                      {options.watermarkEnabled && (
                        <div 
                          className={`watermark-marker ${isDraggingWatermark ? 'dragging' : ''}`}
                          style={{
                            left: `${options.watermarkX}%`,
                            top: `${options.watermarkY}%`,
                            width: `${Math.max(34, Math.min(80, options.watermarkScale * 300))}px`,
                            height: `${Math.max(22, Math.min(55, options.watermarkScale * 200))}px`,
                            opacity: options.watermarkOpacity
                          }}
                        >
                          {selectedWatermark ? (
                            <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--theme-primary)' }}>LOGO</span>
                          ) : (
                            <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--theme-accent)' }}>MARCA</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Monitor Telemetry Readout */}
                    <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '0.72rem', color: 'var(--text-sub)', fontFamily: 'var(--font-mono)' }}>
                      <span>X: <strong style={{ color: 'var(--theme-primary)' }}>{options.watermarkX}%</strong></span>
                      <span>Y: <strong style={{ color: 'var(--theme-primary)' }}>{options.watermarkY}%</strong></span>
                      <span>Escala: <strong style={{ color: '#fff' }}>{(options.watermarkScale * 100).toFixed(0)}%</strong></span>
                      <span>Opac.: <strong style={{ color: '#fff' }}>{(options.watermarkOpacity * 100).toFixed(0)}%</strong></span>
                    </div>
                  </div>

                  {/* Clip Preview Switcher */}
                  {batchVideos.length > 1 && (
                    <div style={{ width: '100%', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-sub)', whiteSpace: 'nowrap' }}>Previsualizando:</span>
                      <select 
                        className="input-field" 
                        style={{ padding: '4px 8px', fontSize: '0.76rem' }}
                        value={previewVideoIndex}
                        onChange={e => setPreviewVideoIndex(parseInt(e.target.value))}
                      >
                        {batchVideos.map((bv, bIdx) => (
                          <option key={bv.path + bIdx} value={bIdx}>
                            #{bIdx + 1} - {bv.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Instant Alignment Position Chips */}
                  <div style={{ marginTop: '12px', width: '100%' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)', marginBottom: '5px', textAlign: 'center' }}>
                      Alineación Rápida con 1 Clic:
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
                      <button className="btn-outline" style={{ padding: '4px 6px', fontSize: '0.66rem', justifyContent: 'center' }} onClick={() => setPresetWatermarkPosition('top-left', 10, 10)}>↖ Sup.I</button>
                      <button className="btn-outline" style={{ padding: '4px 6px', fontSize: '0.66rem', justifyContent: 'center' }} onClick={() => setPresetWatermarkPosition('top-right', 90, 10)}>↗ Sup.D</button>
                      <button className="btn-outline" style={{ padding: '4px 6px', fontSize: '0.66rem', justifyContent: 'center' }} onClick={() => setPresetWatermarkPosition('center', 50, 50)}>⏺ Centro</button>
                      <button className="btn-outline" style={{ padding: '4px 6px', fontSize: '0.66rem', justifyContent: 'center' }} onClick={() => setPresetWatermarkPosition('bottom-left', 10, 90)}>↙ Inf.I</button>
                      <button className="btn-outline" style={{ padding: '4px 6px', fontSize: '0.66rem', justifyContent: 'center' }} onClick={() => setPresetWatermarkPosition('bottom-right', 86, 88)}>↘ Inf.D</button>
                    </div>
                  </div>

                </div>

                {/* 2. Watermark / Logo Configuration Card */}
                <div className="glass-card" style={{ padding: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '0.94rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Move size={17} color="var(--theme-primary)" /> Ajustes de Logo / Marca de Agua
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.74rem', color: options.watermarkEnabled ? 'var(--theme-primary)' : 'var(--text-muted)' }}>
                        {options.watermarkEnabled ? 'Activada' : 'Desactivada'}
                      </span>
                      <input 
                        type="checkbox" 
                        checked={options.watermarkEnabled} 
                        onChange={e => setOptions({ ...options, watermarkEnabled: e.target.checked })} 
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--theme-primary)' }} 
                      />
                    </div>
                  </div>

                  {/* Watermark File Upload Picker */}
                  <input 
                    type="file" 
                    ref={watermarkFileInputRef} 
                    onChange={e => {
                      const f = e.target.files[0];
                      if (f) {
                        setWatermarkFileObj(f);
                        setSelectedWatermark(f.path || f.name);
                      }
                    }} 
                    accept="image/*" 
                    style={{ display: 'none' }} 
                  />

                  <div 
                    onClick={() => watermarkFileInputRef.current && watermarkFileInputRef.current.click()}
                    style={{
                      border: '1px dashed var(--theme-badge-border)',
                      background: 'rgba(0, 0, 0, 0.25)',
                      borderRadius: '10px',
                      padding: '12px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      marginBottom: '14px',
                      fontSize: '0.8rem',
                      color: 'var(--theme-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {selectedWatermark ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0 4px' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '320px' }}>
                          ✓ Logo: {selectedWatermark}
                        </span>
                        <button 
                          className="btn-outline" 
                          style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedWatermark('');
                            setWatermarkFileObj(null);
                          }}
                          title="Quitar logo"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <FolderOpen size={16} /> Clic para seleccionar imagen de logo PNG transparente
                      </>
                    )}
                  </div>

                  {/* Watermark Scale and Opacity Sliders */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-sub)' }}>Escala del Logo</label>
                        <span style={{ fontSize: '0.72rem', color: 'var(--theme-primary)', fontFamily: 'var(--font-mono)' }}>{(options.watermarkScale * 100).toFixed(0)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.05" 
                        max="0.35" 
                        step="0.01" 
                        value={options.watermarkScale} 
                        onChange={e => setOptions({ ...options, watermarkScale: parseFloat(e.target.value) })} 
                        style={{ width: '100%' }} 
                      />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-sub)' }}>Opacidad</label>
                        <span style={{ fontSize: '0.72rem', color: 'var(--theme-primary)', fontFamily: 'var(--font-mono)' }}>{(options.watermarkOpacity * 100).toFixed(0)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.1" 
                        max="1.0" 
                        step="0.05" 
                        value={options.watermarkOpacity} 
                        onChange={e => setOptions({ ...options, watermarkOpacity: parseFloat(e.target.value) })} 
                        style={{ width: '100%' }} 
                      />
                    </div>
                  </div>

                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '6px' }}>
                    💡 Arrastra el marcador en el monitor arriba para posicionar el logo en cualquier lugar.
                  </div>
                </div>

              </div>

              {/* RIGHT: CONTROL RACK (ASPECT, SPEED, DURATION & AI) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
                
                {/* 1. Format & Canvas Aspect Ratio */}
                <div className="glass-card" style={{ padding: '18px' }}>
                  <h3 style={{ fontSize: '0.94rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Layers size={17} color="var(--accent-cyan)" /> Formato de Salida & Lienzo
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '6px', marginBottom: '14px' }}>
                    {[
                      { id: '9:16', label: '9:16', desc: 'Reels / TikTok' },
                      { id: '16:9', label: '16:9', desc: 'YouTube HD' },
                      { id: '1:1', label: '1:1', desc: 'Instagram Feed' },
                      { id: '4:5', label: '4:5', desc: 'Retrato LinkedIn' },
                      { id: 'original', label: 'Original', desc: 'Sin cambios' }
                    ].map(ar => (
                      <button
                        key={ar.id}
                        className={`btn-outline ${options.aspectRatio === ar.id ? 'badge-cyan' : ''}`}
                        onClick={() => setOptions({ ...options, aspectRatio: ar.id })}
                        style={{ flexDirection: 'column', padding: '8px 4px', textAlign: 'center', borderColor: options.aspectRatio === ar.id ? 'var(--accent-cyan)' : 'var(--border-glass)' }}
                      >
                        <span style={{ fontWeight: 800, fontSize: '0.88rem' }}>{ar.label}</span>
                        <span style={{ fontSize: '0.66rem', color: 'var(--text-sub)' }}>{ar.desc}</span>
                      </button>
                    ))}
                  </div>

                  {options.aspectRatio !== 'original' && (
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(0,242,254,0.04)', borderRadius: '8px', border: '1px solid rgba(0,242,254,0.18)', cursor: 'pointer' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>Rellenar con Fondo Desenfocado (Blur)</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-sub)' }}>Crea un fondo difuminado suave en lugar de barras negras</div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={options.blurredBackground} 
                        onChange={e => setOptions({ ...options, blurredBackground: e.target.checked })}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                    </label>
                  )}
                </div>

                {/* 2. Speed & Target Duration Controls (RESTORED COMPLETE CONTROLS) */}
                <div className="glass-card" style={{ padding: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '0.94rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Gauge size={17} color="var(--accent-blue)" /> Velocidad & Duración de los Vídeos
                    </h3>
                  </div>

                  {/* Mode Selector Toggle */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                    <button
                      className={`btn-outline ${options.speedMode === 'multiplier' ? 'badge-cyan' : ''}`}
                      onClick={() => setOptions({ ...options, speedMode: 'multiplier' })}
                      style={{ justifyContent: 'center', padding: '8px 12px', fontWeight: 700 }}
                    >
                      🚀 Multiplicador Libre
                    </button>
                    <button
                      className={`btn-outline ${options.speedMode === 'targetDuration' ? 'badge-cyan' : ''}`}
                      onClick={() => setOptions({ ...options, speedMode: 'targetDuration' })}
                      style={{ justifyContent: 'center', padding: '8px 12px', fontWeight: 700 }}
                    >
                      ⏱️ Duración Exacta Objetivo
                    </button>
                  </div>

                  {/* Multiplier Mode Controls */}
                  {options.speedMode === 'multiplier' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.74rem', color: 'var(--text-sub)', display: 'block', marginBottom: '4px' }}>
                            Multiplicador Numérico (ej: 1.0 = normal, 1.25 = +25% vel.)
                          </label>
                          <input 
                            type="number" 
                            step="0.05"
                            min="0.1"
                            max="20.0"
                            className="input-field" 
                            value={options.speed} 
                            onChange={e => setOptions({ ...options, speed: parseFloat(e.target.value) || 1.0 })}
                            style={{ fontWeight: 800, color: 'var(--accent-cyan)', fontSize: '1rem' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0].map(s => (
                          <button 
                            key={s} 
                            className={`btn-outline ${options.speed === s ? 'badge-cyan' : ''}`}
                            style={{ padding: '4px 8px', fontSize: '0.74rem', flex: 1 }}
                            onClick={() => setOptions({ ...options, speed: s })}
                          >
                            {s}x
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Target Duration Mode Controls (RESTORED AS REQUESTED) */}
                  {options.speedMode === 'targetDuration' && (
                    <div style={{ background: 'rgba(0, 242, 254, 0.05)', border: '1px solid rgba(0, 242, 254, 0.25)', padding: '14px', borderRadius: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                          Duración Objetivo Exacta (en segundos)
                        </label>
                        <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: '#fff' }}>
                          {options.targetDurationSeconds}s ({formatTime(options.targetDurationSeconds)})
                        </span>
                      </div>
                      <input 
                        type="number" 
                        min="2"
                        max="3600"
                        className="input-field" 
                        value={options.targetDurationSeconds} 
                        onChange={e => setOptions({ ...options, targetDurationSeconds: parseInt(e.target.value) || 30 })}
                        style={{ fontWeight: 800, color: 'var(--accent-cyan)', fontSize: '1.15rem' }}
                      />
                      <p style={{ fontSize: '0.74rem', color: 'var(--text-sub)', marginTop: '8px', lineHeight: 1.4 }}>
                        ⚡ FFmpeg calculará la aceleración o ralentización matemática necesaria para que cada vídeo dure exactamente {options.targetDurationSeconds} segundos.
                      </p>
                    </div>
                  )}

                </div>

                {/* 3. Audio & Sound Export Controls */}
                <div className="glass-card" style={{ padding: '18px' }}>
                  <h3 style={{ fontSize: '0.94rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {options.includeAudio !== false ? <Volume2 size={17} color="var(--accent-cyan)" /> : <VolumeX size={17} color="var(--accent-rose)" />}
                    Pista de Audio & Sonido de Exportación
                  </h3>

                  {/* Master Audio Toggle */}
                  <label style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '12px 14px', 
                    background: options.includeAudio !== false ? 'rgba(0,242,254,0.04)' : 'rgba(244,63,94,0.07)', 
                    borderRadius: '8px', 
                    border: options.includeAudio !== false ? '1px solid rgba(0,242,254,0.2)' : '1px solid rgba(244,63,94,0.3)', 
                    cursor: 'pointer',
                    marginBottom: options.includeAudio !== false ? '10px' : '0px'
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.86rem', color: options.includeAudio !== false ? '#fff' : '#fda4af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {options.includeAudio !== false ? '🔊 Exportar Vídeos con Pista de Audio' : '🔇 Exportar Vídeos Silenciados (Mudos)'}
                      </div>
                      <div style={{ fontSize: '0.73rem', color: 'var(--text-sub)', marginTop: '2px' }}>
                        {options.includeAudio !== false 
                          ? 'Los vídeos conservarán su sonido y música. Puedes silenciar vídeos individuales en la lista del Paso 1.' 
                          : 'Todos los vídeos del lote se exportarán sin sonido (-an). Puedes reactivar audio en vídeos específicos en el Paso 1.'}
                      </div>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={options.includeAudio !== false} 
                      onChange={e => setOptions({ ...options, includeAudio: e.target.checked })}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                  </label>

                  {/* Audio Normalization Check (Only shown if audio is enabled) */}
                  {options.includeAudio !== false && (
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-glass)', cursor: 'pointer' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>Normalización de Audio EBU R128 (-16 LUFS)</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)' }}>Estandariza volumen para que no suene saturado ni bajo</div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={options.normalizeAudio} 
                        onChange={e => setOptions({ ...options, normalizeAudio: e.target.checked })} 
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                    </label>
                  )}
                </div>

                {/* 3. Global Trimming & Renaming Pattern */}
                <div className="glass-card" style={{ padding: '18px' }}>
                  <h3 style={{ fontSize: '0.94rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Scissors size={17} color="var(--accent-rose)" /> Recortes Globales del Lote
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-sub)', display: 'block', marginBottom: '4px' }}>
                        Recorte de Inicio Global (segundos)
                      </label>
                      <input 
                        type="number"
                        step="0.1"
                        min="0"
                        className="input-field"
                        value={options.introCutTime}
                        onChange={e => setOptions({ ...options, introCutTime: parseFloat(e.target.value) || 0 })}
                        placeholder="0.0s"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-sub)', display: 'block', marginBottom: '4px' }}>
                        Recorte de Fin Global (segundos)
                      </label>
                      <input 
                        type="number"
                        step="0.1"
                        min="0"
                        className="input-field"
                        value={options.outroCutTime}
                        onChange={e => setOptions({ ...options, outroCutTime: parseFloat(e.target.value) || 0 })}
                        placeholder="0.0s"
                      />
                    </div>
                  </div>

                  {/* Auto AI Vision Trimming Rules */}
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(139, 92, 246, 0.08)', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.25)', cursor: 'pointer' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#c084fc' }}>Auto-recorte con Gemini 3.8 Flash Vision</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)' }}>Escanea fotogramas para omitir placas de título y outros automáticamente</div>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={options.autoAiVisionRules} 
                      onChange={e => setOptions({ ...options, autoAiVisionRules: e.target.checked })} 
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                  </label>
                </div>

                {/* 4. LinkedIn Copywriting Engine */}
                <div className="glass-card" style={{ padding: '18px', border: '1px solid rgba(0, 242, 254, 0.3)', background: 'radial-gradient(ellipse at top left, rgba(0, 242, 254, 0.08) 0%, rgba(13, 20, 36, 0.9) 100%)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Sparkles size={17} color="var(--accent-cyan)" />
                      <div>
                        <h3 style={{ fontSize: '0.94rem', fontWeight: 700 }}>Extraer Post para LinkedIn con Visión IA</h3>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-sub)' }}>Gemini 3.8 Flash analiza el metraje procesado y redacta el post</p>
                      </div>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={options.generateCopy} 
                      onChange={e => setOptions({ ...options, generateCopy: e.target.checked })} 
                      style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                    />
                  </div>

                  {options.generateCopy && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-glass)' }}>
                      <div>
                        <label style={{ fontSize: '0.74rem', color: 'var(--text-sub)', display: 'block', marginBottom: '5px' }}>Tono de Redacción para LinkedIn</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                          {['Profesional', 'Storytelling', 'Educativo', 'Directo'].map(t => (
                            <button
                              key={t}
                              className={`btn-outline ${options.copyTone === t ? 'badge-cyan' : ''}`}
                              onClick={() => setOptions({ ...options, copyTone: t })}
                              style={{ padding: '5px 6px', fontSize: '0.7rem', justifyContent: 'center' }}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={options.saveCopyTxt} 
                          onChange={e => setOptions({ ...options, saveCopyTxt: e.target.checked })} 
                          style={{ width: '16px', height: '16px' }}
                        />
                        <span>Guardar archivo <code>.txt</code> con el copy junto a cada vídeo generado</span>
                      </label>
                    </div>
                  )}
                </div>

              </div>

            </div>

            {/* Bottom Wizard Navigation Footer */}
            <div className="wizard-footer-bar">
              <button 
                className="btn-outline" 
                onClick={() => setActiveTab('browse')}
                style={{ padding: '10px 18px', fontSize: '0.88rem' }}
              >
                <ArrowLeft size={16} /> Volver al Paso 1: Lote
              </button>

              <button 
                className="btn-glow" 
                style={{ padding: '10px 22px', fontSize: '0.92rem' }}
                onClick={() => setActiveTab('process')}
              >
                Continuar al Paso 3: Renderizado & Copys <ArrowRight size={17} />
              </button>
            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: PROCESSING TELEMETRY & RESULTS GALLERY                  */}
        {/* ============================================================== */}
        {activeTab === 'process' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '24px' }}>
              
              {/* Main Center Area: Processing Console & Copys Gallery */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
                
                {/* Progress & Telemetry Console Card */}
                <div className="glass-card" style={{ padding: '22px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {batchProgress.completed ? (
                        <><CheckCircle2 size={22} color="#34d399" /> Lote Finalizado con Éxito</>
                      ) : batchProgress.running ? (
                        <><RefreshCw className="spin" size={20} color="var(--accent-cyan)" /> Procesando Vídeos en Alta Fidelidad...</>
                      ) : (
                        <><Gauge size={20} color="var(--accent-cyan)" /> Panel de Renderizado</>
                      )}
                    </h2>
                    {outputFolder && (
                      <button className="btn-outline" style={{ fontSize: '0.76rem', padding: '6px 12px' }} onClick={openOutputFolderInExplorer}>
                        <FolderCheck size={15} color="#34d399" /> Abrir Carpeta de Salida
                      </button>
                    )}
                  </div>

                  {/* Telemetry Metric Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-sub)', textTransform: 'uppercase' }}>Tiempo Transcurrido</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#fff', marginTop: '3px' }}>
                        {formatTime(batchProgress.elapsedSeconds)}
                      </div>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-sub)', textTransform: 'uppercase' }}>Tiempo Restante (ETA)</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', marginTop: '3px' }}>
                        {batchProgress.etaSeconds !== null ? `~${formatTime(batchProgress.etaSeconds)}` : 'Calculando...'}
                      </div>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-sub)', textTransform: 'uppercase' }}>Vídeos en Cola</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#fff', marginTop: '3px' }}>
                        {batchProgress.currentIndex} / {batchProgress.total || batchVideos.length}
                      </div>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-sub)', textTransform: 'uppercase' }}>Progreso Total</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#38bdf8', marginTop: '3px' }}>
                        {batchProgress.percentage}%
                      </div>
                    </div>
                  </div>

                  {/* Main Progress Bar */}
                  <div style={{ width: '100%', height: '10px', background: 'rgba(0,0,0,0.45)', borderRadius: '6px', overflow: 'hidden', marginBottom: '14px' }}>
                    <div style={{ 
                      width: `${batchProgress.percentage}%`, 
                      height: '100%', 
                      background: 'linear-gradient(90deg, var(--accent-indigo), var(--accent-cyan))', 
                      boxShadow: '0 0 15px rgba(0, 242, 254, 0.5)',
                      transition: 'width 0.35s ease' 
                    }} />
                  </div>

                  {/* Console Log Message */}
                  <div style={{ background: 'rgba(0,0,0,0.35)', padding: '12px 16px', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#93c5fd', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div>▸ Estado: {batchProgress.status || 'Listo para procesar el lote.'}</div>
                    {batchProgress.currentVideo && <div style={{ marginTop: '4px', color: '#38bdf8' }}>▸ Renderizando: {batchProgress.currentVideo}</div>}
                  </div>

                  {!batchProgress.running && (
                    <button 
                      className="btn-glow" 
                      onClick={startBatchProcessing} 
                      disabled={batchVideos.length === 0} 
                      style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '1rem' }}
                    >
                      <Play size={17} /> Iniciar Procesamiento de {batchVideos.length} Vídeos
                    </button>
                  )}

                  {/* Error Log */}
                  {batchProgress.errors && batchProgress.errors.length > 0 && (
                    <div style={{ marginTop: '14px', background: 'rgba(244, 63, 94, 0.12)', border: '1px solid rgba(244, 63, 94, 0.3)', padding: '12px', borderRadius: '8px' }}>
                      <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fda4af', marginBottom: '5px' }}>
                        ⚠️ Errores ({batchProgress.errors.length}):
                      </h4>
                      <div style={{ display: 'grid', gap: '4px', maxHeight: '90px', overflowY: 'auto', fontSize: '0.76rem', fontFamily: 'var(--font-mono)', color: '#fca5a5' }}>
                        {batchProgress.errors.map((err, idx) => (
                          <div key={idx} style={{ padding: '4px 6px', borderRadius: '4px', background: 'rgba(0,0,0,0.2)' }}>
                            <strong>{err.videoName}:</strong> {err.error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* POST-PROCESSING RESULTS & COPYS GALLERY */}
                {batchCopys.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Sparkles size={17} color="var(--accent-cyan)" /> Copys Generados con Gemini 3.8 Flash ({batchCopys.length})
                        </h3>
                        <p style={{ fontSize: '0.76rem', color: 'var(--text-sub)' }}>
                          Listos para publicar. Puedes editarlos en vivo o regenerarlos con otro tono.
                        </p>
                      </div>

                      <button className="btn-outline" onClick={exportAllCopysText} style={{ fontSize: '0.8rem' }}>
                        <Download size={14} /> Exportar Todos (.TXT)
                      </button>
                    </div>

                    <div style={{ display: 'grid', gap: '16px' }}>
                      {batchCopys.map((item, idx) => {
                        const charCount = item.copy ? item.copy.length : 0;
                        const wordCount = item.copy ? item.copy.trim().split(/\s+/).length : 0;
                        const isOptimalLength = charCount >= 700 && charCount <= 1400;

                        return (
                          <div key={item.videoPath + idx} className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ fontWeight: 700, color: 'var(--accent-cyan)', fontSize: '0.9rem' }}>
                                  #{idx + 1} - {item.videoName}
                                </div>
                                {item.aiGenerated && (
                                  <span className="badge-pill badge-purple" style={{ fontSize: '0.66rem' }}>
                                    ✨ Gemini 3.8 Flash
                                  </span>
                                )}
                              </div>

                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button className="btn-outline" style={{ padding: '4px 9px', fontSize: '0.76rem' }} onClick={() => copySingleToClipboard(item.copy, idx)}>
                                  {copiedIndex === idx ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
                                  {copiedIndex === idx ? '¡Copiado!' : 'Copiar Post'}
                                </button>
                                <button className="btn-outline" style={{ padding: '4px 9px', fontSize: '0.76rem' }} onClick={() => setCinemaVideo({ name: item.videoName, path: item.videoPath })}>
                                  <Eye size={13} /> Ver Vídeo
                                </button>
                              </div>
                            </div>

                            {/* Character metrics & Tone regenerator */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.25)', padding: '7px 10px', borderRadius: '6px', fontSize: '0.74rem' }}>
                              <div style={{ display: 'flex', gap: '10px', fontFamily: 'var(--font-mono)' }}>
                                <span>Caracteres: <strong style={{ color: isOptimalLength ? '#34d399' : '#fff' }}>{charCount}</strong></span>
                                <span>Palabras: <strong>{wordCount}</strong></span>
                                {isOptimalLength && <span style={{ color: '#34d399' }}>✓ Rango óptimo LinkedIn</span>}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span style={{ color: 'var(--text-sub)' }}>Regenerar tono:</span>
                                {['Storytelling', 'Educativo', 'Directo'].map(t => (
                                  <button
                                    key={t}
                                    className="btn-outline"
                                    style={{ padding: '2px 7px', fontSize: '0.68rem' }}
                                    onClick={() => regenerateSingleCopy(idx, t)}
                                    disabled={regeneratingIndex === idx}
                                  >
                                    {regeneratingIndex === idx ? <RefreshCw className="spin" size={10} /> : t}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {item.summary && (
                              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '7px 10px', borderRadius: '6px', fontSize: '0.76rem', color: '#94a3b8' }}>
                                <strong>Visión IA:</strong> {item.summary}
                              </div>
                            )}

                            <textarea 
                              className="input-field" 
                              rows={8} 
                              value={item.copy}
                              onChange={e => {
                                const updated = [...batchCopys];
                                updated[idx].copy = e.target.value;
                                setBatchCopys(updated);
                              }}
                              style={{ lineHeight: 1.5, fontSize: '0.82rem' }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>

              {/* Right Sidebar: Summary & Presets Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="glass-card" style={{ padding: '18px' }}>
                  <h3 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '10px' }}>Resumen del Trabajo</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                    <div>▸ Vídeos en cola: <strong style={{ color: '#fff' }}>{batchVideos.length}</strong></div>
                    <div>▸ Formato: <strong style={{ color: '#fff' }}>{options.aspectRatio} {options.blurredBackground ? '(Blur)' : ''}</strong></div>
                    <div>▸ Modo velocidad: <strong style={{ color: '#fff' }}>{options.speedMode === 'multiplier' ? `${options.speed}x` : `${options.targetDurationSeconds}s`}</strong></div>
                    <div>▸ Recorte IA: <strong style={{ color: '#fff' }}>{options.autoAiVisionRules ? 'Gemini 3.8 Flash' : 'Manual'}</strong></div>
                    <div>▸ Generar Copy: <strong style={{ color: options.generateCopy ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>{options.generateCopy ? `Sí (${options.copyTone})` : 'No'}</strong></div>
                  </div>
                </div>

                <div className="glass-card" style={{ padding: '18px' }}>
                  <h3 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '10px' }}>Presets Guardados</h3>
                  <div style={{ display: 'grid', gap: '6px' }}>
                    {presets.map(p => (
                      <div key={p.id} onClick={() => applyPreset(p)} style={{
                        padding: '8px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', cursor: 'pointer', transition: 'all 0.2s'
                      }}>
                        <div style={{ fontWeight: 700, fontSize: '0.8rem', marginBottom: '2px' }}>{p.name}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-sub)' }}>
                          {p.options.aspectRatio} • {p.options.generateCopy ? 'Con Copy' : 'Sin Copy'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>

            {/* Bottom Wizard Navigation Footer */}
            <div className="wizard-footer-bar">
              <button 
                className="btn-outline" 
                onClick={() => setActiveTab('rules')}
                style={{ padding: '10px 18px', fontSize: '0.88rem' }}
              >
                <ArrowLeft size={16} /> Volver al Paso 2: Opciones
              </button>

              {outputFolder && (
                <button 
                  className="btn-glow" 
                  style={{ padding: '10px 22px', fontSize: '0.92rem' }}
                  onClick={openOutputFolderInExplorer}
                >
                  <FolderCheck size={16} /> Ver Vídeos en Carpeta de Salida
                </button>
              )}
            </div>

          </div>
        )}

      </main>

      {/* ============================================================== */}
      {/* QUICK TRIM STUDIO MODAL (NLE MULTI-SEGMENT TRIMMER)            */}
      {/* ============================================================== */}
      {trimmerIndex !== null && currentTrimmerVideo && (
        <div className="cinema-modal-overlay" onClick={closeTrimmer}>
          <div className="trimmer-modal-content" onClick={e => e.stopPropagation()} style={{ padding: '22px' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid var(--border-glass)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'rgba(0, 242, 254, 0.2)', padding: '4px 9px', borderRadius: '6px', color: 'var(--accent-cyan)', fontWeight: 800, fontSize: '0.8rem' }}>
                  Vídeo {trimmerIndex + 1} de {batchVideos.length}
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{currentTrimmerVideo.name}</h3>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="btn-outline" style={{ padding: '4px 9px', fontSize: '0.76rem' }} onClick={() => setTrimmerIndex(Math.max(0, trimmerIndex - 1))} disabled={trimmerIndex === 0}>
                  <ChevronLeft size={14} /> Anterior
                </button>
                <button className="btn-outline" style={{ padding: '4px 9px', fontSize: '0.76rem' }} onClick={() => setTrimmerIndex(Math.min(batchVideos.length - 1, trimmerIndex + 1))} disabled={trimmerIndex === batchVideos.length - 1}>
                  Siguiente <ChevronRight size={14} />
                </button>
                <button className="btn-outline" style={{ padding: '4px 7px' }} onClick={closeTrimmer}>
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Dynamic Video Player Display with Center Play Icon & Real-time HUD */}
            <div 
              style={{ 
                background: '#040711', 
                borderRadius: '10px', 
                overflow: 'hidden', 
                marginBottom: '14px', 
                maxHeight: '340px', 
                display: 'flex', 
                justifyContent: 'center',
                alignItems: 'center',
                position: 'relative',
                border: '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
                boxShadow: 'inset 0 0 40px rgba(0,0,0,0.8)'
              }}
              onClick={toggleTrimmerPlay}
            >
              <video 
                ref={trimmerVideoRef}
                controls={false}
                src={getVideoSourceUrl(currentTrimmerVideo)}
                style={{ maxHeight: '340px', maxWidth: '100%', display: 'block' }}
                onTimeUpdate={e => {
                  const t = e.target.currentTime;
                  setTrimmerCurrentTime(t);

                  // Automatic jump-cut: if head hits a deleted segment, jump forward to segment end!
                  const delSegs = currentTrimmerCuts.deletedSegments || [];
                  for (const seg of delSegs) {
                    if (t >= seg.start && t < seg.end) {
                      e.target.currentTime = seg.end;
                      setTrimmerCurrentTime(seg.end);
                      return;
                    }
                  }

                  // Outro cut automatic pause
                  const outroCut = currentTrimmerCuts.outroCutTime || 0;
                  if (outroCut > 0 && trimmerDuration > 0 && t >= (trimmerDuration - outroCut)) {
                    e.target.pause();
                  }
                }}
                onLoadedMetadata={e => setTrimmerDuration(e.target.duration)}
                onPlay={() => setTrimmerPlaying(true)}
                onPause={() => setTrimmerPlaying(false)}
              />

              {/* Center Glassmorphic Play/Pause Overlay */}
              {!trimmerPlaying && (
                <div style={{
                  position: 'absolute',
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(0, 0, 0, 0.65)',
                  backdropFilter: 'blur(8px)',
                  border: '2px solid rgba(255, 255, 255, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.7), 0 0 20px rgba(56, 189, 248, 0.4)',
                  pointerEvents: 'none'
                }}>
                  <Play size={28} style={{ marginLeft: '4px', fill: '#fff' }} />
                </div>
              )}

              {/* Status HUD Badge */}
              <div style={{
                position: 'absolute',
                top: '10px',
                left: '12px',
                background: 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(6px)',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                color: '#cbd5e1',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                pointerEvents: 'none',
                border: '1px solid rgba(255,255,255,0.08)'
              }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: trimmerPlaying ? '#10b981' : '#f59e0b', boxShadow: trimmerPlaying ? '0 0 6px #10b981' : 'none' }} />
                {trimmerPlaying ? 'Reproduciendo' : 'Pausado (Espacio o Clic para reproducir)'}
              </div>

              {/* Timecode HUD Badge */}
              <div style={{
                position: 'absolute',
                bottom: '10px',
                right: '12px',
                background: 'rgba(0,0,0,0.8)',
                backdropFilter: 'blur(6px)',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--accent-cyan)',
                fontWeight: 700,
                pointerEvents: 'none',
                border: '1px solid rgba(0, 242, 254, 0.2)'
              }}>
                ⏱️ {trimmerCurrentTime.toFixed(2)}s / {(trimmerDuration || 0).toFixed(2)}s
              </div>
            </div>

            {/* NLE Timeline Track with Filmstrip & Visual Cut Zones */}
            <div style={{ background: 'rgba(0,0,0,0.4)', padding: '14px', borderRadius: '10px', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
                  ⏱️ Cabezal: {trimmerCurrentTime.toFixed(2)}s / {(trimmerDuration || 0).toFixed(2)}s
                </span>
                <span style={{ color: 'var(--text-sub)' }}>
                  Duración Neta Conservada: <strong style={{ color: '#34d399' }}>{trimmerNetDuration.toFixed(2)}s</strong>
                </span>
              </div>

              {/* Multi-zone Timeline Bar with Visual Filmstrip Storyboard */}
              <div 
                className="timeline-track-container" 
                style={{ 
                  marginBottom: '10px', 
                  position: 'relative', 
                  height: '68px',
                  borderRadius: '8px', 
                  overflow: 'hidden',
                  background: '#090d16',
                  border: '1px solid rgba(255,255,255,0.15)',
                  cursor: 'pointer'
                }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
                  const pct = x / rect.width;
                  const t = pct * (trimmerDuration || 1);
                  setTrimmerHoverTime(t);
                  setTrimmerHoverX(x);
                }}
                onMouseLeave={() => {
                  setTrimmerHoverTime(null);
                  setTrimmerHoverX(null);
                }}
              >
                {/* Visual Filmstrip Thumbnails Ribbon */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', opacity: 0.75, pointerEvents: 'none' }}>
                  {trimmerFilmstrip.length > 0 ? (
                    trimmerFilmstrip.map((frame, fIdx) => (
                      <div 
                        key={fIdx} 
                        style={{ 
                          flex: 1, 
                          height: '100%', 
                          backgroundImage: `url(${frame.dataUrl})`, 
                          backgroundSize: 'cover', 
                          backgroundPosition: 'center',
                          borderRight: '1px solid rgba(0,0,0,0.5)',
                          position: 'relative'
                        }}
                      >
                        <span style={{ position: 'absolute', bottom: 2, right: 3, fontSize: '0.6rem', color: 'rgba(255,255,255,0.8)', background: 'rgba(0,0,0,0.65)', padding: '0 3px', borderRadius: '2px', fontFamily: 'var(--font-mono)' }}>
                          {frame.timestamp.toFixed(1)}s
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-sub)', fontSize: '0.74rem' }}>
                      {trimmerFilmstripLoading ? '🎞️ Extrayendo fotogramas de referencia para el timeline...' : '🎞️ Pista de vídeo visual'}
                    </div>
                  )}
                </div>

                {/* Intro cut zone */}
                {currentTrimmerCuts.introCutTime > 0 && trimmerDuration > 0 && (
                  <div 
                    className="timeline-zone-cut" 
                    style={{ 
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${Math.min(100, (currentTrimmerCuts.introCutTime / trimmerDuration) * 100)}%`,
                      background: 'repeating-linear-gradient(45deg, rgba(239, 68, 68, 0.45), rgba(239, 68, 68, 0.45) 8px, rgba(185, 28, 28, 0.55) 8px, rgba(185, 28, 28, 0.55) 16px)',
                      borderRight: '2px solid #ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                      zIndex: 2,
                      pointerEvents: 'none'
                    }}
                  >
                    ✂️ Intro ({currentTrimmerCuts.introCutTime.toFixed(1)}s)
                  </div>
                )}

                {/* Middle Deleted Segments */}
                {(currentTrimmerCuts.deletedSegments || []).map(seg => {
                  if (!trimmerDuration) return null;
                  const leftPct = (seg.start / trimmerDuration) * 100;
                  const widthPct = ((seg.end - seg.start) / trimmerDuration) * 100;
                  return (
                    <div 
                      key={seg.id}
                      style={{ 
                        position: 'absolute',
                        left: `${leftPct}%`, 
                        width: `${widthPct}%`,
                        top: 0,
                        bottom: 0,
                        background: 'repeating-linear-gradient(45deg, rgba(192, 132, 252, 0.5), rgba(192, 132, 252, 0.5) 6px, rgba(147, 51, 234, 0.6) 6px, rgba(147, 51, 234, 0.6) 12px)',
                        borderLeft: '2px solid #a855f7',
                        borderRight: '2px solid #a855f7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                        zIndex: 3,
                        pointerEvents: 'none'
                      }}
                      title={`Tramo omitido: ${seg.start}s a ${seg.end}s`}
                    >
                      ✂️ {(seg.end - seg.start).toFixed(1)}s
                    </div>
                  );
                })}

                {/* Active kept zone */}
                {trimmerDuration > 0 && (
                  <div 
                    className="timeline-zone-active"
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: `${(currentTrimmerCuts.introCutTime / trimmerDuration) * 100}%`,
                      width: `${Math.max(0, ((trimmerDuration - currentTrimmerCuts.introCutTime - currentTrimmerCuts.outroCutTime) / trimmerDuration) * 100)}%`,
                      background: 'rgba(16, 185, 129, 0.2)',
                      borderLeft: currentTrimmerCuts.introCutTime > 0 ? '2px solid #10b981' : 'none',
                      borderRight: currentTrimmerCuts.outroCutTime > 0 ? '2px solid #10b981' : 'none',
                      boxShadow: 'inset 0 0 14px rgba(16, 185, 129, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#34d399',
                      fontWeight: 800,
                      fontSize: '0.74rem',
                      textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                      zIndex: 2,
                      pointerEvents: 'none'
                    }}
                  >
                    ✨ Contenido Útil ({trimmerNetDuration.toFixed(1)}s)
                  </div>
                )}

                {/* Outro cut zone */}
                {currentTrimmerCuts.outroCutTime > 0 && trimmerDuration > 0 && (
                  <div 
                    className="timeline-zone-cut-outro"
                    style={{ 
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: `${Math.min(100, (currentTrimmerCuts.outroCutTime / trimmerDuration) * 100)}%`,
                      background: 'repeating-linear-gradient(45deg, rgba(239, 68, 68, 0.45), rgba(239, 68, 68, 0.45) 8px, rgba(185, 28, 28, 0.55) 8px, rgba(185, 28, 28, 0.55) 16px)',
                      borderLeft: '2px solid #ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                      zIndex: 2,
                      pointerEvents: 'none'
                    }}
                  >
                    ✂️ Outro ({currentTrimmerCuts.outroCutTime.toFixed(1)}s)
                  </div>
                )}

                {/* Playhead Marker */}
                {trimmerDuration > 0 && (
                  <div 
                    className="timeline-playhead-cursor"
                    style={{ 
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: `${(trimmerCurrentTime / trimmerDuration) * 100}%`,
                      width: '2px',
                      background: 'var(--accent-cyan)',
                      boxShadow: '0 0 10px var(--accent-cyan)',
                      zIndex: 5,
                      pointerEvents: 'none'
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: '-6px',
                      width: '14px',
                      height: '14px',
                      background: 'var(--accent-cyan)',
                      clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.6)'
                    }} />
                  </div>
                )}

                {/* Hover Tooltip */}
                {trimmerHoverTime !== null && trimmerHoverX !== null && (
                  <div 
                    style={{
                      position: 'absolute',
                      bottom: '4px',
                      left: `${trimmerHoverX}px`,
                      transform: 'translateX(-50%)',
                      background: 'rgba(15, 23, 42, 0.92)',
                      border: '1px solid var(--accent-cyan)',
                      color: '#fff',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      pointerEvents: 'none',
                      zIndex: 10,
                      whiteSpace: 'nowrap',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.6)'
                    }}
                  >
                    ⏱️ {trimmerHoverTime.toFixed(2)}s
                  </div>
                )}

                {/* Scrubber Range Input */}
                <input 
                  type="range"
                  min="0"
                  max={trimmerDuration || 100}
                  step="0.05"
                  value={trimmerCurrentTime}
                  className="timeline-scrubber-slider"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer',
                    zIndex: 6,
                    margin: 0
                  }}
                  onChange={e => {
                    const t = parseFloat(e.target.value);
                    setTrimmerCurrentTime(t);
                    if (trimmerVideoRef.current) trimmerVideoRef.current.currentTime = t;
                  }}
                />
              </div>

              {/* Transport Buttons & In/Out Markers */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="btn-outline" style={{ padding: '4px 7px', fontSize: '0.72rem' }} onClick={() => stepVideoTime(-1.0)} title="Retroceder 1s">-1s</button>
                  <button className="btn-outline" style={{ padding: '4px 7px', fontSize: '0.72rem' }} onClick={() => stepVideoTime(-0.1)} title="Retroceder 0.1s (←)">-0.1s</button>
                  <button 
                    className="btn-glow" 
                    style={{ padding: '4px 14px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                    onClick={toggleTrimmerPlay}
                  >
                    {trimmerPlaying ? <Pause size={13} /> : <Play size={13} fill="currentColor" />}
                    {trimmerPlaying ? 'Pausa' : 'Reproducir'}
                  </button>
                  <button className="btn-outline" style={{ padding: '4px 7px', fontSize: '0.72rem' }} onClick={() => stepVideoTime(0.1)} title="Avanzar 0.1s (→)">+0.1s</button>
                  <button className="btn-outline" style={{ padding: '4px 7px', fontSize: '0.72rem' }} onClick={() => stepVideoTime(1.0)} title="Avanzar 1s">+1s</button>
                  <button className="btn-outline" style={{ padding: '4px 9px', fontSize: '0.72rem', color: '#34d399', borderColor: 'rgba(52, 211, 153, 0.4)' }} onClick={previewCutSegment} title="Previsualizar corte limpio saltando tramos">
                    ▶ Previsualizar
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '5px' }}>
                  <button 
                    className="btn-outline" 
                    style={{ padding: '4px 8px', fontSize: '0.74rem', color: 'var(--accent-cyan)', borderColor: 'var(--accent-cyan)' }}
                    onClick={() => updateCurrentVideoCuts({ introCutTime: parseFloat(trimmerCurrentTime.toFixed(2)) })}
                    title="Fijar segundo actual como corte inicial [I]"
                  >
                    ✂️ Fijar Inicio ({trimmerCurrentTime.toFixed(1)}s) [I]
                  </button>
                  <button 
                    className="btn-outline" 
                    style={{ padding: '4px 8px', fontSize: '0.74rem', color: '#c084fc', borderColor: '#c084fc' }}
                    onClick={() => updateCurrentVideoCuts({ outroCutTime: Math.max(0, parseFloat((trimmerDuration - trimmerCurrentTime).toFixed(2))) })}
                    title="Fijar segundo actual como corte final [O]"
                  >
                    ✂️ Fijar Fin [O]
                  </button>
                  <button 
                    className="btn-glow" 
                    style={{ padding: '4px 10px', fontSize: '0.74rem', background: 'linear-gradient(135deg, #7F00FF, #00F2FE)' }}
                    onClick={runAiDetectionForCurrentTrimmerVideo}
                    disabled={trimmerAiLoading}
                  >
                    {trimmerAiLoading ? <RefreshCw className="spin" size={12} /> : <Sparkles size={12} />}
                    {trimmerAiLoading ? 'Escaneando...' : 'Autodetectar con IA'}
                  </button>
                </div>
              </div>
            </div>

            {/* CUT SEGMENTS MANAGER (ELIMINAR TRAMOS INTERMEDIOS O PERSONALIZADOS) */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Scissors size={15} /> Sistema de Segmentos Personalizados (Eliminar partes intermedias)
                </h4>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-sub)' }}>
                  {(currentTrimmerCuts.deletedSegments || []).length} tramo(s) omitidos
                </span>
              </div>

              {/* Fast Mark In/Out Segment Buttons */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
                <button 
                  className="btn-outline" 
                  style={{ padding: '5px 10px', fontSize: '0.75rem', borderColor: segMarkIn !== null ? 'var(--accent-cyan)' : 'var(--border-glass)', color: segMarkIn !== null ? 'var(--accent-cyan)' : 'inherit' }}
                  onClick={() => setSegMarkIn(parseFloat(trimmerCurrentTime.toFixed(2)))}
                >
                  📍 {segMarkIn !== null ? `Punto A marcado: ${segMarkIn}s` : `Marcar Inicio de Tramo (${trimmerCurrentTime.toFixed(2)}s)`}
                </button>

                <button 
                  className="btn-outline" 
                  style={{ padding: '5px 10px', fontSize: '0.75rem', borderColor: segMarkOut !== null ? 'var(--accent-rose)' : 'var(--border-glass)', color: segMarkOut !== null ? '#fda4af' : 'inherit' }}
                  onClick={() => setSegMarkOut(parseFloat(trimmerCurrentTime.toFixed(2)))}
                >
                  📍 {segMarkOut !== null ? `Punto B marcado: ${segMarkOut}s` : `Marcar Fin de Tramo (${trimmerCurrentTime.toFixed(2)}s)`}
                </button>

                {segMarkIn !== null && segMarkOut !== null && (
                  <button 
                    className="btn-glow" 
                    style={{ padding: '5px 12px', fontSize: '0.75rem', background: 'linear-gradient(135deg, #f43f5e, #be123c)' }}
                    onClick={() => addDeletedSegment(Math.min(segMarkIn, segMarkOut), Math.max(segMarkIn, segMarkOut))}
                  >
                    ✂️ Confirmar y Eliminar Tramo ({Math.min(segMarkIn, segMarkOut)}s a {Math.max(segMarkIn, segMarkOut)}s)
                  </button>
                )}
              </div>

              {/* Manual input range option */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-sub)', marginBottom: '10px' }}>
                <span>O escribe el intervalo manual:</span>
                <input 
                  type="number" 
                  step="0.1" 
                  min="0" 
                  placeholder="Desde (s)" 
                  value={manualSegStart} 
                  onChange={e => setManualSegStart(e.target.value)}
                  className="input-field" 
                  style={{ width: '90px', padding: '4px 8px', fontSize: '0.75rem' }} 
                />
                <span>hasta</span>
                <input 
                  type="number" 
                  step="0.1" 
                  min="0" 
                  placeholder="Hasta (s)" 
                  value={manualSegEnd} 
                  onChange={e => setManualSegEnd(e.target.value)}
                  className="input-field" 
                  style={{ width: '90px', padding: '4px 8px', fontSize: '0.75rem' }} 
                />
                <button 
                  className="btn-outline" 
                  style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                  onClick={() => {
                    if (manualSegStart && manualSegEnd) {
                      addDeletedSegment(parseFloat(manualSegStart), parseFloat(manualSegEnd));
                    }
                  }}
                >
                  + Añadir a tramos omitidos
                </button>
              </div>

              {/* List of actively excluded segments */}
              {(currentTrimmerCuts.deletedSegments || []).length > 0 && (
                <div style={{ display: 'grid', gap: '6px', maxHeight: '110px', overflowY: 'auto' }}>
                  {currentTrimmerCuts.deletedSegments.map((seg, sIdx) => (
                    <div key={seg.id || sIdx} className="segment-card-item">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fda4af' }}>
                        <span>✂️ <strong>Tramo #{sIdx + 1}:</strong> {seg.start.toFixed(2)}s ➔ {seg.end.toFixed(2)}s</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-sub)' }}>(-{(seg.end - seg.start).toFixed(2)} segundos eliminados)</span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                          className="btn-outline" 
                          style={{ padding: '2px 8px', fontSize: '0.68rem', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)' }}
                          onClick={() => previewDeletedSegment(seg)}
                          title="Inspeccionar este tramo en el reproductor"
                        >
                          👁️ Previsualizar
                        </button>
                        <button 
                          className="btn-outline" 
                          style={{ padding: '2px 6px', fontSize: '0.68rem', color: '#fff' }}
                          onClick={() => removeDeletedSegment(seg.id)}
                          title="Restaurar este segmento en el vídeo"
                        >
                          Restaurar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI Result Card if generated */}
            {trimmerAiInfo && (
              <div style={{ 
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(56, 189, 248, 0.1) 100%)', 
                border: '1px solid rgba(139, 92, 246, 0.4)', 
                padding: '12px 16px', 
                borderRadius: '10px', 
                marginBottom: '14px', 
                fontSize: '0.82rem' 
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ fontWeight: 800, color: '#c084fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={16} /> Gemini 3.8 Flash Multimodal Vision:
                  </div>
                  {(trimmerAiInfo.introCutTimestamp > 0 || trimmerAiInfo.outroCutSeconds > 0) && (
                    <button 
                      className="btn-glow" 
                      style={{ padding: '3px 10px', fontSize: '0.74rem' }}
                      onClick={() => {
                        const introCut = trimmerAiInfo.introCutTimestamp || 0;
                        const outroCut = trimmerAiInfo.outroCutSeconds || 0;
                        updateCurrentVideoCuts({
                          introCutTime: introCut,
                          outroCutTime: outroCut
                        });
                        if (trimmerVideoRef.current) {
                          trimmerVideoRef.current.currentTime = introCut;
                          setTrimmerCurrentTime(introCut);
                        }
                      }}
                    >
                      ✨ Aplicar Cortes de IA al Timeline
                    </button>
                  )}
                </div>
                <div style={{ color: '#e2e8f0', lineHeight: 1.4, marginBottom: '6px' }}>{trimmerAiInfo.visualSummary}</div>
                {trimmerAiInfo.detectedText && (
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: '4px' }}>
                    <strong>📝 Texto detectado (OCR):</strong> {trimmerAiInfo.detectedText}
                  </div>
                )}
                {trimmerAiInfo.introDetails && (
                  <div style={{ marginTop: '3px', color: '#38bdf8' }}>
                    ▸ <strong>Cabecera:</strong> {trimmerAiInfo.introDetails} (Sugerido: cortar {trimmerAiInfo.introCutTimestamp}s)
                  </div>
                )}
                {trimmerAiInfo.outroDetails && (
                  <div style={{ marginTop: '3px', color: '#f472b6' }}>
                    ▸ <strong>Outro:</strong> {trimmerAiInfo.outroDetails} (Sugerido: cortar {trimmerAiInfo.outroCutSeconds}s)
                  </div>
                )}
              </div>
            )}


            {/* Numerical Fine-tune Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-sub)', display: 'block', marginBottom: '3px' }}>Recorte de Inicio (segundos)</label>
                <input 
                  type="number"
                  step="0.1"
                  min="0"
                  className="input-field"
                  value={currentTrimmerCuts.introCutTime}
                  onChange={e => updateCurrentVideoCuts({ introCutTime: Math.max(0, parseFloat(e.target.value) || 0) })}
                  style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-sub)', display: 'block', marginBottom: '3px' }}>Recorte de Fin (segundos a omitir)</label>
                <input 
                  type="number"
                  step="0.1"
                  min="0"
                  className="input-field"
                  value={currentTrimmerCuts.outroCutTime}
                  onChange={e => updateCurrentVideoCuts({ outroCutTime: Math.max(0, parseFloat(e.target.value) || 0) })}
                  style={{ fontWeight: 700, color: '#c084fc' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-sub)', display: 'block', marginBottom: '3px' }}>Velocidad para este vídeo</label>
                <select 
                  className="input-field"
                  value={currentTrimmerCuts.speed}
                  onChange={e => updateCurrentVideoCuts({ speed: parseFloat(e.target.value) })}
                  style={{ fontWeight: 600 }}
                >
                  <option value={options.speed}>Por defecto del lote ({options.speed}x)</option>
                  <option value="0.5">0.5x (Cámara lenta)</option>
                  <option value="1.0">1.0x (Normal)</option>
                  <option value="1.25">1.25x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2.0">2.0x (Acelerado)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-sub)', display: 'block', marginBottom: '3px' }}>Pista de Audio / Sonido</label>
                <select 
                  className="input-field"
                  value={currentTrimmerVideo.muteAudio !== undefined ? (currentTrimmerVideo.muteAudio ? 'muted' : 'sound') : 'default'}
                  onChange={e => {
                    const val = e.target.value;
                    setBatchVideos(prev => {
                      const updated = [...prev];
                      if (updated[trimmerIndex]) {
                        updated[trimmerIndex] = {
                          ...updated[trimmerIndex],
                          muteAudio: val === 'default' ? undefined : val === 'muted'
                        };
                      }
                      return updated;
                    });
                  }}
                  style={{ 
                    fontWeight: 600,
                    color: (currentTrimmerVideo.muteAudio !== undefined ? currentTrimmerVideo.muteAudio : options.includeAudio === false) ? '#fda4af' : 'var(--accent-cyan)'
                  }}
                >
                  <option value="default">Por defecto ({options.includeAudio !== false ? '🔊 Con Audio' : '🔇 Mudo'})</option>
                  <option value="sound">🔊 Conservar Sonido</option>
                  <option value="muted">🔇 Silenciar Vídeo (Mudo)</option>
                </select>
              </div>
            </div>

            {/* Trimmer Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--border-glass)' }}>
              <button 
                className="btn-outline" 
                style={{ color: 'var(--text-sub)', fontSize: '0.76rem' }}
                onClick={() => updateCurrentVideoCuts({ introCutTime: 0, outroCutTime: 0, deletedSegments: [] })}
              >
                Restablecer todos los cortes a 0s
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-outline" onClick={closeTrimmer}>
                  Listo / Cerrar
                </button>
                {trimmerIndex < batchVideos.length - 1 && (
                  <button className="btn-glow" onClick={() => setTrimmerIndex(trimmerIndex + 1)}>
                    Guardar & Siguiente Vídeo <ChevronRight size={14} />
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Settings / API Key Modal */}
      {showConfigModal && (
        <div className="cinema-modal-overlay" onClick={() => setShowConfigModal(false)}>
          <div className="cinema-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Key size={18} color="var(--accent-cyan)" /> Configuración de Visión IA
              </h2>
              <button className="btn-outline" style={{ padding: '4px 7px' }} onClick={() => setShowConfigModal(false)}>
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '14px', lineHeight: 1.4 }}>
              La suite utiliza el modelo <strong>Gemini 3.8 Flash</strong> para escanear fotogramas densos, detectar cabeceras con texto/título, reconhecer placas de estudio y redactar copys acordes al metraje.
            </p>

            {configData.isConfigured && (
              <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', fontSize: '0.8rem', fontWeight: 600 }}>
                  <CheckCircle2 size={16} /> API Key de Gemini Conectada ({configData.maskedKey})
                </div>
                <button 
                  className="btn-outline" 
                  style={{ padding: '3px 8px', fontSize: '0.7rem', color: '#fda4af', borderColor: 'rgba(244, 63, 94, 0.4)', display: 'flex', alignItems: 'center', gap: '4px' }}
                  onClick={clearApiKey}
                  title="Eliminar clave configurada"
                >
                  <Trash2 size={12} /> Eliminar
                </button>
              </div>
            )}

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-main)', display: 'block', marginBottom: '5px' }}>
                {configData.isConfigured ? 'Reemplazar API Key (opcional)' : 'Gemini API Key'}
              </label>
              <input 
                type="password"
                className="input-field"
                placeholder={configData.isConfigured ? 'Deja en blanco para conservar la clave actual...' : 'Pega aquí tu API Key de Gemini...'}
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '5px' }}>Modelo Multimodal</label>
              <select 
                className="input-field" 
                value={configData.geminiModel} 
                onChange={e => setConfigData({ ...configData, geminiModel: e.target.value })}
              >
                <option value="gemini-3.8-flash">Gemini 3.8 Flash (Recomendado - Multimodal & OCR)</option>
                <option value="gemini-flash-latest">Gemini Flash Latest</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noreferrer"
                style={{ fontSize: '0.76rem', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
              >
                Obtener API Key en Google AI Studio <ExternalLink size={12} />
              </a>
              {configSaveMsg && <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{configSaveMsg}</span>}
            </div>

            <button className="btn-glow" style={{ width: '100%', justifyContent: 'center' }} onClick={saveConfig}>
              <CheckCheck size={16} /> Guardar Configuración
            </button>

          </div>
        </div>
      )}

      {/* Cinema Player Modal */}
      {cinemaVideo && (
        <div className="cinema-modal-overlay" onClick={() => setCinemaVideo(null)}>
          <div className="cinema-modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ padding: '12px 20px', background: '#111827', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Film size={17} color="var(--accent-cyan)" />
                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#fff' }}>{cinemaVideo.name}</span>
              </div>
              <button className="btn-outline" style={{ padding: '4px 7px' }} onClick={() => setCinemaVideo(null)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ background: '#000', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '360px', maxHeight: '540px' }}>
              <video 
                controls 
                autoPlay 
                style={{ maxWidth: '100%', maxHeight: '540px', outline: 'none' }}
                src={getVideoSourceUrl(cinemaVideo)}
              />
            </div>

            <div style={{ padding: '10px 20px', background: '#0a0f1d', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-sub)' }}>
              <div>Ruta: <code style={{ color: 'var(--accent-cyan)' }}>{cinemaVideo.path}</code></div>
              <div>Tamaño: {cinemaVideo.size ? `${(cinemaVideo.size / (1024 * 1024)).toFixed(1)} MB` : 'Archivo de vídeo'}</div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
