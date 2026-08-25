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
import { execFile } from 'node:child_process';
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
async function compileScore(yamlContent: string, format = 'pdf', knotId?: string) {
  const startTime = Date.now();
  
  // 1. In-memory YAML -> LilyPond compilation (runs in ~10-20ms)
  const result = compileYamlString(yamlContent, { knotId });
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
        availableKnots: result.availableKnots,
        selectedKnotId: result.selectedKnotId,
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
        availableKnots: result.availableKnots,
        selectedKnotId: result.selectedKnotId,
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
        const result = await compileScore(body.yaml, body.format || 'pdf', body.knotId || body.knot);
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
          `${baseName}.cropped.svg`
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
            '.midi'
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

const PORT = parseInt(process.env.PORT || '3333', 10);
server.listen(PORT, () => {
  console.log(`\n🎼 PPT Engraver Studio running at http://localhost:${PORT}`);
  console.log(`🎵 LilyPond path: ${lilypondPath} (${existsSync(lilypondPath) ? 'found' : 'not found'})\n`);
});
