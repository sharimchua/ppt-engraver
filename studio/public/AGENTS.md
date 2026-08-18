# PPT Studio Frontend Web Client (`studio/public/`)

## Purpose & Scope

The `studio/public/` directory contains the client-side single-page application for PPT Studio (`index.html`, `app.js`, `style.css`).

---

## Core Features & Modules

### 1. CodeMirror YAML Editor
- **Custom Solfège Syntax Highlighting (`solfegeOverlay`)**:
  - Highlights Solfège tokens with PPT colors (`cm-solfege-do`, `cm-solfege-re`, etc.).
  - Token boundaries are strictly validated (`isValidSolfegeToken`) to avoid coloring YAML structure keywords (e.g. `mode`, `tempo`, `coils`) or identifiers (e.g. `bridge:`).
  - Sub-syllables in compound tokens (e.g. `FaMe`, `DoxDo`, `DoMeTe`) are individually highlighted in their respective colors.
- **Shortcuts**: Block comment (`Ctrl+/` / `Cmd+/`), bracket matching, auto-indent.

### 2. Lightweight Text-Aligned Solfège Preview Strip
- **Line Widget (`.cm-token-solfege-strip`)**:
  - Active strictly on `melody:`, `harmony:`, and `rhythm:` lines.
  - Floats directly above the line being edited.
  - Dynamically calculates pixel `left` coordinates to center vector SVG Solfège glyphs directly over each token.
  - Light high-contrast background (`#edf2f7`) ensuring readability.
  - Axis diacritics dynamically stroke-colored to match the syllable's color.

### 3. Frescobaldi-Style Point-and-Click Navigation (Preview $\to$ Editor)
- **PDF Mode (`renderPdfPages`)**:
  - Extracts annotations via `page.getAnnotations()`.
  - Non-HTTP links (like `textedit://`) are read from `annot.unsafeUrl || annot.url`.
  - Renders transparent clickable link overlays (`.pdf-point-click-link`) over every notehead.
- **Navigation Handler (`handlePointAndClick`)**:
  - Maps `textedit:///...:line:col` $\to$ LilyPond line $\to$ `\tag #'ppt_${coilId}_...` $\to$ `SidecarMap`.
  - Finds the exact coil and onset token in the YAML document.
  - Moves cursor (`editor.setCursor`), scrolls into view (`editor.scrollIntoView`), and triggers a blue pulse highlight (`.cm-point-click-flash`).

### 4. Interactive UX & Viewport Controls
- **Draggable Split-Pane**: Resize editor and preview with min-width constraints (320px).
- **Circular Loupe Magnifier**: Inspect dense score details with customizable lens diameter and magnification level (`Shift` shortcut).
- **URL Deeplinking & History**:
  - Shareable score URLs: `?score=strive.ppt.yaml`.
  - Remembers active score across page refreshes via `localStorage` and `history.replaceState`.
  - Full browser Back/Forward navigation support (`popstate`).

---

## Maintenance Guidelines

- **Vanilla Stack**: All client logic is pure Vanilla JavaScript (ES6+), HTML5, and CSS3 without heavy front-end framework dependencies.
- **High Performance**: Ensure PDF rendering runs efficiently with canvas reuse and debounced re-renders during editing.
