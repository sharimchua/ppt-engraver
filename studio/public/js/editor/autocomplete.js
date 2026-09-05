/**
 * Context-Aware Autocomplete & Dynamic YAML Snippets Provider for CodeMirror
 */

import { state } from '../state.js';
import { fetchSnippets } from '../api.js';
import { SOLFEGE_COLORS } from '../core/solfege.js';
import { createSolfegeGlyphSvg } from '../core/glyphs.js';
import { scanDeclaredCoilsAndWeaves, findParentSection, getLineIndent } from '../core/ast-scanner.js';

export function setSnippetDefinitions(snippets) {
  state.snippets = (snippets || []).map(s => ({
    id: s.id,
    label: s.label,
    text: s.label || s.displayText || s.id,
    displayText: s.displayText || s.label || s.id,
    snippet: s.snippet,
    desc: s.desc || '',
    type: 'snip',
    icon: s.icon || '📄',
    category: s.category || 'Snippets',
    context: s.context || ['root'],
  }));
}

export const ENUMS_SHOW = [
  { text: 'melody', displayText: 'melody', type: 'enum', desc: 'Melody traditional staff' },
  { text: 'harmony', displayText: 'harmony', type: 'enum', desc: 'Harmony chord staff / coil' },
  { text: 'guitarTab', displayText: 'guitarTab', type: 'enum', desc: 'Guitar Tablature staff' },
  { text: 'melodyCoilAbsolute', displayText: 'melodyCoilAbsolute', type: 'enum', desc: 'Absolute Solfège degree row' },
  { text: 'melodyCoilInterval', displayText: 'melodyCoilInterval', type: 'enum', desc: 'Interval Solfège degree row' },
  { text: 'rhythmCoil', displayText: 'rhythmCoil', type: 'enum', desc: 'Solfège rhythm duration row' },
  { text: 'pulseCoil', displayText: 'pulseCoil', type: 'enum', desc: 'Metric pulse grammar row' },
  { text: 'chordNames', displayText: 'chordNames', type: 'enum', desc: 'Chord symbols above staff' },
  { text: 'chordTriangles', displayText: 'chordTriangles', type: 'enum', desc: 'Piano Triangle chord shapes above staff' },
  { text: 'rhythmGrid', displayText: 'rhythmGrid', type: 'enum', desc: 'Vertical rhythm gridlines' },
  { text: 'gridSymbols', displayText: 'gridSymbols', type: 'enum', desc: 'Annotate grid lines with notehead shapes' },
  { text: 'timeSignature', displayText: 'timeSignature', type: 'enum', desc: 'Traditional time signature on staff' },
  { text: 'pulseSignature', displayText: 'pulseSignature', type: 'enum', desc: 'PPT pulse declaration in header' },
  { text: 'scaleSignature', displayText: 'scaleSignature', type: 'enum', desc: 'Solfège scale glyphs in header' },
  { text: 'scaleSignaturePianoTriangle', displayText: 'scaleSignaturePianoTriangle', type: 'enum', desc: 'Piano Triangle scale map in header' },
  { text: 'keySignature', displayText: 'keySignature', type: 'enum', desc: 'Traditional key signature on staff' },
];

export const ENUMS_CLEF = [
  { text: 'treble', displayText: 'treble', type: 'enum', desc: 'Standard Treble clef' },
  { text: 'treble_8', displayText: 'treble_8', type: 'enum', desc: 'Treble 8vb (Guitar/Tenor)' },
  { text: 'treble^8', displayText: 'treble^8', type: 'enum', desc: 'Treble 8va (Piccolo)' },
  { text: 'bass', displayText: 'bass', type: 'enum', desc: 'Standard Bass clef' },
  { text: 'bass_8', displayText: 'bass_8', type: 'enum', desc: 'Bass 8vb (Sub-bass)' },
  { text: 'bass_15', displayText: 'bass_15', type: 'enum', desc: 'Bass 15mb (Double bass)' }
];

export const ENUMS_NOTEHEAD_STYLE = [
  { text: 'ppt', displayText: 'ppt', type: 'enum', desc: 'PPT Geometric Solfège shapes' },
  { text: 'sacredHarp', displayText: 'sacredHarp', type: 'enum', desc: 'Sacred Harp 4-shape system' },
  { text: 'aiken', displayText: 'aiken', type: 'enum', desc: 'Aiken 7-shape system' },
  { text: 'funk', displayText: 'funk', type: 'enum', desc: 'Funk 7-shape system' },
  { text: 'walker', displayText: 'walker', type: 'enum', desc: 'Walker 7-shape system' },
  { text: 'diamond', displayText: 'diamond', type: 'enum', desc: 'Diamond noteheads' },
  { text: 'default', displayText: 'default', type: 'enum', desc: 'Standard oval noteheads' }
];

export const ENUMS_HARMONY_VOICING = [
  { text: 'close', displayText: 'close', type: 'enum', desc: 'Compact tertian chords' },
  { text: 'rootless', displayText: 'rootless', type: 'enum', desc: 'Rootless (3rd, 5th, 7th, 9th)' },
  { text: 'rootFifth', displayText: 'rootFifth', type: 'enum', desc: 'Root + 5th power dyads' },
  { text: 'shell', displayText: 'shell', type: 'enum', desc: 'Shell (Root + 3rd + 7th)' },
  { text: 'open', displayText: 'open', type: 'enum', desc: 'Open spread (1-5-10)' },
  { text: 'smoothLead', displayText: 'smoothLead', type: 'enum', desc: 'Smooth voice leading' },
  { text: 'bassOnly', displayText: 'bassOnly', type: 'enum', desc: 'Bass root notes' },
  { text: 'walkingBass', displayText: 'walkingBass', type: 'enum', desc: 'Walking bassline' },
  { text: 'octaves', displayText: 'octaves', type: 'enum', desc: 'Bass in octaves' }
];

export const ENUMS_MELODY_AUGMENTATION = [
  { text: 'none', displayText: 'none', type: 'enum', desc: 'Single melody line' },
  { text: 'thirdsBelow', displayText: 'thirdsBelow', type: 'enum', desc: 'Harmonize 3rds below' },
  { text: 'sixthsBelow', displayText: 'sixthsBelow', type: 'enum', desc: 'Harmonize 6ths below' },
  { text: 'triadClose', displayText: 'triadClose', type: 'enum', desc: '3-note close block chord' },
  { text: 'drop2', displayText: 'drop2', type: 'enum', desc: '4-note drop-2 jazz chord melody' },
  { text: 'guideToneDyad', displayText: 'guideToneDyad', type: 'enum', desc: '3rd/7th guide tone dyad' },
  { text: 'octaves', displayText: 'octaves', type: 'enum', desc: 'Octave below' }
];

export const ENUMS_MELODY_AUGMENTATION_DISPLAY = [
  { text: 'ghosted', displayText: 'ghosted', type: 'enum', desc: 'Translucent gray notehead' },
  { text: 'dimmed', displayText: 'dimmed', type: 'enum', desc: 'Dimmed Solfège notehead' },
  { text: 'smallColored', displayText: 'smallColored', type: 'enum', desc: 'Small chromatic notehead' },
  { text: 'smallMuted', displayText: 'smallMuted', type: 'enum', desc: 'Small muted gray notehead' },
  { text: 'parenthesized', displayText: 'parenthesized', type: 'enum', desc: 'Parenthesized notehead' },
  { text: 'diamond', displayText: 'diamond', type: 'enum', desc: 'Diamond notehead style' },
  { text: 'normal', displayText: 'normal', type: 'enum', desc: 'Standard notehead' }
];

export const ENUMS_PROJECTION = [
  { text: 'chordMelody', displayText: 'chordMelody', type: 'enum', desc: 'Drop-2 jazz chord melody' },
  { text: 'leadSheet', displayText: 'leadSheet', type: 'enum', desc: 'Lead sheet (chords + melody)' },
  { text: 'jazzComping', displayText: 'jazzComping', type: 'enum', desc: 'Rootless rhythm comping' },
  { text: 'acousticFolk', displayText: 'acousticFolk', type: 'enum', desc: 'Root-5th & thirds below' },
  { text: 'bassAndLead', displayText: 'bassAndLead', type: 'enum', desc: 'Walking bass + melody' },
  { text: 'default', displayText: 'default', type: 'enum', desc: 'Standard PPT arrangement' }
];

export const ENUMS_HARMONY_STAFF_STYLE = [
  { text: 'standard', displayText: 'standard', type: 'enum', desc: 'Traditional music staff only' },
  { text: 'coil', displayText: 'coil', type: 'enum', desc: 'PPT Harmony Coil only' },
  { text: 'both', displayText: 'both', type: 'enum', desc: 'Both staff and Harmony Coil' }
];

export const ENUMS_GUITAR_VOICING = [
  { text: 'melodyOnly', displayText: 'melodyOnly', type: 'enum', desc: 'Melody line only on optimal strings' },
  { text: 'root', displayText: 'root', type: 'enum', desc: 'Melody note + bass root note on chord changes' },
  { text: 'triad', displayText: 'triad', type: 'enum', desc: 'Melody note + root + 3rd/5th chord tones on chord changes' },
  { text: 'shell', displayText: 'shell', type: 'enum', desc: 'Melody note + 3rd and 7th guide tones on chord changes' },
  { text: 'chordMelody', displayText: 'chordMelody', type: 'enum', desc: 'Jazz chord-melody drop-2 / 3-4 note grips on changes/downbeats' },
  { text: 'rootChordTones', displayText: 'rootChordTones', type: 'enum', desc: 'Alias for triad' },
  { text: 'guideTones', displayText: 'guideTones', type: 'enum', desc: 'Alias for shell' },
  { text: 'bassAndMelody', displayText: 'bassAndMelody', type: 'enum', desc: 'Alias for root' },
  { text: 'auto', displayText: 'auto', type: 'enum', desc: 'Richest playable grip fitting maxFretSpan' }
];

export const ENUMS_GUITAR_TAB_MOVEMENT = [
  { text: 'vertical', displayText: 'vertical', type: 'enum', desc: 'Position-based box playing (limits horizontal fret shifts)' },
  { text: 'horizontal', displayText: 'horizontal', type: 'enum', desc: 'Linear single-string playing (limits string changes)' }
];

export const ENUMS_GUITAR_TAB_SCOPE = [
  { text: 'coil', displayText: 'coil', type: 'enum', desc: 'Solve within each coil/motif independently (default)' },
  { text: 'continuous', displayText: 'continuous', type: 'enum', desc: 'Solve continuously across coil boundaries across the song' }
];

export const ENUMS_TAB_STAFF_STYLE = [
  { text: 'ppt', displayText: 'ppt', type: 'enum', desc: 'Fret numbers with PPT Solfège shape noteheads' },
  { text: 'numbersOnly', displayText: 'numbersOnly', type: 'enum', desc: 'Standard numerical fret numbers' },
  { text: 'default', displayText: 'default', type: 'enum', desc: 'Follows global noteheadStyle' }
];

export const TOKENS_MELODY = [
  { text: 'Do', displayText: 'Do', type: 'note', solfege: 'Do', desc: '0 semitones (Red)' },
  { text: 'Dox', displayText: 'Dox', type: 'note', solfege: 'Dox', desc: '0 semitones (Axis Root)' },
  { text: 'Ra', displayText: 'Ra', type: 'note', solfege: 'Ra', desc: '1 semitone (Orange)' },
  { text: 'Di', displayText: 'Di', type: 'note', solfege: 'Di', desc: '1 semitone (Orange)' },
  { text: 'Re', displayText: 'Re', type: 'note', solfege: 'Re', desc: '2 semitones (Orange)' },
  { text: 'Rex', displayText: 'Rex', type: 'note', solfege: 'Rex', desc: '2 semitones (Axis)' },
  { text: 'Me', displayText: 'Me', type: 'note', solfege: 'Me', desc: '3 semitones (Yellow)' },
  { text: 'Mex', displayText: 'Mex', type: 'note', solfege: 'Mex', desc: '3 semitones (Axis)' },
  { text: 'Ri', displayText: 'Ri', type: 'note', solfege: 'Ri', desc: '3 semitones (Yellow)' },
  { text: 'Mi', displayText: 'Mi', type: 'note', solfege: 'Mi', desc: '4 semitones (Yellow)' },
  { text: 'Miex', displayText: 'Miex', type: 'note', solfege: 'Miex', desc: '4 semitones (Axis)' },
  { text: 'Fa', displayText: 'Fa', type: 'note', solfege: 'Fa', desc: '5 semitones (Green)' },
  { text: 'Fax', displayText: 'Fax', type: 'note', solfege: 'Fax', desc: '5 semitones (Axis)' },
  { text: 'Fi', displayText: 'Fi', type: 'note', solfege: 'Fi', desc: '6 semitones (Slate/Dark)' },
  { text: 'Fix', displayText: 'Fix', type: 'note', solfege: 'Fix', desc: '6 semitones (Axis)' },
  { text: 'Se', displayText: 'Se', type: 'note', solfege: 'Se', desc: '5 semitones (Green)' },
  { text: 'So', displayText: 'So', type: 'note', solfege: 'So', desc: '7 semitones (Blue)' },
  { text: 'Sox', displayText: 'Sox', type: 'note', solfege: 'Sox', desc: '7 semitones (Axis)' },
  { text: 'Le', displayText: 'Le', type: 'note', solfege: 'Le', desc: '8 semitones (Purple)' },
  { text: 'Lex', displayText: 'Lex', type: 'note', solfege: 'Lex', desc: '8 semitones (Axis)' },
  { text: 'Si', displayText: 'Si', type: 'note', solfege: 'Si', desc: '7 semitones (Blue)' },
  { text: 'La', displayText: 'La', type: 'note', solfege: 'La', desc: '9 semitones (Indigo)' },
  { text: 'Lax', displayText: 'Lax', type: 'note', solfege: 'Lax', desc: '9 semitones (Axis)' },
  { text: 'Li', displayText: 'Li', type: 'note', solfege: 'Li', desc: '9 semitones (Indigo)' },
  { text: 'Te', displayText: 'Te', type: 'note', solfege: 'Te', desc: '10 semitones (Pink)' },
  { text: 'Tex', displayText: 'Tex', type: 'note', solfege: 'Tex', desc: '10 semitones (Axis)' },
  { text: 'Ti', displayText: 'Ti', type: 'note', solfege: 'Ti', desc: '11 semitones (Pink)' },
  { text: 'Tix', displayText: 'Tix', type: 'note', solfege: 'Tix', desc: '11 semitones (Axis)' },
  { text: 'Do^', displayText: 'Do^', type: 'note', solfege: 'Do', desc: 'High octave (+12)' },
  { text: 'Re^', displayText: 'Re^', type: 'note', solfege: 'Re', desc: 'High octave' },
  { text: 'Me^', displayText: 'Me^', type: 'note', solfege: 'Me', desc: 'High octave' },
  { text: 'Fa^', displayText: 'Fa^', type: 'note', solfege: 'Fa', desc: 'High octave' },
  { text: 'So^', displayText: 'So^', type: 'note', solfege: 'So', desc: 'High octave' },
  { text: 'La^', displayText: 'La^', type: 'note', solfege: 'La', desc: 'High octave' },
  { text: 'Te^', displayText: 'Te^', type: 'note', solfege: 'Te', desc: 'High octave' },
  { text: 'Do_', displayText: 'Do_', type: 'note', solfege: 'Do', desc: 'Low octave (-12)' },
  { text: 'Re_', displayText: 'Re_', type: 'note', solfege: 'Re', desc: 'Low octave' },
  { text: 'Me_', displayText: 'Me_', type: 'note', solfege: 'Me', desc: 'Low octave' },
  { text: 'Fa_', displayText: 'Fa_', type: 'note', solfege: 'Fa', desc: 'Low octave' },
  { text: 'So_', displayText: 'So_', type: 'note', solfege: 'So', desc: 'Low octave' },
  { text: 'La_', displayText: 'La_', type: 'note', solfege: 'La', desc: 'Low octave' },
  { text: 'Te_', displayText: 'Te_', type: 'note', solfege: 'Te', desc: 'Low octave' },
  { text: '1', displayText: '1', type: 'enum', desc: '1 beat rest / hold' },
  { text: '2', displayText: '2', type: 'enum', desc: '2 beat rest / hold' },
  { text: '3', displayText: '3', type: 'enum', desc: '3 beat rest / hold' },
  { text: '4', displayText: '4', type: 'enum', desc: '4 beat rest / hold' }
];

export const TOKENS_RHYTHM = [
  { text: 'Do', displayText: 'Do', type: 'note', solfege: 'Do', desc: 'Full beat / 0° Base' },
  { text: 'Fi', displayText: 'Fi', type: 'note', solfege: 'Fi', desc: 'Offbeat / 180° Base' },
  { text: 'Me', displayText: 'Me', type: 'note', solfege: 'Me', desc: 'Quarter / 270° Base' },
  { text: 'La', displayText: 'La', type: 'note', solfege: 'La', desc: 'Quarter / 90° Base' },
  { text: 'Mi', displayText: 'Mi', type: 'note', solfege: 'Mi', desc: 'Triplet / 270° Sharp' },
  { text: 'Le', displayText: 'Le', type: 'note', solfege: 'Le', desc: 'Triplet / 90° Flat' },
  { text: 'Te', displayText: 'Te', type: 'note', solfege: 'Te', desc: 'Sixteenth / 90° Sharp' },
  { text: 'Dox', displayText: 'Dox', type: 'note', solfege: 'Dox', desc: 'Axis Accent Onset' },
  { text: 'DoxDo', displayText: 'DoxDo', type: 'note', solfege: 'Dox', desc: 'Compound Dox-Do' },
  { text: 'DoxFi', displayText: 'DoxFi', type: 'note', solfege: 'Dox', desc: 'Compound Dox-Fi' },
  { text: 'DoxMe', displayText: 'DoxMe', type: 'note', solfege: 'Dox', desc: 'Compound Dox-Me' },
  { text: 'DoxLa', displayText: 'DoxLa', type: 'note', solfege: 'Dox', desc: 'Compound Dox-La' },
  { text: 'DoxDoxDo', displayText: 'DoxDoxDo', type: 'note', solfege: 'Dox', desc: 'Compound Dox-Dox-Do' },
  { text: '1', displayText: '1', type: 'enum', desc: '1 beat rest / hold' },
  { text: '2', displayText: '2', type: 'enum', desc: '2 beat rest / hold' },
  { text: '3', displayText: '3', type: 'enum', desc: '3 beat rest / hold' },
  { text: '4', displayText: '4', type: 'enum', desc: '4 beat rest / hold' }
];

export const TOKENS_HARMONY = [
  { text: 'Do', displayText: 'Do', type: 'note', solfege: 'Do', desc: 'Major triad / Root' },
  { text: 'DoMe', displayText: 'DoMe', type: 'note', solfege: 'Do', desc: 'Minor triad' },
  { text: 'DoMi', displayText: 'DoMi', type: 'note', solfege: 'Do', desc: 'Major triad' },
  { text: 'DoSo', displayText: 'DoSo', type: 'note', solfege: 'Do', desc: '5th power chord (no 3rd)' },
  { text: 'DoMeFi', displayText: 'DoMeFi', type: 'note', solfege: 'Do', desc: 'Diminished triad' },
  { text: 'DoMeFiTe', displayText: 'DoMeFiTe', type: 'note', solfege: 'Do', desc: 'Half-diminished 7th (m7b5 / ø7)' },
  { text: 'DoMeFiLa', displayText: 'DoMeFiLa', type: 'note', solfege: 'Do', desc: 'Full diminished 7th (dim7 / o7)' },
  { text: 'DoTe', displayText: 'DoTe', type: 'note', solfege: 'Do', desc: 'Dominant 7th' },
  { text: 'DoTi', displayText: 'DoTi', type: 'note', solfege: 'Do', desc: 'Major 7th' },
  { text: 'DoMeTe', displayText: 'DoMeTe', type: 'note', solfege: 'Do', desc: 'Minor 7th' },
  { text: 'DoMeTi', displayText: 'DoMeTi', type: 'note', solfege: 'Do', desc: 'Minor-major 7th' },
  { text: 'DoLa', displayText: 'DoLa', type: 'note', solfege: 'Do', desc: 'Major 6th' },
  { text: 'DoMeLa', displayText: 'DoMeLa', type: 'note', solfege: 'Do', desc: 'Minor 6th' },
  { text: 'DoFa', displayText: 'DoFa', type: 'note', solfege: 'Do', desc: 'Suspended 4th (sus4)' },
  { text: 'DoFaTe', displayText: 'DoFaTe', type: 'note', solfege: 'Do', desc: '7sus4 chord' },
  { text: 'DoRe', displayText: 'DoRe', type: 'note', solfege: 'Do', desc: 'Suspended 2nd (sus2)' },
  { text: 'DoLe', displayText: 'DoLe', type: 'note', solfege: 'Do', desc: 'Augmented triad' },
  { text: 'DoTeRe', displayText: 'DoTeRe', type: 'note', solfege: 'Do', desc: 'Dominant 9th (9)' },
  { text: 'DoTiRe', displayText: 'DoTiRe', type: 'note', solfege: 'Do', desc: 'Major 9th (maj9)' },
  { text: 'DoMeTeRe', displayText: 'DoMeTeRe', type: 'note', solfege: 'Do', desc: 'Minor 9th (m9)' },
  { text: 'DoMiRe', displayText: 'DoMiRe', type: 'note', solfege: 'Do', desc: 'Add 9 (add9)' },
  { text: 'DoTeRa', displayText: 'DoTeRa', type: 'note', solfege: 'Do', desc: '7(b9) altered chord' },
  { text: 'DoTeRi', displayText: 'DoTeRi', type: 'note', solfege: 'Do', desc: '7(#9) Hendrix chord' },
  { text: 'DoTeFi', displayText: 'DoTeFi', type: 'note', solfege: 'Do', desc: '7(#11) / 7b5 Lydian dominant' },
  { text: 'DoTiFi', displayText: 'DoTiFi', type: 'note', solfege: 'Do', desc: 'maj7(#11) Lydian' },
  { text: 'DoTeLe', displayText: 'DoTeLe', type: 'note', solfege: 'Do', desc: '7(b13) / 7#5 altered chord' },
  { text: 'DoTeLa', displayText: 'DoTeLa', type: 'note', solfege: 'Do', desc: 'Dominant 13th (13)' },
  { text: 'DoTiLa', displayText: 'DoTiLa', type: 'note', solfege: 'Do', desc: 'Major 13th (maj13)' },
  { text: 'DoMeTeLa', displayText: 'DoMeTeLa', type: 'note', solfege: 'Do', desc: 'Minor 13th (m13)' },
  { text: 'DoFi', displayText: 'DoFi', type: 'note', solfege: 'Do', desc: 'Diminished / Tritone dyad' },
  { text: 'SoxDo', displayText: 'SoxDo', type: 'note', solfege: 'Sox', desc: 'C/G (2nd inversion / slash bass)' },
  { text: 'MixDo', displayText: 'MixDo', type: 'note', solfege: 'Mix', desc: 'C/E (1st inversion / slash bass)' },
  { text: 'MexDoMe', displayText: 'MexDoMe', type: 'note', solfege: 'Mex', desc: 'Cm/Eb (1st inversion / slash bass)' },
  { text: 'RexSo', displayText: 'RexSo', type: 'note', solfege: 'Rex', desc: 'G/D (2nd inversion / slash bass)' },
  { text: '1', displayText: '1', type: 'enum', desc: '1 beat hold' },
  { text: '2', displayText: '2', type: 'enum', desc: '2 beat hold' },
  { text: '3', displayText: '3', type: 'enum', desc: '3 beat hold' },
  { text: '4', displayText: '4', type: 'enum', desc: '4 beat hold' },
  { text: '8', displayText: '8', type: 'enum', desc: '8 beat hold' }
];

export const ROOT_KEYS = [
  { text: 'tapestry:', displayText: 'tapestry:', type: 'prop', desc: 'Score root block' },
  { text: 'knot:', displayText: 'knot:', type: 'prop', desc: 'Score metadata & default settings' },
  { text: 'knots:', displayText: 'knots:', type: 'prop', desc: 'Named knot projections list/dictionary' },
  { text: 'coils:', displayText: 'coils:', type: 'prop', desc: 'Coil definitions dictionary' },
  { text: 'weaves:', displayText: 'weaves:', type: 'prop', desc: 'Hierarchical weave dictionary' },
  { text: 'weave:', displayText: 'weave: ...', type: 'prop', desc: 'Root weave reference' }
];

export const KNOT_KEYS = [
  { text: 'id:', displayText: 'id: ...', type: 'prop', desc: 'Knot projection identifier' },
  { text: 'name:', displayText: 'name: "..."', type: 'prop', desc: 'Display name for dropdown' },
  { text: 'abstract:', displayText: 'abstract: true', type: 'prop', desc: 'Abstract template excluded from dropdown (not inherited)' },
  { text: 'hidden:', displayText: 'hidden: true', type: 'prop', desc: 'Exclude from dropdown (not inherited)' },
  { text: 'visible:', displayText: 'visible: true', type: 'prop', desc: 'Visibility toggle in dropdown (not inherited)' },
  { text: 'parent:', displayText: 'parent: ...', type: 'prop', desc: 'Parent knot to inherit settings from' },
  { text: 'parents:', displayText: 'parents: [...]', type: 'prop', desc: 'Parent knots to inherit settings from' },
  { text: 'tonic:', displayText: 'tonic: "C4"', type: 'prop', desc: 'Root tonic reference' },
  { text: 'tempo:', displayText: 'tempo: 120', type: 'prop', desc: 'Score tempo in BPM' },
  { text: 'weave:', displayText: 'weave: ...', type: 'prop', desc: 'Root weave reference' },
  { text: 'engraving:', displayText: 'engraving:', type: 'prop', desc: 'Visual engraving toggles' },
  { text: 'projection:', displayText: 'projection: ...', type: 'prop', desc: 'Arrangement preset' },
  { text: 'harmonyVoicing:', displayText: 'harmonyVoicing: ...', type: 'prop', desc: 'Chord voicing style' },
  { text: 'melodyAugmentation:', displayText: 'melodyAugmentation: ...', type: 'prop', desc: 'Melody augmentation' },
  { text: 'melodyAugmentationDisplay:', displayText: 'melodyAugmentationDisplay: ...', type: 'prop', desc: 'Augmentation display style' },
  { text: 'title:', displayText: 'title: "..."', type: 'prop', desc: 'Score title' },
  { text: 'subtitle:', displayText: 'subtitle: "..."', type: 'prop', desc: 'Score subtitle' },
  { text: 'composer:', displayText: 'composer: "..."', type: 'prop', desc: 'Composer name' },
  { text: 'arranger:', displayText: 'arranger: "..."', type: 'prop', desc: 'Arranger name' },
  { text: 'poet:', displayText: 'poet: "..."', type: 'prop', desc: 'Poet / lyricist' },
  { text: 'copyright:', displayText: 'copyright: "..."', type: 'prop', desc: 'Copyright statement' },
  { text: 'tagline:', displayText: 'tagline: "..."', type: 'prop', desc: 'LilyPond bottom tagline' },
  { text: 'pulse:', displayText: 'pulse: "DoLa"', type: 'prop', desc: 'Metric pulse grammar' },
  { text: 'meter:', displayText: 'meter: "DoLa"', type: 'prop', desc: 'Alias for pulse' },
  { text: 'timeSignature:', displayText: 'timeSignature: "4/4"', type: 'prop', desc: 'Time signature for notation staff' },
  { text: 'showTimeSignature:', displayText: 'showTimeSignature: true', type: 'prop', desc: 'Show time signature on staff' },
  { text: 'pulseSignature:', displayText: 'pulseSignature: "DoLa"', type: 'prop', desc: 'Pulse signature in header' },
  { text: 'showPulseSignature:', displayText: 'showPulseSignature: true', type: 'prop', desc: 'Show pulse signature in header' },
  { text: 'scale:', displayText: 'scale: "Do"', type: 'prop', desc: 'Solfège scale grammar (e.g. "Do", "La", "DoMe", "LaTi")' },
  { text: 'keySignature:', displayText: 'keySignature: "C major"', type: 'prop', desc: 'Traditional staff key signature' },
  { text: 'showKeySignature:', displayText: 'showKeySignature: true', type: 'prop', desc: 'Show traditional key signature on staff' },
  { text: 'scaleSignature:', displayText: 'scaleSignature: "DoReMiFaSoLaTi"', type: 'prop', desc: 'Solfège scale signature in header' },
  { text: 'showScaleSignature:', displayText: 'showScaleSignature: true', type: 'prop', desc: 'Show Solfège scale signature in header' },
  { text: 'showScaleSignaturePianoTriangle:', displayText: 'showScaleSignaturePianoTriangle: true', type: 'prop', desc: 'Show Piano Triangle scale map in header' },
  { text: 'showPulseCoil:', displayText: 'showPulseCoil: true', type: 'prop', desc: 'Show Pulse / Metric coil row' },
  { text: 'gridSymbols:', displayText: 'gridSymbols: true', type: 'prop', desc: 'Annotate grid lines with notehead shapes' },
  { text: 'excludeGridDoSymbol:', displayText: 'excludeGridDoSymbol: true', type: 'prop', desc: 'Omit circle on Do downbeats' },
  { text: 'strongBeatGridWeight:', displayText: 'strongBeatGridWeight: true', type: 'prop', desc: 'Solid line on strong beats' }
];

export const ENGRAVING_KEYS = [
  { text: 'projection:', displayText: 'projection: ...', type: 'prop', desc: 'Arrangement preset' },
  { text: 'harmonyVoicing:', displayText: 'harmonyVoicing: ...', type: 'prop', desc: 'Chord voicing style' },
  { text: 'melodyAugmentation:', displayText: 'melodyAugmentation: ...', type: 'prop', desc: 'Melody augmentation' },
  { text: 'melodyAugmentationDisplay:', displayText: 'melodyAugmentationDisplay: ...', type: 'prop', desc: 'Augmentation display style' },
  { text: 'noteheadStyle:', displayText: 'noteheadStyle: ...', type: 'prop', desc: 'Notehead shape system' },
  { text: 'colorNotes:', displayText: 'colorNotes: true', type: 'prop', desc: 'PPT chromatic notehead colors' },
  { text: 'noteheadOutline:', displayText: 'noteheadOutline: true', type: 'prop', desc: 'Dark outline on noteheads' },
  { text: 'omitStem:', displayText: 'omitStem: true', type: 'prop', desc: 'Hide stems & flags' },
  { text: 'traditionalRhythms:', displayText: 'traditionalRhythms: true', type: 'prop', desc: 'Dotted notes, open noteheads & rests' },
  { text: 'melodyClef:', displayText: 'melodyClef: ...', type: 'prop', desc: 'Melody staff clef' },
  { text: 'harmonyClef:', displayText: 'harmonyClef: ...', type: 'prop', desc: 'Harmony staff clef' },
  { text: 'harmonyOctave:', displayText: 'harmonyOctave: 0', type: 'prop', desc: 'Harmony octave shift' },
  { text: 'harmonyStaffStyle:', displayText: 'harmonyStaffStyle: ...', type: 'prop', desc: 'Standard staff vs Coil' },
  { text: 'harmonyChangesOnly:', displayText: 'harmonyChangesOnly: true', type: 'prop', desc: 'Whole notes on chord changes' },
  { text: 'chordChanges:', displayText: 'chordChanges: true', type: 'prop', desc: 'Chord symbols on changes only' },
  { text: 'zoom:', displayText: 'zoom: 1.0', type: 'prop', desc: 'Staff scaling factor' },
  { text: 'indent:', displayText: 'indent: 0', type: 'prop', desc: 'First line indent in mm' },
  { text: 'showRhythmGrid:', displayText: 'showRhythmGrid: true', type: 'prop', desc: 'Vertical beat gridlines' },
  { text: 'showMelody:', displayText: 'showMelody: true', type: 'prop', desc: 'Show melody staff' },
  { text: 'showHarmonyCoil:', displayText: 'showHarmonyCoil: true', type: 'prop', desc: 'Show harmony coil staff' },
  { text: 'showTraditionalHarmony:', displayText: 'showTraditionalHarmony: true', type: 'prop', desc: 'Show traditional harmony staff' },
  { text: 'guitarTab:', displayText: 'guitarTab: true', type: 'prop', desc: 'Guitar tablature configuration' },
  { text: 'guitarTabMovement:', displayText: 'guitarTabMovement: vertical', type: 'prop', desc: 'Movement priority (vertical | horizontal)' },
  { text: 'guitarTabScope:', displayText: 'guitarTabScope: coil', type: 'prop', desc: 'Solver scope (coil | continuous)' },
  { text: 'guitarVoicing:', displayText: 'guitarVoicing: melodyOnly', type: 'prop', desc: 'Guitar tab voicing style' },
  { text: 'maximumFretSpan:', displayText: 'maximumFretSpan: 4', type: 'prop', desc: 'Max guitar fret stretch reach' },
  { text: 'tabStaffStyle:', displayText: 'tabStaffStyle: ppt', type: 'prop', desc: 'Tab notehead stencil style' },
  { text: 'showGuitarTab:', displayText: 'showGuitarTab: true', type: 'prop', desc: 'Show guitar tab staff' },
  { text: 'showMelodyCoilAbsolute:', displayText: 'showMelodyCoilAbsolute: true', type: 'prop', desc: 'Show absolute melody coil' },
  { text: 'showMelodyCoilInterval:', displayText: 'showMelodyCoilInterval: true', type: 'prop', desc: 'Show interval melody coil' },
  { text: 'showRhythmCoil:', displayText: 'showRhythmCoil: true', type: 'prop', desc: 'Show rhythm coil staff' },
  { text: 'showPulseCoil:', displayText: 'showPulseCoil: true', type: 'prop', desc: 'Show Pulse / Metric coil row' },
  { text: 'showTimeSignature:', displayText: 'showTimeSignature: true', type: 'prop', desc: 'Show time signature on staff' },
  { text: 'timeSignature:', displayText: 'timeSignature: "4/4"', type: 'prop', desc: 'Time signature for notation staff' },
  { text: 'showPulseSignature:', displayText: 'showPulseSignature: true', type: 'prop', desc: 'Show pulse signature in header' },
  { text: 'pulseSignature:', displayText: 'pulseSignature: "DoLa"', type: 'prop', desc: 'Pulse signature in header' },
  { text: 'scale:', displayText: 'scale: "Do"', type: 'prop', desc: 'Solfège scale grammar (e.g. "Do", "La", "DoMe", "LaTi")' },
  { text: 'keySignature:', displayText: 'keySignature: "C major"', type: 'prop', desc: 'Traditional staff key signature' },
  { text: 'showKeySignature:', displayText: 'showKeySignature: true', type: 'prop', desc: 'Show traditional key signature on staff' },
  { text: 'scaleSignature:', displayText: 'scaleSignature: "DoReMiFaSoLaTi"', type: 'prop', desc: 'Solfège scale signature in header' },
  { text: 'showScaleSignature:', displayText: 'showScaleSignature: true', type: 'prop', desc: 'Show Solfège scale signature in header' },
  { text: 'showScaleSignaturePianoTriangle:', displayText: 'showScaleSignaturePianoTriangle: true', type: 'prop', desc: 'Show Piano Triangle scale map in header' },
  { text: 'pulse:', displayText: 'pulse: "DoLa"', type: 'prop', desc: 'Metric pulse grammar' },
  { text: 'meter:', displayText: 'meter: "DoLa"', type: 'prop', desc: 'Alias for pulse' },
  { text: 'gridSymbols:', displayText: 'gridSymbols: true', type: 'prop', desc: 'Annotate grid lines with notehead shapes' },
  { text: 'excludeGridDoSymbol:', displayText: 'excludeGridDoSymbol: true', type: 'prop', desc: 'Omit circle on Do downbeats' },
  { text: 'strongBeatGridWeight:', displayText: 'strongBeatGridWeight: true', type: 'prop', desc: 'Solid line on strong beats' },
  { text: 'show:', displayText: 'show:', type: 'prop', desc: 'Visible score layers list' }
];

export const COIL_KEYS = [
  { text: 'melody:', displayText: 'melody: [ ... ]', type: 'prop', desc: 'Solfège melody array' },
  { text: 'rhythm:', displayText: 'rhythm: [ ... ]', type: 'prop', desc: 'Rhythm token array' },
  { text: 'harmony:', displayText: 'harmony: [ ... ]', type: 'prop', desc: 'Harmony chords array' },
  { text: 'pulse:', displayText: 'pulse: ...', type: 'prop', desc: 'Metric pulse pattern / length' },
  { text: 'meter:', displayText: 'meter: ...', type: 'prop', desc: 'Alias for pulse' },
  { text: 'parents:', displayText: 'parents: ...', type: 'prop', desc: 'Parent coil inheritance' },
  { text: 'parent:', displayText: 'parent: ...', type: 'prop', desc: 'Single parent inheritance' },
  { text: 'concat:', displayText: 'concat:', type: 'prop', desc: 'Concatenation of sub-coils' },
  { text: 'id:', displayText: 'id: ...', type: 'prop', desc: 'Coil identifier' },
  { text: 'harmonyOctave:', displayText: 'harmonyOctave: 0', type: 'prop', desc: 'Coil harmony octave shift' },
  { text: 'harmonyVoicing:', displayText: 'harmonyVoicing: ...', type: 'prop', desc: 'Coil-level voicing override' },
  { text: 'melodyAugmentation:', displayText: 'melodyAugmentation: ...', type: 'prop', desc: 'Melody augmentation' },
  { text: 'melodyAugmentationDisplay:', displayText: 'melodyAugmentationDisplay: ...', type: 'prop', desc: 'Augmentation display style' },
  { text: 'projection:', displayText: 'projection: ...', type: 'prop', desc: 'Coil-level projection preset' },
  { text: 'modulate:', displayText: 'modulate: "Fa"', type: 'prop', desc: 'Shift tonic by Solfège interval (e.g. "Fa", "So")' },
  { text: 'tonic:', displayText: 'tonic: "C4"', type: 'prop', desc: 'Absolute tonic pitch override' }
];

export const ENUMS_LAYOUT = [
  { text: 'concatenate', displayText: 'concatenate', type: 'enum', desc: 'Sequential concatenation of stitches across time' },
  { text: 'parallel', displayText: 'parallel', type: 'enum', desc: 'Concurrent / simultaneous layering of stitches' },
  { text: 'parallelPeriod', displayText: 'parallelPeriod', type: 'enum', desc: 'Polyrhythmic parallel layout stretching all stitches to match the same overall period duration' }
];

export const WEAVE_KEYS = [
  { text: 'id:', displayText: 'id: ...', type: 'prop', desc: 'Weave identifier' },
  { text: 'scale:', displayText: 'scale: "Do"', type: 'prop', desc: 'Weave-level Solfège scale definition (e.g. "Do", "La", "DoMe", "LaTi")' },
  { text: 'modulate:', displayText: 'modulate: "Fa"', type: 'prop', desc: 'Shift tonic by Solfège interval (e.g. "Fa", "So", "^So", "_Fa") or semitone integer' },
  { text: 'tonic:', displayText: 'tonic: "C4"', type: 'prop', desc: 'Absolute tonic pitch override for this weave' },
  { text: 'layout:', displayText: 'layout: concatenate', type: 'prop', desc: 'Stitch sequencing layout (concatenate, parallel, or parallelPeriod)' },
  { text: 'defaultCoil:', displayText: 'defaultCoil: ...', type: 'prop', desc: 'Default fallback coil' },
  { text: 'pulse:', displayText: 'pulse: ...', type: 'prop', desc: 'Weave-level metric pulse pattern' },
  { text: 'meter:', displayText: 'meter: ...', type: 'prop', desc: 'Alias for pulse' },
  { text: 'coils:', displayText: 'coils:', type: 'prop', desc: 'In-place coils map' },
  { text: 'stitch:', displayText: 'stitch:', type: 'prop', desc: 'List of stitches (coils & nested weaves)' },
  { text: 'stitches:', displayText: 'stitches:', type: 'prop', desc: 'Plural alias for stitch list' },
  { text: 'children:', displayText: 'children:', type: 'prop', desc: 'Legacy alias for stitch list' },
  { text: 'harmonyVoicing:', displayText: 'harmonyVoicing: ...', type: 'prop', desc: 'Weave-level voicing override' },
  { text: 'melodyAugmentation:', displayText: 'melodyAugmentation: ...', type: 'prop', desc: 'Weave-level augmentation' },
  { text: 'melodyAugmentationDisplay:', displayText: 'melodyAugmentationDisplay: ...', type: 'prop', desc: 'Weave-level augmentation display' },
  { text: 'projection:', displayText: 'projection: ...', type: 'prop', desc: 'Weave-level projection preset' }
];

export function indentSnippet(snippetText, baseIndent) {
  const lines = snippetText.split('\n');
  return lines.map((line, idx) => idx === 0 ? line : baseIndent + line).join('\n');
}

export function getContextSuggestions(cm, cursor) {
  const line = cm.getLine(cursor.line) || '';
  const beforeCursor = line.slice(0, cursor.ch);
  const { coils, weaves, knots } = scanDeclaredCoilsAndWeaves(cm);

  const openBracketIdx = beforeCursor.lastIndexOf('[');
  const closeBracketIdx = beforeCursor.lastIndexOf(']');
  const insideBrackets = openBracketIdx !== -1 && openBracketIdx > closeBracketIdx;

  if (insideBrackets) {
    if (/melody|pitches/i.test(beforeCursor)) return TOKENS_MELODY;
    if (/rhythm/i.test(beforeCursor)) return TOKENS_RHYTHM;
    if (/harmony|chords/i.test(beforeCursor)) return TOKENS_HARMONY;
    if (/show/i.test(beforeCursor)) return ENUMS_SHOW;
    if (/concat|parents|parent/i.test(beforeCursor)) {
      const parentSection = findParentSection(cm, cursor.line);
      if (parentSection === 'knot' || parentSection === 'knots') {
        return (knots.length > 0 ? knots : coils).map(id => ({ text: id, displayText: id, type: 'knot', desc: 'Parent Knot reference' }));
      }
      return coils.map(id => ({ text: id, displayText: id, type: 'coil', desc: 'Coil reference' }));
    }
  }

  const propMatch = beforeCursor.match(/^\s*([_a-zA-Z0-9]+)\s*:\s*([^#]*)$/);
  if (propMatch) {
    const propName = propMatch[1];
    const afterColon = propMatch[2];

    if (/^harmonyVoicing$/i.test(propName)) return ENUMS_HARMONY_VOICING;
    if (/^(guitarTabMovement|movement)$/i.test(propName)) return ENUMS_GUITAR_TAB_MOVEMENT;
    if (/^(guitarTabScope|scope|phraseScope)$/i.test(propName)) return ENUMS_GUITAR_TAB_SCOPE;
    if (/^(guitarVoicing|voicing)$/i.test(propName)) return ENUMS_GUITAR_VOICING;
    if (/^(tabStaffStyle|style)$/i.test(propName)) return ENUMS_TAB_STAFF_STYLE;
    if (/^melodyAugmentation$/i.test(propName)) return ENUMS_MELODY_AUGMENTATION;
    if (/^melodyAugmentationDisplay$/i.test(propName)) return ENUMS_MELODY_AUGMENTATION_DISPLAY;
    if (/^projection$/i.test(propName)) return ENUMS_PROJECTION;
    if (/^(melodyClef|harmonyClef|clef)$/i.test(propName)) return ENUMS_CLEF;
    if (/^noteheadStyle$/i.test(propName)) return ENUMS_NOTEHEAD_STYLE;
    if (/^harmonyStaffStyle$/i.test(propName)) return ENUMS_HARMONY_STAFF_STYLE;
    if (/^layout$/i.test(propName)) return ENUMS_LAYOUT;
    if (/^(abstract|hidden|visible|colorNotes|noteheadOutline|omitStem|traditionalRhythms|traditionalDurations|harmonyChangesOnly|chordChanges|showRhythmGrid|showMelody|showHarmonyCoil|showTraditionalHarmony|showGuitarTab|guitarTab|crossCoil|crossCoilGuitarTab|showMelodyCoilAbsolute|showMelodyCoilInterval|showRhythmCoil|showPulseCoil|showTimeSignature|showPulseSignature|showScaleSignature|showScaleSignaturePianoTriangle|showKeySignature|excludeGridDoSymbol|gridSymbolExcludeDo|strongBeatGridWeight|gridBeatWeights|showChordNames)$/i.test(propName)) {
      return [
        { text: 'true', displayText: 'true', type: 'enum', desc: 'Enable' },
        { text: 'false', displayText: 'false', type: 'enum', desc: 'Disable' },
      ];
    }
    if (/^gridSymbols$/i.test(propName)) {
      return [
        { text: 'true', displayText: 'true', type: 'enum', desc: 'Enable grid notehead shapes' },
        { text: '"no-do"', displayText: '"no-do"', type: 'enum', desc: 'Enable but exclude Do downbeat circle' },
        { text: '"all"', displayText: '"all"', type: 'enum', desc: 'Include all subdivision notehead shapes' },
        { text: 'false', displayText: 'false', type: 'enum', desc: 'Disable grid symbols' },
      ];
    }
    if (/^(parent|parents|from|use)$/i.test(propName)) {
      const parentSection = findParentSection(cm, cursor.line);
      if (parentSection === 'knot' || parentSection === 'knots') {
        return (knots.length > 0 ? knots : coils).map(id => ({ text: id, displayText: id, type: 'knot', desc: 'Parent Knot ID reference' }));
      }
      return coils.map(id => ({ text: id, displayText: id, type: 'coil', desc: 'Coil ID reference' }));
    }
    if (/^concat$/i.test(propName)) {
      return coils.map(id => ({ text: id, displayText: id, type: 'coil', desc: 'Sub-coil ID' }));
    }
    if (/^weave$/i.test(propName)) {
      return weaves.map(id => ({ text: id, displayText: id, type: 'weave', desc: 'Weave ID' }));
    }
    if (/^rhythm$/i.test(propName)) {
      if (afterColon.includes('[')) return TOKENS_RHYTHM;
      return [
        ...coils.map(id => ({ text: id, displayText: id, type: 'coil', desc: 'Injected Rhythm Coil' })),
        { text: '[Do, Do, Do, Do]', displayText: '[Do, Do, Do, Do] (4 quarter notes)', type: 'snip' },
        { text: '[DoxDo, Fi, DoxDo, Fi]', displayText: '[DoxDo, Fi, ...] (Eighth notes)', type: 'snip' },
        ...TOKENS_RHYTHM,
      ];
    }
    if (/^(melody|pitches)$/i.test(propName)) {
      if (afterColon.includes('[')) return TOKENS_MELODY;
      return [
        ...coils.map(id => ({ text: id, displayText: id, type: 'coil', desc: 'Injected Melody Coil' })),
        { text: '[Dox, Do, Me, So]', displayText: '[Dox, Do, Me, So] (Minor Motif)', type: 'snip' },
        ...TOKENS_MELODY,
      ];
    }
    if (/^(harmony|chords)$/i.test(propName)) {
      if (afterColon.includes('[')) return TOKENS_HARMONY;
      return [
        ...coils.map(id => ({ text: id, displayText: id, type: 'coil', desc: 'Injected Harmony Coil' })),
        { text: '[Do, Fa, So, Do]', displayText: '[Do, Fa, So, Do] (I-IV-V-I progression)', type: 'snip' },
        ...TOKENS_HARMONY,
      ];
    }
  }

  if (/^\s*-\s*/.test(line)) {
    const parentSection = findParentSection(cm, cursor.line);
    if (parentSection === 'show') return ENUMS_SHOW;
    if (parentSection === 'concat' || parentSection === 'parents') {
      return coils.map(id => ({ text: id, displayText: id, type: 'coil', desc: 'Coil reference' }));
    }
    if (parentSection === 'stitch' || parentSection === 'stitches' || parentSection === 'children') {
      const snippets = (state.snippets || []).filter(s => s.context && (s.context.includes('stitch') || s.context.includes('children')));
      return [
        ...snippets,
        ...coils.map(id => ({ text: `coil: ${id}`, displayText: `- coil: ${id}`, type: 'coil', desc: 'Stitch coil reference' })),
        ...weaves.map(id => ({ text: `weave: ${id}`, displayText: `- weave: ${id}`, type: 'weave', desc: 'Stitch weave reference' })),
      ];
    }
  }

  const parentSection = findParentSection(cm, cursor.line);
  if (parentSection === 'engraving') {
    const snippets = (state.snippets || []).filter(s => s.context && s.context.includes('engraving'));
    return [...snippets, ...ENGRAVING_KEYS];
  }
  if (parentSection === 'knot') return KNOT_KEYS;
  if (parentSection === 'coil-body') {
    const snippets = (state.snippets || []).filter(s => s.context && s.context.includes('coil-body'));
    return [...snippets, ...COIL_KEYS];
  }
  if (parentSection === 'weave-body') {
    const snippets = (state.snippets || []).filter(s => s.context && s.context.includes('weave-body'));
    return [...snippets, ...WEAVE_KEYS];
  }

  return [...(state.snippets || []), ...ROOT_KEYS];
}

export function renderHintItem(element, self, data) {
  element.classList.add('CodeMirror-hint', 'cm-ppt-hint-item');
  element.innerHTML = '';

  const type = data.type || 'prop';
  const badge = document.createElement('span');
  badge.className = `cm-ppt-hint-badge badge-${type}`;

  if (type === 'snip') {
    badge.textContent = data.icon || '📄';
  } else if (type === 'note') {
    const syl = (data.solfege || data.text || '').replace(/[^a-zA-Z]/g, '');
    const cleanSyl = syl.charAt(0).toUpperCase() + syl.slice(1).toLowerCase();
    const color = SOLFEGE_COLORS[cleanSyl.toLowerCase()] || '#64748b';
    badge.style.backgroundColor = color;
    badge.style.color = '#fff';
    badge.innerHTML = createSolfegeGlyphSvg(cleanSyl, data.text.includes('x'), 14);
  } else if (type === 'coil') {
    badge.textContent = 'COIL';
  } else if (type === 'weave') {
    badge.textContent = 'WEAVE';
  } else if (type === 'knot') {
    badge.textContent = 'KNOT';
  } else if (type === 'enum') {
    badge.textContent = 'ENUM';
  } else {
    badge.textContent = 'PROP';
  }

  element.appendChild(badge);

  const label = document.createElement('span');
  label.className = 'cm-ppt-hint-label';
  label.textContent = data.displayText || data.text;
  element.appendChild(label);

  if (data.desc) {
    const desc = document.createElement('span');
    desc.className = 'cm-ppt-hint-desc';
    desc.textContent = data.desc;
    element.appendChild(desc);
  }
}

export function registerAutocomplete(CodeMirror) {
  CodeMirror.registerHelper('hint', 'yaml', function (cm) {
    if (!state.preferences.autocomplete) return null;

    const cur = cm.getCursor();
    const token = cm.getTokenAt(cur);
    const line = cm.getLine(cur.line);

    let start = token.start;
    let end = token.end;
    let word = token.string.trim();

    if (/^[,\s\[\]:]+$/.test(word)) {
      word = '';
      start = cur.ch;
      end = cur.ch;
    } else {
      const match = line.slice(0, cur.ch).match(/[\w\-:.]+$/);
      if (match) {
        word = match[0];
        start = cur.ch - word.length;
        end = cur.ch;
      }
    }

    const suggestions = getContextSuggestions(cm, cur);
    if (!suggestions || suggestions.length === 0) return null;

    const cleanWord = word.toLowerCase().replace(/[:\s]/g, '');
    const filtered = cleanWord
      ? suggestions.filter(s =>
          s.text.toLowerCase().replace(/[:\s]/g, '').includes(cleanWord) ||
          (s.displayText && s.displayText.toLowerCase().includes(cleanWord)) ||
          (s.desc && s.desc.toLowerCase().includes(cleanWord))
        )
      : suggestions;

    if (filtered.length === 0) return null;

    return {
      list: filtered.map(item => ({
        text: item.snippet
          ? indentSnippet(item.snippet, (line.match(/^(\s*)/) || [''])[0])
          : item.text,
        displayText: item.displayText || item.text,
        desc: item.desc,
        type: item.type,
        solfege: item.solfege,
        icon: item.icon,
        render: renderHintItem,
      })),
      from: CodeMirror.Pos(cur.line, start),
      to: CodeMirror.Pos(cur.line, end),
    };
  });
}
