/**
 * Command Palette (Ctrl+Shift+P / F1) & Symbol Reference Palette (Ctrl+G)
 */

import { state } from '../state.js';
import { getLineIndent } from '../core/ast-scanner.js';

let isTapestryPickerMode = false;
let isGotoSymbolMode = false;
let paletteActiveIndex = 0;
let paletteFilteredCommands = [];

const RESERVED_SCHEMA_KEYS = new Set([
  'tapestry', 'knot', 'knots', 'weaves', 'coils', 'children', 'stitch', 'stitches', 'melody',
  'rhythm', 'harmony', 'chords', 'pitches', 'concat', 'parents', 'show',
  'song', 'title', 'composer', 'arranger', 'tempo', 'tonic', 'colorNotes',
  'omitStem', 'octave', 'meter', 'duration', 'harmonyOctave', 'harmonyClef',
  'melodyClef', 'voice', 'voices', 'harmonyStaffStyle', 'showHarmonyCoil',
  'showTraditionalHarmony', 'harmonyChangesOnly', 'color', 'harmonyVoicing',
  'melodyAugmentation', 'melodyAugmentationDisplay', 'projection', 'abstract',
  'hidden', 'parent', 'key', 'timeSignature', 'measure', 'measures'
]);

export function scanAllSymbolsInDocument(editor) {
  if (!editor) return [];
  const lines = editor.getValue().split('\n');
  const symbols = [];
  let currentSection = null;

  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const indent = getLineIndent(line);

    const sectionMatch = line.match(/^(\s*)(tapestry|knot|knots|weaves|coils|engraving)\s*:/i);
    if (sectionMatch) {
      const secName = sectionMatch[2].toLowerCase();
      if (indent === 0 || secName === 'weaves' || secName === 'coils' || secName === 'knots' || secName === 'knot' || secName === 'engraving') {
        symbols.push({
          type: 'section',
          id: sectionMatch[2],
          line: l,
          ch: line.indexOf(sectionMatch[2]),
          subtitle: 'Section header',
        });
        currentSection = secName;
        continue;
      }
    }

    const dictMatch = line.match(/^(\s*)([_a-zA-Z0-9]+)\s*:(?!\s*\[)(.*)$/);
    if (dictMatch) {
      const key = dictMatch[2];
      if (!RESERVED_SCHEMA_KEYS.has(key.toLowerCase())) {
        let type = 'coil';
        if (currentSection === 'weaves') type = 'weave';
        else if (currentSection === 'knots') type = 'knot';
        else if (currentSection === 'coils') type = 'coil';

        let preview = '';
        if (l + 1 < lines.length) {
          const nextL = lines[l + 1].trim();
          if (nextL.startsWith('melody:') || nextL.startsWith('stitch:') || nextL.startsWith('children:') || nextL.startsWith('weave:') || nextL.startsWith('tonic:')) {
            preview = nextL.slice(0, 40);
          }
        }

        symbols.push({
          type,
          id: key,
          line: l,
          ch: line.indexOf(key),
          subtitle: preview,
        });
      }
    }

    const inlineMatch = line.match(/^\s*-\s*(coil|weave)\s*:\s*["']?([_a-zA-Z0-9]+)["']?/i);
    if (inlineMatch) {
      symbols.push({
        type: inlineMatch[1].toLowerCase(),
        id: inlineMatch[2],
        line: l,
        ch: line.indexOf(inlineMatch[2]),
        subtitle: 'Inline reference',
      });
    }
  }

  return symbols;
}

export function setupCommandPalette(options = {}) {
  const {
    getEditor,
    getAllCommandsList,
    onLoadScore,
  } = options;

  const commandPaletteModal = document.getElementById('command-palette-modal');
  const paletteBackdrop = document.getElementById('palette-backdrop');
  const paletteSearchInput = document.getElementById('palette-search-input') || document.getElementById('palette-search');
  const paletteListEl = document.getElementById('palette-list');
  const btnCommandPalette = document.getElementById('btn-command-palette');

  function openPalette(mode = 'commands') {
    if (!commandPaletteModal) return;
    commandPaletteModal.classList.remove('hidden');
    isTapestryPickerMode = (mode === 'tapestry');
    isGotoSymbolMode = (mode === 'goto');
    paletteSearchInput.value = '';

    if (isTapestryPickerMode) {
      paletteSearchInput.placeholder = 'Search tapestries by title, composer, arranger, tonic...';
    } else if (isGotoSymbolMode) {
      paletteSearchInput.placeholder = 'Go to symbol (type w: for weaves, c: for coils, k: for knots, s: for sections)...';
    } else {
      paletteSearchInput.placeholder = 'Type a command or search tapestries by title/composer...';
    }

    paletteActiveIndex = 0;
    filterPaletteList('');
    setTimeout(() => {
      paletteSearchInput.focus();
    }, 50);
  }

  function closePalette() {
    if (commandPaletteModal) {
      commandPaletteModal.classList.add('hidden');
      isTapestryPickerMode = false;
      isGotoSymbolMode = false;
      getEditor?.()?.focus();
    }
  }

  function filterPaletteList(query) {
    const q = (query || '').toLowerCase().trim();
    const editor = getEditor?.();

    if (isGotoSymbolMode) {
      const symbols = scanAllSymbolsInDocument(editor);
      let filterType = null;
      let term = q;

      if (q.startsWith('w:') || q.startsWith('weave:')) {
        filterType = 'weave';
        term = q.replace(/^(?:w|weave):/, '').trim();
      } else if (q.startsWith('c:') || q.startsWith('coil:')) {
        filterType = 'coil';
        term = q.replace(/^(?:c|coil):/, '').trim();
      } else if (q.startsWith('k:') || q.startsWith('knot:')) {
        filterType = 'knot';
        term = q.replace(/^(?:k|knot):/, '').trim();
      } else if (q.startsWith('s:') || q.startsWith('section:')) {
        filterType = 'section';
        term = q.replace(/^(?:s|section):/, '').trim();
      }

      paletteFilteredCommands = symbols.filter(sym => {
        if (filterType && sym.type !== filterType) return false;
        if (!term) return true;
        return sym.id.toLowerCase().includes(term) || (sym.subtitle && sym.subtitle.toLowerCase().includes(term));
      }).map(sym => {
        return {
          id: `goto-${sym.type}-${sym.id}`,
          title: sym.id,
          category: `${sym.type.toUpperCase()} • Line ${sym.line + 1}${sym.subtitle ? ` (${sym.subtitle})` : ''}`,
          icon: sym.type === 'weave' ? '🧶' : sym.type === 'coil' ? '🌀' : sym.type === 'knot' ? '⚓' : '📑',
          action: () => {
            if (editor) {
              editor.setCursor({ line: sym.line, ch: sym.ch || 0 });
              editor.scrollIntoView({ line: sym.line, ch: 0 }, 100);
              editor.addLineClass(sym.line, 'background', 'cm-point-click-flash');
              setTimeout(() => {
                editor.removeLineClass(sym.line, 'background', 'cm-point-click-flash');
              }, 1200);
            }
          },
        };
      });
    } else if (isTapestryPickerMode) {
      paletteFilteredCommands = (state.scores || []).filter(s => {
        if (!q) return true;
        return (
          (s.title && s.title.toLowerCase().includes(q)) ||
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.composer && s.composer.toLowerCase().includes(q)) ||
          (s.arranger && s.arranger.toLowerCase().includes(q)) ||
          (s.tonic && s.tonic.toLowerCase().includes(q)) ||
          (s.tempo && String(s.tempo).toLowerCase().includes(q))
        );
      }).map(s => {
        const metaParts = [];
        if (s.composer) metaParts.push(s.composer);
        if (s.arranger) metaParts.push(`arr. ${s.arranger}`);
        if (s.tonic) metaParts.push(`Tonic: ${s.tonic}`);
        if (s.tempo) metaParts.push(`♩=${s.tempo}`);

        return {
          id: `tapestry-${s.name}`,
          title: s.title || s.displayName || s.name,
          category: metaParts.length > 0 ? metaParts.join(' • ') : s.name,
          icon: '◈',
          shortcut: s.name,
          action: () => onLoadScore?.(s.path),
        };
      });
    } else {
      const allCommands = getAllCommandsList?.() || [];
      const cmdMatches = allCommands.filter(cmd => {
        if (!q) return true;
        return cmd.title.toLowerCase().includes(q) || cmd.category.toLowerCase().includes(q) || (cmd.shortcut && cmd.shortcut.toLowerCase().includes(q));
      });

      const scoreMatches = q ? (state.scores || []).filter(s => {
        return (
          (s.title && s.title.toLowerCase().includes(q)) ||
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.composer && s.composer.toLowerCase().includes(q)) ||
          (s.arranger && s.arranger.toLowerCase().includes(q)) ||
          (s.tonic && s.tonic.toLowerCase().includes(q))
        );
      }).map(s => {
        const metaParts = [];
        if (s.composer) metaParts.push(s.composer);
        if (s.tonic) metaParts.push(`Tonic: ${s.tonic}`);

        return {
          id: `open-score-${s.name}`,
          title: `Open: ${s.title || s.name}`,
          category: `Tapestry (${metaParts.join(' • ') || s.name})`,
          icon: '◈',
          action: () => onLoadScore?.(s.path),
        };
      }) : [];

      paletteFilteredCommands = [...cmdMatches, ...scoreMatches];
    }

    paletteActiveIndex = Math.min(paletteActiveIndex, Math.max(0, paletteFilteredCommands.length - 1));
    renderPaletteList();
  }

  function renderPaletteList() {
    if (!paletteListEl) return;
    paletteListEl.innerHTML = '';

    if (paletteFilteredCommands.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'palette-item';
      empty.style.color = 'var(--text-dim)';
      empty.textContent = 'No matching commands or tapestries found';
      paletteListEl.appendChild(empty);
      return;
    }

    paletteFilteredCommands.forEach((cmd, idx) => {
      const item = document.createElement('div');
      item.className = `palette-item ${idx === paletteActiveIndex ? 'active' : ''}`;

      const left = document.createElement('div');
      left.className = 'palette-item-left';

      const icon = document.createElement('span');
      icon.className = 'palette-item-icon';
      icon.textContent = cmd.icon || '⚡';
      left.appendChild(icon);

      const details = document.createElement('div');
      details.className = 'palette-item-details';

      const title = document.createElement('span');
      title.className = 'palette-item-title';
      title.textContent = cmd.title;
      details.appendChild(title);

      const cat = document.createElement('span');
      cat.className = 'palette-item-category';
      cat.textContent = cmd.category;
      details.appendChild(cat);

      left.appendChild(details);
      item.appendChild(left);

      if (cmd.shortcut) {
        const sc = document.createElement('div');
        sc.className = 'palette-item-shortcut';
        cmd.shortcut.split('+').forEach(k => {
          const kbd = document.createElement('kbd');
          kbd.textContent = k;
          sc.appendChild(kbd);
        });
        item.appendChild(sc);
      }

      item.addEventListener('mouseenter', () => {
        paletteActiveIndex = idx;
        renderPaletteList();
      });

      item.addEventListener('click', () => {
        executePaletteItem(idx);
      });

      paletteListEl.appendChild(item);
    });

    const activeEl = paletteListEl.querySelector('.palette-item.active');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }

  function executePaletteItem(index) {
    const cmd = paletteFilteredCommands[index];
    closePalette();
    if (cmd && typeof cmd.action === 'function') {
      setTimeout(() => {
        cmd.action(getEditor?.());
      }, 50);
    }
  }

  if (btnCommandPalette) {
    btnCommandPalette.addEventListener('click', () => openPalette('commands'));
  }
  if (paletteBackdrop) {
    paletteBackdrop.addEventListener('click', closePalette);
  }

  if (paletteSearchInput) {
    paletteSearchInput.addEventListener('input', (e) => {
      paletteActiveIndex = 0;
      filterPaletteList(e.target.value);
    });

    paletteSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (paletteFilteredCommands.length > 0) {
          paletteActiveIndex = (paletteActiveIndex + 1) % paletteFilteredCommands.length;
          renderPaletteList();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (paletteFilteredCommands.length > 0) {
          paletteActiveIndex = (paletteActiveIndex - 1 + paletteFilteredCommands.length) % paletteFilteredCommands.length;
          renderPaletteList();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (paletteFilteredCommands.length > 0) {
          executePaletteItem(paletteActiveIndex);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closePalette();
      }
    });
  }

  return {
    openCommandPalette: () => openPalette('commands'),
    openTapestryPicker: () => openPalette('tapestry'),
    openGotoReferencePalette: () => openPalette('goto'),
    closePalette,
  };
}
