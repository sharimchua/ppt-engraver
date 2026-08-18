# PPT Studio Frontend Web Client (`studio/public/`)

## Purpose & Scope

The `studio/public/` directory contains the client-side single-page application for PPT Studio (`index.html`, `app.js`, `style.css`).

---

## Core Features & Modules

### 1. CodeMirror YAML Editor
- **Custom Solfège & ID Reference Syntax Highlighting (`solfegeOverlay`)**:
  - Highlights Solfège tokens with PPT colors (`cm-solfege-do`, `cm-solfege-re`, etc.).
  - Token boundaries are strictly validated (`isValidSolfegeToken`) to avoid coloring YAML structure keywords (e.g. `mode`, `tempo`, `coils`) or identifiers (e.g. `bridge:`).
  - Sub-syllables in compound tokens (e.g. `FaMe`, `DoxDo`, `DoMeTe`) are individually highlighted in their respective colors.
  - **Clickable ID References vs Free Text (`cm-ppt-id-reference` / `cm-ppt-id-def`)**: Declared coil and weave IDs referenced in `parents:`, `concat:`, `coil:`, `weave:`, etc. are highlighted in vibrant sky cyan with a subtle dashed underline badge (`cm-ppt-id-reference`), distinguishing them from definitions (`cm-ppt-id-def`) and unresolved/free text strings.
- **Solfège Navigation & Transposition Shortcuts**:
  - `Ctrl+Up` / `Ctrl+Down` (`Cmd+Up` / `Cmd+Down`): Transpose active Solfège syllable (or individual sub-syllable in compound tokens like `FaMe`) up/down chromatically centered around `Do` (0) within the base octave from `So` (-5) to `Fi` (+6). Boundary crossings apply octave shifts (`Fi` + up $\to$ `So^`, `So` + down $\to$ `Fi_`), while preserving axis markers (`Dox` $\to$ `Rax`).
  - `Ctrl+Left` / `Ctrl+Right` (`Cmd+Left` / `Cmd+Right`): Navigate between Solfège tokens in lists/arrays; duplicates active syllable (`[Do, Re] -> [Do, Re, Re]`) when pressing `Ctrl+Right` at list end.
- **Go-to-Definition (`Ctrl+Click` / `Cmd+Click` / `F12`)**:
  - Hovering over declared or referenced structure IDs (including `parents: intro`, `parents: _verse_harm`, `parents: [a, b]`, `concat:`, `coil:`, `weave:`) with `Ctrl`/`Cmd` held highlights them (`.cm-id-reference-hover`).
  - Clicking on the reference identifier or `parents` keyword jumps the cursor directly to the definition in YAML with a pulse highlight (`.cm-point-click-flash`).
- **Code Folding & Section Collapsing**:
  - Fold gutter (`.CodeMirror-foldgutter`) with interactive `▾` (open) and `▸` (folded) markers on all hierarchical YAML blocks (`weaves:`, `coils:`, `song:`, `children:`, `melody:`, etc.).
  - Keyboard toggle: `Ctrl+Q` / `Cmd+Q` to collapse or expand the section at the cursor.
- **Standard Shortcuts**: Block comment (`Ctrl+/` / `Cmd+/`), bracket matching, auto-indent.

### 2. Project Management & Tapestry Operations
- **Open Tapestry (`Ctrl+O` / `Cmd+O` / Command Palette `Open Tapestry...`)**:
  - Interactive palette search filtering across all score files and rich metadata (`title`, `composer`, `arranger`, `tonic`, `tempo`, filename).
  - Shows metadata badges and subtitles for quick library navigation.
- **Create Tapestry (`Ctrl+N` / `Cmd+N` / `+` Toolbar Button / Command Palette `Create Tapestry...`)**:
  - Prompts for filename, score title, composer, and tonic root pitch.
  - Automatically scaffolds clean starter YAML score with PPT noteheads, compiles, and loads it into the editor.
- **Save Tapestry (`Ctrl+S` / `Cmd+S` / `💾 Save Tapestry` Button)**:
  - Persists the active tapestry to the `scores/` directory and updates the UI status badge and URL history.
- **Unsaved Changes Protection (`confirmDiscardUnsavedChanges`)**:
  - Automatically guards against accidental loss of unsaved tapestry modifications when switching scores via dropdown, tapestry palette (`Ctrl+O`), `+ New Tapestry` (`Ctrl+N`), browser back/forward navigation (`popstate`), and page reload/close (`beforeunload`).
  - Reverts dropdown selector and URL navigation if the user cancels the confirmation dialog.
- **Delete Tapestry (Command Palette `Delete Current Tapestry...`)**:
  - Prompts for confirmation and permanently removes the score YAML file and all associated compiled artifacts (`.notation.ly`, `.pdf`, `.ppt-map.json`, `.svg`) via `POST /api/delete`.

### 3. Refactoring Operations & Quick Actions
- **Extract into Parent Coil (`Ctrl+Alt+P` / `Cmd+Alt+P`)**:
  - Detects enclosing coil under cursor, prompts for new Parent ID, layer selection (`melody`, `rhythm`, `harmony`), and destination (`coils:` in current weave or top-level `tapestry.coils:`).
  - Automatically creates the parent definition and replaces extracted layers with `parents: <parentId>`.
- **Extract Inline Coil to Named Coil (`Ctrl+Alt+C` / `Cmd+Alt+C`)**:
  - Converts an inline child coil (`- coil:\n  id: ...`) in `children:` to a named entry in `coils:` and replaces the inline block with `- coil: <coilId>`.
- **Inline / Flatten Parent Coil (`Ctrl+Alt+I` / `Cmd+Alt+I`)**:
  - Pulls inherited layers from `parents: <parentId>` directly into the current coil and removes the `parents:` reference.
- **Group Selection into Weave (`Ctrl+Alt+W` / `Cmd+Alt+W`)**:
  - Extracts selected child lines into a new named weave definition under `weaves:` and replaces the selection with `- weave: <newWeaveId>`.
- **Rename Symbol / ID Globally (`F2`)**:
  - Scans definition and all references across `parents:`, `concat:`, `- coil:`, `- weave:` throughout the YAML document with symbol boundary precision.
- **Convert Melody: Interval $\leftrightarrow$ Absolute (`Ctrl+Alt+A` / `Cmd+Alt+A`)**:
  - Detects enclosing coil or active `melody: [...]` line and converts seamlessly between:
    - **Interval Mode** (anchor notehead with axis `x` + relative signed interval degree steps `Do`, `Re`, `Ti`, `Me`, etc.)
    - **Absolute Mode** (absolute chromatic scale degrees relative to tonic `Do`).
  - Available via `Ctrl+Alt+A`, Command Palette `Convert Melody: Interval to Absolute`, and `Convert Melody: Absolute to Interval`.

### 4. Contextual Autocomplete, Snippets & Command Palette
- **Rich Context Autocomplete (`Ctrl+Space`)**:
  - Custom hint renderer displaying category badges: `[SNIP]` (Cyan), `[COIL]` (Green), `[WEAVE]` (Purple), `[NOTE]` (Solfège Pill with PPT color swatch), `[ENUM]` (Amber), `[PROP]` (Slate).
  - **Precision Scope & Property Enums**: Accurately scopes suggestions based on YAML block hierarchy and active property (`harmonyVoicing:`, `melodyAugmentation:`, `melodyAugmentationDisplay:`, `projection:`, `melodyClef:`, `harmonyClef:`, `noteheadStyle:`, `show:`, inside brackets `[...]`, or inside `engraving:`, `coils:`, `weaves:`, `children:`).
- **Dynamic YAML Snippets Library (`snippets/*.yaml`)**:
  - Automatically loads and watches modular snippet files from `snippets/*.yaml` via `/api/snippets`.
  - Seamlessly injected into CodeMirror contextual autocomplete (`Ctrl+Space`) and registered into the Command Palette (`Ctrl+Shift+P`) dynamically.
  - Adding or modifying snippet files in `snippets/` takes effect immediately on reload without code modifications.
- **Searchable Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P` / `F1` / `⌨ Commands` button)**:
  - Filterable command list with instant fuzzy search across all project operations, refactorings, score metadata, dynamically registered snippets, folding, navigation, and compilation tools with full keyboard navigation (`↑`/`↓`/`Enter`/`Esc`).

### 5. Lightweight Text-Aligned Solfège Preview Strip & Paired Layer Highlighting
- **Line Widget (`.cm-token-solfege-strip`)**:
  - Active on `melody:`, `harmony:`, `rhythm:`, `chords:`, `pitches:` lines, and nested polyphonic voice arrays (`- [...]`, `- pitches:`).
  - Floats directly above the line being edited with pixel-accurate token alignment.
  - **Dual Melody Representation Row**: For `melody` lines, displays two vertically stacked rows:
    - **Upper Row (Alternative View, `.cm-token-solfege-row-alt`)**: Displays the alternative representation (computed **Absolute** degrees when defined in **Interval** mode with axis anchor `x`, or computed **Interval** steps when defined in **Absolute** mode) with an `ALT: ABS` / `ALT: INT` badge.
    - **Lower Row (Written View, `.cm-token-solfege-row-main`)**: Displays the written tokens as authored in YAML with a `WRITTEN: INT` / `WRITTEN: ABS` badge.
    - **Single Row**: Displays a single contextual preview row for `rhythm` (`RHY`), `harmony` (`HARM`), and `chords`.
  - Dynamically calculates pixel `left` coordinates to center vector SVG Solfège glyphs directly over each token.
  - Active token highlighted in both rows in sync with cursor position.
- **Paired Music Layer Token Highlighting (`.cm-paired-token-highlight`)**:
  - **Melodic Pairing (`melody` $\leftrightarrow$ `rhythm`)**: Highlights 1-to-1 onset equivalents between melody and melodic rhythm (including across parent/child `parents:` references).
  - **Structured Harmony Pairing (`chords` $\leftrightarrow$ `harmony.rhythm`)**: Scopes structured harmony blocks (`harmony:\n chords: [...]\n rhythm: [...]`), directly pairing `chords` against their own `harmony.rhythm` via local block scanning (`findAdjacentStructuredHarmonyLine`).
  - **Unstructured Harmony Handling**: Simple harmony arrays without explicit rhythm declarations (e.g. `harmony: [Fa, Do, So^, Do]`) do not force an erroneous 1-to-1 token alignment with melodic rhythm onsets.
  - **Onset-Aware Repeat Expansion**: Accurately maps lookback repeat tokens (`X.Y`, `X` e.g. `2.2`, `1.2`) to their expanded onset ranges so cursor positions before and after repeats map seamlessly across layers.

### 6. Bidirectional Navigation & Real-Time Score Highlighting
- **PDF Mode (`renderPdfPages`) & SVG Mode**:
  - Extracts annotations via `page.getAnnotations()` or SVG `textedit://` links.
  - Non-HTTP links are decoded via `resolveTagFromLyLine` to bind full provenance metadata (`dataset.coilId`, `dataset.sourceCoilId`, `dataset.melodySourceCoil`, `dataset.rhythmSourceCoil`, `dataset.harmonySourceCoil`, `dataset.weaveId`, `dataset.layer`, `dataset.voiceIndex`, `dataset.onsetIndex`, `dataset.sourceOnsetIndex`).
  - Renders transparent clickable overlays (`.pdf-point-click-link`) over every notehead.
- **Line-to-Score Real-Time Highlighting (Editor $\to$ Preview, 1-to-Many)**:
  - Scoped strictly to declarative music lines (`melody:`, `harmony:`, `rhythm:`, `chords:`, `pitches:`), polyphonic voice bullet items, and compositional/structural lines (`coil:`, `weave:`, `concat:`, `parents:`, `children:`, structure definition headers).
  - When focused on a specific melody voice line (e.g. voice 2 in a polyphonic melody array), only noteheads in that specific voice receive highlights (`dataset.voiceIndex === targetVoiceIndex`), ignoring other parallel melody voices and other layers.
  - When focused on a specific token on that line, the matching onset in that layer receives `.score-highlight-primary` (gold halo), while the remaining noteheads in that layer/voice receive `.score-highlight-active` (blue halo).
  - On non-declarative lines (metadata, titles, tempos, settings, comments), preview highlighting is automatically deactivated.
- **Navigation Handler (`handlePointAndClick`, Preview $\to$ Editor)**:
  - Traces concatenated sub-coils (e.g. `full_verse` $\to$ `_verse2`) and inherited parents (e.g. `intro4` $\to$ `intro_turnaround`) to their origin coil.
  - For polyphonic melody lines, navigates directly to the specific voice array line (e.g. the 2nd bullet item in `melody:`) and column for that note.
  - For structured harmony blocks, navigates directly to `chords:` or the relevant harmony entry.
  - Moves cursor (`editor.setCursor`), scrolls into view (`editor.scrollIntoView`), and triggers a blue pulse highlight (`.cm-point-click-flash`).

### 6. Interactive UX & Viewport Controls
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
