/**
 * Diagnostics Onsets Table & LilyPond Source Code Viewer
 */

export function renderDiagnosticsOnsets(onsets) {
  const onsetsTbody = document.getElementById('onsets-tbody');
  if (!onsetsTbody) return;

  onsetsTbody.innerHTML = '';
  if (!onsets || onsets.length === 0) {
    onsetsTbody.innerHTML = '<tr><td colspan="8" class="empty-cell">No onsets resolved</td></tr>';
    return;
  }

  onsets.forEach((onset, index) => {
    const tr = document.createElement('tr');
    const triadStr = Array.isArray(onset.chordMidi) ? onset.chordMidi.join(', ') : '';
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${onset.tag || '-'}</td>
      <td><strong>${onset.isRest ? '(rest)' : onset.scaleDegree}</strong></td>
      <td>${onset.melodyMidi || '-'}</td>
      <td>${onset.chordRoot || '-'}</td>
      <td>${triadStr}</td>
      <td>${onset.rhythmToken || '-'}</td>
      <td>${onset.duration || '-'}</td>
    `;
    onsetsTbody.appendChild(tr);
  });
}

export function renderLilyPondSource(lySource) {
  const lilypondCode = document.getElementById('lilypond-code');
  if (lilypondCode) {
    lilypondCode.textContent = lySource || '';
  }
}
