/**
 * Keyboard Shortcuts Cheat Sheet Modal for PPT Studio
 */

const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

export const SHORTCUT_CATEGORIES = [
  {
    id: 'project',
    title: 'Project & File Operations',
    icon: '📁',
    shortcuts: [
      { action: 'Create New Tapestry', keys: ['Ctrl', 'Alt', 'N'], altKeys: ['Alt', 'N'], desc: 'Scaffold starter score with PPT noteheads' },
      { action: 'Open Tapestry Score', keys: ['Ctrl', 'O'], desc: 'Search and switch score files across library' },
      { action: 'Save Tapestry Score', keys: ['Ctrl', 'S'], desc: 'Save active YAML score to disk' },
      { action: 'Export Standalone PDF', keys: ['Ctrl', 'Shift', 'E'], desc: 'Compile score and download standalone PDF' },
      { action: 'Compile / Recompile', keys: ['Ctrl', 'Enter'], desc: 'Trigger fast LilyPond compilation' },
    ],
  },
  {
    id: 'navigation',
    title: 'Navigation & Palettes',
    icon: '🔍',
    shortcuts: [
      { action: 'Command Palette', keys: ['Ctrl', 'Shift', 'P'], altKeys: ['F1'], desc: 'Search all commands, actions, and snippets' },
      { action: 'Go to Symbol / Reference', keys: ['Ctrl', 'G'], desc: 'Filter weaves (w:), coils (c:), knots (k:), sections (s:)' },
      { action: 'Go to Definition', keys: ['Ctrl', 'Click'], altKeys: ['F12'], desc: 'Jump to coil/weave ID declaration from reference' },
      { action: 'Toggle Pitch Clock Reference Window', keys: ['Ctrl', 'Alt', 'K'], desc: 'Open draggable 12-tone multi-representation pitch clock' },
      { action: 'Keyboard Shortcuts Cheat Sheet', keys: ['?'], desc: 'Open this shortcuts cheat sheet modal' },
    ],
  },
  {
    id: 'solfege',
    title: 'Music & Solfège Editing',
    icon: '🎵',
    shortcuts: [
      { action: 'Transpose Solfège Syllable', keys: ['Ctrl', '↑/↓'], desc: 'Transpose pitch up/down chromatically centered at Do' },
      { action: 'Shift Syllable Octave', keys: ['Ctrl', 'Alt', '↑/↓'], desc: 'Shift octave up/down (+1 / -1 octave; adds ^ or _)' },
      { action: 'Step Solfège Token', keys: ['Ctrl', '←/→'], desc: 'Navigate tokens; press Ctrl+→ at end to duplicate syllable' },
      { action: 'Toggle MIDI Solfège Typing', keys: ['Ctrl', 'Shift', 'M'], desc: 'Enable/disable real-time MIDI keyboard input' },
    ],
  },
  {
    id: 'editor',
    title: 'YAML Structure & Editor',
    icon: '📝',
    shortcuts: [
      { action: 'Navigate Property Sibling', keys: ['Ctrl', '↑/↓'], desc: 'Jump to previous/next sibling at same indentation level' },
      { action: 'Reorder Property Block', keys: ['Ctrl', 'Alt', '↑/↓'], desc: 'Move property or array item up/down within parent container' },
      { action: 'Duplicate Enclosing Block', keys: ['Ctrl', 'Alt', 'Enter'], desc: 'Duplicate coil/weave/block with auto-incremented ID' },
      { action: 'Contextual Autocomplete', keys: ['Ctrl', 'Space'], desc: 'Smart Solfège degrees, snippets, and schema hints' },
      { action: 'Toggle Comment', keys: ['Ctrl', '/'], desc: 'Comment or uncomment selected YAML lines' },
      { action: 'Fold / Unfold Section', keys: ['Ctrl', 'Q'], desc: 'Collapse or expand block at cursor' },
      { action: 'Indent / Outdent Selection', keys: ['Tab'], altKeys: ['Shift', 'Tab'], desc: 'Adjust indentation level by 2 spaces' },
    ],
  },
  {
    id: 'refactor',
    title: 'Refactoring & Theory Tools',
    icon: '🧩',
    shortcuts: [
      { action: 'Toggle Melody Representation', keys: ['Ctrl', 'Alt', 'A'], desc: 'Convert seamlessly between Interval and Absolute mode' },
      { action: 'Extract into Parent Coil', keys: ['Ctrl', 'Alt', 'P'], desc: 'Extract layers into shared parent definition' },
      { action: 'Extract Inline Coil to Named', keys: ['Ctrl', 'Alt', 'C'], desc: 'Promote inline stitch coil to named entry' },
      { action: 'Inline Parent Properties', keys: ['Ctrl', 'Alt', 'I'], desc: 'Flatten inherited layers directly into coil' },
      { action: 'Group Selection into Weave', keys: ['Ctrl', 'Alt', 'W'], desc: 'Extract selected lines into a new named weave' },
      { action: 'Rename Symbol Globally', keys: ['F2'], desc: 'Rename ID definition and all occurrences across score' },
    ],
  },
  {
    id: 'preview',
    title: 'Score Preview & Inspection',
    icon: '🎼',
    shortcuts: [
      { action: 'Magnifying Glass (Loupe)', keys: ['Hold Shift'], desc: 'Inspect fine score engraving details under cursor' },
      { action: 'Point-and-Click Navigation', keys: ['Click Notehead'], desc: 'Jump from sheet music notehead to source YAML token' },
    ],
  },
];

function formatKey(key) {
  if (isMac) {
    if (key === 'Ctrl') return '⌘ Cmd';
    if (key === 'Alt') return '⌥ Option';
    if (key === 'Shift') return '⇧ Shift';
  }
  return key;
}

export function setupShortcutsModal() {
  const modal = document.getElementById('shortcuts-modal');
  const btnClose = document.getElementById('btn-close-shortcuts');
  const backdrop = document.getElementById('shortcuts-backdrop');
  const searchInput = document.getElementById('shortcuts-search');
  const contentEl = document.getElementById('shortcuts-content');

  function renderShortcuts(filter = '') {
    if (!contentEl) return;
    contentEl.innerHTML = '';
    const q = (filter || '').toLowerCase().trim();

    let totalMatches = 0;

    SHORTCUT_CATEGORIES.forEach((cat) => {
      const filtered = cat.shortcuts.filter((item) => {
        if (!q) return true;
        return (
          item.action.toLowerCase().includes(q) ||
          item.desc.toLowerCase().includes(q) ||
          cat.title.toLowerCase().includes(q) ||
          item.keys.some(k => k.toLowerCase().includes(q)) ||
          (item.altKeys && item.altKeys.some(k => k.toLowerCase().includes(q)))
        );
      });

      if (filtered.length === 0) return;
      totalMatches += filtered.length;

      const groupEl = document.createElement('div');
      groupEl.className = 'shortcuts-group';

      const headerEl = document.createElement('div');
      headerEl.className = 'shortcuts-group-header';
      headerEl.innerHTML = `
        <span class="shortcuts-group-icon">${cat.icon}</span>
        <span class="shortcuts-group-title">${cat.title}</span>
        <span class="shortcuts-group-count">${filtered.length}</span>
      `;
      groupEl.appendChild(headerEl);

      const tableEl = document.createElement('div');
      tableEl.className = 'shortcuts-table';

      filtered.forEach((item) => {
        const rowEl = document.createElement('div');
        rowEl.className = 'shortcuts-row';

        const infoEl = document.createElement('div');
        infoEl.className = 'shortcuts-row-info';

        const actionEl = document.createElement('div');
        actionEl.className = 'shortcuts-action-title';
        actionEl.textContent = item.action;
        infoEl.appendChild(actionEl);

        if (item.desc) {
          const descEl = document.createElement('div');
          descEl.className = 'shortcuts-action-desc';
          descEl.textContent = item.desc;
          infoEl.appendChild(descEl);
        }

        rowEl.appendChild(infoEl);

        const keysEl = document.createElement('div');
        keysEl.className = 'shortcuts-keys-container';

        const primaryKeys = document.createElement('div');
        primaryKeys.className = 'shortcuts-key-combo';
        item.keys.forEach((k) => {
          const kbd = document.createElement('kbd');
          kbd.textContent = formatKey(k);
          primaryKeys.appendChild(kbd);
        });
        keysEl.appendChild(primaryKeys);

        if (item.altKeys) {
          const orSpan = document.createElement('span');
          orSpan.className = 'shortcuts-or';
          orSpan.textContent = 'or';
          keysEl.appendChild(orSpan);

          const altCombo = document.createElement('div');
          altCombo.className = 'shortcuts-key-combo';
          item.altKeys.forEach((k) => {
            const kbd = document.createElement('kbd');
            kbd.textContent = formatKey(k);
            altCombo.appendChild(kbd);
          });
          keysEl.appendChild(altCombo);
        }

        rowEl.appendChild(keysEl);
        tableEl.appendChild(rowEl);
      });

      groupEl.appendChild(tableEl);
      contentEl.appendChild(groupEl);
    });

    if (totalMatches === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'shortcuts-empty';
      emptyEl.innerHTML = `
        <div class="shortcuts-empty-icon">🔍</div>
        <div class="shortcuts-empty-text">No shortcuts found matching "<strong>${filter}</strong>"</div>
      `;
      contentEl.appendChild(emptyEl);
    }
  }

  function openShortcutsModal() {
    if (!modal) return;
    modal.classList.remove('hidden');
    if (searchInput) {
      searchInput.value = '';
      setTimeout(() => searchInput.focus(), 50);
    }
    renderShortcuts('');
  }

  function closeShortcutsModal() {
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  if (btnClose) {
    btnClose.addEventListener('click', closeShortcutsModal);
  }
  if (backdrop) {
    backdrop.addEventListener('click', closeShortcutsModal);
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderShortcuts(e.target.value);
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeShortcutsModal();
      }
    });
  }

  // Handle Escape key when modal is open
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
      e.preventDefault();
      closeShortcutsModal();
    }
  });

  return {
    openShortcutsModal,
    closeShortcutsModal,
  };
}
