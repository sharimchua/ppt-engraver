# PPT Studio Backend Server (`studio/`)

## Purpose & Architecture

The `studio/` directory houses the interactive web development environment for PPT.
- **Backend (`studio/server.ts`)**: Fast Node.js / Express server compiling YAML scores on-the-fly, invoking LilyPond natively with `-dpoint-and-click`, and streaming PDF/SVG/JSON outputs.
- **Frontend (`studio/public/`)**: Single-page web IDE with CodeMirror editor, PDF.js renderer, interactive annotation links, and settings.

---

## Server Endpoints (`server.ts`)

| Endpoint | Method | Payload / Query | Output | Description |
|---|---|---|---|---|
| `/api/scores` | `GET` | - | `{ scores: [{ name, path, displayName, title, composer, arranger, tonic, tempo }] }` | Lists all `.ppt.yaml` files with parsed score metadata |
| `/api/score` | `GET` | `?file=...` | `{ name, content }` | Reads score YAML text |
| `/api/save` | `POST` | `{ file, content }` | `{ success, file }` | Saves YAML score file |
| `/api/delete` | `POST` | `{ file }` | `{ success, file }` | Deletes YAML score file and associated export artifacts |
| `/api/rename` | `POST` | `{ oldFile, newFile }` | `{ success, oldFile, newFile }` | Renames score YAML file and all associated compiled artifacts |
| `/api/snippets` | `GET` | - | `{ snippets: [{ id, label, displayText, desc, category, icon, context, snippet, file }] }` | Reads and parses all snippet templates in `snippets/` |
| `/api/compile` | `POST` | `{ yaml, format, knotId }` | `{ success, format, pdfBase64, svg, lilypondSource, onsets, sidecarMap, availableKnots, selectedKnotId, metrics }` | Compiles YAML with LilyPond for selected knot and returns PDF/SVG |
| `/api/export-pdf` | `POST` | `{ yaml, file, knotId }` | `{ success, pdfFile, pdfBase64 }` | Compiles & exports standalone PDF to `scores/` and streams base64 for browser download |

---

## Child DOX Index

- [studio/public/AGENTS.md](file:///d:/Development/Midlife%20Muso/ppt-engraver/studio/public/AGENTS.md) — Frontend client, CodeMirror modes, PDF.js viewer, Point-and-Click navigation, loupe magnifier.

---

## LilyPond Invocation Contract

- When compiling PDF:
  ```bash
  lilypond.exe -dpoint-and-click -o <tempOutPrefix> <tempLyPath>
  ```
- Fast Cairo/PostScript rendering provides sub-2-second compile cycles matching native Frescobaldi performance.
- Both PDF and SVG modes must output point-and-click anchors for live editor synchronization.
