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
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, extname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { compileYamlString } from '../src/compiler/compile.js';

const execFileAsync = promisify(execFile);

// Determine base paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const ROOT_DIR = resolve(__dirname, '..');
const SCORES_DIR = resolve(ROOT_DIR, 'scores');
const PUBLIC_DIR = resolve(__dirname, 'public');

// Ensure scores directory exists
if (!existsSync(SCORES_DIR)) {
  mkdirSync(SCORES_DIR, { recursive: true });
}

// Configurable LilyPond binary path
let lilypondPath = process.env.LILYPOND_PATH || process.env.LILYPOND_BIN || 'C:\\lilypond-2.24.4\\bin\\lilypond.exe';

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
 * Compiles a YAML string to LilyPond .ly and runs LilyPond to produce PDF (super-fast native backend).
 */
async function compileScore(yamlContent: string, format = 'pdf') {
  const startTime = Date.now();
  
  // 1. In-memory YAML -> LilyPond compilation (runs in ~10-20ms)
  const result = compileYamlString(yamlContent);
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
        onsets: result.onsets,
        sidecarMap: result.sidecarMap,
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
        onsets: result.onsets,
        sidecarMap: result.sidecarMap,
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
        const result = await compileScore(body.yaml, body.format || 'pdf');
        return sendJson(res, result);
      }

      // GET /api/scores
      if (pathname === '/api/scores' && req.method === 'GET') {
        const files = readdirSync(SCORES_DIR)
          .filter(f => f.endsWith('.ppt.yaml'))
          .map(f => ({
            name: f,
            path: f,
            displayName: f.replace('.ppt.yaml', ''),
          }));
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

      // GET /api/config
      if (pathname === '/api/config' && req.method === 'GET') {
        return sendJson(res, {
          lilypondPath,
          exists: existsSync(lilypondPath),
        });
      }

      // POST /api/config
      if (pathname === '/api/config' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        if (body.lilypondPath && typeof body.lilypondPath === 'string') {
          lilypondPath = body.lilypondPath;
        }
        return sendJson(res, {
          lilypondPath,
          exists: existsSync(lilypondPath),
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

        const result = compileYamlString(body.yaml);
        writeFileSync(lyPath, result.lilypondSource, 'utf-8');

        await execFileAsync(lilypondPath, [
          '-o',
          pdfOutPrefix,
          lyPath,
        ], { timeout: 20000 });

        return sendJson(res, {
          success: true,
          pdfFile: `${fileName}.pdf`,
        });
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

const PORT = parseInt(process.env.PORT || '3333', 10);
server.listen(PORT, () => {
  console.log(`\n🎼 PPT Engraver Studio running at http://localhost:${PORT}`);
  console.log(`🎵 LilyPond path: ${lilypondPath} (${existsSync(lilypondPath) ? 'found' : 'not found'})\n`);
});
