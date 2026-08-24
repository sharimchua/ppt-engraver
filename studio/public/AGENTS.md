The `studio/public/` directory contains the client-side single-page application for PPT Studio (`index.html`, `style.css`, and modular ES modules under `js/`).

### Modular Architecture (`js/`)

- **`js/state.js`**: Centralized reactive state store, preferences persistence (`localStorage`), and event bus (`events`).
- **`js/api.js`**: Typed asynchronous client for PPT Studio backend REST endpoints (`/api/compile`, `/api/scores`, `/api/score`, `/api/save`, `/api/delete`, `/api/rename`, `/api/snippets`, `/api/config`, `/api/export-pdf`).
- **`js/core/`**:
  - `solfege.js`: 12-chromatic Solfège degree definitions, canonical colors, and whole-token validators.
  - `pitch.js`: Semitone intervals, transposition math, and Dual Melody mode conversions (Interval $\leftrightarrow$ Absolute).
  - `rhythm.js`: PPT rhythm timeline resolution, lookback repeats, downbeat phase detection, and grammar optimization.
  - `glyphs.js`: SVG Solfège glyph generator (geometric rotations, axis anchors, octave triangles).
  - `ast-scanner.js`: Fast YAML structural scanner, enclosing coil/weave detectors, and LilyPond provenance tag resolvers.
- **`js/editor/`**:
  - `editor.js`: CodeMirror initialization, lifecycle, addons, and folding.
  - `solfege-mode.js`: Syntax highlighting overlay for Solfège degrees and sky-cyan ID references.
  - `shortcuts.js`: Keyboard navigation, chromatic Solfège transposition, property sibling reordering, and block duplication.
  - `autocomplete.js`: Contextual autocomplete provider and dynamic YAML snippet hints.
  - `definition.js`: Go-to-Definition (`Ctrl+Click` / `F12`) and ID hover highlights.
  - `solfege-strip.js`: Text-aligned floating line preview widget with Dual Melody rows.
  - `paired-highlights.js`: Synchronized token highlight markers across paired music layers.
- **`js/preview/`**:
  - `pdf-viewer.js`: Mozilla PDF.js multi-page renderer and Point-and-Click link overlays.
  - `svg-viewer.js`: SVG sheet music renderer with Point-and-Click bindings.
  - `score-highlighter.js`: Real-time bidirectional notehead halo highlighting.
  - `loupe.js`: Circular magnifying glass canvas tool.
  - `diagnostics.js`: Diagnostics onset table and LilyPond source code viewer.
  - `preview.js`: Preview tab switcher, loading cards, and viewport coordinator.
- **`js/modals/`**:
  - `modal-manager.js`: Generic refactor form dialog controller.
  - `command-palette.js`: Fuzzy searchable Command Palette (`Ctrl+Shift+P`) and Symbol Palette (`Ctrl+G`).
  - `tapestry-modals.js`: Create, Delete, Rename Tapestry dialogs and unsaved changes safety guard.
  - `tonic-modal.js`: Non-destructive Tonic & Mode Pitch Transposition dialog.
  - `rhythm-modal.js`: Rhythmic Period Transposition & Grammar Optimizer dialog.
  - `refactor-dialogs.js`: Structural refactorings (Extract Parent, Extract Inline, Inline Parent, Extract Weave, Rename Symbol).
  - `settings-modal.js`: Studio settings and preferences modal.
- **`js/ui/`**:
  - `toolbar.js`: Top header bar, score picker, and knot projection dropdowns.
  - `split-pane.js`: Draggable split pane gutter with size persistence.
  - `zoom-controls.js`: Zoom in/out/fit/reset controls.
  - `notifications.js`: Status badges, save indicators, and error banners.
- **`js/main.js`**: Application bootstrap entry point wiring all components and event channels.

---

## Core Features & Modules

### 1. CodeMirror YAML Editor
- **Custom Solfège & ID Reference Syntax Highlighting (`solfegeOverlay`)**:
  - Highlights Solfège tokens with PPT colors (`cm-solfege-do`, `cm-solfege-re`, etc.).
  - Token boundaries are strictly validated (`isValidSolfegeToken`) to avoid coloring YAML structure keywords (e.g. `mode`, `tempo`, `coils`) or identifiers (e.g. `bridge:`).
  - Sub-syllables in compound tokens (e.g. `FaMe`, `DoxDo`, `DoMeTe`) are individually highlighted in their respective colors.
  - **Clickable ID References vs Free Text (`cm-ppt-id-reference` / `cm-ppt-id-def`)**: Declared coil and weave IDs referenced in `parents:`, `concat:`, `coil:`, `weave:`, etc. are highlighted in vibrant sky cyan with a subtle dashed underline badge (`cm-ppt-id-reference`), distinguishing them from definitions (`cm-ppt-id-def`) and unresolved/free text strings.
- **Contextual Solfège & Structural Navigation Shortcuts**:
  - **On Solfège Syllable**:
    - `Ctrl+Up` / `Ctrl+Down` (`Cmd+Up` / `Cmd+Down`): Transpose active Solfège syllable (or individual sub-syllable in compound tokens like `FaMe`) up/down chromatically centered around `Do` (0) within the base octave from `So` (-5) to `Fi` (+6). Correctly retains and computes existing octave displacements (`So^` down $\to$ `Fi`, `So_` up $\to$ `Le_`, `Fi` up $\to$ `So^`), and preserves axis markers (`Dox` $\to$ `Rax`).
    - `Ctrl+Alt+Up` / `Ctrl+Alt+Down` (`Cmd+Alt+Up` / `Cmd+Alt+Down`): Shift active syllable octave up/down (+1 / -1 octave) by appending or stripping `^` / `_` modifiers (e.g. `Do` $\to$ `Do^` $\to$ `Do^^`, `Do` $\to$ `Do_`).
    - `Ctrl+Left` / `Ctrl+Right` (`Cmd+Left` / `Cmd+Right`): Navigate between Solfège tokens in lists/arrays; duplicates active syllable (`[Do, Re] -> [Do, Re, Re]`) when pressing `Ctrl+Right` at list end.
  - **On Property Line / Structure Block**:
    - `Ctrl+Up` / `Ctrl+Down` (`Cmd+Up` / `Cmd+Down`): Navigate cursor to previous/next **property sibling** at the exact same indentation level (skipping indented child blocks).
    - `Ctrl+Alt+Up` / `Ctrl+Alt+Down` (`Cmd+Alt+Up` / `Cmd+Alt+Down`): **Reorder property / array item** up/down within parent container boundaries (blocked at boundary edges).
  - **Global Duplication**:
    - `Ctrl+Alt+Enter` (`Cmd+Alt+Enter`): Contextually duplicates enclosing coil/weave/knot or array item below with auto-incremented ID and cursor focus.
- **Go to Named Reference / Symbol Palette (`Ctrl+G` / `Cmd+G`)**:
  - Fast searchable symbol palette with prefix filtering:
    - `w:` or `weave:` $\to$ filter Weaves only (`[WEAVE]`)
    - `c:` or `coil:` $\to$ filter Coils only (`[COIL]`)
    - `k:` or `knot:` $\to$ filter Knots only (`[KNOT]`)
    - `s:` or `section:` $\to$ filter top-level Sections only (`[SECTION]`)
    - Plain query $\to$ fuzzy search all symbols with definition line preview.
  - Jumping scrolls directly to definition in CodeMirror and pulses the line (`.cm-point-click-flash`).
- **Go-to-Definition (`Ctrl+Click` / `Cmd+Click` / `F12`)**:
  - Hovering over declared or referenced structure IDs (including `parents: intro`, `parents: _verse_harm`, `parents: [a, b]`, `concat:`, `coil:`, `weave:`) with `Ctrl`/`Cmd` held highlights them (`.cm-id-reference-hover`).
  - Clicking on the reference identifier or `parents` keyword jumps the cursor directly to the definition in YAML with a pulse highlight (`.cm-point-click-flash`).
- **Code Folding & Section Collapsing**:
  - Fold gutter (`.CodeMirror-foldgutter`) with interactive `▾` (open) and `▸` (folded) markers on all hierarchical YAML blocks (`weaves:`, `coils:`, `song:`, `children:`, `melody:`, etc.).
  - Keyboard toggle: `Ctrl+Q` / `Cmd+Q` to collapse or expand the section at the cursor.
- **Standard Shortcuts**: Block comment (`Ctrl+/` / `Cmd+/`), bracket matching, auto-indent.

### 2. Project Management & Tapestry Operations
- **Branding & Header Elements**:
  - Official Prime Period Theory vector logo (`logo.svg`) displayed in app header and configured as SVG favicon.
- **Auto-Compile Toggle Control**:
  - Auto-compile checkbox in the main toolbar group (`#chk-autocompile`) and Settings modal allows enabling/disabling automatic debounced recompilation on YAML edits.
  - Preference persisted in `localStorage` (`ppt_autocompile`) and toggleable via Command Palette.
- **Open Tapestry (`Ctrl+O` / `Cmd+O` / Command Palette `Open Tapestry...`)**:
  - Interactive palette search filtering across all score files and rich metadata (`title`, `composer`, `arranger`, `tonic`, `tempo`, filename).
  - Shows metadata badges and subtitles for quick library navigation.
- **Create Tapestry (`Ctrl+N` / `Cmd+N` / `+` Toolbar Button / Command Palette `Create Tapestry...`)**:
  - Prompts for filename, score title, composer, and tonic root pitch.
  - Automatically scaffolds clean starter YAML score with PPT noteheads, compiles, and loads it into the editor.
- **Rename Tapestry File (Command Palette `Rename Tapestry File & Artifacts...`)**:
  - Prompts for new filename and renames the primary score YAML file along with all associated compilation artifacts (`.notation.ly`, `.pdf`, `.ppt-map.json`, `.svg`, `.cropped.svg`, `.mid`) via `POST /api/rename`.
  - Automatically refreshes the tapestry library and updates active URL deeplinks.
- **Save Tapestry (`Ctrl+S` / `Cmd+S` / `💾 Save Tapestry` Button)**:
  - Persists the active tapestry to the `scores/` directory and updates the UI status badge and URL history.
- **Unsaved Changes Protection (`confirmDiscardUnsavedChanges`)**:
  - Automatically guards against accidental loss of unsaved tapestry modifications when switching scores via dropdown, tapestry palette (`Ctrl+O`), `+ New Tapestry` (`Ctrl+N`), browser back/forward navigation (`popstate`), and page reload/close (`beforeunload`).
  - Reverts dropdown selector and URL navigation if the user cancels the confirmation dialog.
- **Delete Tapestry (`🗑️` Toolbar Button / Command Palette `Delete Current Tapestry...`)**:
  - Prompts for confirmation and permanently removes the score YAML file and all associated compiled artifacts (`.notation.ly`, `.pdf`, `.ppt-map.json`, `.svg`) via `POST /api/delete`.

### 3. Refactoring Operations & Transposition Tools
- **Non-Destructive Tonic & Mode Pitch Transposition Modal (`Transpose Tonic & Mode (Preserve Pitch)...`)**:
  - Shifts "Do" root anchor across mode presets (Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian) or custom target pitch/shift.
  - Non-destructively preserves sounding concert pitch by transposing Solfège syllables across `melody:`, `harmony:`, and `pitches:` inversely while updating `knot.tonic`.
- **Rhythmic Period Transposition & Grammar Optimizer Modal (`Transpose Rhythmic Period & Optimize Grammar...`)**:
  - Scales beat period length ($2\times, 0.5\times, 4\times, 0.25\times, 1.5\times, 3\times$) to alter downbeat density.
  - **Downbeat & Harmony Phase Alignment**: Automatically detects chord change downbeats from `harmony.rhythm` and applies an optimal phase offset ($\phi$) so that pickups (e.g. 3-beat pickup in Autumn Leaves) land on proper offbeat subdivisions while primary chord changes land on clean `Do` downbeats.
  - Features an automated **Grammar Optimization Suggester** that analyzes onset timestamps and recommends the period length that minimizes `Dox` delays and compound suffixes (`LeFi`, `MeFi`).
  - Optional tempo compensation to preserve real-time playback duration.
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
  - Scans definition and all references across `parents:`, `parent:`, `concat:`, `harmony:`, `chords:`, `rhythm:`, `melody:`, `pitches:`, `from:`, `use:`, `- coil:`, `- weave:`, and dot-path references (e.g. `changes.harmony`) throughout the YAML document with symbol boundary precision.
- **Convert Melody: Interval $\leftrightarrow$ Absolute (`Ctrl+Alt+A` / `Cmd+Alt+A`)**:
  - Converts seamlessly between **Interval Mode** (anchor notehead with axis `x` + relative interval tokens) and **Absolute Mode** (chromatic scale degrees relative to Do).

### 4. Contextual Autocomplete, Snippets & Command Palette
- **Rich Context Autocomplete (`Ctrl+Space`)**:
  - Custom hint renderer in elevated dark popup (`.CodeMirror-hints`, `.cm-ppt-hint-item`) displaying high-contrast typography, descriptions, and category badges: `[SNIP]` (Cyan), `[COIL]` (Green), `[WEAVE]` (Purple), `[KNOT]` (Pink), `[NOTE]` (Solfège Pill with PPT color swatch and SVG glyph), `[ENUM]` (Amber), `[PROP]` (Slate).
  - **Precision Scope & Property Enums**: Accurately scopes suggestions based on YAML block hierarchy and active property (`harmonyVoicing:`, `melodyAugmentation:`, `melodyAugmentationDisplay:`, `projection:`, `melodyClef:`, `harmonyClef:`, `noteheadStyle:`, `show:`, inside brackets `[...]`, or inside `engraving:`, `coils:`, `weaves:`, `children:`).
- **Dynamic YAML Snippets Library (`snippets/*.yaml`)**:
  - Automatically loads and watches modular snippet files from `snippets/*.yaml` via `/api/snippets`.
  - Seamlessly injected into CodeMirror contextual autocomplete (`Ctrl+Space`) and registered into the Command Palette (`Ctrl+Shift+P`) dynamically.
  - Adding or modifying snippet files in `snippets/` takes effect immediately on reload without code modifications.
- **Searchable Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P` / `F1` / `⌨ Commands` button)**:
  - Filterable command list with instant fuzzy search across all project operations, refactorings, score metadata, dynamically registered snippets, folding, navigation, and compilation tools with full keyboard navigation (`↑`/`↓`/`Enter`/`Esc`).
  - **Quick Preference Toggles**: Directly toggle Auto-Compile, Solfège Highlighting, Melody Previews, Autocompletion, Coil Suggestions, or open Settings without leaving the keyboard.

### 5. Lightweight Text-Aligned Solfège Preview Strip & Paired Layer Highlighting
- **Line Widget (`.cm-token-solfege-strip`)**:
  - Active on `melody:`, `harmony:`, `rhythm:`, `chords:`, `pitches:` lines, and nested polyphonic voice arrays (`- [...]`, `- pitches:`).
  - Floats directly above the line being edited with pixel-accurate token alignment.
  - **Dual Melody Representation Row**: For `melody` lines, displays two vertically stacked rows:
    - **Upper Row (Alternative View, `.cm-token-solfege-row-alt`)**: Displays the alternative representation (computed **Absolute** degrees when defined in **Interval** mode with axis anchor `x`, or computed **Interval** steps when defined in **Absolute** mode) with an `ALT: ABS` / `ALT: INT` badge.
    - **Lower Row (Written View, `.cm-token-solfege-row-main`)**: Displays the written tokens as authored in YAML with a `WRITTEN: INT` / `WRITTEN: ABS` badge.
    - **Single Row**: Displays a single contextual preview row for `rhythm` (`RHY`), `harmony` (`HARM`), and `chords`.
  - **Octave Displacement Prefix Triangles**: Renders directional vector triangles (pointing UP `▲` for `^` / $+1$, $+2$, and pointing DOWN `▼` for `_` / $-1$, $-2$) prefixed to the left of the syllable glyph in the syllable's color, vertically stacked for multi-octave leaps without offsetting the syllable centroid.
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

### 7. Interactive UX & Viewport Controls
- **Enhanced Empty Preview & Loading Cards**:
  - Replaces plain placeholder text with a PPT Studio welcome card featuring the official vector logo, product title/subtitle, quick-reference keyboard shortcuts grid (`Ctrl+Enter`, `Ctrl+O`, `Ctrl+Shift+P`, `Ctrl+↑/↓`, `Ctrl+Alt+↑/↓`, `Ctrl+Space`), and direct quick action buttons (`▶ Compile Tapestry`, `📂 Open Score...`).
  - While compiling/loading scores, displays an animated PPT spinner ring with pulsing vector branding and descriptive compilation progress.
- **Scroll Depth Preservation & Loading Reset**:
  - Automatically captures and restores preview window scroll position (`scrollTop` / `scrollLeft`) across PDF and SVG compilations during live editing of the same score.
  - When loading or switching to a new tapestry (`loadScore`, `createTapestry`), immediately clears the previous score from the preview canvas, resets scroll to top (`0, 0`), and displays the loading status card for responsive feedback.
- **Knot Projection Selector & Deeplinking (`#knot-select`)**:
  - Live dropdown in top toolbar header right after the tapestry score picker, dynamically listing all declared score knots in declaration order (`availableKnots`).
  - Switching projections triggers immediate recompilation and updates URL search parameter `?score=...&knot=<knotId>` and history state.
  - Retains knot selection across browser refreshes, bookmarks, and back/forward navigation (`popstate`).
- **Draggable Split-Pane**: Resize editor and preview with min-width constraints (320px).
- **Circular Loupe Magnifier**: Inspect dense score details with customizable lens diameter and magnification level (`Shift` shortcut).
- **URL Deeplinking & History**:
  - Shareable score & knot URLs: `?score=autumn_leaves_variants.ppt.yaml&knot=leadSheet`.
  - Remembers active score and knot projection across page refreshes via `localStorage` and `history.replaceState`.
  - Full browser Back/Forward navigation support (`popstate`).

---

## Maintenance Guidelines

- **Vanilla Stack**: All client logic is pure Vanilla JavaScript (ES6+), HTML5, and CSS3 without heavy front-end framework dependencies.
- **High Performance**: Ensure PDF rendering runs efficiently with canvas reuse and debounced re-renders during editing.
