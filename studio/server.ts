/**
 * PPT Engraver Web Studio Server
 * 
 * Lightweight standalone local development server providing:
 * - Live in-memory YAML -> LilyPond compilation
 * - Local LilyPond binary execution with SVG vector generation
 * - File loading, saving, and PDF exporting from ./scores
 * - Configurable LilyPond executable path via env or API
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, unlinkSync, renameSync } from 'node:fs';
import { join, resolve, extname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { load as loadYaml } from 'js-yaml';
import { compileYamlString } from '../src/compiler/compile.js';

const execFileAsync = promisify(execFile);

// Determine base paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const ROOT_DIR = resolve(__dirname, '..');
const SCORES_DIR = resolve(ROOT_DIR, 'scores');
const SNIPPETS_DIR = resolve(ROOT_DIR, 'snippets');
const PUBLIC_DIR = resolve(__dirname, 'public');

// Ensure scores and snippets directories exist
if (!existsSync(SCORES_DIR)) {
  mkdirSync(SCORES_DIR, { recursive: true });
}
if (!existsSync(SNIPPETS_DIR)) {
  mkdirSync(SNIPPETS_DIR, { recursive: true });
}

// Configurable LilyPond binary path
let lilypondPath = process.env.LILYPOND_PATH || process.env.LILYPOND_BIN || 'C:\\lilypond-2.24.4\\bin\\lilypond.exe';

// Configurable audio backend subsystem URL
let audioBackendUrl = process.env.AUDIO_BACKEND_URL || 'http://127.0.0.1:8000';

/**
 * Finds a working LilyPond binary if default is missing.
 */
function findLilyPondPath(): string {
  if (existsSync(lilypondPath)) return lilypondPath;

  const candidates = [
    'C:\\lilypond-2.24.4\\bin\\lilypond.exe',
    'C:\\Program Files\\LilyPond\\bin\\lilypond.exe',
    'C:\\Program Files (x86)\\LilyPond\\bin\\lilypond.exe',
    'lilypond',
  ];

  for (const candidate of candidates) {
    if (candidate === 'lilypond' || existsSync(candidate)) {
      return candidate;
    }
  }
  return lilypondPath;
}

lilypondPath = findLilyPondPath();

/**
 * Helper to read JSON request body.
 */
async function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Sends JSON response.
 */
function sendJson(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

/**
 * Sends error response.
 */
function sendError(res: ServerResponse, message: string, status = 500, details?: unknown) {
  sendJson(res, { error: message, details }, status);
}

/**
 * Distinguishes purely structural/timed section tags (instrumental) from actual sung vocal lyrics.
 */
function isSectionPlanOnly(text?: string): boolean {
  if (!text || !text.trim()) return true;
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return true;
  return lines.every(line => line.replace(/\[[^\]]+\]/g, '').trim().length === 0);
}

/**
 * Compiles a YAML string to LilyPond .ly and runs LilyPond to produce PDF (super-fast native backend).
 */
async function compileScore(yamlContent: string, format = 'pdf', knotId?: string, isInstrumental?: boolean, tempo?: number) {
  const startTime = Date.now();
  
  // 1. In-memory YAML -> LilyPond compilation (runs in ~10-20ms)
  const result = compileYamlString(yamlContent, { knotId, isInstrumental, tempo });
  const compileTimeMs = Date.now() - startTime;

  // 2. Render via LilyPond
  const tempDir = resolve(tmpdir(), 'ppt-studio-' + Math.random().toString(36).slice(2, 8));
  mkdirSync(tempDir, { recursive: true });

  const tempLyPath = join(tempDir, 'score.ly');
  const tempOutPrefix = join(tempDir, 'score');
  writeFileSync(tempLyPath, result.lilypondSource, 'utf-8');

  try {
    const lilyStartTime = Date.now();

    if (format === 'svg') {
      await execFileAsync(lilypondPath, [
        '-dbackend=svg',
        '-dpoint-and-click',
        '-o',
        tempOutPrefix,
        tempLyPath,
      ], { timeout: 20000 });
      const lilyTimeMs = Date.now() - lilyStartTime;

      const standardSvgPath = tempOutPrefix + '.svg';
      const croppedSvgPath = tempOutPrefix + '.cropped.svg';
      let svgContent = '';

      if (existsSync(standardSvgPath)) {
        svgContent = readFileSync(standardSvgPath, 'utf-8');
      } else if (existsSync(croppedSvgPath)) {
        svgContent = readFileSync(croppedSvgPath, 'utf-8');
      }

      return {
        success: true,
        format: 'svg',
        svg: svgContent,
        lilypondSource: result.lilypondSource,
        abcSource: result.abcSource,
        onsets: result.onsets,
        sidecarMap: result.sidecarMap,
        availableKnots: result.availableKnots,
        selectedKnotId: result.selectedKnotId,
        knot: result.knot,
        timing: result.timing,
        warnings: result.warnings,
        metrics: {
          compileTimeMs,
          lilyTimeMs,
          totalTimeMs: Date.now() - startTime,
        },
      };
    } else {
      // Default: Native PDF output (1.7s fast Cairo/PostScript engine, exact Frescobaldi match)
      await execFileAsync(lilypondPath, [
        '-dpoint-and-click',
        '-o',
        tempOutPrefix,
        tempLyPath,
      ], { timeout: 20000 });
      const lilyTimeMs = Date.now() - lilyStartTime;

      const pdfPath = tempOutPrefix + '.pdf';
      let pdfBase64 = '';
      if (existsSync(pdfPath)) {
        pdfBase64 = readFileSync(pdfPath).toString('base64');
      } else {
        throw new Error('LilyPond did not produce PDF output');
      }

      return {
        success: true,
        format: 'pdf',
        pdfBase64,
        lilypondSource: result.lilypondSource,
        abcSource: result.abcSource,
        onsets: result.onsets,
        sidecarMap: result.sidecarMap,
        availableKnots: result.availableKnots,
        selectedKnotId: result.selectedKnotId,
        knot: result.knot,
        timing: result.timing,
        warnings: result.warnings,
        metrics: {
          compileTimeMs,
          lilyTimeMs,
          totalTimeMs: Date.now() - startTime,
        },
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'LilyPond execution failed',
      stderr: err.stderr,
      stdout: err.stdout,
      lilypondSource: result.lilypondSource,
      availableKnots: result.availableKnots,
      selectedKnotId: result.selectedKnotId,
      knot: result.knot,
      warnings: result.warnings,
      metrics: {
        compileTimeMs,
        totalTimeMs: Date.now() - startTime,
      },
    };
  }
}

/**
 * MIME types map for static assets.
 */
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// Create HTTP Server
const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // --- API Routes ---
  if (pathname.startsWith('/api/')) {
    try {
      // POST /api/compile
      if (pathname === '/api/compile' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.yaml || typeof body.yaml !== 'string') {
          return sendError(res, 'Missing yaml content', 400);
        }
        const result = await compileScore(
          body.yaml,
          body.format || 'pdf',
          body.knotId || body.knot,
          body.isInstrumental !== undefined ? Boolean(body.isInstrumental) : undefined,
          body.tempo ? Number(body.tempo) : undefined
        );
        return sendJson(res, result);
      }

      // GET /api/scores
      if (pathname === '/api/scores' && req.method === 'GET') {
        const files = readdirSync(SCORES_DIR)
          .filter(f => f.endsWith('.ppt.yaml'))
          .map(f => {
            const filePath = join(SCORES_DIR, f);
            let title = '';
            let composer = '';
            let arranger = '';
            let tonic = '';
            let tempo = '';
            try {
              const text = readFileSync(filePath, 'utf-8');
              const titleMatch = text.match(/\btitle\s*:\s*["']?([^"'\r\n]+)["']?/i);
              if (titleMatch) title = titleMatch[1].trim();
              const composerMatch = text.match(/\bcomposer\s*:\s*["']?([^"'\r\n]+)["']?/i);
              if (composerMatch) composer = composerMatch[1].trim();
              const arrangerMatch = text.match(/\barranger\s*:\s*["']?([^"'\r\n]+)["']?/i);
              if (arrangerMatch) arranger = arrangerMatch[1].trim();
              const tonicMatch = text.match(/\btonic\s*:\s*["']?([^"'\r\n]+)["']?/i);
              if (tonicMatch) tonic = tonicMatch[1].trim();
              const tempoMatch = text.match(/\btempo\s*:\s*(\d+)/i);
              if (tempoMatch) tempo = tempoMatch[1].trim();
            } catch (e) {
              // fallback
            }
            return {
              name: f,
              path: f,
              displayName: title ? `${title} (${f})` : f.replace('.ppt.yaml', ''),
              title: title || f.replace('.ppt.yaml', ''),
              composer,
              arranger,
              tonic,
              tempo,
            };
          });
        return sendJson(res, { scores: files });
      }

      // GET /api/score?file=...
      if (pathname === '/api/score' && req.method === 'GET') {
        const fileName = url.searchParams.get('file');
        if (!fileName) return sendError(res, 'Missing file parameter', 400);
        const safePath = join(SCORES_DIR, basename(fileName));
        if (!existsSync(safePath)) return sendError(res, 'Score not found', 404);
        const content = readFileSync(safePath, 'utf-8');
        return sendJson(res, { name: basename(fileName), content });
      }

      // POST /api/save
      if (pathname === '/api/save' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.file || typeof body.content !== 'string') {
          return sendError(res, 'Missing file or content', 400);
        }
        const fileName = body.file.endsWith('.ppt.yaml') ? body.file : `${body.file}.ppt.yaml`;
        const safePath = join(SCORES_DIR, basename(fileName));
        writeFileSync(safePath, body.content, 'utf-8');
        return sendJson(res, { success: true, file: basename(fileName) });
      }

      // POST /api/delete
      if (pathname === '/api/delete' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.file) {
          return sendError(res, 'Missing file parameter', 400);
        }
        const baseName = basename(body.file).replace(/\.ppt\.yaml$/, '');
        const yamlPath = join(SCORES_DIR, `${baseName}.ppt.yaml`);
        if (existsSync(yamlPath)) {
          unlinkSync(yamlPath);
        }
        const relatedFiles = [
          `${baseName}.notation.ly`,
          `${baseName}.pdf`,
          `${baseName}.ppt-map.json`,
          `${baseName}.svg`,
          `${baseName}.cropped.svg`,
          `${baseName}.abc`,
        ];
        for (const rel of relatedFiles) {
          const relPath = join(SCORES_DIR, rel);
          if (existsSync(relPath)) {
            try { unlinkSync(relPath); } catch (e) {}
          }
        }
        return sendJson(res, { success: true, file: `${baseName}.ppt.yaml` });
      }

      // POST /api/rename
      if (pathname === '/api/rename' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.oldFile || !body.newFile) {
          return sendError(res, 'Missing oldFile or newFile parameter', 400);
        }
        const oldBase = basename(body.oldFile).replace(/\.ppt\.yaml$/, '');
        const newBase = basename(body.newFile).replace(/\.ppt\.yaml$/, '');
        if (!oldBase || !newBase) {
          return sendError(res, 'Invalid file name', 400);
        }
        const oldYamlPath = join(SCORES_DIR, `${oldBase}.ppt.yaml`);
        const newYamlPath = join(SCORES_DIR, `${newBase}.ppt.yaml`);

        if (!existsSync(oldYamlPath)) {
          return sendError(res, `Original score '${oldBase}.ppt.yaml' does not exist`, 404);
        }
        if (oldBase !== newBase && existsSync(newYamlPath)) {
          return sendError(res, `Target score '${newBase}.ppt.yaml' already exists`, 409);
        }

        // Rename the primary YAML score
        if (oldBase !== newBase) {
          renameSync(oldYamlPath, newYamlPath);

          // Rename all known related sidecar and compilation artifacts
          const extensions = [
            '.notation.ly',
            '.pdf',
            '.ppt-map.json',
            '.svg',
            '.cropped.svg',
            '.mid',
            '.midi',
            '.abc',
          ];
          for (const ext of extensions) {
            const oldArtifact = join(SCORES_DIR, `${oldBase}${ext}`);
            const newArtifact = join(SCORES_DIR, `${newBase}${ext}`);
            if (existsSync(oldArtifact)) {
              try {
                renameSync(oldArtifact, newArtifact);
              } catch (e) {
                console.warn(`Failed to rename artifact ${oldArtifact}:`, e);
              }
            }
          }
        }

        return sendJson(res, {
          success: true,
          oldFile: `${oldBase}.ppt.yaml`,
          newFile: `${newBase}.ppt.yaml`
        });
      }

      // GET /api/snippets
      if (pathname === '/api/snippets' && req.method === 'GET') {
        if (!existsSync(SNIPPETS_DIR)) {
          return sendJson(res, { snippets: [] });
        }
        const files = readdirSync(SNIPPETS_DIR).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
        const snippets: any[] = [];
        for (const f of files) {
          try {
            const content = readFileSync(join(SNIPPETS_DIR, f), 'utf-8');
            const parsed = loadYaml(content) as any;
            if (parsed && parsed.snippet) {
              snippets.push({
                id: parsed.id || f.replace(/\.ya?ml$/, ''),
                label: parsed.label || parsed.displayText || f,
                displayText: parsed.displayText || parsed.label || f,
                desc: parsed.desc || '',
                category: parsed.category || 'Snippets',
                icon: parsed.icon || '📄',
                context: Array.isArray(parsed.context) ? parsed.context : ['root'],
                snippet: parsed.snippet,
                file: f,
              });
            }
          } catch (err) {
            console.error(`Failed to parse snippet ${f}:`, err);
          }
        }
        return sendJson(res, { snippets });
      }

      // GET /api/config
      if (pathname === '/api/config' && req.method === 'GET') {
        return sendJson(res, {
          lilypondPath,
          exists: existsSync(lilypondPath),
          audioBackendUrl,
        });
      }

      // POST /api/config
      if (pathname === '/api/config' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        if (body.lilypondPath && typeof body.lilypondPath === 'string') {
          lilypondPath = body.lilypondPath;
        }
        if (body.audioBackendUrl && typeof body.audioBackendUrl === 'string') {
          audioBackendUrl = body.audioBackendUrl.trim();
        }
        return sendJson(res, {
          lilypondPath,
          exists: existsSync(lilypondPath),
          audioBackendUrl,
        });
      }

      // --- Audio Subsystem Endpoints ---
      if (pathname === '/api/audio/status' && req.method === 'GET') {
        try {
          const resp = await fetch(`${audioBackendUrl}/health`, { signal: AbortSignal.timeout(2000) });
          if (resp.ok) {
            const data = await resp.json();
            return sendJson(res, { online: true, ...data });
          }
          return sendJson(res, { online: false, status: resp.status });
        } catch {
          return sendJson(res, { online: false, message: 'Audio backend daemon offline' });
        }
      }

      if (pathname === '/api/audio/models' && req.method === 'GET') {
        try {
          const resp = await fetch(`${audioBackendUrl}/models`, { signal: AbortSignal.timeout(2500) });
          if (resp.ok) {
            const data = await resp.json();
            return sendJson(res, data);
          }
          return sendJson(res, { models: [], error: 'Backend error' });
        } catch {
          // Fallback catalog when offline
          const homeDir = process.env.HOME || process.env.USERPROFILE || '';
          const fallbackCache = join(homeDir, '.cache', 'ppt-engraver', 'models');
          return sendJson(res, {
            cache_dir: fallbackCache,
            models: [
              {
                id: 'yue2-3b-gguf-q4',
                name: 'Yue2-3B-GGUF (Q4_0 Quantized)',
                repo_id: 'audio-cpp/Yue2-3B-GGUF',
                engine: 'gguf',
                category: 'generation',
                tier: 'Tier 2 (~8-9GB VRAM / CPU)',
                estimated_size: '2.66 GB',
                min_vram_gb: 8,
                requires_vae: 'yue2-vae-gguf',
                is_downloaded: false,
                status: 'offline',
                description: 'Quantized GGUF model via audio.cpp engine. Runs on consumer hardware with 8GB VRAM or CPU.',
              },
              {
                id: 'yue2-3b-gguf-q8',
                name: 'Yue2-3B-GGUF (Q8_0 High-Precision)',
                repo_id: 'audio-cpp/Yue2-3B-GGUF',
                engine: 'gguf',
                category: 'generation',
                tier: 'Tier 2 (~12GB VRAM / CPU)',
                estimated_size: '4.26 GB',
                min_vram_gb: 12,
                requires_vae: 'yue2-vae-gguf',
                is_downloaded: false,
                status: 'offline',
                description: 'Higher precision 8-bit GGUF model balancing speed and perceptual quality.',
              },
              {
                id: 'yue2-3b-gguf-q8-instrumental',
                name: 'Yue2-3B-GGUF (Q8_0 Instrumental LoRA Merged)',
                repo_id: 'Mothersuperior/YuE2-instrumental-cot-full-loras',
                engine: 'gguf',
                category: 'generation',
                tier: 'Tier 2 (~12GB VRAM / CPU)',
                estimated_size: '4.26 GB',
                min_vram_gb: 12,
                requires_vae: 'yue2-vae-gguf',
                requires_lora: 'yue2-lora-instrumental',
                is_downloaded: false,
                status: 'offline',
                description: 'Q8_0 model pre-merged with Mothersuperior Section-Plan LoRA for strict instrumental synthesis without vocal ad-libs.',
              },
              {
                id: 'yue2-3b-pytorch',
                name: 'YuE2-3B (Official PyTorch BF16)',
                repo_id: 'm-a-p/YuE2-3B',
                engine: 'pytorch',
                category: 'generation',
                tier: 'Tier 1 (24GB VRAM)',
                estimated_size: '15.0 GB',
                min_vram_gb: 24,
                requires_vae: 'xcodec-mini-infer',
                is_downloaded: false,
                status: 'offline',
                description: 'Full-precision official foundation model for high-end GPUs (RTX 3090/4090).',
              },
              {
                id: 'yue2-vae-gguf',
                name: 'YuE2 VAE / Audio Decoder (GGUF F16)',
                repo_id: 'audio-cpp/Yue2-3B-GGUF',
                engine: 'gguf',
                category: 'vae',
                tier: 'Required for GGUF',
                estimated_size: '265 MB',
                is_downloaded: false,
                status: 'offline',
                description: 'Neural audio decoder/VAE for audio.cpp. Synthesizes latent tokens into 48kHz audio.',
              },
              {
                id: 'xcodec-mini-infer',
                name: 'xcodec_mini_infer (PyTorch Tokenizer / VAE)',
                repo_id: 'm-a-p/xcodec_mini_infer',
                engine: 'pytorch',
                category: 'vae',
                tier: 'Required for PyTorch',
                estimated_size: '2.1 GB',
                is_downloaded: false,
                status: 'offline',
                description: 'Official 44.1kHz neural audio tokenizer and vocoder used by PyTorch YuE / YuE2.',
              },
              {
                id: 'yue2-lora-instrumental',
                name: 'YuE2 Instrumental Section-Plan LoRA (Mothersuperior)',
                repo_id: 'Mothersuperior/YuE2-instrumental-cot-full-loras',
                filename: 'ar_lora_inst_v3abc.bf16.safetensors',
                engine: 'pytorch',
                category: 'lora',
                tier: 'Adapter (~300MB)',
                estimated_size: '301 MB',
                is_downloaded: false,
                status: 'offline',
                description: 'AR-branch LoRA trained on 2.7k instrumental tracks with SheetSage2 ABC scores. Eliminates vocal ad-libs and enforces section progression.',
              },
            ],
            hardware: { cuda_available: false, recommended_engine: 'mock' },
            offline: true,
          });
        }
      }

      if (pathname === '/api/audio/models/download' && req.method === 'POST') {
        try {
          const body: any = await parseJsonBody(req);
          const payload = {
            model_id: body?.model_id || body?.modelId,
            modelId: body?.modelId || body?.model_id,
          };
          const resp = await fetch(`${audioBackendUrl}/models/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await resp.json();
          return sendJson(res, data, resp.status);
        } catch (err: any) {
          return sendError(res, err.message || 'Failed to connect to audio backend', 502);
        }
      }

      if (pathname === '/api/audio/models/delete' && req.method === 'POST') {
        try {
          const body = await parseJsonBody(req);
          const resp = await fetch(`${audioBackendUrl}/models/${encodeURIComponent(body.model_id)}`, {
            method: 'DELETE',
          });
          const data = await resp.json();
          return sendJson(res, data, resp.status);
        } catch (err: any) {
          return sendError(res, err.message || 'Failed to connect to audio backend', 502);
        }
      }

      if (pathname === '/api/audio/generate' && req.method === 'POST') {
        try {
          const body = await parseJsonBody(req);
          let abcSource = body.abc;
          let calculatedTiming: any = undefined;
          const isInstrumental = body.isInstrumental !== undefined
            ? (isSectionPlanOnly(body.lyrics) ? true : Boolean(body.isInstrumental))
            : isSectionPlanOnly(body.lyrics);

          // If YAML provided, compile directly to ensure freshest ABC
          if (body.yaml && typeof body.yaml === 'string') {
            const result = compileYamlString(body.yaml, {
              knotId: body.knotId || body.knot,
              isInstrumental,
              tempo: body.tempo ? Number(body.tempo) : undefined,
            });
            abcSource = result.abcSource || abcSource;
            calculatedTiming = result.timing;
          }

          if (!abcSource) {
            return sendError(res, 'Missing ABC notation or YAML score', 400);
          }

          const effectiveDuration = body.duration ?? calculatedTiming?.durationSeconds;
          const effectiveTempo = body.tempo ?? calculatedTiming?.tempo;

          const resp = await fetch(`${audioBackendUrl}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              abc: abcSource,
              prompt: body.prompt || 'acoustic jazz trio with piano and bass',
              lyrics: body.lyrics,
              cot: body.cot || 'melody',
              temperature: body.temperature ?? 1.0,
              seed: body.seed,
              duration: effectiveDuration,
              tempo: effectiveTempo,
              engine: body.engine || 'mock',
              model_id: body.model_id,
            }),
          });
          const data = await resp.json();
          return sendJson(res, { ...data, abcSource, timing: calculatedTiming }, resp.status);
        } catch (err: any) {
          console.error('[audio] Error in /api/audio/generate:', err);
          return sendError(res, `Audio generation failed: ${err.message || 'Daemon unreachable'}`, 502);
        }
      }

      if (pathname.startsWith('/api/audio/jobs/') && req.method === 'GET') {
        const jobId = pathname.replace('/api/audio/jobs/', '');
        try {
          const resp = await fetch(`${audioBackendUrl}/jobs/${jobId}`);
          const data = await resp.json();
          return sendJson(res, data, resp.status);
        } catch (err: any) {
          return sendError(res, err.message, 502);
        }
      }

      if (pathname.startsWith('/api/audio/file/') && req.method === 'GET') {
        const filename = pathname.replace('/api/audio/file/', '');
        try {
          const resp = await fetch(`${audioBackendUrl}/audio/${filename}`);
          if (!resp.ok) return sendError(res, 'File not found on backend', 404);
          const buf = Buffer.from(await resp.arrayBuffer());
          let contentType = resp.headers.get('content-type') || 'audio/wav';
          if (filename.endsWith('.abc')) contentType = 'text/plain; charset=utf-8';
          else if (filename.endsWith('.json')) contentType = 'application/json; charset=utf-8';
          else if (filename.endsWith('.log')) contentType = 'text/plain; charset=utf-8';
          else if (filename.endsWith('.wav')) contentType = 'audio/wav';
          res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': buf.length,
            'Access-Control-Allow-Origin': '*',
          });
          return res.end(buf);
        } catch (err: any) {
          return sendError(res, err.message, 502);
        }
      }

      // POST /api/export-abc
      if (pathname === '/api/export-abc' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.yaml || !body.file) {
          return sendError(res, 'Missing yaml or file name', 400);
        }
        const fileName = basename(body.file).replace(/\.ppt\.yaml$/, '');
        const abcPath = join(SCORES_DIR, `${fileName}.abc`);
        const isInstrumental = body.isInstrumental !== undefined
          ? (isSectionPlanOnly(body.lyrics) ? true : Boolean(body.isInstrumental))
          : isSectionPlanOnly(body.lyrics);
        const tempo = body.tempo ? Number(body.tempo) : undefined;
        const result = compileYamlString(body.yaml, { knotId: body.knotId || body.knot, isInstrumental, tempo });
        if (result.abcSource) {
          writeFileSync(abcPath, result.abcSource, 'utf-8');
        }
        return sendJson(res, {
          success: true,
          abcFile: `${fileName}.abc`,
          abcSource: result.abcSource,
          timing: result.timing,
        });
      }

      // POST /api/export-pdf
      if (pathname === '/api/export-pdf' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.yaml || !body.file) {
          return sendError(res, 'Missing yaml or file name', 400);
        }
        const fileName = basename(body.file).replace(/\.ppt\.yaml$/, '');
        const lyPath = join(SCORES_DIR, `${fileName}.notation.ly`);
        const pdfOutPrefix = join(SCORES_DIR, fileName);

        try {
          const result = compileYamlString(body.yaml, { knotId: body.knotId || body.knot });
          writeFileSync(lyPath, result.lilypondSource, 'utf-8');

          await execFileAsync(lilypondPath, [
            '-dpoint-and-click',
            '-o',
            pdfOutPrefix,
            lyPath,
          ], { timeout: 20000 });

          const pdfPath = join(SCORES_DIR, `${fileName}.pdf`);
          let pdfBase64 = '';
          if (existsSync(pdfPath)) {
            pdfBase64 = readFileSync(pdfPath).toString('base64');
          }

          return sendJson(res, {
            success: true,
            pdfFile: `${fileName}.pdf`,
            pdfBase64,
          });
        } catch (err: any) {
          return sendError(res, err.stderr || err.message || 'LilyPond PDF export failed', 500, err.stack);
        }
      }

      return sendError(res, 'Not found', 404);
    } catch (err: any) {
      return sendError(res, err.message || 'Internal Server Error', 500, err.stack);
    }
  }

  // --- Static File Serving ---
  let filePath = join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!existsSync(filePath)) {
    filePath = join(PUBLIC_DIR, 'index.html');
  }

  try {
    const content = readFileSync(filePath);
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

const WITH_AUDIO = process.argv.includes('--with-audio') || 
                   process.argv.includes('--audio') || 
                   process.env.WITH_AUDIO === '1' ||
                   process.env.AUDIO === '1';

let audioProcess: ChildProcess | null = null;

async function checkAudioHealth(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      const data = await res.json() as any;
      return data.status === 'online';
    }
  } catch {
    // offline or unreachable
  }
  return false;
}

async function startAudioBackendIfNeeded(): Promise<void> {
  const isRunning = await checkAudioHealth(audioBackendUrl);
  if (isRunning) {
    console.log(`🎧 Audio backend connected at ${audioBackendUrl}\n`);
    return;
  }

  if (!WITH_AUDIO) {
    console.log(`🎧 Audio backend: offline (run 'npm run studio:audio' or pass '--with-audio' to start together)\n`);
    return;
  }

  console.log(`🎧 Starting Python Audio Backend (${audioBackendUrl})...`);
  const pythonCmd = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
  const mainScript = join(ROOT_DIR, 'audio-backend', 'main.py');

  try {
    audioProcess = spawn(pythonCmd, [mainScript], {
      cwd: ROOT_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    audioProcess.stdout?.on('data', (data) => {
      const lines = data.toString().trim().split('\n');
      for (const line of lines) {
        if (line.trim()) console.log(`[audio] ${line.trim()}`);
      }
    });

    audioProcess.stderr?.on('data', (data) => {
      const lines = data.toString().trim().split('\n');
      for (const line of lines) {
        if (line.trim()) console.log(`[audio] ${line.trim()}`);
      }
    });

    audioProcess.on('error', (err) => {
      console.error(`[audio] Failed to spawn Python backend: ${err.message}`);
      audioProcess = null;
    });

    audioProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.warn(`[audio] Python backend exited with code ${code}`);
      }
      audioProcess = null;
    });

    const cleanup = () => {
      if (audioProcess && !audioProcess.killed) {
        try {
          if (process.platform === 'win32' && audioProcess.pid) {
            execFile('taskkill', ['/pid', audioProcess.pid.toString(), '/f', '/t'], () => {});
          } else {
            audioProcess.kill('SIGTERM');
          }
        } catch {
          // ignore
        }
      }
    };

    process.on('exit', cleanup);
    process.on('SIGINT', () => { cleanup(); process.exit(0); });
    process.on('SIGTERM', () => { cleanup(); process.exit(0); });

    // Wait up to 5 seconds for health check to succeed
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (await checkAudioHealth(audioBackendUrl)) {
        console.log(`🎧 Audio backend successfully initialized at ${audioBackendUrl} (PID: ${audioProcess.pid})\n`);
        return;
      }
    }
    console.warn(`⚠️  Audio backend process launched (PID: ${audioProcess?.pid}), still initializing...\n`);
  } catch (err: any) {
    console.error(`[audio] Could not start audio backend: ${err.message}\n`);
  }
}

const PORT = parseInt(process.env.PORT || '3333', 10);
server.listen(PORT, async () => {
  console.log(`\n🎼 PPT Engraver Studio running at http://localhost:${PORT}`);
  console.log(`🎵 LilyPond path: ${lilypondPath} (${existsSync(lilypondPath) ? 'found' : 'not found'})`);
  await startAudioBackendIfNeeded();
});
