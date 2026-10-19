import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execPromise = promisify(exec);
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// -------------------------------------------------------------
// Configuration & Presets Storage (Portable & Desktop Aware)
// -------------------------------------------------------------
const BASE_STORAGE_DIR = process.env.APP_DATA_PATH || process.cwd();
if (!fs.existsSync(BASE_STORAGE_DIR)) {
  try { fs.mkdirSync(BASE_STORAGE_DIR, { recursive: true }); } catch (e) {}
}

const CONFIG_FILE = path.join(BASE_STORAGE_DIR, 'config.json');
let config = {
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: 'gemini-3.8-flash',
};

// Check candidate config files across storage, workspace, and resources
const candidateConfigFiles = [
  CONFIG_FILE,
  path.join(process.cwd(), 'config.json'),
  'c:\\VSCODE\\fframes\\config.json',
  path.join(__dirname, 'config.json'),
  path.join(process.resourcesPath || '', 'app.asar.unpacked', 'config.json'),
  path.join(process.resourcesPath || '', 'app', 'config.json'),
  path.join(process.resourcesPath || '', 'config.json')
];

for (const cPath of candidateConfigFiles) {
  if (fs.existsSync(cPath)) {
    try {
      const loadedConfig = JSON.parse(fs.readFileSync(cPath, 'utf-8'));
      if (loadedConfig.geminiApiKey && !config.geminiApiKey) {
        config.geminiApiKey = loadedConfig.geminiApiKey.trim();
        console.log(`[Config] API Key de Gemini cargada desde ${cPath}`);
      }
      if (loadedConfig.geminiModel && (!config.geminiModel || config.geminiModel === 'gemini-2.5-flash')) {
        config.geminiModel = loadedConfig.geminiModel === 'gemini-2.5-flash' ? 'gemini-3.8-flash' : loadedConfig.geminiModel;
      }
    } catch (e) {
      // ignore parse errors
    }
  }
}

// Persist config to CONFIG_FILE if it exists and had an API key
if (config.geminiApiKey && !fs.existsSync(CONFIG_FILE)) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log(`[Config] Configuración inicial guardada en ${CONFIG_FILE}`);
  } catch (e) {}
}

const PRESETS_FILE = path.join(BASE_STORAGE_DIR, 'presets.json');
let presets = [];
const candidatePresetFiles = [
  PRESETS_FILE,
  path.join(process.cwd(), 'presets.json'),
  'c:\\VSCODE\\fframes\\presets.json',
  path.join(__dirname, 'presets.json'),
  path.join(process.resourcesPath || '', 'app.asar.unpacked', 'presets.json'),
  path.join(process.resourcesPath || '', 'presets.json')
];

for (const pPath of candidatePresetFiles) {
  if (fs.existsSync(pPath)) {
    try {
      const loadedPresets = JSON.parse(fs.readFileSync(pPath, 'utf-8'));
      if (Array.isArray(loadedPresets) && loadedPresets.length > 0) {
        presets = loadedPresets;
        break;
      }
    } catch (e) {}
  }
}

// -------------------------------------------------------------
// FFmpeg & FFprobe Binary Resolution (System PATH or Portable bin/ folder)
// -------------------------------------------------------------
let ffmpegCmd = 'ffmpeg';
function resolveFfmpegCommand() {
  const possiblePaths = [
    path.join(process.cwd(), 'bin', 'ffmpeg.exe'),
    path.join(path.dirname(process.execPath || ''), 'bin', 'ffmpeg.exe'),
    path.join(process.resourcesPath || '', 'bin', 'ffmpeg.exe'),
    path.join(process.resourcesPath || '', 'ffmpeg.exe'),
    'C:\\ffmpeg\\bin\\ffmpeg.exe'
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return `"${p}"`;
    }
  }
  return 'ffmpeg';
}
ffmpegCmd = resolveFfmpegCommand();

let ffprobeCmd = 'ffprobe';
function resolveFfprobeCommand() {
  const possiblePaths = [
    path.join(process.cwd(), 'bin', 'ffprobe.exe'),
    path.join(path.dirname(process.execPath || ''), 'bin', 'ffprobe.exe'),
    path.join(process.resourcesPath || '', 'bin', 'ffprobe.exe'),
    path.join(process.resourcesPath || '', 'ffprobe.exe'),
    'C:\\ffmpeg\\bin\\ffprobe.exe'
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return `"${p}"`;
    }
  }
  return 'ffprobe';
}
ffprobeCmd = resolveFfprobeCommand();

// Check FFmpeg availability
let ffmpegAvailable = false;
async function checkFFmpeg() {
  try {
    await execPromise(`${ffmpegCmd} -version`);
    ffmpegAvailable = true;
    console.log(`✅ FFmpeg detectado correctamente (${ffmpegCmd}).`);
  } catch (err) {
    ffmpegAvailable = false;
    console.warn('⚠️ FFmpeg no se encontró en el PATH ni en bin/. Asegúrate de tener FFmpeg instalado.');
  }
}
checkFFmpeg();

// Safe Default Output Directory Resolver (never write to read-only Program Files)
function getDefaultOutputDir() {
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'PROCESADOS');
  }
  const localDir = path.join(process.cwd(), 'PROCESADOS');
  try {
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
    const testFile = path.join(localDir, `.write_test_${Date.now()}`);
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    return localDir;
  } catch (e) {
    const userDir = path.join(process.env.USERPROFILE || 'C:\\', 'Videos', 'BatchVideoStudio');
    if (!fs.existsSync(userDir)) {
      try { fs.mkdirSync(userDir, { recursive: true }); } catch (err) {}
    }
    return userDir;
  }
}

// Ensure temp_uploads folder exists in writable data directory
const tempUploadsDir = path.join(BASE_STORAGE_DIR, 'temp_uploads');
if (!fs.existsSync(tempUploadsDir)) {
  try {
    fs.mkdirSync(tempUploadsDir, { recursive: true });
  } catch (e) {}
}

// Universal video path resolver (resolves relative names, uploaded files, and output dirs)
function resolveExistingVideoPath(rawPath) {
  if (!rawPath || typeof rawPath !== 'string') return null;
  const cleanPath = rawPath.trim();
  const baseName = path.basename(cleanPath);

  const candidates = [
    cleanPath,
    path.normalize(cleanPath),
    path.resolve(cleanPath),
    path.join(tempUploadsDir, baseName),
    path.join(tempUploadsDir, cleanPath),
    path.join(process.cwd(), cleanPath),
    path.join(process.cwd(), baseName),
    path.join(process.cwd(), 'temp_uploads', baseName),
    path.join(getDefaultOutputDir(), baseName),
    path.join(process.cwd(), 'PROCESADOS', baseName),
    path.join(BASE_STORAGE_DIR, baseName),
    path.join(BASE_STORAGE_DIR, 'PROCESADOS', baseName),
    path.join('c:\\VSCODE\\fframes', baseName),
    path.join('c:\\VSCODE\\fframes\\temp_uploads', baseName),
    path.join('c:\\VSCODE\\fframes\\PROCESADOS', baseName),
    path.join(process.env.USERPROFILE || 'C:\\', 'AppData', 'Roaming', 'Batch Video Studio AI', 'data', 'temp_uploads', baseName),
    path.join(process.env.USERPROFILE || 'C:\\', 'AppData', 'Roaming', 'Batch Video Studio AI', 'data', 'PROCESADOS', baseName)
  ];

  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      try {
        const stat = fs.statSync(c);
        if (stat.isFile() && stat.size > 0) {
          return c;
        }
      } catch (e) {}
    }
  }

  return null;
}


// -------------------------------------------------------------
// Probing & Signal Analysis Helpers
// -------------------------------------------------------------
async function probeVideoInfo(videoPath) {
  try {
    const { stdout } = await execPromise(
      `${ffprobeCmd} -v error -select_streams v:0 -show_entries stream=width,height,duration,r_frame_rate -of json "${videoPath}"`
    );
    const data = JSON.parse(stdout);
    const stream = (data.streams && data.streams[0]) ? data.streams[0] : {};
    
    let duration = parseFloat(stream.duration);
    if (!duration || isNaN(duration)) {
      const { stdout: fmtOut } = await execPromise(
        `${ffprobeCmd} -v error -show_entries format=duration -of json "${videoPath}"`
      );
      const fmtData = JSON.parse(fmtOut);
      duration = parseFloat(fmtData.format && fmtData.format.duration) || 30;
    }

    const width = parseInt(stream.width) || 1920;
    const height = parseInt(stream.height) || 1080;

    let hasAudio = false;
    try {
      const { stdout: aOut } = await execPromise(
        `${ffprobeCmd} -v error -select_streams a -show_entries stream=codec_name -of csv=p=0 "${videoPath}"`
      );
      hasAudio = aOut.trim().length > 0;
    } catch (e) {
      hasAudio = false;
    }

    return { duration, width, height, hasAudio };
  } catch (err) {
    console.warn(`Probe warning for ${videoPath}:`, err.message);
    return { duration: 30, width: 1920, height: 1080, hasAudio: true };
  }
}

// Deterministic detection of black frames and audio silences
async function detectBlackAndSilence(videoPath, duration) {
  const result = {
    blackIntroEnd: 0,
    blackOutroStart: duration,
    silenceIntroEnd: 0,
    silenceOutroStart: duration
  };

  try {
    const probeDur = Math.min(10, duration);
    const { stderr: blackOut } = await execPromise(
      `${ffmpegCmd} -i "${videoPath}" -t ${probeDur} -vf "blackdetect=d=0.2:pic_th=0.95" -f null - 2>&1`
    ).catch(e => ({ stderr: e.message || '' }));

    const blackMatches = [...blackOut.matchAll(/black_start:([0-9.]+)\s+black_end:([0-9.]+)/g)];
    for (const m of blackMatches) {
      const start = parseFloat(m[1]);
      const end = parseFloat(m[2]);
      if (start <= 0.2 && end > result.blackIntroEnd) {
        result.blackIntroEnd = end;
      }
    }
  } catch (e) {
    // Ignore
  }

  try {
    const { stderr: silenceOut } = await execPromise(
      `${ffmpegCmd} -i "${videoPath}" -t 8 -af "silencedetect=noise=-35dB:d=0.4" -f null - 2>&1`
    ).catch(e => ({ stderr: e.message || '' }));

    const silenceMatches = [...silenceOut.matchAll(/silence_end:\s*([0-9.]+)/g)];
    if (silenceMatches.length > 0) {
      const firstEnd = parseFloat(silenceMatches[0][1]);
      if (firstEnd <= 4.0) {
        result.silenceIntroEnd = firstEnd;
      }
    }
  } catch (e) {
    // Ignore
  }

  return result;
}

// Dense keyframe extraction for accurate temporal vision & OCR
async function extractKeyframes(videoPath, duration, count = 12) {
  const frames = [];
  const tempDir = tempUploadsDir;
  if (!fs.existsSync(tempDir)) {
    try { fs.mkdirSync(tempDir, { recursive: true }); } catch (e) {}
  }
  const safeId = Date.now() + '_' + Math.floor(Math.random() * 1000);

  // Dense strategic sampling across intro, core content, and outro
  const rawTimestamps = [];
  if (duration <= 8) {
    for (let s = 0.2; s < duration; s += 0.7) rawTimestamps.push(s);
  } else {
    // Dense intro scan
    rawTimestamps.push(0.2, 0.8, 1.8, 3.0, 4.5, 6.0);
    // Core content
    rawTimestamps.push(duration * 0.25, duration * 0.45, duration * 0.65);
    // Dense outro scan
    rawTimestamps.push(
      Math.max(0, duration - 8.5),
      Math.max(0, duration - 6.0),
      Math.max(0, duration - 4.0),
      Math.max(0, duration - 2.5),
      Math.max(0, duration - 1.2),
      Math.max(0, duration - 0.4)
    );
  }

  const uniqueTimestamps = [...new Set(rawTimestamps.map(t => Math.max(0, Math.min(t, Math.max(0, duration - 0.2)))))].sort((a, b) => a - b);

  for (let idx = 0; idx < uniqueTimestamps.length; idx++) {
    const sec = uniqueTimestamps[idx];
    const framePath = path.join(tempDir, `kf_${safeId}_${idx}.jpg`);
    try {
      await execPromise(
        `${ffmpegCmd} -y -ss ${sec.toFixed(2)} -i "${videoPath}" -vframes 1 -vf "scale=720:-1" -q:v 3 "${framePath}"`
      );
      if (fs.existsSync(framePath)) {
        const base64Data = fs.readFileSync(framePath).toString('base64');
        frames.push({
          timestamp: sec,
          base64: base64Data
        });
        fs.unlinkSync(framePath);
      }
    } catch (e) {
      if (fs.existsSync(framePath)) fs.unlinkSync(framePath);
    }
  }

  return frames;
}

// -------------------------------------------------------------
// Gemini Multimodal Vision API (Dense Temporal & OCR Prompt)
// -------------------------------------------------------------
async function callGeminiVision(keyframes, duration, requestedTone = 'Profesional', videoName = '') {
  const apiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('No se ha configurado la API Key de Gemini. Añádela en Configuración para activar la visión real por IA.');
  }

  const model = config.geminiModel || 'gemini-3.8-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const promptText = `Actúas como un editor de vídeo experto y analista visual de contenido multimedia.
Estoy proporcionando ${keyframes.length} fotogramas clave con sus marcas de tiempo exactas en segundos, correspondientes al archivo "${videoName}" (duración total: ${duration.toFixed(1)}s).

INSTRUCCIONES CRÍTICAS DE ANÁLISIS VISUAL Y OCR:
1. DETECTAR CABECERA / TÍTULO / PLACA DE INICIO (introCutSeconds):
   - Revisa meticulosamente los fotogramas iniciales (de 0s a 10s).
   - Busca pantallas en negro con texto centrado, títulos de cabecera, logotipos, nombres de canal o placas de presentación fijas.
   - Si detectas una pantalla de cabecera o título antes de que comience el metraje o acción real, determina el SEGUNDO EXACTO en el que termina y se desvanece ("introCutSeconds").
   - Si el contenido empieza de inmediato sin pantalla de título ni logo previo, devuelve 0.0.

2. DETECTAR OUTRO / CIERRE / ESTUDIO (outroCutSeconds):
   - Revisa meticulosamente los fotogramas finales (últimos 10 segundos hasta el final).
   - Busca placas de cierre, logotipos de estudio (ejemplo: "3D FOR SCIENCE", logos de marcas, "Suscríbete", créditos finales, pantallas de cierre corporativo).
   - Si detectas una pantalla de cierre, determina a partir de qué segundo entra esa outro y calcula cuántos segundos deben recortarse desde el final: outroCutSeconds = ${duration.toFixed(1)} - timestamp_inicio_outro.
   - Si el vídeo no tiene outro ni placa de cierre molesta, devuelve 0.0.

3. EXTRACCIÓN DE TEXTO Y TEMA (OCR):
   - Lee todos los textos visibles en los fotogramas (títulos, nombres de estudio, subtítulos, carteles).
   - Resume exactamente de qué trata el vídeo y qué procesos, interfaces o acciones se observan.

4. REDACCIÓN DE COPY PARA LINKEDIN:
   - Redacta una publicación completa y atractiva para LinkedIn en tono "${requestedTone}" basada EXCLUSIVAMENTE en el contenido, textos y acciones reales que has observado en el vídeo. No uses plantillas genéricas.

RESPONDE EXCLUSIVAMENTE CON UN OBJETO JSON VÁLIDO CON ESTA ESTRUCTURA EXACTA:
{
  "hasIntroLogo": true/false,
  "introCutSeconds": 0.0,
  "introDetails": "descripción de lo que hay en la cabecera (texto, logo, etc.)",
  "hasOutroCard": true/false,
  "outroCutSeconds": 0.0,
  "outroDetails": "descripción de la outro de cierre encontrada",
  "visualSummary": "resumen conciso de 2-3 frases de lo que se ve en el vídeo",
  "topic": "tema identificado",
  "detectedText": "todos los textos legibles leídos en los fotogramas",
  "linkedinCopy": "texto completo del post para LinkedIn con gancho, desarrollo y llamada a la acción",
  "hashtags": ["#Tag1", "#Tag2", "#Tag3"]
}`;

  const parts = [{ text: promptText }];
  for (const kf of keyframes) {
    parts.push({ text: `[FOTOGRAMA EN EL SEGUNDO ${kf.timestamp.toFixed(1)}s]:` });
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: kf.base64
      }
    });
  }

  const payload = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json'
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error en API de Gemini (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textOutput) {
    throw new Error('Gemini no devolvió texto en la respuesta.');
  }

  try {
    const cleanJson = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (parseErr) {
    return {
      hasIntroLogo: false,
      introCutSeconds: 0,
      introDetails: 'No detectado',
      hasOutroCard: false,
      outroCutSeconds: 0,
      outroDetails: 'No detectado',
      visualSummary: textOutput.slice(0, 150),
      topic: 'Contenido General',
      detectedText: '',
      linkedinCopy: textOutput,
      hashtags: ['#Video', '#Productividad', '#Innovacion']
    };
  }
}

// Generate Copy on processed video
async function generateCopyForProcessedVideo(rawPath, tone = 'Profesional', videoName = '') {
  const videoPath = resolveExistingVideoPath(rawPath) || rawPath;
  const cleanTitle = path.basename(videoName || videoPath).replace(/\.[^/.]+$/, "");
  
  if (config.geminiApiKey && videoPath && fs.existsSync(videoPath)) {
    try {
      const info = await probeVideoInfo(videoPath);
      const keyframes = await extractKeyframes(videoPath, info.duration, 8);
      const geminiResult = await callGeminiVision(keyframes, info.duration, tone, videoName || path.basename(videoPath));
      
      return {
        videoPath,
        videoName: videoName || path.basename(videoPath),
        title: cleanTitle,
        summary: geminiResult.visualSummary,
        detectedText: geminiResult.detectedText || '',
        copy: geminiResult.linkedinCopy,
        hashtags: geminiResult.hashtags || ['#Tecnologia', '#Innovacion'],
        aiGenerated: true
      };
    } catch (e) {
      console.warn(`Fallo al generar copy Gemini para ${videoName}:`, e.message);
    }
  }

  // Fallback template
  const tonesMap = {
    'Profesional': `🚀 **${cleanTitle.toUpperCase()}**: Claves de Alto Impacto\n\nOptimizar nuestros procesos y automatizar lo tedioso es la clave para enfocarnos en lo estratégico.\n\n💡 **3 Puntos destacados de este contenido:**\n1️⃣ **Innovación aplicada:** Eliminando tareas repetitivas.\n2️⃣ **Rendimiento:** Escalabilidad y rapidez de ejecución.\n3️⃣ **Resultados:** Eficiencia probada en equipo.\n\n¿Qué metodologías estás aplicando hoy en tu proyecto?\n\n💬 ¡Hablemos en los comentarios!\n\n#Tecnologia #Productividad #Innovacion #Liderazgo`,
    'Storytelling': `Reflexionando sobre cómo solíamos hacer **"${cleanTitle}"**...\n\nAntes esto implicaba horas de edición manual. Hoy, gracias a la automatización inteligente, lo resolvemos en segundos. 💡\n\n📌 **La lección:** No trabajes más horas, construye mejores herramientas.\n\nEcha un vistazo a este clip y cuéntame si te ha pasado algo similar. 👇\n\n#Storytelling #Productividad #Automatizacion #Estrategia`,
    'Educativo': `🎓 **GUÍA RÁPIDA:** **${cleanTitle}**\n\nResumen ejecutivo para aplicar esta semana:\n\n🔹 **Paso 1:** Identificar cuellos de botella.\n🔹 **Paso 2:** Automatizar en lote.\n🔹 **Paso 3:** Medir y escalar resultados.\n\nGuarda este post 📌 para consultarlo cuando lo necesites.\n\n#EducacionDigital #TipsProductividad #Tutorial`,
    'Directo': `⚡ **${cleanTitle}** en estado puro.\n\n✓ Sin rodeos.\n✓ Máxima velocidad.\n✓ Resultados garantizados.\n\nMira el vídeo arriba 👆 y déjame tu opinión en los comentarios.\n\n#DirectoAlGrano #Automatización #Eficiencia`
  };

  return {
    videoPath,
    videoName: videoName || path.basename(videoPath),
    title: cleanTitle,
    summary: 'Vídeo procesado en lote con éxito.',
    detectedText: '',
    copy: tonesMap[tone] || tonesMap['Profesional'],
    hashtags: ['#Tecnologia', '#Innovacion', '#BatchStudioAI'],
    aiGenerated: false
  };
}

// -------------------------------------------------------------
// Audio & Filtergraph Helpers for FFmpeg
// -------------------------------------------------------------
function buildAtempoFilter(speed) {
  if (Math.abs(speed - 1.0) < 0.01) return '';
  let s = speed;
  const filters = [];
  
  if (s > 1.0) {
    while (s > 2.0) {
      filters.push('atempo=2.0');
      s /= 2.0;
    }
    filters.push(`atempo=${s.toFixed(3)}`);
  } else {
    while (s < 0.5) {
      filters.push('atempo=0.5');
      s /= 0.5;
    }
    filters.push(`atempo=${s.toFixed(3)}`);
  }
  return filters.join(',');
}

function resolveCanvasDimensions(aspectRatio, origW, origH) {
  switch (aspectRatio) {
    case '9:16':
      return { width: 1080, height: 1920 };
    case '16:9':
      return { width: 1920, height: 1080 };
    case '1:1':
      return { width: 1080, height: 1080 };
    case '4:5':
      return { width: 1080, height: 1350 };
    default:
      return {
        width: origW % 2 === 0 ? origW : origW - 1,
        height: origH % 2 === 0 ? origH : origH - 1
      };
  }
}

function computeKeptIntervals(totalDuration, introTrim = 0, outroTrim = 0, deletedSegments = []) {
  const safeIntro = Math.max(0, Math.min(totalDuration, parseFloat(introTrim) || 0));
  const safeOutro = Math.max(0, Math.min(totalDuration - safeIntro, parseFloat(outroTrim) || 0));
  const effectiveEnd = Math.max(safeIntro, totalDuration - safeOutro);

  if (effectiveEnd <= safeIntro + 0.05) {
    return [{ start: 0, end: totalDuration }];
  }

  // Filter and clamp deleted segments inside [safeIntro, effectiveEnd]
  const validDeleted = (deletedSegments || [])
    .map(seg => ({
      start: Math.max(safeIntro, Math.min(effectiveEnd, parseFloat(seg.start) || 0)),
      end: Math.max(safeIntro, Math.min(effectiveEnd, parseFloat(seg.end) || 0))
    }))
    .filter(seg => seg.end > seg.start + 0.05)
    .sort((a, b) => a.start - b.start);

  // Merge overlapping deleted segments
  const mergedDeleted = [];
  for (const d of validDeleted) {
    if (mergedDeleted.length === 0) {
      mergedDeleted.push({ ...d });
    } else {
      const prev = mergedDeleted[mergedDeleted.length - 1];
      if (d.start <= prev.end) {
        prev.end = Math.max(prev.end, d.end);
      } else {
        mergedDeleted.push({ ...d });
      }
    }
  }

  // Build kept intervals from safeIntro to effectiveEnd
  const kept = [];
  let cursor = safeIntro;
  for (const d of mergedDeleted) {
    if (d.start > cursor + 0.05) {
      kept.push({ start: cursor, end: d.start });
    }
    cursor = Math.max(cursor, d.end);
  }

  if (cursor < effectiveEnd - 0.05) {
    kept.push({ start: cursor, end: effectiveEnd });
  }

  return kept.length > 0 ? kept : [{ start: safeIntro, end: effectiveEnd }];
}


// -------------------------------------------------------------
// Endpoints: Status & Config
// -------------------------------------------------------------
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    ffmpegAvailable,
    hasGeminiKey: !!config.geminiApiKey,
    geminiModel: config.geminiModel || 'gemini-3.8-flash',
    cwd: process.cwd(),
    os: process.platform
  });
});

app.get('/api/config', (req, res) => {
  res.json({
    isConfigured: !!config.geminiApiKey,
    hasGeminiKey: !!config.geminiApiKey,
    maskedKey: config.geminiApiKey ? '••••••••' + config.geminiApiKey.slice(-4) : '',
    geminiModel: config.geminiModel || 'gemini-3.8-flash'
  });
});

app.post('/api/config', (req, res) => {
  const { geminiApiKey, geminiModel } = req.body;

  // Only update if a genuine non-empty key was passed, or explicit '__CLEAR__'
  if (typeof geminiApiKey === 'string' && geminiApiKey.trim().length > 0) {
    config.geminiApiKey = geminiApiKey.trim();
  } else if (geminiApiKey === '__CLEAR__') {
    config.geminiApiKey = '';
  }

  if (geminiModel) {
    config.geminiModel = geminiModel;
  }
  
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    // Also sync to workspace and candidate locations
    const wsConfig = path.join(process.cwd(), 'config.json');
    try { fs.writeFileSync(wsConfig, JSON.stringify(config, null, 2)); } catch (e) {}
    const rootConfig = 'c:\\VSCODE\\fframes\\config.json';
    try { if (fs.existsSync(rootConfig)) fs.writeFileSync(rootConfig, JSON.stringify(config, null, 2)); } catch (e) {}

    res.json({
      success: true,
      isConfigured: !!config.geminiApiKey,
      hasGeminiKey: !!config.geminiApiKey,
      maskedKey: config.geminiApiKey ? '••••••••' + config.geminiApiKey.slice(-4) : '',
      geminiModel: config.geminiModel
    });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo guardar la configuración: ' + err.message });
  }
});


// -------------------------------------------------------------
// Endpoints: Presets
// -------------------------------------------------------------
app.get('/api/presets', (req, res) => {
  res.json(presets);
});

app.post('/api/presets', (req, res) => {
  const newPresets = req.body;
  if (!Array.isArray(newPresets)) {
    return res.status(400).json({ error: 'El formato de presets debe ser un array.' });
  }
  presets = newPresets;
  try {
    fs.writeFileSync(PRESETS_FILE, JSON.stringify(presets, null, 2));
    res.json({ success: true, presets });
  } catch (err) {
    res.status(500).json({ error: 'Error guardando presets: ' + err.message });
  }
});

// -------------------------------------------------------------
// Endpoints: Directory Browser & File Streaming
// -------------------------------------------------------------
app.get('/api/browse', async (req, res) => {
  try {
    let dirPath = req.query.path || process.cwd();
    dirPath = path.normalize(dirPath);

    if (!fs.existsSync(dirPath)) {
      return res.status(400).json({ error: 'El directorio no existe.' });
    }

    let items = [];
    try {
      items = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch (readErr) {
      return res.json({
        currentPath: dirPath,
        parent: path.dirname(dirPath) !== dirPath ? path.dirname(dirPath) : null,
        folders: [],
        videos: [],
        images: [],
        accessError: 'Acceso denegado o carpeta protegida del sistema.'
      });
    }

    const videoExtensions = ['.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v', '.flv'];
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];

    const folders = [];
    const videos = [];
    const images = [];

    for (const item of items) {
      try {
        const fullPath = path.join(dirPath, item.name);
        if (item.isDirectory()) {
          folders.push({ name: item.name, path: fullPath });
        } else {
          const ext = path.extname(item.name).toLowerCase();
          const stats = fs.statSync(fullPath);
          if (videoExtensions.includes(ext)) {
            videos.push({
              name: item.name,
              path: fullPath,
              size: stats.size,
              ext,
              modified: stats.mtime
            });
          } else if (imageExtensions.includes(ext)) {
            images.push({
              name: item.name,
              path: fullPath,
              size: stats.size,
              ext
            });
          }
        }
      } catch (itemErr) {
        // Ignore protected system files
      }
    }

    const parentDir = path.dirname(dirPath);
    res.json({
      currentPath: dirPath,
      parent: parentDir !== dirPath ? parentDir : null,
      folders,
      videos,
      images
    });
  } catch (err) {
    res.status(500).json({ error: err.message, currentPath: req.query.path || process.cwd() });
  }
});

// Video stream for player
app.get('/api/video-stream', (req, res) => {
  try {
    const rawPath = req.query.path;
    if (!rawPath) return res.status(400).send('Ruta no proporcionada');
    const videoPath = resolveExistingVideoPath(rawPath);

    if (!videoPath || !fs.existsSync(videoPath)) {
      return res.status(404).send('Vídeo no encontrado en la ruta especificada');
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    const ext = path.extname(videoPath).toLowerCase();
    const mimeTypes = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.mkv': 'video/x-matroska',
      '.avi': 'video/x-msvideo',
      '.m4v': 'video/mp4'
    };
    const contentType = mimeTypes[ext] || 'video/mp4';

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': contentType,
      };
      res.writeHead(200, head);
      fs.createReadStream(videoPath).pipe(res);
    }
  } catch (err) {
    res.status(500).send('Error interno de streaming: ' + err.message);
  }
});

// Fast Cached Video Thumbnail Endpoint
app.get('/api/thumbnail', async (req, res) => {
  try {
    const rawPath = req.query.path;
    if (!rawPath) return res.status(400).send('Ruta no proporcionada');
    const videoPath = resolveExistingVideoPath(rawPath);

    if (!videoPath || !fs.existsSync(videoPath)) {
      return res.status(404).send('Vídeo no encontrado');
    }

    const hash = Buffer.from(videoPath).toString('base64url').slice(-20);
    const thumbPath = path.join(tempUploadsDir, `thumb_${hash}.jpg`);

    if (!fs.existsSync(thumbPath)) {
      await execPromise(`${ffmpegCmd} -y -ss 1.0 -i "${videoPath}" -vframes 1 -vf "scale=360:-1" -q:v 3 "${thumbPath}"`);
    }

    if (fs.existsSync(thumbPath)) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      fs.createReadStream(thumbPath).pipe(res);
    } else {
      res.status(404).send('No se pudo generar miniatura');
    }
  } catch (err) {
    res.status(500).send('Error de miniatura: ' + err.message);
  }
});

// Video Filmstrip: generates a sequence of 8-12 thumbnail frames across duration for visual reference in NLE
app.get('/api/video-filmstrip', async (req, res) => {
  try {
    const rawPath = req.query.path;
    if (!rawPath) return res.status(400).json({ error: 'Ruta no proporcionada' });
    const videoPath = resolveExistingVideoPath(rawPath);

    if (!videoPath || !fs.existsSync(videoPath)) {
      return res.status(404).json({ error: 'Vídeo no encontrado en disco' });
    }

    const info = await probeVideoInfo(videoPath);
    const duration = info.duration || 30;
    const count = Math.max(6, Math.min(14, parseInt(req.query.count, 10) || 10));

    const stat = fs.statSync(videoPath);
    const hash = Buffer.from(`${videoPath}_${stat.size}_${Math.round(stat.mtimeMs)}`).toString('base64url').slice(-24);
    const filmstripDir = path.join(tempUploadsDir, 'filmstrips', hash);
    if (!fs.existsSync(filmstripDir)) {
      fs.mkdirSync(filmstripDir, { recursive: true });
    }

    const frames = [];
    const step = duration / count;

    for (let i = 0; i < count; i++) {
      const timestamp = Math.max(0.1, Math.min(duration - 0.1, i * step + (step * 0.25)));
      const frameFile = path.join(filmstripDir, `f_${i}.jpg`);

      if (!fs.existsSync(frameFile)) {
        try {
          await execPromise(
            `${ffmpegCmd} -y -ss ${timestamp.toFixed(2)} -i "${videoPath}" -vframes 1 -vf "scale=180:-1" -q:v 4 "${frameFile}"`
          );
        } catch (e) {
          // ignore individual frame error
        }
      }

      if (fs.existsSync(frameFile)) {
        const base64 = fs.readFileSync(frameFile).toString('base64');
        frames.push({
          index: i,
          timestamp: parseFloat(timestamp.toFixed(2)),
          dataUrl: `data:image/jpeg;base64,${base64}`
        });
      }
    }

    res.json({
      success: true,
      videoPath,
      duration,
      count: frames.length,
      frames
    });
  } catch (err) {
    console.error('Error generando filmstrip:', err);
    res.status(500).json({ error: err.message });
  }
});


// Local File Upload Endpoint
app.post('/api/upload', (req, res) => {
  try {
    const rawFilename = req.headers['x-filename'] || `upload_${Date.now()}.mp4`;
    const safeFilename = path.basename(decodeURIComponent(rawFilename));
    const filePath = path.join(tempUploadsDir, safeFilename);
    const writeStream = fs.createWriteStream(filePath);

    req.pipe(writeStream);

    writeStream.on('finish', () => {
      res.json({ success: true, path: filePath, filename: safeFilename });
    });

    writeStream.on('error', (err) => {
      res.status(500).json({ error: err.message });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Open Folder in Explorer
app.post('/api/open-folder', (req, res) => {
  const { folderPath } = req.body;
  const target = folderPath || path.join(process.cwd(), 'PROCESADOS');
  if (fs.existsSync(target)) {
    if (process.platform === 'win32') {
      exec(`explorer.exe "${path.normalize(target)}"`);
    } else if (process.platform === 'darwin') {
      exec(`open "${target}"`);
    } else {
      exec(`xdg-open "${target}"`);
    }
    return res.json({ success: true, path: target });
  }
  res.status(404).json({ error: 'La carpeta no existe.' });
});

// -------------------------------------------------------------
// Endpoints: AI Scene Vision (Auditoría previa & Asistente)
// -------------------------------------------------------------
app.post('/api/ai/analyze-scene', async (req, res) => {
  const { videoPath: rawPath } = req.body;
  const videoPath = resolveExistingVideoPath(rawPath);
  if (!videoPath || !fs.existsSync(videoPath)) {
    return res.status(400).json({ error: 'Ruta de vídeo no válida o no encontrada en disco.' });
  }

  try {
    const mainInfo = await probeVideoInfo(videoPath);
    const duration = mainInfo.duration;

    const deterministic = await detectBlackAndSilence(videoPath, duration);

    if (config.geminiApiKey) {
      try {
        const keyframes = await extractKeyframes(videoPath, duration, 12);
        const geminiResult = await callGeminiVision(
          keyframes,
          duration,
          'Profesional',
          path.basename(videoPath)
        );

        const finalIntroCut = Math.max(deterministic.blackIntroEnd, geminiResult.introCutSeconds || 0);
        const finalOutroCut = Math.max(0, geminiResult.outroCutSeconds || 0);

        return res.json({
          videoPath,
          duration,
          aiAnalysis: {
            hasIntroLogo: geminiResult.hasIntroLogo || finalIntroCut > 0,
            introCutTimestamp: parseFloat(finalIntroCut.toFixed(2)),
            introDetails: geminiResult.introDetails || '',
            hasOutroCard: geminiResult.hasOutroCard || finalOutroCut > 0,
            outroCutTimestamp: parseFloat((finalOutroCut > 0 ? duration - finalOutroCut : duration).toFixed(2)),
            outroCutSeconds: parseFloat(finalOutroCut.toFixed(2)),
            outroDetails: geminiResult.outroDetails || '',
            visualSummary: geminiResult.visualSummary,
            detectedText: geminiResult.detectedText || '',
            topic: geminiResult.topic,
            confidence: 0.98,
            provider: 'Gemini 3.8 Flash Multimodal Vision'
          }
        });
      } catch (geminiErr) {
        console.warn('Gemini vision falló, usando fallback determinista:', geminiErr.message);
      }
    }

    const introCutSuggested = Math.max(deterministic.blackIntroEnd, Math.min(3.5, duration * 0.08));
    const outroCutSuggested = Math.max(duration - 4.0, duration * 0.92);

    res.json({
      videoPath,
      duration,
      aiAnalysis: {
        hasIntroLogo: deterministic.blackIntroEnd > 0,
        introCutTimestamp: parseFloat(introCutSuggested.toFixed(2)),
        introDetails: 'Detección por señal de corte negro/silencio',
        hasOutroCard: false,
        outroCutTimestamp: parseFloat(outroCutSuggested.toFixed(2)),
        outroCutSeconds: parseFloat((duration - outroCutSuggested).toFixed(2)),
        outroDetails: '',
        visualSummary: 'Análisis determinista local. Conecta tu API Key de Gemini para visión multimodal completa.',
        detectedText: '',
        confidence: 0.75,
        provider: 'FFmpeg Signal Engine'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate Copy on-demand for a single video
app.post('/api/ai/generate-copy-single', async (req, res) => {
  const { videoPath: rawPath, tone = 'Profesional' } = req.body;
  const videoPath = resolveExistingVideoPath(rawPath);
  if (!videoPath || !fs.existsSync(videoPath)) {
    return res.status(400).json({ error: 'Ruta de vídeo no válida o no encontrada en disco.' });
  }
  try {
    const copyData = await generateCopyForProcessedVideo(videoPath, tone, path.basename(videoPath));
    res.json(copyData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// -------------------------------------------------------------
// Endpoints: Master Batch Processing Engine
// -------------------------------------------------------------
app.post('/api/batch/start', async (req, res) => {
  const { videos, options, outputDir } = req.body;
  if (!videos || !Array.isArray(videos) || videos.length === 0) {
    return res.status(400).json({ error: 'No se enviaron vídeos para procesar.' });
  }

  const destinationFolder = outputDir || getDefaultOutputDir();
  if (!fs.existsSync(destinationFolder)) {
    try {
      fs.mkdirSync(destinationFolder, { recursive: true });
    } catch (e) {
      console.warn('No se pudo crear carpeta de salida principal:', e.message);
    }
  }

  res.json({
    message: 'Procesamiento en lote iniciado',
    totalVideos: videos.length,
    outputDir: destinationFolder
  });

  // Asynchronous background execution
  (async () => {
    const batchStartTime = Date.now();
    broadcastProgress({ type: 'BATCH_START', total: videos.length, outputDir: destinationFolder, startTime: batchStartTime });
    const failedVideos = [];
    const successfulVideos = [];
    const generatedCopys = [];

    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      const videoName = video.name;
      const indexStr = String(i + 1).padStart(3, '0');

      let originalPath = resolveExistingVideoPath(video.path) || resolveExistingVideoPath(videoName) || video.path;


      let newName = options.renamePattern || '{prefix}_{counter}_{original}';
      const cleanOriginalName = path.basename(videoName, path.extname(videoName));
      newName = newName
        .replace('{prefix}', options.prefix || 'REEL')
        .replace('{counter}', indexStr)
        .replace('{original}', cleanOriginalName)
        .replace('{suffix}', options.suffix || '')
        .replace('{date}', new Date().toISOString().split('T')[0]);

      newName = `${newName}${path.extname(videoName)}`;
      const outputPath = path.join(destinationFolder, newName);

      try {
        if (!originalPath || !fs.existsSync(originalPath)) {
          throw new Error(`El archivo de vídeo "${videoName}" no existe en disco.`);
        }

        const elapsedSec = Math.round((Date.now() - batchStartTime) / 1000);
        const avgSecPerVideo = i > 0 ? elapsedSec / i : null;
        const etaSec = avgSecPerVideo ? Math.round(avgSecPerVideo * (videos.length - i)) : null;

        broadcastProgress({
          type: 'VIDEO_PROGRESS',
          currentIndex: i + 1,
          total: videos.length,
          videoName,
          newVideoName: newName,
          percentage: Math.round((i / videos.length) * 100),
          elapsedSeconds: elapsedSec,
          etaSeconds: etaSec,
          status: `[${i + 1}/${videos.length}] Analizando metadatos y cortes para ${videoName}...`
        });

        const mainInfo = await probeVideoInfo(originalPath);
        const origDuration = mainInfo.duration;

        // Check if this specific video has custom cuts from the manual/assisted trimmer
        let introTrim = 0;
        let outroTrim = 0;
        let effectiveSpeed = parseFloat(options.speed) || 1.0;

        if (video.customCuts) {
          if (video.customCuts.introCutTime !== undefined && video.customCuts.introCutTime !== null) {
            introTrim = parseFloat(video.customCuts.introCutTime) || 0;
          }
          if (video.customCuts.outroCutTime !== undefined && video.customCuts.outroCutTime !== null) {
            outroTrim = parseFloat(video.customCuts.outroCutTime) || 0;
          }
          if (video.customCuts.speed) {
            effectiveSpeed = parseFloat(video.customCuts.speed) || effectiveSpeed;
          }
          console.log(`[MANUAL CUTS] Aplicando recortes individuales para ${videoName}: Intro ${introTrim}s, Outro ${outroTrim}s, Vel ${effectiveSpeed}x`);
        } else {
          // Use global rules
          introTrim = parseFloat(options.introCutTime) || 0;
          outroTrim = parseFloat(options.outroCutTime) || 0;

          if (options.autoAiVisionRules) {
            if (config.geminiApiKey && origDuration > 4) {
              try {
                broadcastProgress({
                  type: 'VIDEO_PROGRESS',
                  currentIndex: i + 1,
                  total: videos.length,
                  videoName,
                  newVideoName: newName,
                  percentage: Math.round(((i + 0.1) / videos.length) * 100),
                  status: `[${i + 1}/${videos.length}] Escaneando fotogramas con Gemini 3.8 Flash...`
                });

                const keyframes = await extractKeyframes(originalPath, origDuration, 12);
                const vision = await callGeminiVision(keyframes, origDuration, options.copyTone || 'Profesional', videoName);

                if (options.aiRemoveIntroLogo && vision.introCutSeconds > 0) {
                  introTrim = Math.max(introTrim, vision.introCutSeconds);
                  console.log(`[AI VISION] Cabecera/título detectado en ${videoName}: recortando ${introTrim}s (${vision.introDetails || ''})`);
                }
                if (options.aiRemoveOutroLogo && vision.outroCutSeconds > 0) {
                  outroTrim = Math.max(outroTrim, vision.outroCutSeconds);
                  console.log(`[AI VISION] Outro de estudio detectada en ${videoName}: recortando ${outroTrim}s (${vision.outroDetails || ''})`);
                }
              } catch (vErr) {
                console.warn(`Visión IA falló para ${videoName}:`, vErr.message);
                const det = await detectBlackAndSilence(originalPath, origDuration);
                if (options.aiRemoveIntroLogo && det.blackIntroEnd > 0) {
                  introTrim = Math.max(introTrim, det.blackIntroEnd);
                }
              }
            } else {
              const det = await detectBlackAndSilence(originalPath, origDuration);
              if (options.aiRemoveIntroLogo && det.blackIntroEnd > 0) {
                introTrim = Math.max(introTrim, det.blackIntroEnd);
              }
            }
          }
        }

        const deletedSegments = video.customCuts?.deletedSegments || [];
        const keptIntervals = computeKeptIntervals(origDuration, introTrim, outroTrim, deletedSegments);
        const totalKeptDuration = Math.max(0.5, keptIntervals.reduce((sum, s) => sum + (s.end - s.start), 0));

        if (options.speedMode === 'targetDuration' && options.targetDurationSeconds > 0 && (!video.customCuts || !video.customCuts.speed)) {
          effectiveSpeed = totalKeptDuration / parseFloat(options.targetDurationSeconds);
        }

        let customIntro = options.customIntroPath;
        if (customIntro && !path.isAbsolute(customIntro)) {
          const c1 = path.join(process.cwd(), customIntro);
          const c2 = path.join(tempUploadsDir, customIntro);
          if (fs.existsSync(c1)) customIntro = c1;
          else if (fs.existsSync(c2)) customIntro = c2;
        }
        if (customIntro && !fs.existsSync(customIntro)) customIntro = null;

        let customOutro = options.customOutroPath;
        if (customOutro && !path.isAbsolute(customOutro)) {
          const c1 = path.join(process.cwd(), customOutro);
          const c2 = path.join(tempUploadsDir, customOutro);
          if (fs.existsSync(c1)) customOutro = c1;
          else if (fs.existsSync(c2)) customOutro = c2;
        }
        if (customOutro && !fs.existsSync(customOutro)) customOutro = null;

        let watermarkPath = options.watermarkPath;
        if (watermarkPath && !path.isAbsolute(watermarkPath)) {
          const w1 = path.join(process.cwd(), watermarkPath);
          const w2 = path.join(tempUploadsDir, watermarkPath);
          if (fs.existsSync(w1)) watermarkPath = w1;
          else if (fs.existsSync(w2)) watermarkPath = w2;
        }
        const hasWatermark = options.watermarkEnabled && watermarkPath && fs.existsSync(watermarkPath);

        const targetDims = resolveCanvasDimensions(options.aspectRatio, mainInfo.width, mainInfo.height);
        const targetW = targetDims.width;
        const targetH = targetDims.height;
        const useBlurredBackground = !!options.blurredBackground;

        broadcastProgress({
          type: 'VIDEO_PROGRESS',
          currentIndex: i + 1,
          total: videos.length,
          videoName,
          newVideoName: newName,
          percentage: Math.round(((i + 0.35) / videos.length) * 100),
          status: `[${i + 1}/${videos.length}] Renderizando vídeo (${targetW}x${targetH}, vel. ${effectiveSpeed.toFixed(2)}x, ${keptIntervals.length} tramos útiles)...`
        });

        if (ffmpegAvailable) {
          let targetRenderPath = outputPath;
          let tempMainPath = null;

          if (customIntro || customOutro) {
            tempMainPath = path.join(destinationFolder, `_temp_main_${Date.now()}_${newName}`);
            targetRenderPath = tempMainPath;
          }

          let inputIndex = 0;
          let cmdArgs = [ffmpegCmd, '-y'];

          const hasMultiSegments = keptIntervals.length > 1;

          if (!hasMultiSegments) {
            const singleSeg = keptIntervals[0];
            if (singleSeg.start > 0) {
              cmdArgs.push('-ss', singleSeg.start.toFixed(2));
            }
            if (singleSeg.end < origDuration) {
              cmdArgs.push('-t', (singleSeg.end - singleSeg.start).toFixed(2));
            }
          }

          cmdArgs.push('-i', `"${originalPath}"`);
          const mainInputIdx = inputIndex++;

          let wmInputIdx = -1;
          if (hasWatermark) {
            cmdArgs.push('-i', `"${watermarkPath}"`);
            wmInputIdx = inputIndex++;
          }

          const filterChains = [];
          let currentVLabel = `${mainInputIdx}:v`;
          let currentALabel = `${mainInputIdx}:a`;

          // Check if this video should be exported without audio (muted)
          const videoAudioMuted = video.muteAudio !== undefined 
            ? !!video.muteAudio 
            : (options.includeAudio === false || options.muteAudio === true);
          const hasAudioActive = mainInfo.hasAudio && !videoAudioMuted;

          if (hasMultiSegments) {
            for (let sIdx = 0; sIdx < keptIntervals.length; sIdx++) {
              const seg = keptIntervals[sIdx];
              filterChains.push(
                `[${mainInputIdx}:v]trim=start=${seg.start.toFixed(3)}:end=${seg.end.toFixed(3)},setpts=PTS-STARTPTS[v_seg_${sIdx}]`
              );
              if (hasAudioActive) {
                filterChains.push(
                  `[${mainInputIdx}:a]atrim=start=${seg.start.toFixed(3)}:end=${seg.end.toFixed(3)},asetpts=PTS-STARTPTS[a_seg_${sIdx}]`
                );
              }
            }
            if (hasAudioActive) {
              const concatStreams = keptIntervals.map((_, sIdx) => `[v_seg_${sIdx}][a_seg_${sIdx}]`).join('');
              filterChains.push(`${concatStreams}concat=n=${keptIntervals.length}:v=1:a=1[v_trimmed][a_trimmed]`);
              currentVLabel = 'v_trimmed';
              currentALabel = 'a_trimmed';
            } else {
              const vStreams = keptIntervals.map((_, sIdx) => `[v_seg_${sIdx}]`).join('');
              filterChains.push(`${vStreams}concat=n=${keptIntervals.length}:v=1:a=0[v_trimmed]`);
              currentVLabel = 'v_trimmed';
            }
          }

          if (Math.abs(effectiveSpeed - 1.0) >= 0.01) {
            const ptsVal = (1 / effectiveSpeed).toFixed(4);
            filterChains.push(`[${currentVLabel}]setpts=${ptsVal}*PTS[v_speed]`);
            currentVLabel = 'v_speed';
          }

          if (options.aspectRatio && options.aspectRatio !== 'original') {
            if (useBlurredBackground) {
              filterChains.push(
                `[${currentVLabel}]split[bg_raw][fg_raw]`,
                `[bg_raw]scale=${targetW}:${targetH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH},boxblur=25:5[bg]`,
                `[fg_raw]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease[fg]`,
                `[bg][fg]overlay=(W-w)/2:(H-h)/2[v_canvas]`
              );
              currentVLabel = 'v_canvas';
            } else {
              filterChains.push(
                `[${currentVLabel}]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:color=black[v_canvas]`
              );
              currentVLabel = 'v_canvas';
            }
          }

          if (hasWatermark && wmInputIdx !== -1) {
            const opacity = options.watermarkOpacity !== undefined ? options.watermarkOpacity : 0.85;
            const scale = options.watermarkScale !== undefined ? options.watermarkScale : 0.15;

            let posCoord;
            if (options.watermarkX !== undefined && options.watermarkY !== undefined) {
              const xPct = Math.max(0, Math.min(100, parseFloat(options.watermarkX)));
              const yPct = Math.max(0, Math.min(100, parseFloat(options.watermarkY)));
              posCoord = `(main_w-overlay_w)*${(xPct / 100).toFixed(4)}:(main_h-overlay_h)*${(yPct / 100).toFixed(4)}`;
            } else {
              const posMap = {
                'top-left': '10:10',
                'top-center': '(main_w-overlay_w)/2:10',
                'top-right': 'main_w-overlay_w-10:10',
                'center-left': '10:(main_h-overlay_h)/2',
                'center': '(main_w-overlay_w)/2:(main_h-overlay_h)/2',
                'center-right': 'main_w-overlay_w-10:(main_h-overlay_h)/2',
                'bottom-left': '10:main_h-overlay_h-10',
                'bottom-center': '(main_w-overlay_w)/2:main_h-overlay_h-10',
                'bottom-right': 'main_w-overlay_w-10:main_h-overlay_h-10'
              };
              posCoord = posMap[options.watermarkPosition] || posMap['bottom-right'];
            }

            filterChains.push(
              `[${wmInputIdx}:v]scale=iw*${scale}:-1,format=rgba,colorchannelmixer=aa=${opacity}[wm]`,
              `[${currentVLabel}][wm]overlay=${posCoord}[v_wm]`
            );
            currentVLabel = 'v_wm';
          }

          filterChains.push(`[${currentVLabel}]setsar=1,format=yuv420p[v_out]`);

          let audioMapArg = '';
          if (hasAudioActive) {
            const audioFilters = [];
            if (Math.abs(effectiveSpeed - 1.0) >= 0.01) {
              const atempoStr = buildAtempoFilter(effectiveSpeed);
              if (atempoStr) audioFilters.push(atempoStr);
            }
            if (options.normalizeAudio) {
              audioFilters.push("loudnorm=I=-16:LRA=11:TP=-1.5");
            }

            if (audioFilters.length > 0) {
              filterChains.push(`[${currentALabel}]${audioFilters.join(',')}[a_out]`);
              audioMapArg = '-map "[a_out]" -c:a aac -b:a 192k';
            } else {
              audioMapArg = currentALabel === `${mainInputIdx}:a`
                ? `-map ${mainInputIdx}:a -c:a aac -b:a 192k`
                : `-map "[${currentALabel}]" -c:a aac -b:a 192k`;
            }
          } else {
            audioMapArg = '-an';
          }

          const fullFilterStr = filterChains.join(';');
          cmdArgs.push(
            `-filter_complex "${fullFilterStr}"`,
            `-map "[v_out]"`,
            audioMapArg,
            `-c:v libx264 -preset fast -crf 22`,
            `"${targetRenderPath}"`
          );

          const mainCmd = cmdArgs.join(' ');
          console.log(`▶ Ejecutando FFmpeg: ${mainCmd}`);
          await execPromise(mainCmd);

          if (customIntro || customOutro) {
            broadcastProgress({
              type: 'VIDEO_PROGRESS',
              currentIndex: i + 1,
              total: videos.length,
              videoName,
              newVideoName: newName,
              percentage: Math.round(((i + 0.75) / videos.length) * 100),
              status: `[${i + 1}/${videos.length}] Ensamblando Intro / Outro personalizada...`
            });

            const concatParts = [];
            if (customIntro) concatParts.push({ path: customIntro, type: 'intro' });
            concatParts.push({ path: tempMainPath, type: 'main' });
            if (customOutro) concatParts.push({ path: customOutro, type: 'outro' });

            const concatInputs = [];
            const concatFilters = [];

            for (let cIdx = 0; cIdx < concatParts.length; cIdx++) {
              const part = concatParts[cIdx];
              concatInputs.push(`-i "${part.path}"`);

              concatFilters.push(
                `[${cIdx}:v]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30,format=yuv420p[cv${cIdx}]`
              );

              if (hasAudioActive) {
                const pInfo = await probeVideoInfo(part.path);
                if (pInfo.hasAudio) {
                  concatFilters.push(`[${cIdx}:a]aformat=sample_rates=44100:channel_layouts=stereo[ca${cIdx}]`);
                } else {
                  concatFilters.push(`anullsrc=channel_layout=stereo:sample_rate=44100:d=${pInfo.duration.toFixed(2)}[ca${cIdx}]`);
                }
              }
            }

            if (hasAudioActive) {
              const concatStreams = concatParts.map((_, cIdx) => `[cv${cIdx}][ca${cIdx}]`).join('');
              concatFilters.push(`${concatStreams}concat=n=${concatParts.length}:v=1:a=1[concat_v][concat_a]`);
              const concatCmd = `${ffmpegCmd} -y ${concatInputs.join(' ')} -filter_complex "${concatFilters.join(';')}" -map "[concat_v]" -map "[concat_a]" -c:v libx264 -preset fast -crf 22 -c:a aac -b:a 192k "${outputPath}"`;
              console.log(`▶ Concatena Intro/Outro: ${concatCmd}`);
              await execPromise(concatCmd);
            } else {
              const concatStreams = concatParts.map((_, cIdx) => `[cv${cIdx}]`).join('');
              concatFilters.push(`${concatStreams}concat=n=${concatParts.length}:v=1:a=0[concat_v]`);
              const concatCmd = `${ffmpegCmd} -y ${concatInputs.join(' ')} -filter_complex "${concatFilters.join(';')}" -map "[concat_v]" -an -c:v libx264 -preset fast -crf 22 "${outputPath}"`;
              console.log(`▶ Concatena Intro/Outro (Mudo): ${concatCmd}`);
              await execPromise(concatCmd);
            }

            if (tempMainPath && fs.existsSync(tempMainPath)) {
              fs.unlinkSync(tempMainPath);
            }
          }

        } else {
          await new Promise(r => setTimeout(r, 500));
          fs.copyFileSync(originalPath, outputPath);
        }

        successfulVideos.push({
          name: newName,
          path: outputPath,
          originalName: videoName
        });

        // -----------------------------------------------------------
        // GENERATE COPY AFTER PROCESSING (If enabled)
        // -----------------------------------------------------------
        if (options.generateCopy) {
          broadcastProgress({
            type: 'VIDEO_PROGRESS',
            currentIndex: i + 1,
            total: videos.length,
            videoName,
            newVideoName: newName,
            percentage: Math.round(((i + 0.9) / videos.length) * 100),
            status: `[${i + 1}/${videos.length}] Analizando metraje finalizado y extrayendo copy con Visión IA...`
          });

          const copyData = await generateCopyForProcessedVideo(outputPath, options.copyTone || 'Profesional', newName);

          if (options.saveCopyTxt !== false) {
            try {
              const txtFilename = `${path.basename(newName, path.extname(newName))}_copy.txt`;
              const txtPath = path.join(destinationFolder, txtFilename);
              const txtContent = `TITULO: ${copyData.title}
ARCHIVO DE VIDEO: ${copyData.videoName}
RESUMEN VISUAL: ${copyData.summary || 'N/A'}
TEXTO DETECTADO: ${copyData.detectedText || 'N/A'}
FECHA DE PROCESAMIENTO: ${new Date().toLocaleString()}

============================================================
PUBLICACION PARA LINKEDIN / REDES SOCIALES
============================================================

${copyData.copy}

HASHTAGS: ${(copyData.hashtags || []).join(' ')}
`;
              fs.writeFileSync(txtPath, txtContent, 'utf-8');
              copyData.txtPath = txtPath;
            } catch (txtErr) {
              console.warn('Error guardando archivo .txt de copy:', txtErr.message);
            }
          }

          generatedCopys.push(copyData);

          broadcastProgress({
            type: 'VIDEO_COPY_READY',
            currentIndex: i + 1,
            total: videos.length,
            videoName: newName,
            copyData
          });
        }

        broadcastProgress({
          type: 'VIDEO_PROGRESS',
          currentIndex: i + 1,
          total: videos.length,
          videoName,
          newVideoName: newName,
          percentage: Math.round(((i + 1) / videos.length) * 100),
          status: `[${i + 1}/${videos.length}] ¡Completado con éxito!`
        });

      } catch (procErr) {
        console.error(`Error procesando ${videoName}:`, procErr.message);
        failedVideos.push({ name: videoName, error: procErr.message });
        broadcastProgress({
          type: 'VIDEO_ERROR',
          currentIndex: i + 1,
          total: videos.length,
          videoName,
          error: procErr.message
        });
      }
    }

    broadcastProgress({
      type: 'BATCH_COMPLETE',
      total: videos.length,
      successCount: videos.length - failedVideos.length,
      failedCount: failedVideos.length,
      failedVideos,
      successfulVideos,
      copys: generatedCopys,
      outputDir: destinationFolder
    });
  })();
});

// -------------------------------------------------------------
// Serve Static Vite Client in Production / Electron
// -------------------------------------------------------------
const candidateDistDirs = [
  path.join(__dirname, 'dist'),
  path.join(process.cwd(), 'dist'),
  path.join(process.resourcesPath || '', 'app', 'dist'),
  path.join(process.resourcesPath || '', 'app.asar', 'dist'),
  path.join(process.resourcesPath || '', 'dist')
];
const productionDistDir = candidateDistDirs.find(d => fs.existsSync(path.join(d, 'index.html')));

if (productionDistDir) {
  console.log(`📦 Sirviendo cliente estático desde: ${productionDistDir}`);
  app.use(express.static(productionDistDir));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/stream')) {
      return res.sendFile(path.join(productionDistDir, 'index.html'));
    }
    next();
  });
}

// -------------------------------------------------------------
// WebSocket Real-time Broadcast
// -------------------------------------------------------------
const server = app.listen(PORT, () => {
  console.log(`🚀 Backend procesador de vídeo escuchando en http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });
let activeClients = new Set();

wss.on('connection', (ws) => {
  activeClients.add(ws);
  console.log('🔌 Cliente WebSocket conectado para estado en tiempo real.');

  ws.on('close', () => {
    activeClients.delete(ws);
  });
});

function broadcastProgress(data) {
  const payload = JSON.stringify(data);
  for (const client of activeClients) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
}
