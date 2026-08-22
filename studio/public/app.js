/**
 * PPT Engraver Studio Frontend Application
 */

// State
let currentScoreFile = '';
let isDirty = false;
let compileDebounceTimer = null;
let currentZoom = 1.0;
let lastCompiledData = null;

// User Preferences
let enableAutocompile = localStorage.getItem('ppt_autocompile') !== 'false';
let enableAutocomplete = localStorage.getItem('ppt_enable_autocomplete') !== 'false';
let enableSolfegeColors = localStorage.getItem('ppt_enable_solfege_colors') !== 'false';
let enableCoilSuggestions = localStorage.getItem('ppt_enable_coil_suggestions') !== 'false';
let enableSolfegeContext = localStorage.getItem('ppt_enable_solfege_context') !== 'false';

// --- Domain Keyword Sets with Rich Metadata ---
const ENUMS_SHOW = [
  { text: 'melody', displayText: 'melody', type: 'enum', desc: 'Melody notation staff' },
  { text: 'harmony', displayText: 'harmony', type: 'enum', desc: 'Traditional harmony staff' },
  { text: 'traditionalHarmony', displayText: 'traditionalHarmony', type: 'enum', desc: 'Traditional 5-line harmony staff' },
  { text: 'harmonyStaff', displayText: 'harmonyStaff', type: 'enum', desc: 'Traditional 5-line harmony staff' },
  { text: 'melodyCoilInterval', displayText: 'melodyCoilInterval', type: 'enum', desc: 'Relative Solfège interval coil' },
  { text: 'melodyCoilAbsolute', displayText: 'melodyCoilAbsolute', type: 'enum', desc: 'Absolute Solfège pitch coil' },
  { text: 'rhythmCoil', displayText: 'rhythmCoil', type: 'enum', desc: 'PPT Rhythm Coil staff' },
  { text: 'pulseCoil', displayText: 'pulseCoil', type: 'enum', desc: 'PPT Pulse / Metric Coil staff' },
  { text: 'harmonyCoil', displayText: 'harmonyCoil', type: 'enum', desc: 'PPT Harmony Coil staff' },
  { text: 'chordNames', displayText: 'chordNames', type: 'enum', desc: 'Chord symbols above staff' },
  { text: 'rhythmGrid', displayText: 'rhythmGrid', type: 'enum', desc: 'Vertical rhythm gridlines' },
  { text: 'gridSymbols', displayText: 'gridSymbols', type: 'enum', desc: 'Annotate grid lines with notehead shapes' },
  { text: 'timeSignature', displayText: 'timeSignature', type: 'enum', desc: 'Traditional time signature on staff' },
  { text: 'pulseSignature', displayText: 'pulseSignature', type: 'enum', desc: 'PPT pulse declaration in header' },
];

const ENUMS_CLEF = [
  { text: 'treble', displayText: 'treble', type: 'enum', desc: 'Standard Treble clef' },
  { text: 'treble_8', displayText: 'treble_8', type: 'enum', desc: 'Treble 8vb (Guitar/Tenor)' },
  { text: 'treble^8', displayText: 'treble^8', type: 'enum', desc: 'Treble 8va (Piccolo)' },
  { text: 'bass', displayText: 'bass', type: 'enum', desc: 'Standard Bass clef' },
  { text: 'bass_8', displayText: 'bass_8', type: 'enum', desc: 'Bass 8vb (Sub-bass)' },
  { text: 'bass_15', displayText: 'bass_15', type: 'enum', desc: 'Bass 15mb (Double bass)' }
];

const ENUMS_NOTEHEAD_STYLE = [
  { text: 'ppt', displayText: 'ppt', type: 'enum', desc: 'PPT Geometric Solfège shapes' },
  { text: 'sacredHarp', displayText: 'sacredHarp', type: 'enum', desc: 'Sacred Harp 4-shape system' },
  { text: 'aiken', displayText: 'aiken', type: 'enum', desc: 'Aiken 7-shape system' },
  { text: 'funk', displayText: 'funk', type: 'enum', desc: 'Funk 7-shape system' },
  { text: 'walker', displayText: 'walker', type: 'enum', desc: 'Walker 7-shape system' },
  { text: 'diamond', displayText: 'diamond', type: 'enum', desc: 'Diamond noteheads' },
  { text: 'default', displayText: 'default', type: 'enum', desc: 'Standard oval noteheads' }
];

const ENUMS_HARMONY_VOICING = [
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

const ENUMS_MELODY_AUGMENTATION = [
  { text: 'none', displayText: 'none', type: 'enum', desc: 'Single melody line' },
  { text: 'thirdsBelow', displayText: 'thirdsBelow', type: 'enum', desc: 'Harmonize 3rds below' },
  { text: 'sixthsBelow', displayText: 'sixthsBelow', type: 'enum', desc: 'Harmonize 6ths below' },
  { text: 'triadClose', displayText: 'triadClose', type: 'enum', desc: '3-note close block chord' },
  { text: 'drop2', displayText: 'drop2', type: 'enum', desc: '4-note drop-2 jazz chord melody' },
  { text: 'guideToneDyad', displayText: 'guideToneDyad', type: 'enum', desc: '3rd/7th guide tone dyad' },
  { text: 'octaves', displayText: 'octaves', type: 'enum', desc: 'Octave below' }
];

const ENUMS_MELODY_AUGMENTATION_DISPLAY = [
  { text: 'ghosted', displayText: 'ghosted', type: 'enum', desc: 'Translucent gray notehead' },
  { text: 'dimmed', displayText: 'dimmed', type: 'enum', desc: 'Dimmed Solfège notehead' },
  { text: 'smallColored', displayText: 'smallColored', type: 'enum', desc: 'Small chromatic notehead' },
  { text: 'smallMuted', displayText: 'smallMuted', type: 'enum', desc: 'Small muted gray notehead' },
  { text: 'parenthesized', displayText: 'parenthesized', type: 'enum', desc: 'Parenthesized notehead' },
  { text: 'diamond', displayText: 'diamond', type: 'enum', desc: 'Diamond notehead style' },
  { text: 'normal', displayText: 'normal', type: 'enum', desc: 'Standard notehead' }
];

const ENUMS_PROJECTION = [
  { text: 'chordMelody', displayText: 'chordMelody', type: 'enum', desc: 'Drop-2 jazz chord melody' },
  { text: 'leadSheet', displayText: 'leadSheet', type: 'enum', desc: 'Lead sheet (chords + melody)' },
  { text: 'jazzComping', displayText: 'jazzComping', type: 'enum', desc: 'Rootless rhythm comping' },
  { text: 'acousticFolk', displayText: 'acousticFolk', type: 'enum', desc: 'Root-5th & thirds below' },
  { text: 'bassAndLead', displayText: 'bassAndLead', type: 'enum', desc: 'Walking bass + melody' },
  { text: 'default', displayText: 'default', type: 'enum', desc: 'Standard PPT arrangement' }
];

const ENUMS_HARMONY_STAFF_STYLE = [
  { text: 'standard', displayText: 'standard', type: 'enum', desc: 'Traditional music staff only' },
  { text: 'coil', displayText: 'coil', type: 'enum', desc: 'PPT Harmony Coil only' },
  { text: 'both', displayText: 'both', type: 'enum', desc: 'Both staff and Harmony Coil' }
];

const TOKENS_MELODY = [
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

const TOKENS_RHYTHM = [
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

const TOKENS_HARMONY = [
  { text: 'Do', displayText: 'Do', type: 'note', solfege: 'Do', desc: 'Root unison' },
  { text: 'DoMe', displayText: 'DoMe', type: 'note', solfege: 'Do', desc: 'Minor 3rd dyad' },
  { text: 'DoMi', displayText: 'DoMi', type: 'note', solfege: 'Do', desc: 'Major 3rd dyad' },
  { text: 'DoSo', displayText: 'DoSo', type: 'note', solfege: 'Do', desc: 'Fifth power dyad' },
  { text: 'DoMeSo', displayText: 'DoMeSo', type: 'note', solfege: 'Do', desc: 'Minor triad' },
  { text: 'DoMiSo', displayText: 'DoMiSo', type: 'note', solfege: 'Do', desc: 'Major triad' },
  { text: 'DoMeTe', displayText: 'DoMeTe', type: 'note', solfege: 'Do', desc: 'Minor 7th chord' },
  { text: 'DoMiTe', displayText: 'DoMiTe', type: 'note', solfege: 'Do', desc: 'Dominant 7th chord' },
  { text: 'DoLa', displayText: 'DoLa', type: 'note', solfege: 'Do', desc: 'Major 6th dyad' },
  { text: 'DoRe', displayText: 'DoRe', type: 'note', solfege: 'Do', desc: 'Suspended 2nd dyad' },
  { text: 'DoSi', displayText: 'DoSi', type: 'note', solfege: 'Do', desc: 'Major 7th dyad' },
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

const ROOT_KEYS = [
  { text: 'tapestry:', displayText: 'tapestry:', type: 'prop', desc: 'Score root block' },
  { text: 'knot:', displayText: 'knot:', type: 'prop', desc: 'Score metadata & default settings' },
  { text: 'knots:', displayText: 'knots:', type: 'prop', desc: 'Named knot projections list/dictionary' },
  { text: 'coils:', displayText: 'coils:', type: 'prop', desc: 'Coil definitions dictionary' },
  { text: 'weaves:', displayText: 'weaves:', type: 'prop', desc: 'Hierarchical weave dictionary' },
  { text: 'weave:', displayText: 'weave: ...', type: 'prop', desc: 'Root weave reference' }
];

const KNOT_KEYS = [
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
  { text: 'showPulseCoil:', displayText: 'showPulseCoil: true', type: 'prop', desc: 'Show Pulse / Metric coil row' },
  { text: 'gridSymbols:', displayText: 'gridSymbols: true', type: 'prop', desc: 'Annotate grid lines with notehead shapes' },
  { text: 'excludeGridDoSymbol:', displayText: 'excludeGridDoSymbol: true', type: 'prop', desc: 'Omit circle on Do downbeats' },
  { text: 'strongBeatGridWeight:', displayText: 'strongBeatGridWeight: true', type: 'prop', desc: 'Solid line on strong beats' }
];

const ENGRAVING_KEYS = [
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
  { text: 'showMelodyCoilAbsolute:', displayText: 'showMelodyCoilAbsolute: true', type: 'prop', desc: 'Show absolute melody coil' },
  { text: 'showMelodyCoilInterval:', displayText: 'showMelodyCoilInterval: true', type: 'prop', desc: 'Show interval melody coil' },
  { text: 'showRhythmCoil:', displayText: 'showRhythmCoil: true', type: 'prop', desc: 'Show rhythm coil staff' },
  { text: 'showPulseCoil:', displayText: 'showPulseCoil: true', type: 'prop', desc: 'Show Pulse / Metric coil row' },
  { text: 'showTimeSignature:', displayText: 'showTimeSignature: true', type: 'prop', desc: 'Show time signature on staff' },
  { text: 'timeSignature:', displayText: 'timeSignature: "4/4"', type: 'prop', desc: 'Time signature for notation staff' },
  { text: 'showPulseSignature:', displayText: 'showPulseSignature: true', type: 'prop', desc: 'Show pulse signature in header' },
  { text: 'pulseSignature:', displayText: 'pulseSignature: "DoLa"', type: 'prop', desc: 'Pulse signature in header' },
  { text: 'pulse:', displayText: 'pulse: "DoLa"', type: 'prop', desc: 'Metric pulse grammar' },
  { text: 'meter:', displayText: 'meter: "DoLa"', type: 'prop', desc: 'Alias for pulse' },
  { text: 'gridSymbols:', displayText: 'gridSymbols: true', type: 'prop', desc: 'Annotate grid lines with notehead shapes' },
  { text: 'excludeGridDoSymbol:', displayText: 'excludeGridDoSymbol: true', type: 'prop', desc: 'Omit circle on Do downbeats' },
  { text: 'strongBeatGridWeight:', displayText: 'strongBeatGridWeight: true', type: 'prop', desc: 'Solid line on strong beats' },
  { text: 'show:', displayText: 'show:', type: 'prop', desc: 'Visible score layers list' }
];

const COIL_KEYS = [
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
  { text: 'melodyAugmentation:', displayText: 'melodyAugmentation: ...', type: 'prop', desc: 'Coil-level augmentation' },
  { text: 'melodyAugmentationDisplay:', displayText: 'melodyAugmentationDisplay: ...', type: 'prop', desc: 'Coil-level augmentation display' },
  { text: 'projection:', displayText: 'projection: ...', type: 'prop', desc: 'Coil-level projection preset' }
];

const WEAVE_KEYS = [
  { text: 'id:', displayText: 'id: ...', type: 'prop', desc: 'Weave identifier' },
  { text: 'layout:', displayText: 'layout: concatenate', type: 'prop', desc: 'Child sequencing layout' },
  { text: 'defaultCoil:', displayText: 'defaultCoil: ...', type: 'prop', desc: 'Default fallback coil' },
  { text: 'pulse:', displayText: 'pulse: ...', type: 'prop', desc: 'Weave-level metric pulse pattern' },
  { text: 'meter:', displayText: 'meter: ...', type: 'prop', desc: 'Alias for pulse' },
  { text: 'coils:', displayText: 'coils:', type: 'prop', desc: 'In-place coils map' },
  { text: 'children:', displayText: 'children:', type: 'prop', desc: 'List of child coils & weaves' },
  { text: 'harmonyVoicing:', displayText: 'harmonyVoicing: ...', type: 'prop', desc: 'Weave-level voicing override' },
  { text: 'melodyAugmentation:', displayText: 'melodyAugmentation: ...', type: 'prop', desc: 'Weave-level augmentation' },
  { text: 'melodyAugmentationDisplay:', displayText: 'melodyAugmentationDisplay: ...', type: 'prop', desc: 'Weave-level augmentation display' },
  { text: 'projection:', displayText: 'projection: ...', type: 'prop', desc: 'Weave-level projection preset' }
];

const TOP_LEVEL_KEYS = ROOT_KEYS;

// --- Contextual YAML Snippets Library ---
const DEFAULT_SNIPPET_TEMPLATES = [
  {
    id: 'snip-tapestry-full',
    label: 'New Tapestry Score Scaffold',
    displayText: 'New Tapestry Score (Full)',
    type: 'snip',
    desc: 'Complete score template',
    category: 'Snippets',
    icon: '📄',
    context: ['root', 'top'],
    snippet: `tapestry:
  knot:
    tonic: "C4"
    weave: song
    engraving:
      title: "New PPT Score"
      composer: "Composer"
      colorNotes: true
      omitStem: true
      noteheadStyle: ppt
      show:
        - melody
        - harmony
        - melodyCoilInterval
        - rhythmCoil
        - rhythmGrid
        - chordNames

  weaves:
    song:
      children:
        - coil: verse

  coils:
    verse:
      melody: [Dox, Do, Me, So, Me, Do]
      rhythm: [Do, Fi, Do, Fi, Do, 2]
      harmony: [DoMe]`
  },
  {
    id: 'snip-knot-header',
    label: 'Tapestry & Knot Header',
    displayText: 'Tapestry & Knot Header',
    type: 'snip',
    desc: 'Score metadata header',
    category: 'Snippets',
    icon: '🏷️',
    context: ['root', 'top'],
    snippet: `tapestry:
  knot:
    tonic: "C4"
    weave: song
    engraving:
      title: "Score Title"
      composer: "Composer"
      noteheadStyle: ppt
      colorNotes: true
      omitStem: true`
  },
  {
    id: 'snip-weave-with-coils',
    label: 'New Weave (with Coils & Children)',
    displayText: 'New Weave (with Coils & Children)',
    type: 'snip',
    desc: 'Weave with local coil dictionary',
    category: 'Snippets',
    icon: '🧶',
    context: ['weaves', 'weave-body'],
    snippet: `section:
  coils:
    _base_harm:
      harmony: [DoMe]
    _part1:
      parents: _base_harm
      melody: [Dox, Do, Me, La]
      rhythm: [Do, Fi, Do, Fi]
  children:
    - coil: _part1`
  },
  {
    id: 'snip-weave-simple',
    label: 'New Weave (Children only)',
    displayText: 'New Weave (Children only)',
    type: 'snip',
    desc: 'Weave container for child coils',
    category: 'Snippets',
    icon: '🧶',
    context: ['weaves', 'weave-body'],
    snippet: `section:
  children:
    - coil: verse
    - coil: chorus`
  },
  {
    id: 'snip-child-coil-inline',
    label: 'Add Inline Coil (Melody + Rhythm + Harmony)',
    displayText: 'Add Inline Coil',
    type: 'snip',
    desc: '3-layer inline child coil',
    category: 'Snippets',
    icon: '🎵',
    context: ['children'],
    snippet: `- coil:
    id: motif
    melody: [Dox, Do, Me, So]
    rhythm: [Do, Fi, Do, Fi]
    harmony: [DoMe]`
  },
  {
    id: 'snip-child-coil-parent',
    label: 'Add Inline Child Coil with Parent',
    displayText: 'Add Inline Child Coil with Parent',
    type: 'snip',
    desc: 'Inherits layers from parent coil',
    category: 'Snippets',
    icon: '🔗',
    context: ['children'],
    snippet: `- coil:
    id: motif_var
    parents: motif
    melody: [Dox, Re, Fa, La]`
  },
  {
    id: 'snip-child-ref-coil',
    label: 'Add Child Coil Reference',
    displayText: 'Add Child Coil Reference (- coil: ...)',
    type: 'snip',
    desc: 'Reference to declared coil',
    category: 'Snippets',
    icon: '🎵',
    context: ['children'],
    snippet: `- coil: `
  },
  {
    id: 'snip-child-ref-weave',
    label: 'Add Child Weave Reference',
    displayText: 'Add Child Weave Reference (- weave: ...)',
    type: 'snip',
    desc: 'Reference to child weave',
    category: 'Snippets',
    icon: '🧶',
    context: ['children'],
    snippet: `- weave: `
  },
  {
    id: 'snip-coil-full',
    label: 'New Coil Definition',
    displayText: 'New Coil Definition',
    type: 'snip',
    desc: 'Full 3-layer coil entry',
    category: 'Snippets',
    icon: '🎵',
    context: ['coils', 'coil-body'],
    snippet: `new_coil:
  melody: [Dox, Do, Me, So, Me, Do]
  rhythm: [Do, Fi, Do, Fi, Do, 2]
  harmony: [DoMe]`
  },
  {
    id: 'snip-coil-parent',
    label: 'New Coil with Parent',
    displayText: 'New Coil with Parent',
    type: 'snip',
    desc: 'Coil inheriting from parent',
    category: 'Snippets',
    icon: '🔗',
    context: ['coils', 'coil-body'],
    snippet: `new_coil_var:
  parents: base_coil
  melody: [Dox, Re, Fa, La]`
  },
  {
    id: 'snip-coil-concat',
    label: 'New Concat Coil Block',
    displayText: 'New Concat Coil Block',
    type: 'snip',
    desc: 'Concatenates multiple sub-coils',
    category: 'Snippets',
    icon: '🔗',
    context: ['coils', 'coil-body'],
    snippet: `full_section:
  concat:
    - part1
    - part2`
  },
  {
    id: 'snip-layer-melody',
    label: 'Add Melody Layer',
    displayText: 'melody: [ ... ]',
    type: 'snip',
    desc: 'Solfège pitch degree array',
    category: 'Snippets',
    icon: '🎼',
    context: ['coil-body'],
    snippet: `melody: [Dox, Do, Me, So]`
  },
  {
    id: 'snip-layer-rhythm',
    label: 'Add Rhythm Layer',
    displayText: 'rhythm: [ ... ]',
    type: 'snip',
    desc: 'PPT duration token array',
    category: 'Snippets',
    icon: '🥁',
    context: ['coil-body'],
    snippet: `rhythm: [Do, Fi, Do, Fi]`
  },
  {
    id: 'snip-layer-harmony',
    label: 'Add Harmony Layer',
    displayText: 'harmony: [ ... ]',
    type: 'snip',
    desc: 'PPT chord / dyad array',
    category: 'Snippets',
    icon: '🎹',
    context: ['coil-body'],
    snippet: `harmony: [DoMe]`
  },
  {
    id: 'snip-engraving-preset',
    label: 'Standard PPT Engraving Preset',
    displayText: 'Standard PPT Engraving Preset',
    type: 'snip',
    desc: 'High-contrast Solfège noteheads & coils',
    category: 'Snippets',
    icon: '⚙️',
    context: ['engraving'],
    snippet: `noteheadStyle: ppt
colorNotes: true
omitStem: true
harmonyClef: treble_8
show:
  - melody
  - harmony
  - melodyCoilInterval
  - rhythmCoil
  - rhythmGrid
  - chordNames`
  }
];

let SNIPPET_TEMPLATES = [...DEFAULT_SNIPPET_TEMPLATES];

async function fetchSnippets() {
  try {
    const res = await fetch('/api/snippets');
    if (!res.ok) return;
    const data = await res.json();
    if (data.snippets && Array.isArray(data.snippets) && data.snippets.length > 0) {
      SNIPPET_TEMPLATES = data.snippets.map(s => ({
        ...s,
        type: 'snip'
      }));
    }
  } catch (err) {
    console.error('Failed to load snippets from API:', err);
  }
}

function indentSnippet(snippetText, baseIndent) {
  const lines = snippetText.split('\n');
  return lines.map((line, idx) => idx === 0 ? line : baseIndent + line).join('\n');
}

/**
 * Cache of declared knot, coil and weave IDs in the document.
 */
let declaredIdsCache = new Set();

const RESERVED_SCHEMA_KEYS = new Set([
  'tapestry', 'knot', 'knots', 'engraving', 'weaves', 'coils',
  'children', 'melody', 'rhythm', 'harmony', 'chords', 'pitches',
  'from', 'use', 'pulse', 'meter', 'clef', 'concat', 'parents', 'parent',
  'show', 'title', 'subtitle', 'composer', 'arranger', 'poet', 'lyricist',
  'copyright', 'tagline', 'tempo', 'tonic', 'do', 'colorNotes', 'omitStem',
  'id', 'name', 'label', 'layout', 'coil', 'weave', 'projection', 'harmonyVoicing',
  'melodyAugmentation', 'melodyAugmentationDisplay', 'harmonyStaffStyle', 'harmonyClef',
  'melodyClef', 'harmonyOctave', 'noteheadStyle', 'traditionalRhythms',
  'traditionalDurations', 'noteheadOutline', 'harmonyChangesOnly', 'chordChanges',
  'showChordNames', 'showTraditionalHarmony', 'showRhythmGrid', 'showMelody',
  'showHarmonyCoil', 'showMelodyCoilAbsolute', 'showMelodyCoilInterval',
  'showRhythmCoil', 'showPulseCoil', 'zoom', 'indent', 'tags', 'repeat', 'transposition',
  // Engraving feature keys (all property names that appear as YAML dict keys in engraving blocks)
  'gridSymbols', 'excludeGridDoSymbol', 'gridSymbolExcludeDo', 'strongBeatGridWeight',
  'gridBeatWeights', 'showTimeSignature', 'timeSignature', 'showPulseSignature',
  'pulseSignature', 'showKeyAnchor', 'piece', 'abstract', 'hidden', 'visible',
  'noteheadOutline', 'colorNotes', 'omitStem', 'chordChanges', 'harmonyChangesOnly',
  'piece', 'copyright', 'tagline', 'zoom', 'indent', 'tags', 'repeat',
]);

function scanDeclaredCoilsAndWeaves(cm) {
  if (!cm) return { coils: [], weaves: [], knots: [], all: [] };
  const text = cm.getValue();
  const coilIds = new Set();
  const weaveIds = new Set();
  const knotIds = new Set();

  const lines = text.split('\n');
  let currentSection = null; // 'weaves' | 'coils' | 'knots' | other
  let sectionIndent = 0;

  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    if (/^\s*#/.test(line) || !line.trim()) continue;

    const indent = (line.match(/^(\s*)/) || [''])[0].length;

    const sectionMatch = line.match(/^(\s*)(weaves|coils|knots)\s*:/i);
    if (sectionMatch) {
      currentSection = sectionMatch[2].toLowerCase();
      sectionIndent = indent;
      continue;
    } else if (indent <= sectionIndent && /^\s*[_a-zA-Z0-9]+\s*:/i.test(line)) {
      const topMatch = line.match(/^\s*([_a-zA-Z0-9]+)\s*:/);
      if (topMatch && ['tapestry', 'knot', 'knots', 'weaves', 'coils'].includes(topMatch[1].toLowerCase())) {
        currentSection = topMatch[1].toLowerCase();
        sectionIndent = indent;
      } else if (indent === 0) {
        currentSection = null;
      }
    }

    const dictKeyMatch = line.match(/^(\s*)([_a-zA-Z0-9]+)\s*:(?!\s*\[)/);
    if (dictKeyMatch) {
      const key = dictKeyMatch[2];
      if (!RESERVED_SCHEMA_KEYS.has(key.toLowerCase())) {
        if (currentSection === 'weaves') weaveIds.add(key);
        else if (currentSection === 'knots') knotIds.add(key);
        else if (currentSection === 'coils') coilIds.add(key);
        else coilIds.add(key);
      }
    }

    const inlineIdMatch = line.match(/\bid\s*:\s*["']?([_a-zA-Z0-9]+)["']?/);
    if (inlineIdMatch) {
      const idVal = inlineIdMatch[1];
      if (currentSection === 'weaves') weaveIds.add(idVal);
      else if (currentSection === 'knots') knotIds.add(idVal);
      else coilIds.add(idVal);
    }
  }

  const all = Array.from(new Set([...coilIds, ...weaveIds, ...knotIds]));
  declaredIdsCache = new Set(all);

  return {
    coils: Array.from(coilIds),
    weaves: Array.from(weaveIds),
    knots: Array.from(knotIds),
    all
  };
}

function updateDeclaredIdsCache(cm) {
  const result = scanDeclaredCoilsAndWeaves(cm);
  return result.all;
}

/**
 * Scans the current document text for declared coil and weave IDs.
 */
function scanDeclaredIds(cm) {
  return updateDeclaredIdsCache(cm);
}

/**
 * Determines parent YAML section based on indentation hierarchy.
 */
function findParentSection(cm, lineNum) {
  const targetLine = cm.getLine(lineNum) || '';
  const targetIndent = (targetLine.match(/^(\s*)/) || [''])[0].length;

  for (let l = lineNum - 1; l >= 0; l--) {
    const prevLine = cm.getLine(l);
    if (!prevLine || /^\s*#/.test(prevLine) || !prevLine.trim()) continue;

    const prevIndent = (prevLine.match(/^(\s*)/) || [''])[0].length;
    if (prevIndent < targetIndent || targetIndent === 0) {
      const match = prevLine.match(/^\s*(?:-\s*)?([_a-zA-Z0-9]+)\s*:/);
      if (match) {
        const key = match[1].toLowerCase();
        if (key === 'engraving') return 'engraving';
        if (key === 'knot' || key === 'knots') return 'knot';
        if (key === 'show') return 'show';
        if (key === 'coils') return 'coils';
        if (key === 'weaves') return 'weaves';
        if (key === 'children') return 'children';
        if (key === 'concat') return 'concat';
        if (key === 'parents' || key === 'parent') return 'parents';

        const grandParent = findParentSection(cm, l);
        if (grandParent === 'knots' || grandParent === 'knot') return 'knot';
        if (grandParent === 'coils' || grandParent === 'coil-body') return 'coil-body';
        if (grandParent === 'weaves' || grandParent === 'weave-body') return 'weave-body';
        return key;
      }
    }
  }
  return 'root';
}

/**
 * Determines autocomplete context and suggestions based on cursor position and surrounding lines.
 */
function getContextSuggestions(cm, cursor) {
  const line = cm.getLine(cursor.line) || '';
  const beforeCursor = line.slice(0, cursor.ch);
  const { coils, weaves, knots } = scanDeclaredCoilsAndWeaves(cm);

  // 0. Check if cursor is inside bracket array [...] on current line
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

  // 1. Property Value Contexts (cursor is after propertyName:)
  const propMatch = beforeCursor.match(/^\s*([_a-zA-Z0-9]+)\s*:\s*([^#]*)$/);
  if (propMatch) {
    const propName = propMatch[1];
    const afterColon = propMatch[2];

    if (/^harmonyVoicing$/i.test(propName)) return ENUMS_HARMONY_VOICING;
    if (/^melodyAugmentation$/i.test(propName)) return ENUMS_MELODY_AUGMENTATION;
    if (/^melodyAugmentationDisplay$/i.test(propName)) return ENUMS_MELODY_AUGMENTATION_DISPLAY;
    if (/^projection$/i.test(propName)) return ENUMS_PROJECTION;
    if (/^(melodyClef|harmonyClef|clef)$/i.test(propName)) return ENUMS_CLEF;
    if (/^noteheadStyle$/i.test(propName)) return ENUMS_NOTEHEAD_STYLE;
    if (/^harmonyStaffStyle$/i.test(propName)) return ENUMS_HARMONY_STAFF_STYLE;
    if (/^layout$/i.test(propName)) return [{ text: 'concatenate', displayText: 'concatenate', type: 'enum', desc: 'Sequential concatenation' }];
    if (/^(abstract|hidden|visible|colorNotes|noteheadOutline|omitStem|traditionalRhythms|traditionalDurations|harmonyChangesOnly|chordChanges|showRhythmGrid|showMelody|showHarmonyCoil|showTraditionalHarmony|showMelodyCoilAbsolute|showMelodyCoilInterval|showRhythmCoil|showPulseCoil|showTimeSignature|showPulseSignature|excludeGridDoSymbol|gridSymbolExcludeDo|strongBeatGridWeight|gridBeatWeights|showChordNames)$/i.test(propName)) {
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
    if (/^(tonic|do)$/i.test(propName)) {
      return [
        { text: '"C4"', displayText: 'C4 (Default Middle C)', type: 'enum' },
        { text: '"D4"', displayText: 'D4', type: 'enum' },
        { text: '"Eb4"', displayText: 'Eb4', type: 'enum' },
        { text: '"F4"', displayText: 'F4', type: 'enum' },
        { text: '"F#3"', displayText: 'F#3', type: 'enum' },
        { text: '"G4"', displayText: 'G4', type: 'enum' },
        { text: '"A4"', displayText: 'A4', type: 'enum' },
        { text: '"Bb4"', displayText: 'Bb4', type: 'enum' },
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
    if (/^defaultCoil$/i.test(propName)) {
      return coils.map(id => ({ text: id, displayText: id, type: 'coil', desc: 'Default coil fallback' }));
    }
    if (/^(pulse|meter)$/i.test(propName)) {
      return [
        { text: 'DoLa', displayText: 'DoLa (4-beat Common Time)', type: 'enum' },
        { text: 'DoRe', displayText: 'DoRe (3-beat Triple Pulse)', type: 'enum' },
        { text: 'DoSo', displayText: 'DoSo (2-beat Half Time)', type: 'enum' },
        { text: 'DoMi', displayText: 'DoMi (5-beat Quintuple Pulse)', type: 'enum' },
        { text: 'DoSi', displayText: 'DoSi (6-beat Compound Pulse)', type: 'enum' },
        { text: 'DoLaDiLa', displayText: 'DoLaDiLa (8-beat Compound 4/4)', type: 'enum' },
        { text: 'DoReDiRe', displayText: 'DoReDiRe (6-beat Compound 6/8)', type: 'enum' },
        { text: 'DoReDiSo', displayText: 'DoReDiSo (5-beat Compound 5/4 [3+2])', type: 'enum' },
        { text: 'DoSoDiRe', displayText: 'DoSoDiRe (5-beat Compound 5/4 [2+3])', type: 'enum' },
      ];
    }
    if (/^rhythm$/i.test(propName)) {
      if (afterColon.includes('[')) return TOKENS_RHYTHM;
      return [
        ...coils.map(id => ({ text: id, displayText: id, type: 'coil', desc: 'Injected Rhythm Coil' })),
        { text: '[Do, Do, Do, Do]', displayText: '[Do, Do, Do, Do] (4 quarter notes)', type: 'snip' },
        { text: '[DoxDo, Fi, DoxDo, Fi]', displayText: '[DoxDo, Fi, ...] (Eighth notes)', type: 'snip' },
        { text: 'DoLa', displayText: 'DoLa (4-beat Macro Block)', type: 'enum' },
        { text: 'DoSo', displayText: 'DoSo (8-beat Macro Block)', type: 'enum' },
        ...TOKENS_RHYTHM,
      ];
    }
    if (/^(melody|pitches)$/i.test(propName)) {
      if (afterColon.includes('[')) return TOKENS_MELODY;
      return [
        ...coils.map(id => ({ text: id, displayText: id, type: 'coil', desc: 'Injected Melody Coil' })),
        { text: '[Dox, Do, Re, Mi, Fa, So]', displayText: '[Dox, Do, Re, ...] (Scale phrase)', type: 'snip' },
        { text: '[Dox, 1, So, 2]', displayText: '[Dox, 1, So, 2] (Padded phrase)', type: 'snip' },
        ...TOKENS_MELODY,
      ];
    }
    if (/^(harmony|chords)$/i.test(propName)) {
      if (afterColon.includes('[')) return TOKENS_HARMONY;
      return [
        ...coils.map(id => ({ text: id, displayText: id, type: 'coil', desc: 'Injected Harmony Coil' })),
        { text: '[Do, Fa, So, Do]', displayText: '[Do, Fa, So, Do] (I-IV-V-I progression)', type: 'snip' },
        { text: '[Do, 2, Fa, 2, So, 2, Do, 2]', displayText: '[Do, 2, Fa, 2, ...] (Held chords)', type: 'snip' },
        ...TOKENS_HARMONY,
      ];
    }
    if (/^show$/i.test(propName)) {
      return ENUMS_SHOW;
    }
  }

  // 2. Bullet / List Item Contexts
  if (/^\s*-\s*/.test(line)) {
    const parentSection = findParentSection(cm, cursor.line);
    if (parentSection === 'show') return ENUMS_SHOW;
    if (parentSection === 'concat' || parentSection === 'parents') {
      return coils.map(id => ({ text: id, displayText: id, type: 'coil', desc: 'Coil reference' }));
    }
    if (parentSection === 'knot' || parentSection === 'knots') {
      const knotSnippets = SNIPPET_TEMPLATES.filter(s => s.context && (s.context.includes('knot') || s.context.includes('knots'))).map(s => ({
        text: s.label,
        displayText: s.displayText,
        type: s.type,
        desc: s.desc,
        isSnippet: true,
        snippet: s.snippet,
        context: s.context
      }));
      return [...knotSnippets, ...KNOT_KEYS];
    }
    if (parentSection === 'children') {
      const childSnippets = SNIPPET_TEMPLATES.filter(s => s.context && s.context.includes('children')).map(s => ({
        text: s.label,
        displayText: s.displayText,
        type: s.type,
        desc: s.desc,
        isSnippet: true,
        snippet: s.snippet,
        context: s.context
      }));
      const coilRefs = coils.map(id => ({ text: `coil: ${id}`, displayText: `coil: ${id}`, type: 'coil', desc: 'Child coil' }));
      const weaveRefs = weaves.map(id => ({ text: `weave: ${id}`, displayText: `weave: ${id}`, type: 'weave', desc: 'Child weave' }));
      return [...childSnippets, ...coilRefs, ...weaveRefs];
    }
  }

  // 3. Block Key Position (typing a key name at start of line / indentation)
  const currentIndent = (line.match(/^(\s*)/) || [''])[0].length;
  const parentSection = findParentSection(cm, cursor.line);

  if (currentIndent === 0) {
    const rootSnippets = SNIPPET_TEMPLATES.filter(s => s.context && s.context.includes('root')).map(s => ({
      text: s.label,
      displayText: s.displayText,
      type: s.type,
      desc: s.desc,
      isSnippet: true,
      snippet: s.snippet,
      context: s.context
    }));
    return [...rootSnippets, ...ROOT_KEYS];
  }

  if (parentSection === 'engraving') {
    const engSnippets = SNIPPET_TEMPLATES.filter(s => s.context && s.context.includes('engraving')).map(s => ({
      text: s.label,
      displayText: s.displayText,
      type: s.type,
      desc: s.desc,
      isSnippet: true,
      snippet: s.snippet,
      context: s.context
    }));
    return [...engSnippets, ...ENGRAVING_KEYS];
  }

  if (parentSection === 'knot' || parentSection === 'knots') {
    const knotSnippets = SNIPPET_TEMPLATES.filter(s => s.context && (s.context.includes('knot') || s.context.includes('knots'))).map(s => ({
      text: s.label,
      displayText: s.displayText,
      type: s.type,
      desc: s.desc,
      isSnippet: true,
      snippet: s.snippet,
      context: s.context
    }));
    return [...knotSnippets, ...KNOT_KEYS];
  }

  if (parentSection === 'coils' || parentSection === 'coil-body') {
    const coilSnippets = SNIPPET_TEMPLATES.filter(s => s.context && (s.context.includes('coils') || s.context.includes('coil-body'))).map(s => ({
      text: s.label,
      displayText: s.displayText,
      type: s.type,
      desc: s.desc,
      isSnippet: true,
      snippet: s.snippet,
      context: s.context
    }));
    return [...coilSnippets, ...COIL_KEYS];
  }

  if (parentSection === 'weaves' || parentSection === 'weave-body') {
    const weaveSnippets = SNIPPET_TEMPLATES.filter(s => s.context && (s.context.includes('weaves') || s.context.includes('weave-body'))).map(s => ({
      text: s.label,
      displayText: s.displayText,
      type: s.type,
      desc: s.desc,
      isSnippet: true,
      snippet: s.snippet,
      context: s.context
    }));
    return [...weaveSnippets, ...WEAVE_KEYS];
  }

  if (parentSection === 'children') {
    const childSnippets = SNIPPET_TEMPLATES.filter(s => s.context && s.context.includes('children')).map(s => ({
      text: s.label,
      displayText: s.displayText,
      type: s.type,
      desc: s.desc,
      isSnippet: true,
      snippet: s.snippet,
      context: s.context
    }));
    const coilRefs = coils.map(id => ({ text: `- coil: ${id}`, displayText: `- coil: ${id}`, type: 'coil', desc: 'Child coil' }));
    const weaveRefs = weaves.map(id => ({ text: `- weave: ${id}`, displayText: `- weave: ${id}`, type: 'weave', desc: 'Child weave' }));
    return [...childSnippets, ...coilRefs, ...weaveRefs];
  }

  // General fallback
  const allSnippets = SNIPPET_TEMPLATES.map(s => ({
    text: s.label,
    displayText: s.displayText,
    type: s.type,
    desc: s.desc,
    isSnippet: true,
    snippet: s.snippet,
    context: s.context
  }));
  return [...allSnippets, ...KNOT_KEYS, ...COIL_KEYS, ...ENGRAVING_KEYS, ...ROOT_KEYS];
}


// Solfège Color Overlay Mode for CodeMirror
const SOLFEGE_COLOR_MAP = {
  do: 'ppt-do',
  dox: 'ppt-dox',
  ra: 'ppt-ra',
  di: 'ppt-di',
  re: 'ppt-re',
  me: 'ppt-me',
  ri: 'ppt-ri',
  mi: 'ppt-mi',
  fa: 'ppt-fa',
  se: 'ppt-fa',
  fi: 'ppt-fi',
  so: 'ppt-so',
  si: 'ppt-so',
  le: 'ppt-le',
  la: 'ppt-la',
  li: 'ppt-la',
  te: 'ppt-te',
  ti: 'ppt-te'
};

const SOLFEGE_SYLLABLES_LIST = [
  'dox', 'rax', 'dix', 'rex', 'mex', 'rix', 'mix', 'fax', 'fix', 'sex', 'sox', 'lex', 'six', 'lax', 'tex', 'lix', 'tix',
  'do', 'ra', 'di', 're', 'me', 'ri', 'mi', 'fa', 'fi', 'se', 'so', 'le', 'si', 'la', 'te', 'li', 'ti'
];

const ALL_SYLLABLES_REGEX = /^(?:(?:Do[xX]?|Ra[xX]?|Di[xX]?|Re[xX]?|Me[xX]?|Ri[xX]?|Mi[xX]?|Fa[xX]?|Fi[xX]?|Se[xX]?|So[xX]?|Le[xX]?|Si[xX]?|La[xX]?|Te[xX]?|Li[xX]?|Ti[xX]?)(?:[\^_]*))+$/i;

function isValidSolfegeToken(word) {
  return ALL_SYLLABLES_REGEX.test(word);
}

const solfegeOverlay = {
  token: function(stream) {
    const line = stream.string;
    const colonIdx = line.indexOf(':');

    // Skip YAML comments
    if (stream.match(/^\s*#.*/)) {
      return null;
    }

    // If on a "key: value" line and before the colon, it's a YAML key - skip!
    if (colonIdx !== -1 && stream.pos <= colonIdx) {
      stream.next();
      return null;
    }

    // Skip whitespace
    if (stream.eatSpace()) return null;

    // Check if we are at the start of a word
    const rest = line.slice(stream.pos);
    const wordMatch = rest.match(/^["']?([_A-Za-z0-9\^_]+)["']?/);
    if (!wordMatch) {
      stream.next();
      return null;
    }

    const fullWord = wordMatch[0];
    const cleanWord = wordMatch[1];

    // Ensure cache is initialized
    if (!declaredIdsCache || declaredIdsCache.size === 0) {
      if (typeof editor !== 'undefined' && editor) {
        updateDeclaredIdsCache(editor);
      }
    }

    // 1. Highlight declared structure IDs (clickable references vs definitions)
    if (declaredIdsCache && declaredIdsCache.has(cleanWord)) {
      const isDefinition = new RegExp(`^\\s*id\\s*:\\s*["']?${cleanWord}["']?`, 'i').test(line) ||
                           new RegExp(`^\\s*${cleanWord}\\s*:`, 'i').test(line);
      stream.pos += fullWord.length;
      return isDefinition ? 'ppt-id-def' : 'ppt-id-reference';
    }

    // 2. Only highlight if the word is a valid Solfège expression
    if (!isValidSolfegeToken(fullWord)) {
      // Advance past this entire non-solfege, non-reference word (plain free text)
      stream.pos += fullWord.length;
      return null;
    }

    // Incrementally match and color each sub-syllable of the valid Solfège word
    for (const syl of SOLFEGE_SYLLABLES_LIST) {
      if (stream.match(new RegExp('^' + syl, 'i'))) {
        const baseSyl = syl.replace(/x$/i, '').toLowerCase();
        return SOLFEGE_COLOR_MAP[baseSyl] || 'ppt-do';
      }
    }

    // Advance past octave indicators (^, _) or modifiers
    stream.next();
    return null;
  }
};

// --- Solfège Transposition & Navigation Engine ---
// In PPT, Do is the center (0), with a lower bound of So (-5) and an upper bound of Fi (+6).
// Moving down from Do goes through Ti (-1), Te (-2), La (-3), Le (-4), So (-5) in the base octave.
// Octave displacement occurs when crossing the boundaries: So -> Fi_ (down) or Fi -> So^ (up).
const SOLFEGE_CHROMATIC_UP = {
  'So': 'Le',
  'Si': 'La',
  'Le': 'La',
  'La': 'Te',
  'Li': 'Ti',
  'Te': 'Ti',
  'Ti': 'Do',
  'Do': 'Ra',
  'Ra': 'Re',
  'Di': 'Re',
  'Re': 'Me',
  'Me': 'Mi',
  'Ri': 'Mi',
  'Mi': 'Fa',
  'Fa': 'Fi',
  'Se': 'So',
  'Fi': 'So', // Upper bound: Fi -> So^ (octave + 1)
};

const SOLFEGE_CHROMATIC_DOWN = {
  'Fi': 'Fa',
  'Se': 'Fa',
  'Fa': 'Mi',
  'Mi': 'Me',
  'Ri': 'Re',
  'Me': 'Re',
  'Re': 'Ra',
  'Di': 'Do',
  'Ra': 'Do',
  'Do': 'Ti', // Center down: Do -> Ti (same octave)
  'Ti': 'Te',
  'Li': 'La',
  'Te': 'La',
  'La': 'Le',
  'Si': 'Fi',
  'Le': 'So',
  'So': 'Fi', // Lower bound: So -> Fi_ (octave - 1)
};

/**
 * Extracts all Solfège sub-syllable tokens on a given line with exact character bounds.
 */
function getSolfegeTokensOnLine(lineText) {
  if (!lineText) return [];
  const colonIdx = lineText.indexOf(':');
  const wordRegex = /([A-Za-z0-9\^_]+)/g;
  const tokens = [];
  let m;

  while ((m = wordRegex.exec(lineText)) !== null) {
    if (colonIdx !== -1 && m.index <= colonIdx) continue;
    const rawWord = m[1];
    if (!isValidSolfegeToken(rawWord)) continue;

    const SYL_REGEX = /(Dox|Rax|Dix|Rex|Mex|Rix|Mix|Fax|Fix|Sex|Sox|Lex|Six|Lax|Tex|Lix|Tix|Do|Ra|Di|Re|Me|Ri|Mi|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti)([\^_]*)/gi;
    let sm;
    while ((sm = SYL_REGEX.exec(rawWord)) !== null) {
      const rawSyl = sm[1];
      const octStr = sm[2] || '';
      const canonical = rawSyl.charAt(0).toUpperCase() + rawSyl.slice(1).toLowerCase();
      const hasAxis = /x$/i.test(canonical);
      const baseSyl = canonical.replace(/x$/i, '');
      const subStart = m.index + sm.index;
      const subEnd = subStart + sm[0].length;

      tokens.push({
        word: rawWord,
        rawSyl,
        canonical,
        baseSyl,
        hasAxis,
        octStr,
        fullTokenText: sm[0],
        startCh: subStart,
        endCh: subEnd,
      });
    }
  }
  return tokens;
}

/**
 * Transposes a sub-syllable token up or down by 1 chromatic semitone with PPT boundary arithmetic.
 */
function transposeSubSyllable(subToken, direction) {
  const { baseSyl, hasAxis, octStr } = subToken;
  
  let octShift = 0;
  for (const c of octStr) {
    if (c === '^') octShift++;
    else if (c === '_') octShift--;
  }

  let newBaseSyl = baseSyl;
  if (direction === 'up') {
    if (baseSyl === 'Fi') {
      newBaseSyl = 'So';
      octShift += 1;
    } else {
      newBaseSyl = SOLFEGE_CHROMATIC_UP[baseSyl] || 'Do';
    }
  } else if (direction === 'down') {
    if (baseSyl === 'So') {
      newBaseSyl = 'Fi';
      octShift -= 1;
    } else {
      newBaseSyl = SOLFEGE_CHROMATIC_DOWN[baseSyl] || 'Ti';
    }
  }

  let result = newBaseSyl;
  if (hasAxis) {
    result += 'x';
  }
  if (octShift > 0) {
    result += '^'.repeat(octShift);
  } else if (octShift < 0) {
    result += '_'.repeat(Math.abs(octShift));
  }

  return result;
}

/**
 * Checks if the cursor is positioned directly on or adjacent to a valid Solfège token.
 */
function isCursorOnSolfege(cm) {
  const cur = cm.getCursor();
  const lineText = cm.getLine(cur.line) || '';
  const tokens = getSolfegeTokensOnLine(lineText);
  if (tokens.length === 0) return false;
  return tokens.some(t => cur.ch >= t.startCh && cur.ch <= t.endCh);
}

/**
 * Contextual Ctrl+Up: transposes note if cursor is on Solfège token; otherwise navigates to previous property sibling.
 */
function handleContextualUp(cm) {
  if (isCursorOnSolfege(cm)) {
    return handleSolfegeTranspose(cm, 'up');
  }
  return navigatePropertySibling(cm, 'up');
}

/**
 * Contextual Ctrl+Down: transposes note if cursor is on Solfège token; otherwise navigates to next property sibling.
 */
function handleContextualDown(cm) {
  if (isCursorOnSolfege(cm)) {
    return handleSolfegeTranspose(cm, 'down');
  }
  return navigatePropertySibling(cm, 'down');
}

/**
 * Contextual Ctrl+Alt+Up: shifts note octave if on Solfège token; otherwise reorders property block upwards.
 */
function handleContextualAltUp(cm) {
  if (isCursorOnSolfege(cm)) {
    return handleSolfegeOctaveShift(cm, 'up');
  }
  return reorderPropertyBlock(cm, 'up');
}

/**
 * Contextual Ctrl+Alt+Down: shifts note octave if on Solfège token; otherwise reorders property block downwards.
 */
function handleContextualAltDown(cm) {
  if (isCursorOnSolfege(cm)) {
    return handleSolfegeOctaveShift(cm, 'down');
  }
  return reorderPropertyBlock(cm, 'down');
}

/**
 * Navigates cursor up or down between sibling YAML properties or list items at the exact same indentation level.
 */
function navigatePropertySibling(cm, direction) {
  const cur = cm.getCursor();
  const lineCount = cm.lineCount();
  const curLine = cm.getLine(cur.line) || '';
  const curIndent = getLineIndent(curLine);

  let startL = cur.line;
  if (!curLine.trim()) {
    if (direction === 'up') {
      while (startL > 0 && !cm.getLine(startL).trim()) startL--;
    } else {
      while (startL < lineCount - 1 && !cm.getLine(startL).trim()) startL++;
    }
  }

  const step = direction === 'up' ? -1 : 1;
  let targetLine = -1;

  for (let l = startL + step; l >= 0 && l < lineCount; l += step) {
    const line = cm.getLine(l);
    if (!line.trim() || /^\s*#/.test(line)) continue;

    const indent = getLineIndent(line);
    if (indent === curIndent) {
      if (/^\s*(?:-\s*)?[_a-zA-Z0-9]+(?:\s*\(.*?\))?\s*:/i.test(line) || /^\s*-\s+/.test(line)) {
        targetLine = l;
        break;
      }
    } else if (indent < curIndent) {
      break;
    }
  }

  if (targetLine !== -1) {
    const targetText = cm.getLine(targetLine);
    const keyMatch = targetText.match(/^\s*(?:-\s*)?([_a-zA-Z0-9]+)/);
    const targetCh = keyMatch ? targetText.indexOf(keyMatch[1]) : getLineIndent(targetText);
    cm.setCursor({ line: targetLine, ch: targetCh });
    cm.scrollIntoView({ line: targetLine, ch: targetCh }, 50);
  }
}

/**
 * Finds the contiguous block range [startLine, endLine] for the property or list item at pos,
 * along with the enclosing parent container boundaries.
 */
function getEnclosingPropertyBlock(cm, pos) {
  const lineCount = cm.lineCount();
  let l = pos.line;
  while (l >= 0 && !cm.getLine(l).trim()) l--;
  if (l < 0) return null;

  let line = cm.getLine(l);
  let indent = getLineIndent(line);

  const isBlockHeader = (str) => /^\s*-\s+/.test(str) || /^\s*[_a-zA-Z0-9]+(?:\s*\(.*?\))?\s*:/i.test(str);

  let blockStart = l;
  let baseIndent = indent;

  // If line is not a block header (e.g. middle of an indented block), walk up to find the enclosing key/bullet
  if (!isBlockHeader(line)) {
    for (let p = l - 1; p >= 0; p--) {
      const pLine = cm.getLine(p);
      if (!pLine.trim() || /^\s*#/.test(pLine)) continue;
      const pIndent = getLineIndent(pLine);
      if (pIndent < baseIndent && isBlockHeader(pLine)) {
        blockStart = p;
        baseIndent = pIndent;
        break;
      }
    }
  }

  // Find blockEnd
  let blockEnd = blockStart;
  for (let n = blockStart + 1; n < lineCount; n++) {
    const nLine = cm.getLine(n);
    if (!nLine.trim() || /^\s*#/.test(nLine)) {
      let nextNonEmpty = n + 1;
      while (nextNonEmpty < lineCount && !cm.getLine(nextNonEmpty).trim()) nextNonEmpty++;
      if (nextNonEmpty < lineCount && getLineIndent(cm.getLine(nextNonEmpty)) > baseIndent) {
        blockEnd = nextNonEmpty;
        n = nextNonEmpty;
        continue;
      }
      break;
    }
    const nIndent = getLineIndent(nLine);
    if (nIndent > baseIndent) {
      blockEnd = n;
    } else {
      break;
    }
  }

  // Find parent container start and indent
  let parentStart = 0;
  let parentIndent = -1;
  for (let p = blockStart - 1; p >= 0; p--) {
    const pLine = cm.getLine(p);
    if (!pLine.trim() || /^\s*#/.test(pLine)) continue;
    const pIndent = getLineIndent(pLine);
    if (pIndent < baseIndent) {
      parentStart = p;
      parentIndent = pIndent;
      break;
    }
  }

  let parentEnd = lineCount - 1;
  for (let n = blockEnd + 1; n < lineCount; n++) {
    const nLine = cm.getLine(n);
    if (!nLine.trim() || /^\s*#/.test(nLine)) continue;
    const nIndent = getLineIndent(nLine);
    if (parentIndent >= 0 && nIndent <= parentIndent) {
      parentEnd = n - 1;
      break;
    }
  }

  return {
    startLine: blockStart,
    endLine: blockEnd,
    baseIndent,
    parentStart,
    parentEnd,
  };
}

/**
 * Reorders a YAML property or array item up or down within its parent container boundaries.
 */
function reorderPropertyBlock(cm, direction) {
  const cur = cm.getCursor();
  const block = getEnclosingPropertyBlock(cm, cur);
  if (!block) return;

  const isBlockHeader = (str) => /^\s*-\s+/.test(str) || /^\s*[_a-zA-Z0-9]+(?:\s*\(.*?\))?\s*:/i.test(str);
  const lineCount = cm.lineCount();

  if (direction === 'up') {
    // Find preceding sibling block by searching backwards for a block header at the exact same baseIndent
    let prevStart = -1;
    for (let p = block.startLine - 1; p >= 0; p--) {
      const pLine = cm.getLine(p);
      if (!pLine.trim() || /^\s*#/.test(pLine)) continue;
      const pIndent = getLineIndent(pLine);
      if (pIndent < block.baseIndent) {
        // Reached parent boundary - cannot move up further
        break;
      }
      if (pIndent === block.baseIndent && isBlockHeader(pLine)) {
        prevStart = p;
        break;
      }
    }
    if (prevStart === -1) return; // Already first sibling

    const prevBlock = getEnclosingPropertyBlock(cm, { line: prevStart, ch: 0 });
    if (!prevBlock || prevBlock.baseIndent !== block.baseIndent) {
      return; // Boundary reached
    }

    const prevText = cm.getRange({ line: prevBlock.startLine, ch: 0 }, { line: prevBlock.endLine, ch: cm.getLine(prevBlock.endLine).length });
    const currentText = cm.getRange({ line: block.startLine, ch: 0 }, { line: block.endLine, ch: cm.getLine(block.endLine).length });

    let middleText = '';
    if (block.startLine > prevBlock.endLine + 1) {
      middleText = cm.getRange({ line: prevBlock.endLine + 1, ch: 0 }, { line: block.startLine - 1, ch: cm.getLine(block.startLine - 1).length }) + '\n';
    }

    const newCombined = `${currentText}\n${middleText}${prevText}`;
    cm.replaceRange(newCombined, { line: prevBlock.startLine, ch: 0 }, { line: block.endLine, ch: cm.getLine(block.endLine).length });

    const offsetLines = cur.line - block.startLine;
    const newCurLine = prevBlock.startLine + offsetLines;
    cm.setCursor({ line: newCurLine, ch: cur.ch });
  } else {
    // Find succeeding sibling block by searching forwards for a block header at the exact same baseIndent
    let nextStart = -1;
    for (let n = block.endLine + 1; n < lineCount; n++) {
      const nLine = cm.getLine(n);
      if (!nLine.trim() || /^\s*#/.test(nLine)) continue;
      const nIndent = getLineIndent(nLine);
      if (nIndent < block.baseIndent) {
        // Reached parent boundary or next outer block
        break;
      }
      if (nIndent === block.baseIndent && isBlockHeader(nLine)) {
        nextStart = n;
        break;
      }
    }
    if (nextStart === -1) return; // Already last sibling

    const nextBlock = getEnclosingPropertyBlock(cm, { line: nextStart, ch: 0 });
    if (!nextBlock || nextBlock.baseIndent !== block.baseIndent) {
      return; // Boundary reached
    }

    const currentText = cm.getRange({ line: block.startLine, ch: 0 }, { line: block.endLine, ch: cm.getLine(block.endLine).length });
    const nextText = cm.getRange({ line: nextBlock.startLine, ch: 0 }, { line: nextBlock.endLine, ch: cm.getLine(nextBlock.endLine).length });

    let middleText = '';
    if (nextBlock.startLine > block.endLine + 1) {
      middleText = cm.getRange({ line: block.endLine + 1, ch: 0 }, { line: nextBlock.startLine - 1, ch: cm.getLine(nextBlock.startLine - 1).length }) + '\n';
    }

    const newCombined = `${nextText}\n${middleText}${currentText}`;
    cm.replaceRange(newCombined, { line: block.startLine, ch: 0 }, { line: nextBlock.endLine, ch: cm.getLine(nextBlock.endLine).length });

    const nextBlockLength = nextBlock.endLine - nextBlock.startLine + 1;
    const middleLength = nextBlock.startLine > block.endLine + 1 ? (nextBlock.startLine - block.endLine - 1) : 0;
    const offsetLines = cur.line - block.startLine;
    const newCurLine = block.startLine + nextBlockLength + middleLength + offsetLines;
    cm.setCursor({ line: newCurLine, ch: cur.ch });
  }

  updateDeclaredIdsCache(cm);
  updateInlineSolfegeWidget();
  updatePairedTokenHighlights(cm);
  updateScoreHighlights(cm);
}

/**
 * Duplicates the current property or array item contextually below it with auto-incremented ID.
 */
function duplicatePropertyBlock(cm) {
  const cur = cm.getCursor();
  const block = getEnclosingPropertyBlock(cm, cur);
  if (!block) return;

  const originalText = cm.getRange(
    { line: block.startLine, ch: 0 },
    { line: block.endLine, ch: cm.getLine(block.endLine).length }
  );

  const declared = scanDeclaredCoilsAndWeaves(cm);
  const allIds = new Set(declared.all);

  let duplicatedText = originalText;
  const firstLine = cm.getLine(block.startLine);

  const idMatch = originalText.match(/^(\s*id\s*:\s*["']?)([_a-zA-Z0-9]+)(["']?.*)$/m);
  const dictMatch = firstLine.match(/^(\s*)([_a-zA-Z0-9]+)(\s*:(?!\s*\[).*)$/);
  const itemMatch = firstLine.match(/^(\s*-\s*(?:coil|weave)\s*:\s*["']?)([_a-zA-Z0-9]+)(["']?.*)$/);

  let targetOldId = null;
  let newId = null;

  if (dictMatch && !RESERVED_SCHEMA_KEYS.has(dictMatch[2].toLowerCase())) {
    targetOldId = dictMatch[2];
  } else if (idMatch) {
    targetOldId = idMatch[2];
  } else if (itemMatch) {
    targetOldId = itemMatch[2];
  }

  if (targetOldId) {
    let suffixNum = 2;
    const numMatch = targetOldId.match(/^(.*?)(?:_?(\d+))$/);
    let baseStem = targetOldId;
    if (numMatch) {
      baseStem = numMatch[1].replace(/_$/, '');
      suffixNum = parseInt(numMatch[2], 10) + 1;
    }

    newId = `${baseStem}_${suffixNum}`;
    while (allIds.has(newId)) {
      suffixNum++;
      newId = `${baseStem}_${suffixNum}`;
    }

    if (dictMatch && !RESERVED_SCHEMA_KEYS.has(dictMatch[2].toLowerCase())) {
      const newFirstLine = `${dictMatch[1]}${newId}${dictMatch[3]}`;
      const lines = duplicatedText.split('\n');
      lines[0] = newFirstLine;
      duplicatedText = lines.join('\n');
    } else if (idMatch) {
      duplicatedText = duplicatedText.replace(
        new RegExp(`^(\\s*id\\s*:\\s*["']?)${targetOldId}(["']?.*)$`, 'm'),
        `$1${newId}$2`
      );
    } else if (itemMatch) {
      const newFirstLine = `${itemMatch[1]}${newId}${itemMatch[3]}`;
      const lines = duplicatedText.split('\n');
      lines[0] = newFirstLine;
      duplicatedText = lines.join('\n');
    }
  }

  const insertLine = block.endLine;
  const insertPos = { line: insertLine, ch: cm.getLine(insertLine).length };
  cm.replaceRange(`\n${duplicatedText}`, insertPos);

  const newBlockStart = block.endLine + 1;
  cm.setCursor({ line: newBlockStart, ch: getLineIndent(cm.getLine(newBlockStart)) });
  cm.scrollIntoView({ line: newBlockStart, ch: 0 }, 50);

  cm.addLineClass(newBlockStart, 'background', 'cm-point-click-flash');
  setTimeout(() => {
    cm.removeLineClass(newBlockStart, 'background', 'cm-point-click-flash');
  }, 1200);

  updateDeclaredIdsCache(cm);
  updateInlineSolfegeWidget();
  updatePairedTokenHighlights(cm);
  updateScoreHighlights(cm);
  setStatus('ready', `Duplicated block${newId ? ` as ${newId}` : ''}`);
}

/**
 * Handles Ctrl+Up / Ctrl+Down Solfège transposition at cursor.
 */
function handleSolfegeTranspose(cm, direction) {
  const cur = cm.getCursor();
  const lineText = cm.getLine(cur.line) || '';
  const tokens = getSolfegeTokensOnLine(lineText);

  if (tokens.length === 0) {
    return CodeMirror.Pass;
  }

  let target = tokens.find(t => cur.ch >= t.startCh && cur.ch <= t.endCh);
  if (!target) {
    let minDist = Infinity;
    for (const t of tokens) {
      const dist = Math.min(Math.abs(cur.ch - t.startCh), Math.abs(cur.ch - t.endCh));
      if (dist < minDist) {
        minDist = dist;
        target = t;
      }
    }
  }

  if (!target) return CodeMirror.Pass;

  const newText = transposeSubSyllable(target, direction);
  const from = { line: cur.line, ch: target.startCh };
  const to = { line: cur.line, ch: target.endCh };

  cm.replaceRange(newText, from, to);

  const newCursorCh = Math.min(cur.ch, target.startCh + newText.length);
  cm.setCursor({ line: cur.line, ch: newCursorCh });

  updateInlineSolfegeWidget();
  updatePairedTokenHighlights(cm);
  updateScoreHighlights(cm);
}

/**
 * Shifts a sub-syllable token up or down by 1 octave (+1 / -1 octave) via ^ and _ suffixes.
 */
function shiftSubSyllableOctave(subToken, direction) {
  const { baseSyl, hasAxis, octStr } = subToken;

  let octShift = 0;
  for (const c of octStr) {
    if (c === '^') octShift++;
    else if (c === '_') octShift--;
  }

  if (direction === 'up') {
    octShift += 1;
  } else if (direction === 'down') {
    octShift -= 1;
  }

  let result = baseSyl;
  if (hasAxis) {
    result += 'x';
  }
  if (octShift > 0) {
    result += '^'.repeat(octShift);
  } else if (octShift < 0) {
    result += '_'.repeat(Math.abs(octShift));
  }

  return result;
}

/**
 * Handles Ctrl+Shift+Up / Ctrl+Shift+Down Solfège octave shift at cursor.
 */
function handleSolfegeOctaveShift(cm, direction) {
  const cur = cm.getCursor();
  const lineText = cm.getLine(cur.line) || '';
  const tokens = getSolfegeTokensOnLine(lineText);

  if (tokens.length === 0) {
    return CodeMirror.Pass;
  }

  let target = tokens.find(t => cur.ch >= t.startCh && cur.ch <= t.endCh);
  if (!target) {
    let minDist = Infinity;
    for (const t of tokens) {
      const dist = Math.min(Math.abs(cur.ch - t.startCh), Math.abs(cur.ch - t.endCh));
      if (dist < minDist) {
        minDist = dist;
        target = t;
      }
    }
  }

  if (!target) return CodeMirror.Pass;

  const newText = shiftSubSyllableOctave(target, direction);
  const from = { line: cur.line, ch: target.startCh };
  const to = { line: cur.line, ch: target.endCh };

  cm.replaceRange(newText, from, to);

  const newCursorCh = Math.min(cur.ch, target.startCh + newText.length);
  cm.setCursor({ line: cur.line, ch: newCursorCh });

  updateInlineSolfegeWidget();
  updatePairedTokenHighlights(cm);
  updateScoreHighlights(cm);
}

/**
 * Handles Ctrl+Left / Ctrl+Right navigation between Solfège tokens, duplicating at list end.
 */
function handleSolfegeNavigation(cm, direction) {
  const cur = cm.getCursor();
  const lineText = cm.getLine(cur.line) || '';
  const tokens = getSolfegeTokensOnLine(lineText);

  if (tokens.length === 0) {
    return CodeMirror.Pass;
  }

  let activeIdx = tokens.findIndex(t => cur.ch >= t.startCh && cur.ch <= t.endCh);
  if (activeIdx === -1) {
    let minDist = Infinity;
    tokens.forEach((t, idx) => {
      const dist = Math.min(Math.abs(cur.ch - t.startCh), Math.abs(cur.ch - t.endCh));
      if (dist < minDist) {
        minDist = dist;
        activeIdx = idx;
      }
    });
  }

  if (direction === 'left') {
    if (activeIdx > 0) {
      const prev = tokens[activeIdx - 1];
      cm.setCursor({ line: cur.line, ch: prev.startCh });
    } else if (activeIdx === 0) {
      cm.setCursor({ line: cur.line, ch: tokens[0].startCh });
    }
  } else if (direction === 'right') {
    if (activeIdx >= 0 && activeIdx < tokens.length - 1) {
      const next = tokens[activeIdx + 1];
      cm.setCursor({ line: cur.line, ch: next.startCh });
    } else {
      // At the end of the solfege sequence: duplicate the current syllable/token!
      const currentToken = tokens[activeIdx >= 0 ? activeIdx : tokens.length - 1];
      const dupText = currentToken.fullTokenText;

      const closingBracketIdx = lineText.indexOf(']');
      if (closingBracketIdx !== -1) {
        const insertPos = { line: cur.line, ch: closingBracketIdx };
        const insertText = `, ${dupText}`;
        cm.replaceRange(insertText, insertPos);
        cm.setCursor({ line: cur.line, ch: closingBracketIdx + 2 });
      } else if (/^\s*-\s+/.test(lineText)) {
        const indentMatch = lineText.match(/^(\s*-\s+)/);
        const indent = indentMatch ? indentMatch[1] : '  - ';
        const insertPos = { line: cur.line, ch: lineText.length };
        const insertText = `\n${indent}${dupText}`;
        cm.replaceRange(insertText, insertPos);
        cm.setCursor({ line: cur.line + 1, ch: indent.length });
      } else {
        const insertPos = { line: cur.line, ch: lineText.length };
        const insertText = ` ${dupText}`;
        cm.replaceRange(insertText, insertPos);
        cm.setCursor({ line: cur.line, ch: lineText.length + 1 });
      }
    }
  }

  updateInlineSolfegeWidget();
  updatePairedTokenHighlights(cm);
  updateScoreHighlights(cm);
}

/**
 * Searches YAML text to find the definition line & column for an ID reference.
 */
function findDefinitionInYaml(yamlText, targetId) {
  if (!yamlText || !targetId) return null;
  const lines = yamlText.split('\n');

  // Priority 1: id: "<targetId>" or id: <targetId> (e.g. id: intro)
  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    const match = line.match(new RegExp(`^\\s*id\\s*:\\s*["']?${targetId}["']?(?:\\s*#.*)?$`));
    if (match) {
      const ch = line.indexOf(targetId);
      return { line: l, ch: ch !== -1 ? ch : 0 };
    }
  }

  // Priority 2: Dictionary key "<targetId>:" under coils or weaves (e.g. _verse_harm:, verse:, song:)
  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    const match = line.match(new RegExp(`^\\s*${targetId}\\s*:(?:\\s*#.*)?$`));
    if (match) {
      const ch = line.indexOf(targetId);
      return { line: l, ch: ch !== -1 ? ch : 0 };
    }
  }

  // Priority 3: Reference definition "- coil: <targetId>" or "- weave: <targetId>"
  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    const match = line.match(new RegExp(`^\\s*-\\s*(?:coil|weave)\\s*:\\s*["']?${targetId}["']?(?:\\s*#.*)?$`));
    if (match) {
      const ch = line.indexOf(targetId);
      return { line: l, ch: ch !== -1 ? ch : 0 };
    }
  }

  // Priority 4: Fallback containing id: <targetId> or <targetId>:
  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    if (line.includes(targetId) && (/^\s*id\s*:/i.test(line) || /^\s*[_a-zA-Z0-9]+\s*:/i.test(line))) {
      return { line: l, ch: line.indexOf(targetId) };
    }
  }

  return null;
}

/**
 * Resolves the target structure ID and character range under the mouse cursor.
 */
function getTargetIdAtPos(cm, pos) {
  const lineText = cm.getLine(pos.line) || '';
  const wordRange = cm.findWordAt(pos);
  let word = lineText.slice(wordRange.anchor.ch, wordRange.head.ch).trim();
  word = word.replace(/^["']|["']$/g, '');

  const declaredIds = updateDeclaredIdsCache(cm);

  // 1. Direct match on a declared ID token
  if (word && declaredIds.includes(word)) {
    return { id: word, range: wordRange };
  }

  // 1b. Check if word is part of a dotted reference e.g. "changes.harmony"
  const dotMatch = word.match(/^([_a-zA-Z0-9]+)\.(?:harmony|melody|rhythm)$/);
  if (dotMatch && declaredIds.includes(dotMatch[1])) {
    return { id: dotMatch[1], range: wordRange };
  }

  // 1c. Check if cursor position falls within any declared ID in the lineText
  for (const id of declaredIds) {
    const idRegex = new RegExp(`\\b${id}\\b`, 'g');
    let m;
    while ((m = idRegex.exec(lineText)) !== null) {
      if (pos.ch >= m.index && pos.ch <= m.index + id.length) {
        return {
          id: id,
          range: {
            anchor: { line: pos.line, ch: m.index },
            head: { line: pos.line, ch: m.index + id.length }
          }
        };
      }
    }
  }

  // 2. If hovering over a reference keyword on this line, find referenced target on this line
  const refKeywords = ['parents', 'parent', 'concat', 'coil', 'weave', 'harmony', 'chords', 'rhythm', 'melody', 'pitches', 'from', 'use'];
  for (const kw of refKeywords) {
    if (word === kw || new RegExp(`^\\s*${kw}\\s*:`, 'i').test(lineText.slice(0, pos.ch + 1))) {
      for (const decId of declaredIds) {
        if (new RegExp(`\\b${kw}\\s*:[^\n]*\\b${decId}\\b`, 'i').test(lineText)) {
          const startCh = lineText.indexOf(decId);
          return {
            id: decId,
            range: {
              anchor: { line: pos.line, ch: startCh },
              head: { line: pos.line, ch: startCh + decId.length }
            }
          };
        }
      }
    }
  }

  return null;
}

// Initialize CodeMirror Editor
const editorContainer = document.getElementById('editor-container');
const editor = CodeMirror(editorContainer, {
  mode: 'yaml',
  theme: 'dracula',
  lineNumbers: true,
  foldGutter: true,
  gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
  tabSize: 2,
  indentUnit: 2,
  lineWrapping: true,
  autoCloseBrackets: true,
  matchBrackets: true,
  styleActiveLine: true,
  extraKeys: {
    'Ctrl-S': () => saveScore(),
    'Cmd-S': () => saveScore(),
    'Ctrl-O': () => openTapestryPicker(),
    'Cmd-O': () => openTapestryPicker(),
    'Ctrl-N': () => createTapestry(),
    'Cmd-N': () => createTapestry(),
    'Ctrl-Enter': () => triggerCompile(),
    'Cmd-Enter': () => triggerCompile(),
    'Ctrl-Shift-P': (cm) => openCommandPalette(cm),
    'Cmd-Shift-P': (cm) => openCommandPalette(cm),
    'F1': (cm) => openCommandPalette(cm),
    'F2': (cm) => renameSymbol(cm),
    'F12': (cm) => triggerGoToDefinition(cm),
    'Ctrl-G': (cm) => openGotoReferencePalette(cm),
    'Cmd-G': (cm) => openGotoReferencePalette(cm),
    'Ctrl-Alt-Enter': (cm) => duplicatePropertyBlock(cm),
    'Cmd-Alt-Enter': (cm) => duplicatePropertyBlock(cm),
    'Ctrl-Alt-P': (cm) => extractParentCoil(cm),
    'Cmd-Alt-P': (cm) => extractParentCoil(cm),
    'Ctrl-Alt-C': (cm) => extractInlineCoil(cm),
    'Cmd-Alt-C': (cm) => extractInlineCoil(cm),
    'Ctrl-Alt-W': (cm) => extractWeave(cm),
    'Cmd-Alt-W': (cm) => extractWeave(cm),
    'Ctrl-Alt-I': (cm) => inlineParentCoil(cm),
    'Cmd-Alt-I': (cm) => inlineParentCoil(cm),
    'Ctrl-Alt-A': (cm) => refactorConvertMelody(cm, 'auto'),
    'Cmd-Alt-A': (cm) => refactorConvertMelody(cm, 'auto'),
    'Ctrl-Space': 'autocomplete',
    'Ctrl-/': 'toggleComment',
    'Cmd-/': 'toggleComment',
    'Ctrl-Q': (cm) => cm.foldCode(cm.getCursor()),
    'Cmd-Q': (cm) => cm.foldCode(cm.getCursor()),
    'Ctrl-Up': (cm) => handleContextualUp(cm),
    'Cmd-Up': (cm) => handleContextualUp(cm),
    'Ctrl-Down': (cm) => handleContextualDown(cm),
    'Cmd-Down': (cm) => handleContextualDown(cm),
    'Ctrl-Alt-Up': (cm) => handleContextualAltUp(cm),
    'Cmd-Alt-Up': (cm) => handleContextualAltUp(cm),
    'Ctrl-Alt-Down': (cm) => handleContextualAltDown(cm),
    'Cmd-Alt-Down': (cm) => handleContextualAltDown(cm),
    'Ctrl-Left': (cm) => handleSolfegeNavigation(cm, 'left'),
    'Cmd-Left': (cm) => handleSolfegeNavigation(cm, 'left'),
    'Ctrl-Right': (cm) => handleSolfegeNavigation(cm, 'right'),
    'Cmd-Right': (cm) => handleSolfegeNavigation(cm, 'right'),
    'Tab': (cm) => {
      if (cm.somethingSelected()) {
        cm.indentSelection('add');
      } else {
        cm.replaceSelection('  ', 'end');
      }
    },
    'Shift-Tab': (cm) => cm.indentSelection('subtract'),
  },
});

// Go-To-Definition (Ctrl+Click / Cmd+Click) and Hover Underline
let currentHoverMark = null;

function clearIdHover() {
  if (currentHoverMark) {
    currentHoverMark.clear();
    currentHoverMark = null;
  }
}

editor.getWrapperElement().addEventListener('mousemove', (e) => {
  if (!e.ctrlKey && !e.metaKey) {
    clearIdHover();
    return;
  }

  const pos = editor.coordsChar({ left: e.clientX, top: e.clientY });
  const target = getTargetIdAtPos(editor, pos);

  if (target) {
    clearIdHover();
    currentHoverMark = editor.markText(target.range.anchor, target.range.head, {
      className: 'cm-id-reference-hover'
    });
    return;
  }
  clearIdHover();
});

editor.getWrapperElement().addEventListener('mousedown', (e) => {
  if (!e.ctrlKey && !e.metaKey) return;

  const pos = editor.coordsChar({ left: e.clientX, top: e.clientY });
  const target = getTargetIdAtPos(editor, pos);

  if (target) {
    const def = findDefinitionInYaml(editor.getValue(), target.id);
    if (def) {
      e.preventDefault();
      e.stopPropagation();
      clearIdHover();

      editor.setCursor(def);
      editor.scrollIntoView(def, 150);
      editor.focus();

      editor.addLineClass(def.line, 'background', 'cm-point-click-flash');
      setTimeout(() => {
        editor.removeLineClass(def.line, 'background', 'cm-point-click-flash');
      }, 1200);

      updateInlineSolfegeWidget();
      updatePairedTokenHighlights(editor);
      updateScoreHighlights(editor);
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'Control' || e.key === 'Meta') {
    clearIdHover();
  }
});

// Enable Solfège Overlay if preferred
if (enableSolfegeColors) {
  editor.addOverlay(solfegeOverlay);
}

function renderHintItem(element, self, data) {
  element.classList.add('cm-hint-item');
  const left = document.createElement('div');
  left.className = 'cm-hint-left';

  const badge = document.createElement('span');
  const bType = (data.type || 'prop').toLowerCase();
  badge.className = `cm-hint-badge cm-hint-badge-${bType}`;
  badge.textContent = bType.toUpperCase();
  left.appendChild(badge);

  if (data.type === 'note' && data.solfege) {
    const cleanSyl = data.solfege.replace(/[\^_0-9\.xX]/g, '');
    const spec = SOLFEGE_GLYPH_SPECS[cleanSyl];
    const color = spec ? spec.colorHex : '#E13610';
    const pill = document.createElement('span');
    pill.className = 'cm-hint-solfege-pill';
    pill.style.backgroundColor = `${color}22`;
    pill.style.color = color;
    pill.style.border = `1px solid ${color}66`;
    pill.textContent = data.displayText || data.text;
    left.appendChild(pill);
  } else {
    const label = document.createElement('span');
    label.className = 'cm-hint-label';
    label.textContent = data.displayText || data.text;
    left.appendChild(label);
  }

  element.appendChild(left);

  if (data.desc) {
    const desc = document.createElement('span');
    desc.className = 'cm-hint-desc';
    desc.textContent = data.desc;
    element.appendChild(desc);
  }
}

// Context-Aware Solfège Autocomplete & Snippets Hinting
CodeMirror.registerHelper('hint', 'yaml', (cm) => {
  if (!enableAutocomplete) return { list: [], from: cm.getCursor(), to: cm.getCursor() };

  const cur = cm.getCursor();
  const line = cm.getLine(cur.line) || '';
  const beforeCursor = line.slice(0, cur.ch);

  // Check if typing after a colon, e.g. "harmonyVoicing: sm" or "harmonyVoicing:sm" or "harmonyVoicing: "
  let word = '';
  let fromCh = cur.ch;
  const toCh = cur.ch;

  const colonIdx = beforeCursor.lastIndexOf(':');
  const openBracketIdx = beforeCursor.lastIndexOf('[');
  const commaIdx = beforeCursor.lastIndexOf(',');

  if (openBracketIdx !== -1 && openBracketIdx > beforeCursor.lastIndexOf(']')) {
    // Inside bracket array: word is whatever is typed after last comma or bracket
    const delimiterIdx = Math.max(openBracketIdx, commaIdx);
    const tokenPart = beforeCursor.slice(delimiterIdx + 1);
    const match = tokenPart.match(/^(\s*)([^\s,\]]*)$/);
    if (match) {
      word = match[2];
      fromCh = delimiterIdx + 1 + match[1].length;
    }
  } else if (colonIdx !== -1 && colonIdx > beforeCursor.lastIndexOf('\n')) {
    // After colon on current line
    const afterColon = beforeCursor.slice(colonIdx + 1);
    const match = afterColon.match(/^(\s*)([^\s]*)$/);
    if (match) {
      word = match[2];
      fromCh = colonIdx + 1 + match[1].length;
    }
  } else if (/^\s*-\s*/.test(beforeCursor)) {
    // In bullet list
    const dashIdx = beforeCursor.lastIndexOf('-');
    const afterDash = beforeCursor.slice(dashIdx + 1);
    const match = afterDash.match(/^(\s*)([^\s]*)$/);
    if (match) {
      word = match[2];
      fromCh = dashIdx + 1 + match[1].length;
    }
  } else {
    // Standalone key / word
    const match = beforeCursor.match(/([a-zA-Z0-9_\^~'#\-:]+)$/);
    if (match) {
      word = match[1];
      fromCh = cur.ch - word.length;
    }
  }

  const candidates = getContextSuggestions(cm, cur);

  // Filter candidates by word prefix / substring
  const filtered = word
    ? candidates.filter(item => {
        const text = typeof item === 'string' ? item : (item.text || item.displayText || '');
        const cleanText = text.replace(/:\s*$/, '').replace(/^-\s*/, '');
        const cleanWord = word.replace(/:\s*$/, '').replace(/^-\s*/, '');
        return cleanText.toLowerCase().includes(cleanWord.toLowerCase());
      })
    : candidates;

  const list = filtered.map(item => {
    const obj = typeof item === 'string' ? { text: item, displayText: item, type: 'prop' } : { ...item };
    return {
      ...obj,
      render: renderHintItem,
      hint: (cmInstance, data, completion) => {
        if (completion.isSnippet) {
          const baseIndentMatch = line.match(/^(\s*)/);
          const baseIndent = baseIndentMatch ? baseIndentMatch[1] : '';
          const indented = indentSnippet(completion.snippet, baseIndent);
          const replaceFrom = completion.context && completion.context.includes('root')
            ? CodeMirror.Pos(cur.line, 0)
            : CodeMirror.Pos(cur.line, fromCh);
          const replaceTo = CodeMirror.Pos(cur.line, line.length);
          cmInstance.replaceRange(indented, replaceFrom, replaceTo);
        } else {
          let insertText = completion.text;

          // Check if completion is inserted after a property colon without a space
          if (colonIdx !== -1 && openBracketIdx === -1) {
            const hasSpaceAfterColon = /:\s+/.test(line.slice(0, fromCh));
            if (!hasSpaceAfterColon && !insertText.startsWith(' ') && !insertText.endsWith(':')) {
              insertText = ' ' + insertText;
            }
          }

          // If inserting a property key, append space after colon if not already present
          if (insertText.endsWith(':') && !insertText.endsWith(': ')) {
            insertText = insertText + ' ';
          }

          const fromPos = CodeMirror.Pos(cur.line, fromCh);
          const toPos = CodeMirror.Pos(cur.line, toCh);
          cmInstance.replaceRange(insertText, fromPos, toPos);
        }
        updateDeclaredIdsCache(cmInstance);
        updateScoreHighlights(cmInstance);
      }
    };
  });

  return {
    list: list,
    from: CodeMirror.Pos(cur.line, fromCh),
    to: CodeMirror.Pos(cur.line, toCh),
  };
});

// --- Solfège SVG Glyph Definitions (PPT Geometric Rotations & Palettes) ---
const SVG_PATH_BASE = 'M 0.262 0.806 L 0.389 0.674 L 0.559 0.498 L 0.750 0.302 L 0.848 0.000 L 0.750 -0.302 L 0.714 -0.412 L 0.686 -0.498 L 0.405 -0.702 L 0.262 -0.806 L 0.000 -0.848 L -0.262 -0.806 L -0.405 -0.702 L -0.686 -0.498 L -0.714 -0.412 L -0.750 -0.302 L -0.848 0.000 L -0.750 0.302 L -0.559 0.498 L -0.389 0.674 L -0.262 0.806 L -0.250 0.432 L -0.330 0.381 L -0.407 0.292 L -0.440 0.254 L -0.473 0.216 L -0.483 0.142 L -0.504 0.000 L -0.483 -0.142 L -0.445 -0.226 L -0.393 -0.340 L -0.330 -0.381 L -0.250 -0.432 L -0.209 -0.458 L -0.147 -0.498 L 0.000 -0.504 L 0.147 -0.498 L 0.209 -0.458 L 0.250 -0.432 L 0.330 -0.381 L 0.393 -0.340 L 0.445 -0.226 L 0.483 -0.142 L 0.504 0.000 L 0.483 0.142 L 0.473 0.216 L 0.440 0.254 L 0.407 0.292 L 0.330 0.381 L 0.250 0.432 Z';

const SVG_PATH_SHARP = 'M 0.00 1.00 L 0.00 0.807 L 0.001 0.806 L 0.262 0.806 L 0.389 0.674 L 0.447 0.615 L 0.462 0.599 L 0.559 0.498 L 0.288 0.498 L 0.148 0.740 L 0.110 0.806 L 0.000 0.806 L 0.000 0.520 L 0.072 0.499 L 0.146 0.499 L 0.147 0.498 L 0.073 0.498 L 0.209 0.458 L 0.250 0.432 L 0.330 0.381 L 0.407 0.292 L 0.424 0.272 L 0.440 0.254 L 0.473 0.216 L 0.480 0.165 L 0.483 0.142 L 0.504 0.000 L 0.514 -0.074 L 0.483 -0.142 L 0.445 -0.226 L 0.434 -0.250 L 0.424 -0.272 L 0.393 -0.340 L 0.371 -0.354 L 0.330 -0.381 L 0.250 -0.432 L 0.209 -0.458 L 0.147 -0.498 L 0.146 -0.499 L -0.146 -0.499 L -0.147 -0.498 L -0.209 -0.458 L -0.250 -0.432 L -0.330 -0.381 L -0.371 -0.354 L -0.393 -0.340 L -0.424 -0.272 L -0.434 -0.250 L -0.445 -0.226 L -0.483 -0.142 L -0.514 -0.074 L -0.504 0.000 L -0.483 0.142 L -0.480 0.165 L -0.473 0.216 L -0.440 0.254 L -0.424 0.272 L -0.407 0.292 L -0.330 0.381 L -0.250 0.432 L -0.257 0.444 L -0.288 0.498 L -0.560 0.498 L -0.668 0.386 L -0.697 0.356 L -0.750 0.302 L -0.848 0.000 L -0.750 -0.302 L -0.714 -0.412 L -0.686 -0.498 L -0.405 -0.702 L -0.262 -0.806 L 0.262 -0.806 L 0.110 -0.806 L 0.262 -0.806 L 0.405 -0.702 L 0.686 -0.498 L 0.714 -0.412 L 0.750 -0.302 L 0.848 0.000 L 0.750 0.302 L 0.811 0.408 L 0.863 0.498 L 0.866 0.500 L 0.707 0.707 L 0.500 0.866 L 0.259 0.966 L 0.000 1.000 Z';

const SVG_PATH_FLAT = 'M 0.00 1.00 L -0.259 0.966 L -0.500 0.866 L -0.707 0.707 L -0.866 0.500 L -0.863 0.498 L -0.811 0.408 L -0.750 0.302 L -0.848 0.000 L -0.750 -0.302 L -0.714 -0.412 L -0.686 -0.498 L -0.405 -0.702 L -0.262 -0.806 L 0.262 -0.806 L 0.110 -0.806 L 0.262 -0.806 L 0.405 -0.702 L 0.686 -0.498 L 0.714 -0.412 L 0.750 -0.302 L 0.848 0.000 L 0.750 0.302 L 0.697 0.356 L 0.668 0.386 L 0.559 0.498 L 0.288 0.498 L 0.257 0.444 L 0.250 0.432 L 0.330 0.381 L 0.407 0.292 L 0.424 0.272 L 0.440 0.254 L 0.473 0.216 L 0.480 0.165 L 0.483 0.142 L 0.504 0.000 L 0.514 -0.074 L 0.483 -0.142 L 0.445 -0.226 L 0.434 -0.250 L 0.424 -0.272 L 0.393 -0.340 L 0.371 -0.354 L 0.330 -0.381 L 0.250 -0.432 L 0.209 -0.458 L 0.147 -0.498 L 0.146 -0.499 L -0.146 -0.499 L -0.147 -0.498 L -0.209 -0.458 L -0.250 -0.432 L -0.330 -0.381 L -0.371 -0.354 L -0.393 -0.340 L -0.424 -0.272 L -0.434 -0.250 L -0.445 -0.226 L -0.483 -0.142 L -0.514 -0.074 L -0.504 0.000 L -0.483 0.142 L -0.480 0.165 L -0.473 0.216 L -0.440 0.254 L -0.424 0.272 L -0.407 0.292 L -0.330 0.381 L -0.250 0.432 L -0.073 0.498 L -0.147 0.498 L -0.146 0.499 L -0.072 0.499 L 0.000 0.520 L 0.000 0.806 L -0.110 0.806 L -0.148 0.740 L -0.288 0.498 L -0.560 0.498 L -0.463 0.599 L -0.447 0.615 L -0.389 0.675 L -0.262 0.806 L -0.001 0.806 L 0.000 0.807 L 0.000 1.000 Z';

const SOLFEGE_GLYPH_SPECS = {
  Do: { glyphType: 'base', rotation: 0, colorHex: '#E13610' },
  Ra: { glyphType: 'sharp', rotation: 0, colorHex: '#F98016' },
  Di: { glyphType: 'sharp', rotation: 0, colorHex: '#F98016' },
  Re: { glyphType: 'flat', rotation: 270, colorHex: '#F98016' },
  Me: { glyphType: 'base', rotation: 270, colorHex: '#F5D432' },
  Ri: { glyphType: 'base', rotation: 270, colorHex: '#F5D432' },
  Mi: { glyphType: 'sharp', rotation: 270, colorHex: '#F5D432' },
  Fa: { glyphType: 'flat', rotation: 180, colorHex: '#43A440' },
  Fi: { glyphType: 'base', rotation: 180, colorHex: '#141414' },
  Se: { glyphType: 'base', rotation: 180, colorHex: '#141414' },
  So: { glyphType: 'sharp', rotation: 180, colorHex: '#0032A4' },
  Le: { glyphType: 'flat', rotation: 90, colorHex: '#5300A4' },
  Si: { glyphType: 'flat', rotation: 90, colorHex: '#5300A4' },
  La: { glyphType: 'base', rotation: 90, colorHex: '#5300A4' },
  Te: { glyphType: 'sharp', rotation: 90, colorHex: '#F158A4' },
  Li: { glyphType: 'sharp', rotation: 90, colorHex: '#F158A4' },
  Ti: { glyphType: 'flat', rotation: 0, colorHex: '#F158A4' },
};

function createSolfegeGlyphSvg(syllable, hasAxis = false, size = 18, octaveShift = 0) {
  let octShift = octaveShift;
  if (octShift === 0 && typeof syllable === 'string') {
    for (const ch of syllable) {
      if (ch === '^') octShift++;
      else if (ch === '_') octShift--;
    }
  }

  const cleanSyl = syllable.replace(/[\^_0-9\.xX]/g, '');
  const spec = SOLFEGE_GLYPH_SPECS[cleanSyl] || SOLFEGE_GLYPH_SPECS['Do'];

  const color = spec ? spec.colorHex : '#E13610';
  const rot = spec ? spec.rotation : 0;
  const glyphType = spec ? spec.glyphType : 'base';

  let pathD = SVG_PATH_BASE;
  if (glyphType === 'sharp') pathD = SVG_PATH_SHARP;
  else if (glyphType === 'flat') pathD = SVG_PATH_FLAT;

  const axisSvg = hasAxis
    ? `<line x1="-1.1" y1="0" x2="1.1" y2="0" stroke="${color}" stroke-width="0.22" stroke-linecap="round" />`
    : '';

  let octaveSvg = '';
  if (octShift !== 0) {
    const absOct = Math.abs(octShift);
    const triScale = absOct > 1 ? 0.65 : 0.75;
    // In SVG standard orientation (y down):
    // Upward pointing triangle (▲): top vertex (0, -0.25), base vertices (-0.22, 0.25) & (0.22, 0.25)
    // Downward pointing triangle (▼): bottom vertex (0, 0.25), top base vertices (-0.22, -0.25) & (0.22, -0.25)
    const isUp = octShift > 0;
    const triPathD = isUp
      ? 'M 0 -0.25 L 0.22 0.25 L -0.22 0.25 Z'
      : 'M 0 0.25 L 0.22 -0.25 L -0.22 -0.25 Z';

    const xPos = -1.15;
    const spacing = 0.44;
    const triangles = [];
    for (let k = 0; k < absOct; k++) {
      const yPos = isUp ? (-0.52 + (k * spacing)) : (0.52 - (k * spacing));
      triangles.push(`
        <g transform="translate(${xPos}, ${yPos}) scale(${triScale})">
          <path d="${triPathD}" fill="${color}" stroke="#1e2127" stroke-width="0.08" stroke-linejoin="round" />
        </g>
      `);
    }
    octaveSvg = triangles.join('');
  }

  return `
    <svg viewBox="-1.5 -1.25 3.0 2.5" width="${size}" height="${size}" style="display:inline-block; vertical-align:middle; overflow:visible;">
      <g transform="scale(1, -1) rotate(${rot})">
        <path d="${pathD}" fill="${color}" stroke="#1e2127" stroke-width="0.08" stroke-linejoin="round" />
        ${axisSvg}
      </g>
      ${octaveSvg}
    </svg>
  `;
}

function splitSyllables(word) {
  if (!isValidSolfegeToken(word)) {
    return [];
  }
  const SYL_REGEX = /(Dox|Rax|Dix|Rex|Mex|Rix|Mix|Fax|Fix|Sex|Sox|Lex|Six|Lax|Tex|Lix|Tix|Do|Ra|Di|Re|Me|Ri|Mi|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti)([\^_]*)/gi;
  const parts = [];
  let m;
  while ((m = SYL_REGEX.exec(word)) !== null) {
    const raw = m[1];
    const canonical = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    const hasAxis = /x$/i.test(canonical);
    const baseSyl = canonical.replace(/x$/i, '');
    const octStr = m[2] || '';
    let octaveShift = 0;
    for (const ch of octStr) {
      if (ch === '^') octaveShift++;
      else if (ch === '_') octaveShift--;
    }
    parts.push({
      canonical,
      baseSyl,
      hasAxis,
      octStr,
      octaveShift,
    });
  }
  return parts;
}

// Inline Line Widget State
let currentInlineWidget = null;
let currentInlineWidgetLine = -1;

function clearInlineWidget() {
  if (currentInlineWidget) {
    currentInlineWidget.clear();
    currentInlineWidget = null;
    currentInlineWidgetLine = -1;
  }
}

/**
 * Extracts individual music layer tokens (words, numbers, Solfège) and their column ranges from a YAML line.
 */
function extractTokensFromLine(lineText) {
  if (!lineText) return [];
  const colonIdx = lineText.indexOf(':');
  let content = lineText;
  let offset = 0;
  if (colonIdx !== -1) {
    content = lineText.slice(colonIdx + 1);
    offset = colonIdx + 1;
  } else {
    const bulletMatch = lineText.match(/^\s*-\s+/);
    if (bulletMatch) {
      content = lineText.slice(bulletMatch[0].length);
      offset = bulletMatch[0].length;
    }
  }

  const tokenRegex = /([a-zA-Z0-9\^_~#\/\.\+\-]+)/g;
  const tokens = [];
  let tm;
  while ((tm = tokenRegex.exec(content)) !== null) {
    const raw = tm[1];
    if (raw === '[' || raw === ']' || raw === ',') continue;
    tokens.push({
      word: raw,
      startCh: offset + tm.index,
      endCh: offset + tm.index + raw.length
    });
  }
  return tokens;
}

// Paired Layer Token Highlight State (CodeMirror text markers)
let pairedTokenMarks = [];

function clearPairedTokenHighlights() {
  pairedTokenMarks.forEach(mark => mark.clear());
  pairedTokenMarks = [];
}

/**
 * Expands an array of tokens on a layer into an onset array, taking repeat specs (e.g. 2.2, 1.2, 2)
 * into account to map each onset back to its authored sourceToken.
 */
function expandLayerTokensWithOnsets(tokens) {
  const onsets = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const raw = tok.word.trim();

    // Check if repeat token (e.g. 2.2, 1.2, 2, 4)
    const repeatMatch = raw.match(/^(\d+)(?:\.(\d+))?$/);
    if (repeatMatch && onsets.length > 0) {
      const repeatCount = parseInt(repeatMatch[1], 10);
      const windowSize = repeatMatch[2] ? parseInt(repeatMatch[2], 10) : 1;
      if (repeatCount > 0 && windowSize > 0 && windowSize <= onsets.length) {
        const windowOnsets = onsets.slice(-windowSize);
        for (let r = 0; r < repeatCount; r++) {
          for (let w = 0; w < windowOnsets.length; w++) {
            onsets.push({
              onsetIndex: onsets.length,
              sourceToken: tok,
              originToken: windowOnsets[w].originToken || windowOnsets[w].sourceToken,
              isRepeat: true
            });
          }
        }
        continue;
      }
    }

    onsets.push({
      onsetIndex: onsets.length,
      sourceToken: tok,
      originToken: tok,
      isRepeat: false
    });
  }

  return onsets;
}

/**
 * Detects the music layer context for a given line, accurately distinguishing structured
 * harmony sub-blocks (chords vs harmony.rhythm) from coil-level declarations.
 */
function getMusicLayerContext(cm, lineNo) {
  const line = cm.getLine(lineNo) || '';
  if (!line.trim() || /^\s*#/.test(line)) return null;

  const curIndent = getLineIndent(line);

  // Walk upwards to detect if inside a harmony: dictionary/list block
  let isUnderHarmony = false;
  let harmonyHeaderLine = -1;
  for (let l = lineNo - 1; l >= Math.max(0, lineNo - 30); l--) {
    const prevL = cm.getLine(l) || '';
    if (!prevL.trim() || /^\s*#/.test(prevL)) continue;
    const prevIndent = getLineIndent(prevL);
    if (/^\s*harmony\s*:/i.test(prevL) && prevIndent < curIndent) {
      isUnderHarmony = true;
      harmonyHeaderLine = l;
      break;
    }
    if (prevIndent < curIndent && /^\s*[_a-zA-Z0-9]+\s*:/.test(prevL) && !/^\s*-\s+/.test(prevL)) {
      break;
    }
  }

  if (/^\s*(melody|pitches)\s*:/i.test(line)) {
    return { layer: 'melody', isStructuredHarmony: false };
  }
  if (/^\s*rhythm\s*:/i.test(line)) {
    if (isUnderHarmony) {
      return { layer: 'harmonyRhythm', isStructuredHarmony: true, harmonyHeaderLine };
    }
    return { layer: 'rhythm', isStructuredHarmony: false };
  }
  if (/^\s*chords\s*:/i.test(line) || /^\s*-\s*chords\s*:/i.test(line)) {
    return { layer: 'harmonyChords', isStructuredHarmony: isUnderHarmony, harmonyHeaderLine };
  }
  if (/^\s*harmony\s*:/i.test(line)) {
    return { layer: 'harmony', isStructuredHarmony: isUnderHarmony };
  }

  // Bullet items under a layer
  if (/^\s*-\s+/.test(line)) {
    for (let l = lineNo - 1; l >= Math.max(0, lineNo - 40); l--) {
      const prevL = cm.getLine(l) || '';
      if (!prevL.trim() || /^\s*#/.test(prevL)) continue;
      const prevIndent = getLineIndent(prevL);
      if (/^\s*(melody|pitches)\s*:/i.test(prevL)) {
        return { layer: 'melody', isStructuredHarmony: false };
      }
      if (/^\s*rhythm\s*:/i.test(prevL)) {
        return { layer: isUnderHarmony ? 'harmonyRhythm' : 'rhythm', isStructuredHarmony: isUnderHarmony };
      }
      if (/^\s*(harmony|chords)\s*:/i.test(prevL)) {
        return { layer: 'harmony', isStructuredHarmony: isUnderHarmony };
      }
      if (prevIndent < curIndent && /^\s*[a-zA-Z0-9_]+\s*:/.test(prevL) && !/^\s*-\s+/.test(prevL)) {
        break;
      }
    }
  }

  return null;
}

/**
 * Searches locally in the document around curLineNo for an adjacent structured harmony line (rhythm or chords).
 */
function findAdjacentStructuredHarmonyLine(cm, curLineNo, targetKey) {
  const curLine = cm.getLine(curLineNo) || '';
  const curIndent = getLineIndent(curLine);
  const lineCount = cm.lineCount();
  const searchRegex = targetKey === 'rhythm' 
    ? /^\s*rhythm\s*:/i 
    : /^\s*(?:-\s*)?chords\s*:/i;

  // Search downwards first (e.g. from chords: downwards to rhythm:)
  for (let l = curLineNo + 1; l < Math.min(lineCount, curLineNo + 15); l++) {
    const lText = cm.getLine(l) || '';
    if (!lText.trim() || /^\s*#/.test(lText)) continue;
    const lIndent = getLineIndent(lText);
    if (lIndent < curIndent && !/^\s*-\s+/.test(lText)) break;
    if (searchRegex.test(lText)) {
      return l;
    }
  }

  // Search upwards (e.g. from rhythm: upwards to chords:)
  for (let l = curLineNo - 1; l >= Math.max(0, curLineNo - 15); l--) {
    const lText = cm.getLine(l) || '';
    if (!lText.trim() || /^\s*#/.test(lText)) continue;
    const lIndent = getLineIndent(lText);
    if (lIndent < curIndent && !/^\s*-\s+/.test(lText)) {
      if (!/^\s*harmony\s*:/i.test(lText)) break;
    }
    if (searchRegex.test(lText)) {
      return l;
    }
  }

  return -1;
}

/**
 * Highlights equivalent token indices across paired music layers (rhythm <-> melody <-> harmony)
 * in the active coil in CodeMirror.
 */
function updatePairedTokenHighlights(cm) {
  if (!cm) return;
  clearPairedTokenHighlights();

  const cur = cm.getCursor();
  const currentLine = cm.getLine(cur.line) || '';
  if (!currentLine.trim() || /^\s*#/.test(currentLine)) return;

  const musicContext = getMusicLayerContext(cm, cur.line);
  if (!musicContext) return;

  const lineTokens = extractTokensFromLine(currentLine);
  if (lineTokens.length === 0) return;

  const activeOnsets = expandLayerTokensWithOnsets(lineTokens);

  // Find all onset indices covered by the token under cursor
  const targetOnsetIndices = [];
  activeOnsets.forEach(onset => {
    const srcTok = onset.sourceToken;
    if (cur.ch >= srcTok.startCh && cur.ch <= srcTok.endCh) {
      targetOnsetIndices.push(onset.onsetIndex);
    }
  });

  if (targetOnsetIndices.length === 0) return;

  // 2. Find enclosing coil
  const coil = getEnclosingCoilAtPos(cm, cur);
  if (!coil) return;

  // 3. Find candidate target lines for sister layers
  const targetLayerLines = [];

  function findMelodyOrRhythmLine(layerKey) {
    if (coil.fields) {
      if (layerKey === 'rhythm') {
        if (coil.fields.rhythm) return coil.fields.rhythm.line;
      } else if (layerKey === 'melody') {
        if (coil.fields.melody) return coil.fields.melody.line;
      }
    }

    // Check inherited parent coil if on child coil
    if (layerKey === 'rhythm' && coil.fields && coil.fields.parents) {
      const parentId = coil.fields.parents.value.replace(/[\[\]"',]/g, '').trim().split(/\s+/)[0];
      if (parentId) {
        const totalLines = cm.lineCount();
        for (let l = 0; l < totalLines; l++) {
          const lText = cm.getLine(l) || '';
          if (new RegExp(`^\\s*${parentId}\\s*:`).test(lText) || new RegExp(`^\\s*-\\s*coil\\s*:\\s*${parentId}\\b`).test(lText)) {
            const parentCoil = getEnclosingCoilAtPos(cm, { line: l, ch: 0 });
            if (parentCoil && parentCoil.fields && parentCoil.fields.rhythm) {
              return parentCoil.fields.rhythm.line;
            }
            break;
          }
        }
      }
    }

    // Check child coils inheriting this coil if on a parent coil
    if (layerKey === 'melody' && (!coil.fields || !coil.fields.melody) && coil.fields && coil.fields.id) {
      const currentCoilId = coil.fields.id.value;
      const totalLines = cm.lineCount();
      for (let l = 0; l < totalLines; l++) {
        const lText = cm.getLine(l) || '';
        if (new RegExp(`^\\s*parents\\s*:\\s*${currentCoilId}\\b`).test(lText)) {
          const childCoil = getEnclosingCoilAtPos(cm, { line: l, ch: 0 });
          if (childCoil && childCoil.fields && childCoil.fields.melody) {
            return childCoil.fields.melody.line;
          }
        }
      }
    }

    return -1;
  }

  if (musicContext.isStructuredHarmony) {
    // Structured harmony block: pair chords <-> harmony.rhythm locally
    if (musicContext.layer === 'harmonyChords') {
      const adjLine = findAdjacentStructuredHarmonyLine(cm, cur.line, 'rhythm');
      if (adjLine !== -1) {
        targetLayerLines.push({ layer: 'harmonyRhythm', lineNo: adjLine });
      } else if (coil.fields && coil.fields.harmonyRhythm) {
        targetLayerLines.push({ layer: 'harmonyRhythm', lineNo: coil.fields.harmonyRhythm.line });
      }
    } else if (musicContext.layer === 'harmonyRhythm') {
      const adjLine = findAdjacentStructuredHarmonyLine(cm, cur.line, 'chords');
      if (adjLine !== -1) {
        targetLayerLines.push({ layer: 'harmonyChords', lineNo: adjLine });
      } else if (coil.fields && coil.fields.chords) {
        targetLayerLines.push({ layer: 'harmonyChords', lineNo: coil.fields.chords.line });
      }
    }
  } else if (musicContext.layer === 'melody') {
    targetLayerLines.push({ layer: 'rhythm', lineNo: findMelodyOrRhythmLine('rhythm') });
  } else if (musicContext.layer === 'rhythm') {
    targetLayerLines.push({ layer: 'melody', lineNo: findMelodyOrRhythmLine('melody') });
  }
  // Note: Unstructured harmony arrays (without explicit harmony rhythm) do not assume 1:1 token alignment with melodic rhythm

  targetLayerLines.forEach(({ layer, lineNo }) => {
    let targetLineNo = lineNo;
    if (targetLineNo !== -1 && targetLineNo !== cur.line) {
      let targetLineText = cm.getLine(targetLineNo) || '';
      let targetTokens = extractTokensFromLine(targetLineText);

      // Handle multiline array header with child bullet items
      if (targetTokens.length === 0 && /:\s*$/.test(targetLineText)) {
        const nextLine = cm.getLine(targetLineNo + 1) || '';
        if (/^\s*-\s+/.test(nextLine)) {
          targetTokens = extractTokensFromLine(nextLine);
          targetLineNo = targetLineNo + 1;
        }
      }

      const targetOnsets = expandLayerTokensWithOnsets(targetTokens);
      const markedTokens = new Set();

      targetOnsetIndices.forEach(oIdx => {
        if (targetOnsets[oIdx]) {
          const tok = targetOnsets[oIdx].sourceToken;
          const tokKey = `${tok.startCh}-${tok.endCh}`;
          if (!markedTokens.has(tokKey)) {
            markedTokens.add(tokKey);
            const mark = cm.markText(
              { line: targetLineNo, ch: tok.startCh },
              { line: targetLineNo, ch: tok.endCh },
              {
                className: 'cm-paired-token-highlight',
                title: `Paired onset #${oIdx + 1} (${tok.word})`
              }
            );
            pairedTokenMarks.push(mark);
          }
        }
      });
    }
  });
}

function updateInlineSolfegeWidget() {
  if (!enableSolfegeContext) {
    clearInlineWidget();
    return;
  }

  const cur = editor.getCursor();
  const currentLine = editor.getLine(cur.line) || '';

  // Strictly scope preview to melody, harmony, rhythm, chords, pitches lines, or bullet arrays
  const isMusicLine = /^\s*(melody|harmony|rhythm|chords|pitches)\s*:\s*\[/i.test(currentLine) ||
                      /^\s*(melody|harmony|rhythm|chords|pitches)\s*:/i.test(currentLine) ||
                      /^\s*-\s*\[/i.test(currentLine) ||
                      /^\s*-\s+(?:Do|Ra|Di|Re|Me|Ri|Mi|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti|Dox)/i.test(currentLine);

  if (!isMusicLine) {
    clearInlineWidget();
    return;
  }

  let isMelody = /^\s*(melody|pitches)\s*:/i.test(currentLine);
  if (!isMelody && /^\s*-\s+/.test(currentLine)) {
    const curLineIndent = (currentLine.match(/^\s*/) || [''])[0].length;
    for (let l = cur.line - 1; l >= Math.max(0, cur.line - 40); l--) {
      const prevL = editor.getLine(l) || '';
      const prevIndent = (prevL.match(/^\s*/) || [''])[0].length;
      if (/^\s*(melody|pitches)\s*:/i.test(prevL)) {
        isMelody = true;
        break;
      } else if (/^\s*(rhythm|harmony|chords)\s*:/i.test(prevL) || (prevIndent < curLineIndent && /^\s*[a-zA-Z0-9_]+\s*:/.test(prevL))) {
        break;
      }
    }
  }

  // Extract all tokens on this line (accurately preserving ^, _, and repeat counts)
  const lineTokens = extractTokensFromLine(currentLine);
  const matches = [];
  for (const tok of lineTokens) {
    const parts = splitSyllables(tok.word);
    if (parts.length > 0) {
      matches.push({
        word: tok.word,
        parts,
        startCh: tok.startCh,
        endCh: tok.endCh,
      });
    }
  }

  if (matches.length === 0) {
    clearInlineWidget();
    return;
  }

  // Create strip container
  const stripNode = document.createElement('div');

  if (isMelody) {
    stripNode.className = 'cm-token-solfege-strip cm-token-solfege-strip-dual';

    const rawWords = matches.map(tok => tok.word);
    const firstParsed = parseMelodyToken(rawWords[0]);
    const isInterval = firstParsed.hasAxis;

    let altWords = [];
    let altBadgeText = '';
    let mainBadgeText = '';

    if (isInterval) {
      altWords = convertIntervalToAbsoluteMelody(rawWords);
      altBadgeText = 'ALT: ABS';
      mainBadgeText = 'INT';
    } else {
      altWords = convertAbsoluteToIntervalMelody(rawWords);
      altBadgeText = 'ALT: INT';
      mainBadgeText = 'ABS';
    }

    // 1. Upper Row (Alternative representation)
    const altRow = document.createElement('div');
    altRow.className = 'cm-token-solfege-row cm-token-solfege-row-alt';
    altRow.title = `Alternative Melody View (${isInterval ? 'Absolute' : 'Interval'})`;

    const altBadge = document.createElement('span');
    altBadge.className = 'cm-token-solfege-badge alt-badge';
    altBadge.textContent = altBadgeText;
    altRow.appendChild(altBadge);

    matches.forEach((tok, idx) => {
      const altWord = altWords[idx] || tok.word;
      const altParts = splitSyllables(altWord);

      const startCoord = editor.cursorCoords({ line: cur.line, ch: tok.startCh }, 'local');
      const endCoord = editor.cursorCoords({ line: cur.line, ch: tok.endCh }, 'local');
      const centerLeft = Math.round((startCoord.left + endCoord.left) / 2);

      const altItem = document.createElement('div');
      altItem.className = 'cm-token-solfege-item';
      altItem.style.left = `${centerLeft}px`;
      altItem.title = `Alt (${altBadgeText}): ${altWord}`;

      if (cur.ch >= tok.startCh && cur.ch <= tok.endCh) {
        altItem.classList.add('active-token');
      }

      if (altParts.length === 1) {
        altItem.innerHTML = createSolfegeGlyphSvg(altParts[0].baseSyl, altParts[0].hasAxis, 16, altParts[0].octaveShift);
      } else if (altParts.length > 1) {
        altItem.innerHTML = altParts.map((p, pIdx) => {
          const size = pIdx === 0 ? 14 : 10;
          return createSolfegeGlyphSvg(p.baseSyl, p.hasAxis, size, p.octaveShift);
        }).join('');
      } else {
        altItem.textContent = altWord;
      }

      altRow.appendChild(altItem);
    });

    // 2. Lower Row (Written representation)
    const mainRow = document.createElement('div');
    mainRow.className = 'cm-token-solfege-row cm-token-solfege-row-main';
    mainRow.title = `Written Melody View (${isInterval ? 'Interval' : 'Absolute'})`;

    const mainBadge = document.createElement('span');
    mainBadge.className = 'cm-token-solfege-badge main-badge';
    mainBadge.textContent = mainBadgeText;
    mainRow.appendChild(mainBadge);

    matches.forEach(tok => {
      const startCoord = editor.cursorCoords({ line: cur.line, ch: tok.startCh }, 'local');
      const endCoord = editor.cursorCoords({ line: cur.line, ch: tok.endCh }, 'local');
      const centerLeft = Math.round((startCoord.left + endCoord.left) / 2);

      const item = document.createElement('div');
      item.className = 'cm-token-solfege-item';
      item.style.left = `${centerLeft}px`;
      item.title = `Written (${mainBadgeText}): ${tok.word}`;

      if (cur.ch >= tok.startCh && cur.ch <= tok.endCh) {
        item.classList.add('active-token');
      }

      if (tok.parts.length === 1) {
        item.innerHTML = createSolfegeGlyphSvg(tok.parts[0].baseSyl, tok.parts[0].hasAxis, 17, tok.parts[0].octaveShift);
      } else {
        item.innerHTML = tok.parts.map((p, pIdx) => {
          const size = pIdx === 0 ? 15 : 11;
          return createSolfegeGlyphSvg(p.baseSyl, p.hasAxis, size, p.octaveShift);
        }).join('');
      }

      mainRow.appendChild(item);
    });

    stripNode.appendChild(altRow);
    stripNode.appendChild(mainRow);
  } else {
    // Single row for rhythm, harmony, chords
    stripNode.className = 'cm-token-solfege-strip cm-token-solfege-strip-single';

    const row = document.createElement('div');
    row.className = 'cm-token-solfege-row cm-token-solfege-row-main';

    let layerBadgeText = 'NOTE';
    if (/^\s*rhythm\s*:/i.test(currentLine)) layerBadgeText = 'RHY';
    else if (/^\s*(harmony|chords)\s*:/i.test(currentLine)) layerBadgeText = 'HARM';

    const badge = document.createElement('span');
    badge.className = 'cm-token-solfege-badge main-badge';
    badge.textContent = layerBadgeText;
    row.appendChild(badge);

    matches.forEach(tok => {
      const startCoord = editor.cursorCoords({ line: cur.line, ch: tok.startCh }, 'local');
      const endCoord = editor.cursorCoords({ line: cur.line, ch: tok.endCh }, 'local');
      const centerLeft = Math.round((startCoord.left + endCoord.left) / 2);

      const item = document.createElement('div');
      item.className = 'cm-token-solfege-item';
      item.style.left = `${centerLeft}px`;
      item.title = tok.word;

      if (cur.ch >= tok.startCh && cur.ch <= tok.endCh) {
        item.classList.add('active-token');
      }

      if (tok.parts.length === 1) {
        item.innerHTML = createSolfegeGlyphSvg(tok.parts[0].baseSyl, tok.parts[0].hasAxis, 18, tok.parts[0].octaveShift);
      } else {
        item.innerHTML = tok.parts.map((p, pIdx) => {
          const size = pIdx === 0 ? 16 : 11;
          return createSolfegeGlyphSvg(p.baseSyl, p.hasAxis, size, p.octaveShift);
        }).join('');
      }

      row.appendChild(item);
    });

    stripNode.appendChild(row);
  }

  clearInlineWidget();
  currentInlineWidget = editor.addLineWidget(cur.line, stripNode, {
    above: true,
    coverGutter: false,
    noHScroll: false
  });
  currentInlineWidgetLine = cur.line;
}

// Editor change event
editor.on('change', () => {
  setDirty(true);
  updateDeclaredIdsCache(editor);
  updateInlineSolfegeWidget();
  updatePairedTokenHighlights(editor);
  updateScoreHighlights(editor);
  if (enableAutocompile) {
    clearTimeout(compileDebounceTimer);
    compileDebounceTimer = setTimeout(() => {
      triggerCompile();
    }, 500);
  }
});

// Cursor activity event for real-time line context, paired layer token sync & score highlighting
editor.on('cursorActivity', () => {
  updateInlineSolfegeWidget();
  updatePairedTokenHighlights(editor);
  updateScoreHighlights(editor);
});

// DOM Elements
const scoreSelect = document.getElementById('score-select');
const knotSelect = document.getElementById('knot-select');
const knotPickerWrapper = document.getElementById('knot-picker-wrapper');
let currentKnotId = null;
const btnNewScore = document.getElementById('btn-new-score');
const btnDeleteScore = document.getElementById('btn-delete-score');
const btnCompile = document.getElementById('btn-compile');
const chkAutocompile = document.getElementById('chk-autocompile');
const btnSave = document.getElementById('btn-save');
const btnExportPdf = document.getElementById('btn-export-pdf');
const btnSettings = document.getElementById('btn-settings');
const statusBadge = document.getElementById('status-badge');
const saveStatus = document.getElementById('save-status');
const metricsText = document.getElementById('metrics-text');
const errorBanner = document.getElementById('error-banner');
const errorContent = document.getElementById('error-content');
const scoreCanvas = document.getElementById('score-canvas');
const scoreSvgContainer = document.getElementById('score-svg-container');
const scorePlaceholder = document.getElementById('score-placeholder');
const lilypondCode = document.getElementById('lilypond-code');
const btnCopyLy = document.getElementById('btn-copy-ly');
const onsetsTbody = document.getElementById('onsets-tbody');
const zoomLevel = document.getElementById('zoom-level');
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');
const btnZoomReset = document.getElementById('btn-zoom-reset');
const btnZoomFit = document.getElementById('btn-zoom-fit');
const btnToggleMagnifier = document.getElementById('btn-toggle-magnifier');
const magnifierLens = document.getElementById('magnifier-lens');
const magnifierCanvas = document.getElementById('magnifier-canvas');
const magnifierCtx = magnifierCanvas ? magnifierCanvas.getContext('2d') : null;

// Settings Modal Elements
const settingsModal = document.getElementById('settings-modal');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnSaveSettings = document.getElementById('btn-save-settings');
const settingLilypondPath = document.getElementById('setting-lilypond-path');
const settingStatusHint = document.getElementById('setting-status-hint');
const settingLoupeSize = document.getElementById('setting-loupe-size');
const labelLoupeSize = document.getElementById('label-loupe-size');
const settingLoupePower = document.getElementById('setting-loupe-power');
const labelLoupePower = document.getElementById('label-loupe-power');
const settingEnableAutocompile = document.getElementById('setting-enable-autocompile');
const settingEnableAutocomplete = document.getElementById('setting-enable-autocomplete');
const settingEnableSolfegeColors = document.getElementById('setting-enable-solfege-colors');
const settingEnableCoilSuggestions = document.getElementById('setting-enable-coil-suggestions');
const settingEnableSolfegeContext = document.getElementById('setting-enable-solfege-context');

// Split Pane Layout Elements
const mainContainer = document.querySelector('.main-container');
const editorPanel = document.getElementById('editor-panel');
const previewPanel = document.getElementById('preview-panel');
const splitGutter = document.getElementById('split-gutter');

// --- Draggable Split Pane Logic ---
const MIN_EDITOR_WIDTH = 320;
const MIN_PREVIEW_WIDTH = 360;
let isDraggingSplitter = false;

// Restore saved width from localStorage if valid
const savedSplitWidth = localStorage.getItem('ppt_split_editor_width');
if (savedSplitWidth && editorPanel && mainContainer) {
  const widthNum = parseInt(savedSplitWidth, 10);
  const containerWidth = mainContainer.clientWidth || window.innerWidth;
  if (widthNum >= MIN_EDITOR_WIDTH && widthNum <= (containerWidth - MIN_PREVIEW_WIDTH)) {
    editorPanel.style.width = `${widthNum}px`;
    editorPanel.style.flex = `0 0 ${widthNum}px`;
  }
}

if (splitGutter && editorPanel && mainContainer) {
  splitGutter.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isDraggingSplitter = true;
    document.body.classList.add('resizing-panels');
    splitGutter.classList.add('dragging');
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDraggingSplitter) return;
    const containerRect = mainContainer.getBoundingClientRect();
    let newWidth = e.clientX - containerRect.left;

    const maxWidth = containerRect.width - MIN_PREVIEW_WIDTH;
    if (newWidth < MIN_EDITOR_WIDTH) newWidth = MIN_EDITOR_WIDTH;
    if (newWidth > maxWidth) newWidth = maxWidth;

    editorPanel.style.width = `${newWidth}px`;
    editorPanel.style.flex = `0 0 ${newWidth}px`;
    localStorage.setItem('ppt_split_editor_width', String(Math.round(newWidth)));
  });

  window.addEventListener('mouseup', () => {
    if (isDraggingSplitter) {
      isDraggingSplitter = false;
      document.body.classList.remove('resizing-panels');
      splitGutter.classList.remove('dragging');
      editor.refresh();
      if (pdfZoomMode === 'FitH' && currentPdfDoc) {
        renderPdfPages();
      }
    }
  });
}

let isInitialScoreLoadDone = false;
let shouldResetPreviewScroll = false;

function getPlaceholderDefaultHtml() {
  return `
    <div class="placeholder-card">
      <div class="placeholder-hero-header">
        <img src="logo.svg" alt="PPT Logo" class="placeholder-hero-logo" />
        <h2 class="placeholder-title">Prime Period Theory Studio</h2>
        <p class="placeholder-subtitle">Live geometric music notation compiler & interactive studio</p>
      </div>
      
      <div class="placeholder-shortcuts-grid">
        <div class="shortcut-item">
          <span class="shortcut-action">Compile Score</span>
          <span class="shortcut-keys"><kbd>Ctrl</kbd>+<kbd>Enter</kbd></span>
        </div>
        <div class="shortcut-item">
          <span class="shortcut-action">Open Tapestry</span>
          <span class="shortcut-keys"><kbd>Ctrl</kbd>+<kbd>O</kbd></span>
        </div>
        <div class="shortcut-item">
          <span class="shortcut-action">Command Palette</span>
          <span class="shortcut-keys"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd></span>
        </div>
        <div class="shortcut-item">
          <span class="shortcut-action">Transpose Solfège</span>
          <span class="shortcut-keys"><kbd>Ctrl</kbd>+<kbd>↑/↓</kbd></span>
        </div>
        <div class="shortcut-item">
          <span class="shortcut-action">Shift Octave</span>
          <span class="shortcut-keys"><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>↑/↓</kbd></span>
        </div>
        <div class="shortcut-item">
          <span class="shortcut-action">Autocomplete & Snips</span>
          <span class="shortcut-keys"><kbd>Ctrl</kbd>+<kbd>Space</kbd></span>
        </div>
      </div>

      <div class="placeholder-actions">
        <button type="button" id="btn-placeholder-compile" class="btn btn-primary">
          <span>▶</span> Compile Tapestry
        </button>
        <button type="button" id="btn-placeholder-open" class="btn btn-secondary">
          <span>📂</span> Open Score...
        </button>
      </div>
    </div>
  `;
}

function getPlaceholderLoadingHtml(title = 'Compiling Tapestry Score', subtitle = 'Generating LilyPond notation...') {
  return `
    <div class="placeholder-card placeholder-loading-card">
      <div class="placeholder-spinner-wrap">
        <div class="placeholder-spinner-ring"></div>
        <img src="logo.svg" alt="PPT Logo" class="placeholder-spinner-logo" />
      </div>
      <h3 class="placeholder-loading-title">${title}</h3>
      <p class="placeholder-loading-sub">${subtitle}</p>
    </div>
  `;
}

function bindPlaceholderButtons() {
  const btnCompile = document.getElementById('btn-placeholder-compile');
  const btnOpen = document.getElementById('btn-placeholder-open');
  if (btnCompile) {
    btnCompile.addEventListener('click', () => triggerCompile());
  }
  if (btnOpen) {
    btnOpen.addEventListener('click', () => openTapestryPicker());
  }
}

function clearPreviewWindow(loadingMessage = null) {
  currentPdfDoc = null;
  lastPdfBase64 = null;
  if (scoreSvgContainer) scoreSvgContainer.innerHTML = '';
  if (scorePlaceholder) {
    if (loadingMessage) {
      scorePlaceholder.innerHTML = getPlaceholderLoadingHtml('Loading Tapestry Score', loadingMessage);
    } else {
      scorePlaceholder.innerHTML = getPlaceholderDefaultHtml();
      bindPlaceholderButtons();
    }
    scorePlaceholder.style.display = 'flex';
  }
  if (scoreCanvas) {
    scoreCanvas.scrollTop = 0;
    scoreCanvas.scrollLeft = 0;
  }
  shouldResetPreviewScroll = true;
}

// --- URL & Deeplinking Helpers ---
function getKnotFromUrlOrStorage() {
  const urlParams = new URLSearchParams(window.location.search);
  const paramKnot = urlParams.get('knot');
  if (paramKnot) return paramKnot;

  if (window.location.hash) {
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const hashKnot = hashParams.get('knot');
    if (hashKnot) return hashKnot;
  }

  return localStorage.getItem('ppt_active_knot') || null;
}

function getScoreFromUrlOrStorage(scoreList) {
  if (!scoreList || scoreList.length === 0) return null;

  // 1. Check URL search param (?score=...)
  const urlParams = new URLSearchParams(window.location.search);
  const paramScore = urlParams.get('score');
  if (paramScore) {
    const cleanParam = paramScore.toLowerCase().replace(/^scores[\\/]/, '');
    const match = scoreList.find(s => 
      s.path.toLowerCase() === paramScore.toLowerCase() ||
      s.name.toLowerCase() === cleanParam ||
      s.path.toLowerCase().endsWith(cleanParam)
    );
    if (match) return match.path;
  }

  // 2. Check URL hash (#...)
  if (window.location.hash) {
    const hashText = window.location.hash.slice(1);
    const hashParams = new URLSearchParams(hashText);
    const hashScoreParam = hashParams.get('score');
    const hashScore = (hashScoreParam || hashText).toLowerCase().replace(/^scores[\\/]/, '');
    const match = scoreList.find(s => 
      s.name.toLowerCase() === hashScore ||
      s.path.toLowerCase().endsWith(hashScore)
    );
    if (match) return match.path;
  }

  // 3. Check localStorage
  const savedScore = localStorage.getItem('ppt_active_score');
  if (savedScore) {
    const cleanSaved = savedScore.toLowerCase().replace(/^scores[\\/]/, '');
    const match = scoreList.find(s => 
      s.path.toLowerCase() === savedScore.toLowerCase() ||
      s.name.toLowerCase() === cleanSaved ||
      s.path.toLowerCase().endsWith(cleanSaved)
    );
    if (match) return match.path;
  }

  // 4. Default to first score
  return scoreList[0].path;
}

function updateUrlAndStorage(filePath, knotId = currentKnotId) {
  if (!filePath) return;
  localStorage.setItem('ppt_active_score', filePath);
  if (knotId) {
    localStorage.setItem('ppt_active_knot', knotId);
  } else {
    localStorage.removeItem('ppt_active_knot');
  }

  const cleanName = filePath.replace(/^scores[\\/]/, '');
  let newUrl = `${window.location.pathname}?score=${encodeURIComponent(cleanName)}`;
  if (knotId) {
    newUrl += `&knot=${encodeURIComponent(knotId)}`;
  }
  window.history.replaceState({ score: cleanName, knot: knotId }, '', newUrl);
}

function updateKnotDropdown(availableKnots, selectedKnotId) {
  if (!knotSelect) return;
  knotSelect.innerHTML = '';

  const knots = (availableKnots && availableKnots.length > 0)
    ? availableKnots
    : [{ id: selectedKnotId || 'default', name: 'Default' }];

  knots.forEach(k => {
    const opt = document.createElement('option');
    opt.value = k.id;
    opt.textContent = k.name || k.title || k.id;
    if (k.id === selectedKnotId) {
      opt.selected = true;
    }
    knotSelect.appendChild(opt);
  });

  const effectiveSelected = selectedKnotId || knots[0].id;
  knotSelect.value = effectiveSelected;
  currentKnotId = effectiveSelected;
}

// --- API Helpers ---
let cachedScores = [];

async function fetchScores(targetPath = null) {
  try {
    const res = await fetch('/api/scores');
    const data = await res.json();
    scoreSelect.innerHTML = '';
    cachedScores = data.scores || [];
    
    if (cachedScores.length > 0) {
      cachedScores.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.path;
        opt.textContent = s.title ? `${s.title} (${s.name})` : s.name;
        scoreSelect.appendChild(opt);
      });

      if (!isInitialScoreLoadDone) {
        isInitialScoreLoadDone = true;
        const initialScore = targetPath || getScoreFromUrlOrStorage(cachedScores);
        currentKnotId = getKnotFromUrlOrStorage();
        currentScoreFile = initialScore;
        scoreSelect.value = initialScore;
        loadScore(initialScore);
      } else {
        const selected = targetPath || currentScoreFile || cachedScores[0].path;
        currentScoreFile = selected;
        scoreSelect.value = selected;
        updateUrlAndStorage(selected, currentKnotId);
      }
    } else {
      scoreSelect.innerHTML = '<option value="">No tapestries found</option>';
    }
  } catch (err) {
    console.error('Failed to load tapestries list:', err);
  }
}

function confirmDiscardUnsavedChanges() {
  if (!isDirty) return true;
  return window.confirm('You have unsaved changes in the current tapestry. Are you sure you want to discard them?');
}

async function loadScore(filePath, force = false) {
  if (!force && isDirty && currentScoreFile && filePath !== currentScoreFile) {
    if (!confirmDiscardUnsavedChanges()) {
      if (scoreSelect && currentScoreFile) {
        scoreSelect.value = currentScoreFile;
      }
      return;
    }
  }

  try {
    setStatus('loading', 'Loading...');
    clearPreviewWindow('Loading & compiling tapestry sheet music...');
    const res = await fetch(`/api/score?file=${encodeURIComponent(filePath)}`);
    const data = await res.json();
    if (data.content) {
      currentScoreFile = filePath;
      scoreSelect.value = filePath;
      updateUrlAndStorage(filePath, currentKnotId);
      editor.setValue(data.content);
      setDirty(false);
      triggerCompile(currentKnotId);
    }
  } catch (err) {
    console.error('Failed to load tapestry:', err);
  }
}

async function saveScore() {
  const content = editor.getValue();
  let fileName = currentScoreFile || 'score.ppt.yaml';
  
  try {
    setStatus('compiling', 'Saving...');
    const res = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: fileName, content }),
    });
    const data = await res.json();
    if (data.success) {
      currentScoreFile = data.file;
      setDirty(false);
      setStatus('ready', 'Tapestry Saved');
      updateUrlAndStorage(data.file, currentKnotId);
      await fetchScores(data.file); // Refresh list without reloading or recompiling editor!
    }
  } catch (err) {
    console.error('Failed to save tapestry:', err);
    setStatus('error', 'Save Failed');
  }
}

async function triggerCompile(customKnotId = null) {
  const yaml = editor.getValue();
  if (!yaml.trim()) return;

  const targetKnotId = customKnotId || currentKnotId || getKnotFromUrlOrStorage();

  setStatus('compiling', 'Compiling...');
  hideError();

  try {
    const res = await fetch('/api/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yaml, knotId: targetKnotId }),
    });
    const data = await res.json();
    lastCompiledData = data;
    latestSidecarMap = data.sidecarMap || null;
    latestLilypondSource = data.lilypondSource || '';
    latestOnsets = data.onsets || [];

    if (data.availableKnots) {
      updateKnotDropdown(data.availableKnots, data.selectedKnotId);
    }
    if (data.selectedKnotId) {
      currentKnotId = data.selectedKnotId;
      if (currentScoreFile) {
        updateUrlAndStorage(currentScoreFile, currentKnotId);
      }
    }

    if (data.success) {
      setStatus('ready', `⚡ ${data.metrics?.totalTimeMs || 0}ms`);
      metricsText.textContent = `Compile: ${data.metrics?.compileTimeMs || 0}ms | LilyPond: ${data.metrics?.lilyTimeMs || 0}ms`;
      renderPreview(data);
      renderLilyPond(data.lilypondSource);
      renderOnsets(data.onsets);
    } else {
      setStatus('error', 'Compile Error');
      showError(data.error + (data.stderr ? `\n\n${data.stderr}` : ''));
      if (data.lilypondSource) {
        renderLilyPond(data.lilypondSource);
      }
    }
  } catch (err) {
    setStatus('error', 'Network Error');
    showError(String(err));
  }
}

async function exportPdf() {
  const yaml = editor.getValue();
  const file = currentScoreFile || 'score.ppt.yaml';

  try {
    setStatus('compiling', 'Exporting PDF...');
    const res = await fetch('/api/export-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yaml, file, knotId: currentKnotId }),
    });
    const data = await res.json();
    if (data.success) {
      setStatus('ready', `Exported ${data.pdfFile}`);
      alert(`Successfully exported PDF to scores/${data.pdfFile}!`);
    } else {
      setStatus('error', 'Export Failed');
      alert(`Export failed: ${data.error}`);
    }
  } catch (err) {
    setStatus('error', 'Export Error');
  }
}

// PDF.js worker setup
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// Point-and-Click State & Navigation (Preview -> Code Editor)
let latestSidecarMap = null;
let latestLilypondSource = '';
let latestOnsets = [];

function findTokenInArray(lineText, onsetIndex) {
  const arrayMatch = lineText.match(/\[(.*?)\]/);
  if (arrayMatch) {
    const inner = arrayMatch[1];
    const arrayStartCh = lineText.indexOf('[');
    const rawItems = inner.split(',');
    const tokenMap = [];
    let currentOnset = 1;
    let runningOffset = arrayStartCh + 1;

    for (let i = 0; i < rawItems.length; i++) {
      const rawItem = rawItems[i];
      const trimmed = rawItem.trim();
      if (!trimmed) continue;
      const itemStartCh = lineText.indexOf(trimmed, runningOffset);
      if (itemStartCh !== -1) {
        runningOffset = itemStartCh + trimmed.length;
      }

      const isNum = /^\d+(?:\.\d+)?$/.test(trimmed);
      if (isNum) {
        const parts = trimmed.split('.');
        const repeatCount = parseInt(parts[0], 10);
        const windowSize = parts[1] ? parseInt(parts[1], 10) : 1;
        const totalItemsAdded = repeatCount * windowSize;
        for (let k = 0; k < totalItemsAdded; k++) {
          tokenMap.push({ onsetIndex: currentOnset++, startCh: itemStartCh !== -1 ? itemStartCh : runningOffset, token: trimmed });
        }
      } else {
        const subTokens = trimmed.split(/\s+/).filter(Boolean);
        let subOffset = itemStartCh !== -1 ? itemStartCh : runningOffset;
        for (const st of subTokens) {
          const stStart = lineText.indexOf(st, subOffset);
          tokenMap.push({ onsetIndex: currentOnset++, startCh: stStart !== -1 ? stStart : subOffset, token: st });
          if (stStart !== -1) {
            subOffset = stStart + st.length;
          }
        }
      }
    }

    const match = tokenMap.find(t => t.onsetIndex === onsetIndex);
    if (match) return match.startCh;
    if (tokenMap.length > 0) return tokenMap[tokenMap.length - 1].startCh;
    return arrayStartCh;
  }

  const colonIdx = lineText.indexOf(':');
  if (colonIdx !== -1) {
    const afterColon = lineText.slice(colonIdx + 1);
    const tokens = afterColon.trim().split(/\s+/).filter(Boolean);
    let currentOffset = colonIdx + 1;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      const tStart = lineText.indexOf(t, currentOffset);
      if (i + 1 === onsetIndex && tStart !== -1) {
        return tStart;
      }
      if (tStart !== -1) currentOffset = tStart + t.length;
    }
    return colonIdx + 2;
  }

  return 0;
}

function findYamlTarget(yamlText, coilId, onsetIndex, targetLayer = 'melody', voiceIndex = 1, parentCoilId = null) {
  if (!yamlText || !coilId) return { targetLine: -1, targetCh: 0 };
  const lines = yamlText.split('\n');

  // 1. Check for anonymous sub-coil of concat (e.g. "bridge_end_sub_2", "subCoil_1")
  let subIndex = null;
  let targetParent = parentCoilId;

  const subMatch = coilId.match(/^(?:(.+?)_)?(?:sub|subCoil)_(\d+)$/i);
  if (subMatch) {
    if (subMatch[1]) targetParent = subMatch[1];
    subIndex = parseInt(subMatch[2], 10);
    if (/^subCoil_/i.test(coilId) && !subMatch[1]) {
      subIndex = subIndex + 1; // 0-based to 1-based
    }
  }

  // Check for anonymous child of weave (e.g. "song_child_1", "song_coil_1")
  const childMatch = coilId.match(/^(.+?)_(?:child|coil)_(\d+)$/i);
  let weaveChildIndex = null;
  let targetWeave = null;
  if (childMatch) {
    targetWeave = childMatch[1];
    weaveChildIndex = parseInt(childMatch[2], 10);
  }

  // 2. If it's a sub-coil inside a concat block of targetParent:
  if (targetParent && subIndex !== null) {
    for (let l = 0; l < lines.length; l++) {
      const line = lines[l];
      if (new RegExp(`^\\s*id\\s*:\\s*["']?${targetParent}["']?\\s*$`).test(line) ||
          new RegExp(`^\\s*${targetParent}\\s*:`).test(line)) {
        const parentIndent = (line.match(/^\s*/) || [''])[0].length;
        for (let subL = l + 1; subL < Math.min(lines.length, l + 80); subL++) {
          const sLine = lines[subL];
          const sIndent = (sLine.match(/^\s*/) || [''])[0].length;
          if (sIndent <= parentIndent && sLine.trim().length > 0 && !/^\s*#/.test(sLine)) break;

          if (/^\s*concat\s*:/i.test(sLine)) {
            const concatIndent = sIndent;
            let currentSubCount = 0;
            for (let cL = subL + 1; cL < Math.min(lines.length, subL + 80); cL++) {
              const cLine = lines[cL];
              const cIndent = (cLine.match(/^\s*/) || [''])[0].length;
              if (cIndent <= concatIndent && cLine.trim().length > 0 && !/^\s*#/.test(cLine)) break;

              if (/^\s*-\s*/.test(cLine)) {
                currentSubCount++;
                if (currentSubCount === subIndex) {
                  const subItemIndent = cIndent;
                  for (let tL = cL; tL < Math.min(lines.length, cL + 30); tL++) {
                    const tLine = lines[tL];
                    const tIndent = (tLine.match(/^\s*/) || [''])[0].length;
                    if (tL > cL && tIndent <= subItemIndent && /^\s*-\s*/.test(tLine)) break;
                    if (tL > cL && tIndent <= concatIndent && tLine.trim().length > 0 && !/^\s*#/.test(tLine)) break;

                    if (targetLayer === 'melody' && /^\s*(?:-\s*)?(?:melody|pitches)\s*:/i.test(tLine)) {
                      return { targetLine: tL, targetCh: findTokenInArray(tLine, onsetIndex) };
                    }
                    if (targetLayer === 'harmony' && /^\s*(?:-\s*)?(?:harmony|chords)\s*:/i.test(tLine)) {
                      return { targetLine: tL, targetCh: findTokenInArray(tLine, onsetIndex) };
                    }
                    if (targetLayer === 'rhythm' && /^\s*(?:-\s*)?rhythm\s*:/i.test(tLine)) {
                      return { targetLine: tL, targetCh: findTokenInArray(tLine, onsetIndex) };
                    }
                  }
                  return { targetLine: cL, targetCh: (lines[cL].match(/^\s*/) || [''])[0].length };
                }
              }
            }
          }
        }
      }
    }
  }

  // 3. If it's an inline child inside weave.children:
  if (targetWeave && weaveChildIndex !== null) {
    for (let l = 0; l < lines.length; l++) {
      const line = lines[l];
      if (new RegExp(`^\\s*id\\s*:\\s*["']?${targetWeave}["']?\\s*$`).test(line) ||
          new RegExp(`^\\s*${targetWeave}\\s*:`).test(line)) {
        const weaveIndent = (line.match(/^\s*/) || [''])[0].length;
        for (let subL = l + 1; subL < Math.min(lines.length, l + 80); subL++) {
          const sLine = lines[subL];
          const sIndent = (sLine.match(/^\s*/) || [''])[0].length;
          if (sIndent <= weaveIndent && sLine.trim().length > 0 && !/^\s*#/.test(sLine)) break;

          if (/^\s*children\s*:/i.test(sLine)) {
            const childrenIndent = sIndent;
            let currentChildCount = 0;
            for (let cL = subL + 1; cL < Math.min(lines.length, subL + 80); cL++) {
              const cLine = lines[cL];
              const cIndent = (cLine.match(/^\s*/) || [''])[0].length;
              if (cIndent <= childrenIndent && cLine.trim().length > 0 && !/^\s*#/.test(cLine)) break;

              if (/^\s*-\s*/.test(cLine)) {
                currentChildCount++;
                if (currentChildCount === weaveChildIndex) {
                  const childItemIndent = cIndent;
                  for (let tL = cL; tL < Math.min(lines.length, cL + 30); tL++) {
                    const tLine = lines[tL];
                    const tIndent = (tLine.match(/^\s*/) || [''])[0].length;
                    if (tL > cL && tIndent <= childItemIndent && /^\s*-\s*/.test(tLine)) break;
                    if (tL > cL && tIndent <= childrenIndent && tLine.trim().length > 0 && !/^\s*#/.test(tLine)) break;

                    if (targetLayer === 'melody' && /^\s*(?:-\s*)?(?:melody|pitches)\s*:/i.test(tLine)) {
                      return { targetLine: tL, targetCh: findTokenInArray(tLine, onsetIndex) };
                    }
                    if (targetLayer === 'harmony' && /^\s*(?:-\s*)?(?:harmony|chords)\s*:/i.test(tLine)) {
                      return { targetLine: tL, targetCh: findTokenInArray(tLine, onsetIndex) };
                    }
                    if (targetLayer === 'rhythm' && /^\s*(?:-\s*)?rhythm\s*:/i.test(tLine)) {
                      return { targetLine: tL, targetCh: findTokenInArray(tLine, onsetIndex) };
                    }
                  }
                  return { targetLine: cL, targetCh: (lines[cL].match(/^\s*/) || [''])[0].length };
                }
              }
            }
          }
        }
      }
    }
  }

  // 4. Standard candidate definitions for named coils
  const candidates = [];
  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    if (new RegExp(`^\\s*id\\s*:\\s*["']?${coilId}["']?\\s*$`).test(line)) {
      candidates.push({ lineIndex: l, type: 'id' });
    } else if (new RegExp(`^\\s*${coilId}\\s*:`).test(line)) {
      candidates.push({ lineIndex: l, type: 'dict' });
    } else if (new RegExp(`^\\s*-\\s*coil\\s*:\\s*["']?${coilId}["']?\\s*$`).test(line)) {
      candidates.push({ lineIndex: l, type: 'ref' });
    }
  }

  // Fallback: substring or parent search
  if (candidates.length === 0 && targetParent) {
    for (let l = 0; l < lines.length; l++) {
      const line = lines[l];
      if (new RegExp(`^\\s*id\\s*:\\s*["']?${targetParent}["']?\\s*$`).test(line) ||
          new RegExp(`^\\s*${targetParent}\\s*:`).test(line)) {
        candidates.push({ lineIndex: l, type: 'dict' });
      }
    }
  }

  if (candidates.length === 0) {
    for (let l = 0; l < lines.length; l++) {
      if (lines[l].includes(coilId)) {
        candidates.push({ lineIndex: l, type: 'substr' });
      }
    }
  }

  if (candidates.length === 0) {
    return { targetLine: -1, targetCh: 0 };
  }

  for (const cand of candidates) {
    const startL = cand.lineIndex;
    const maxLookahead = Math.min(lines.length, startL + 60);
    const startIndent = (lines[startL].match(/^\s*/) || [''])[0].length;

    for (let l = startL; l < maxLookahead; l++) {
      const line = lines[l];
      if (l > startL) {
        const curIndent = (line.match(/^\s*/) || [''])[0].length;
        if (/^\s*-\s*(coil|weave)\s*:/.test(line)) {
          break;
        }
        if (curIndent < startIndent && line.trim().length > 0 && !/^\s*#/.test(line)) {
          break;
        }
        if (cand.type === 'dict' && curIndent <= startIndent && /^\s*[_a-zA-Z0-9]+\s*:/.test(line) && line.trim().length > 0 && !/^\s*#/.test(line)) {
          break;
        }
      }

      // 1. Melody target
      if (targetLayer === 'melody' && /^\s*(?:-\s*)?(?:melody|pitches)\s*:/i.test(line)) {
        const afterColon = line.slice(line.indexOf(':') + 1).trim();
        if (afterColon.startsWith('[')) {
          // Inline array: melody: [Do, Re, Mi]
          return { targetLine: l, targetCh: findTokenInArray(line, onsetIndex) };
        }
        // Polyphonic / multi-line voice bullets
        let vCount = 0;
        for (let subL = l + 1; subL < maxLookahead; subL++) {
          const subLine = lines[subL];
          const subIndent = (subLine.match(/^\s*/) || [''])[0].length;
          if (subIndent <= (line.match(/^\s*/) || [''])[0].length && subLine.trim().length > 0) break;
          if (/^\s*-\s*/.test(subLine)) {
            vCount++;
            if (vCount === (voiceIndex || 1)) {
              return { targetLine: subL, targetCh: findTokenInArray(subLine, onsetIndex) };
            }
          }
        }
        return { targetLine: l, targetCh: findTokenInArray(line, onsetIndex) };
      }

      // 2. Harmony target
      if (targetLayer === 'harmony' && /^\s*(?:-\s*)?(?:harmony|chords)\s*:/i.test(line)) {
        const afterColon = line.slice(line.indexOf(':') + 1).trim();
        if (afterColon.startsWith('[')) {
          // Inline array: harmony: [Do, Fa, Do] or chords: [Do, Fa, Do]
          return { targetLine: l, targetCh: findTokenInArray(line, onsetIndex) };
        }
        // Check for nested chords: or bullets
        for (let subL = l + 1; subL < maxLookahead; subL++) {
          const subLine = lines[subL];
          const subIndent = (subLine.match(/^\s*/) || [''])[0].length;
          if (subIndent <= (line.match(/^\s*/) || [''])[0].length && subLine.trim().length > 0) break;
          if (/^\s*chords\s*:/i.test(subLine)) {
            return { targetLine: subL, targetCh: findTokenInArray(subLine, onsetIndex) };
          }
          if (/^\s*-\s*/.test(subLine)) {
            return { targetLine: subL, targetCh: findTokenInArray(subLine, onsetIndex) };
          }
        }
        return { targetLine: l, targetCh: findTokenInArray(line, onsetIndex) };
      }

      // 3. Rhythm target
      if (targetLayer === 'rhythm' && /^\s*(?:-\s*)?rhythm\s*:/i.test(line)) {
        return { targetLine: l, targetCh: findTokenInArray(line, onsetIndex) };
      }
    }
  }

  return { targetLine: candidates[0].lineIndex, targetCh: 0 };
}

function handlePointAndClick(url) {
  if (!url || !url.includes('textedit:')) return;

  // Format: textedit:...:line:col:endCol or textedit:...:line:col
  const match = url.match(/:(\d+)(?::(\d+))?(?::(\d+))?$/);
  if (!match) return;

  const lyLineNum = parseInt(match[1], 10);
  const tagInfo = resolveTagFromLyLine(lyLineNum);
  if (!tagInfo || !tagInfo.coilId) return;

  const doc = editor.getDoc();
  const yamlText = doc.getValue();
  const { targetLine, targetCh } = findYamlTarget(
    yamlText,
    tagInfo.coilId,
    tagInfo.targetLayer === 'melody'
      ? (tagInfo.melodyOnsetIndex || tagInfo.sourceOnsetIndex || tagInfo.onsetIndex)
      : (tagInfo.sourceOnsetIndex || tagInfo.onsetIndex),
    tagInfo.targetLayer,
    tagInfo.voiceIndex || 1,
    tagInfo.parentCoilId,
  );

  if (targetLine !== -1) {
    editor.setCursor({ line: targetLine, ch: targetCh });
    editor.scrollIntoView({ line: targetLine, ch: targetCh }, 150);
    editor.focus();

    // Trigger cursor update so inline preview strip, paired tokens, and highlights update immediately
    updateInlineSolfegeWidget();
    updatePairedTokenHighlights(editor);
    updateScoreHighlights(editor);

    // Flash animation on the target line
    editor.addLineClass(targetLine, 'background', 'cm-point-click-flash');
    setTimeout(() => {
      editor.removeLineClass(targetLine, 'background', 'cm-point-click-flash');
    }, 1200);
  }
}

/**
 * Resolves LilyPond source line number into tag and provenance metadata.
 */
function resolveTagFromLyLine(lyLineNum) {
  if (!latestLilypondSource || !lyLineNum) return null;
  const lyLines = latestLilypondSource.split('\n');
  let rawTag = null;
  const targetIdx = lyLineNum - 1;

  if (targetIdx >= 0 && targetIdx < lyLines.length) {
    const exactMatch = lyLines[targetIdx].match(/\\tag\s*#'(ppt_[a-zA-Z0-9_]+)/);
    if (exactMatch) {
      rawTag = exactMatch[1];
    }
  }

  if (!rawTag) {
    const startL = Math.max(0, lyLineNum - 6);
    const endL = Math.min(lyLines.length - 1, lyLineNum + 5);

    // Search backward
    for (let l = Math.min(lyLines.length - 1, lyLineNum - 1); l >= startL; l--) {
      const line = lyLines[l];
      if (/Voice\s*=\s*\{/.test(line) || /\\cadenzaOff/.test(line)) break;
      const tm = line.match(/\\tag\s*#'(ppt_[a-zA-Z0-9_]+)/);
      if (tm) {
        rawTag = tm[1];
        break;
      }
    }

    // Search forward
    if (!rawTag) {
      for (let l = lyLineNum; l <= endL; l++) {
        const line = lyLines[l];
        if (/Voice\s*=\s*\{/.test(line) || /\\cadenzaOff/.test(line)) break;
        const tm = line.match(/\\tag\s*#'(ppt_[a-zA-Z0-9_]+)/);
        if (tm) {
          rawTag = tm[1];
          break;
        }
      }
    }
  }

  if (!rawTag) return null;

  let targetLayer = 'melody';
  let coilId = null;
  let onsetIndex = 1;
  let voiceIndex = 1;

  const voiceLayerMatch = rawTag.match(/^ppt_(.+)_([a-zA-Z]+)_v(\d+)_(\d+)$/);
  const voiceDirectMatch = rawTag.match(/^ppt_(.+)_v(\d+)_(\d+)$/);
  const newFormatMatch = rawTag.match(/^ppt_(.+)_([a-zA-Z]+)_(\d+)$/);
  const suffixFormatMatch = rawTag.match(/^ppt_(.+)_(\d+)_([a-zA-Z]+)$/);

  if (voiceLayerMatch) {
    voiceIndex = parseInt(voiceLayerMatch[3], 10) || 1;
    const layerKey = voiceLayerMatch[2];
    onsetIndex = parseInt(voiceLayerMatch[4], 10) || 1;
    if (layerKey.startsWith('rhythm')) {
      targetLayer = 'rhythm';
    } else if (layerKey.startsWith('harm') || layerKey.startsWith('chord')) {
      targetLayer = 'harmony';
    } else {
      targetLayer = 'melody';
    }
  } else if (voiceDirectMatch) {
    voiceIndex = parseInt(voiceDirectMatch[2], 10) || 1;
    onsetIndex = parseInt(voiceDirectMatch[3], 10) || 1;
    targetLayer = 'melody';
  } else if (newFormatMatch) {
    const layerKey = newFormatMatch[2];
    onsetIndex = parseInt(newFormatMatch[3], 10) || 1;
    if (layerKey.startsWith('rhythm')) {
      targetLayer = 'rhythm';
    } else if (layerKey.startsWith('harm') || layerKey.startsWith('chord')) {
      targetLayer = 'harmony';
    } else {
      targetLayer = 'melody';
    }
  } else if (suffixFormatMatch) {
    const layerKey = suffixFormatMatch[3];
    onsetIndex = parseInt(suffixFormatMatch[2], 10) || 1;
    if (layerKey.startsWith('rhythm')) {
      targetLayer = 'rhythm';
    } else if (layerKey.startsWith('harm') || layerKey.startsWith('chord')) {
      targetLayer = 'harmony';
    } else {
      targetLayer = 'melody';
    }
  }

  let sidecarEntry = null;
  if (latestSidecarMap) {
    sidecarEntry = latestSidecarMap[rawTag];
    if (!sidecarEntry) {
      const strippedTag = rawTag.replace(/_(?:melody|melodyAbs|melodyInt|rhythm|harmony|harmCoil|harmStaff|chordName|mel|melAbs|melInt)(?:_v\d+)?/g, '');
      sidecarEntry = latestSidecarMap[strippedTag];
    }
  }

  let weaveId = sidecarEntry ? sidecarEntry.weaveId : '';
  let sourceCoilId = sidecarEntry ? sidecarEntry.sourceCoilId : '';
  let sourceOnsetIndex = sidecarEntry ? (sidecarEntry.sourceOnsetIndex || sidecarEntry.onsetIndex || onsetIndex) : onsetIndex;
  let melodySourceCoil = sidecarEntry ? sidecarEntry.melodySourceCoil : '';
  let rhythmSourceCoil = sidecarEntry ? sidecarEntry.rhythmSourceCoil : '';
  let harmonySourceCoil = sidecarEntry ? sidecarEntry.harmonySourceCoil : '';
  if (sidecarEntry && sidecarEntry.voiceIndex) {
    voiceIndex = sidecarEntry.voiceIndex;
  }

  if (sidecarEntry) {
    onsetIndex = sidecarEntry.onsetIndex || onsetIndex;
    if (targetLayer === 'rhythm') {
      coilId = sidecarEntry.rhythmSourceCoil || sidecarEntry.sourceCoilId || sidecarEntry.coilId;
    } else if (targetLayer === 'harmony') {
      coilId = sidecarEntry.harmonySourceCoil || sidecarEntry.sourceCoilId || sidecarEntry.coilId;
    } else {
      coilId = sidecarEntry.melodySourceCoil || sidecarEntry.sourceCoilId || sidecarEntry.coilId;
    }
  } else if (newFormatMatch) {
    const parts = newFormatMatch[1].split('_');
    coilId = parts[parts.length - 1];
    weaveId = parts[0];
  } else if (suffixFormatMatch) {
    const parts = suffixFormatMatch[1].split('_');
    coilId = parts[parts.length - 1];
    weaveId = parts[0];
  } else {
    const parts = rawTag.replace(/^ppt_/, '').split('_');
    onsetIndex = parseInt(parts[parts.length - 1], 10) || 1;
    sourceOnsetIndex = onsetIndex;
    coilId = parts.length > 2 ? parts[parts.length - 2] : parts[0];
    weaveId = parts[0];
  }

  return {
    rawTag,
    targetLayer,
    voiceIndex,
    coilId,
    parentCoilId: sidecarEntry ? sidecarEntry.coilId : null,
    sourceCoilId: sourceCoilId || coilId,
    melodySourceCoil: melodySourceCoil || coilId,
    rhythmSourceCoil: rhythmSourceCoil || coilId,
    harmonySourceCoil: harmonySourceCoil || coilId,
    weaveId,
    onsetIndex,
    sourceOnsetIndex,
    melodyOnsetIndex: sidecarEntry ? sidecarEntry.melodyOnsetIndex : undefined,
    sidecarEntry,
  };
}

let currentPdfDoc = null;
let lastPdfBase64 = null;
let pdfZoomMode = 'FitH'; // 'FitH' | 'percent'
let isRenderingPdf = false;

// --- Real-Time Line-to-Score Highlighting Engine ---
let highlightAnimFrame = null;

function updateScoreHighlights(cm) {
  if (!cm) return;
  if (highlightAnimFrame) {
    cancelAnimationFrame(highlightAnimFrame);
  }

  highlightAnimFrame = requestAnimationFrame(() => {
    const cur = cm.getCursor();
    const doc = cm.getDoc();
    const currentLineNum = cur.line;
    const currentLine = cm.getLine(currentLineNum) || '';
    const yamlText = doc.getValue();
    const lines = yamlText.split('\n');

    const previewElements = scoreSvgContainer.querySelectorAll('.pdf-point-click-link, a[data-tag]');
    if (!previewElements || previewElements.length === 0) return;

    const trimmed = currentLine.trim();

    // If blank or comment, clear highlights completely
    if (!trimmed || trimmed.startsWith('#')) {
      previewElements.forEach(el => {
        el.classList.remove('score-highlight-active', 'score-highlight-primary');
      });
      return;
    }

    // Exclude known YAML properties and top-level block keys from coil dict header detection
    const EXCLUDED_KEYS = new Set([
      'tapestry', 'knot', 'engraving', 'weaves', 'coils', 'children',
      'melody', 'rhythm', 'harmony', 'chords', 'pitches', 'concat',
      'parents', 'show', 'song', 'title', 'composer', 'arranger',
      'tempo', 'tonic', 'colorNotes', 'omitStem', 'octave', 'meter',
      'duration', 'harmonyOctave', 'harmonyClef', 'melodyClef',
      'voice', 'voices', 'harmonyStaffStyle', 'showHarmonyCoil',
      'showTraditionalHarmony', 'harmonyChangesOnly', 'color',
      'harmonyVoicing', 'melodyAugmentation', 'melodyAugmentationDisplay',
      'projection'
    ]);

    // 1. Check if on a Declarative Music Layer Line (melody, harmony, rhythm, chords, pitches)
    let declarativeLayer = null;
    let targetVoiceIndex = null;

    if (/^\s*(?:-\s*)?(?:melody|pitches)\s*:/i.test(currentLine)) {
      declarativeLayer = 'melody';
      const afterColon = currentLine.slice(currentLine.indexOf(':') + 1).trim();
      if (afterColon.startsWith('[')) {
        targetVoiceIndex = 1;
      }
    } else if (/^\s*(?:-\s*)?(?:harmony|chords)\s*:/i.test(currentLine)) {
      declarativeLayer = 'harmony';
    } else if (/^\s*(?:-\s*)?rhythm\s*:/i.test(currentLine)) {
      // Check if this rhythm: is nested under harmony:
      let isUnderHarmony = false;
      const curIndent = (currentLine.match(/^\s*/) || [''])[0].length;
      for (let l = currentLineNum - 1; l >= Math.max(0, currentLineNum - 20); l--) {
        const prevL = lines[l];
        const prevIndent = (prevL.match(/^\s*/) || [''])[0].length;
        if (/^\s*harmony\s*:/i.test(prevL) && prevIndent < curIndent) {
          isUnderHarmony = true;
          break;
        }
        if (prevIndent < curIndent && /^\s*[_a-zA-Z0-9]+\s*:/.test(prevL)) break;
      }
      declarativeLayer = isUnderHarmony ? 'harmony' : 'rhythm';
    }

    // Also handle bullet list items directly under a music layer
    if (!declarativeLayer && /^\s*-\s+/.test(currentLine)) {
      let bulletIndex = 1;
      const curLineIndent = (currentLine.match(/^\s*/) || [''])[0].length;
      for (let l = currentLineNum - 1; l >= Math.max(0, currentLineNum - 40); l--) {
        const prevL = lines[l];
        const prevIndent = (prevL.match(/^\s*/) || [''])[0].length;
        if (/^\s*-\s+/.test(prevL) && prevIndent === curLineIndent) {
          bulletIndex++;
        } else if (/^\s*(?:melody|pitches)\s*:/i.test(prevL)) {
          declarativeLayer = 'melody';
          targetVoiceIndex = bulletIndex;
          break;
        } else if (/^\s*rhythm\s*:/i.test(prevL)) {
          declarativeLayer = 'rhythm';
          break;
        } else if (/^\s*(?:harmony|chords)\s*:/i.test(prevL)) {
          declarativeLayer = 'harmony';
          break;
        } else if (/^\s*[a-zA-Z0-9_]+\s*:/i.test(prevL) && !/^\s*-\s+/.test(prevL) && prevIndent < curLineIndent) {
          break;
        }
      }
    } else if (!declarativeLayer && /^\s*chords\s*:/i.test(currentLine)) {
      declarativeLayer = 'harmony';
    } else if (!declarativeLayer && /^\s*pitches\s*:/i.test(currentLine)) {
      declarativeLayer = 'melody';
      let bulletIndex = 1;
      for (let l = currentLineNum - 1; l >= Math.max(0, currentLineNum - 40); l--) {
        const prevL = lines[l];
        if (/^\s*melody\s*:/i.test(prevL)) {
          targetVoiceIndex = bulletIndex;
          break;
        }
      }
    }

    if (declarativeLayer) {
      // Find enclosing coil ID and check if inside an inline sub-coil under concat or children
      let enclosingCoil = null;
      let inlineSubIndex = null;
      let inlineChildIndex = null;
      let isInsideConcat = false;
      let isInsideChildren = false;

      const currentLineIndent = (currentLine.match(/^\s*/) || [''])[0].length;

      for (let l = currentLineNum - 1; l >= 0; l--) {
        const lText = lines[l];
        const lIndent = (lText.match(/^\s*/) || [''])[0].length;

        if (/^\s*concat\s*:/i.test(lText) && lIndent < currentLineIndent) {
          isInsideConcat = true;
          // Count sub-coil bullet index from concat down to currentLine
          let subCount = 0;
          for (let sL = l + 1; sL <= currentLineNum; sL++) {
            if (/^\s*-\s*/.test(lines[sL])) {
              subCount++;
            }
          }
          inlineSubIndex = subCount || 1;
        } else if (/^\s*children\s*:/i.test(lText) && lIndent < currentLineIndent) {
          isInsideChildren = true;
          let childCount = 0;
          for (let cL = l + 1; cL <= currentLineNum; cL++) {
            if (/^\s*-\s*/.test(lines[cL])) {
              childCount++;
            }
          }
          inlineChildIndex = childCount || 1;
        }

        const idMatch = lText.match(/^\s*id\s*:\s*["']?([_a-zA-Z0-9]+)["']?/);
        if (idMatch) { enclosingCoil = idMatch[1]; break; }
        const coilRefMatch = lText.match(/^\s*-\s*coil\s*:\s*["']?([_a-zA-Z0-9]+)["']?/);
        if (coilRefMatch) { enclosingCoil = coilRefMatch[1]; break; }
        const dictMatch = lText.match(/^\s*([_a-zA-Z0-9]+)\s*:/);
        if (dictMatch && !EXCLUDED_KEYS.has(dictMatch[1].toLowerCase())) {
          enclosingCoil = dictMatch[1];
          break;
        }
      }

      if (!enclosingCoil) {
        previewElements.forEach(el => {
          el.classList.remove('score-highlight-active', 'score-highlight-primary');
        });
        return;
      }

      // Compute sub-coil / child-coil ID if inside anonymous concat/children block
      const inlineSubCoilId = (isInsideConcat && inlineSubIndex !== null)
        ? `${enclosingCoil}_sub_${inlineSubIndex}`
        : null;
      const inlineChildCoilId = (isInsideChildren && inlineChildIndex !== null)
        ? `${enclosingCoil}_child_${inlineChildIndex}`
        : null;

      // Find token under cursor on this declarative line using precision token extractor
      const tokensOnLine = extractTokensFromLine(currentLine);
      const expandedOnsets = expandLayerTokensWithOnsets(tokensOnLine);
      const curTok = tokensOnLine.find(tok => cur.ch >= tok.startCh && cur.ch <= tok.endCh);
      let activeOnsetIndices = [];
      if (curTok) {
        activeOnsetIndices = expandedOnsets
          .filter(eo => eo.sourceToken === curTok)
          .map(eo => eo.onsetIndex + 1);
      }

      // For harmony chords, collect the sorted unique onset indices present in this coil's harmony layer
      let harmonyOnsetOrder = [];
      if (declarativeLayer === 'harmony') {
        const onsetSet = new Set();
        previewElements.forEach(el => {
          const isCoil = (
            el.dataset.sourceCoilId === inlineSubCoilId ||
            el.dataset.sourceCoilId === inlineChildCoilId ||
            el.dataset.coilId === enclosingCoil ||
            el.dataset.sourceCoilId === enclosingCoil ||
            el.dataset.harmonySourceCoil === enclosingCoil
          );
          if (isCoil && el.dataset.layer === 'harmony' && el.dataset.onsetIndex) {
            onsetSet.add(parseInt(el.dataset.onsetIndex, 10));
          }
        });
        harmonyOnsetOrder = Array.from(onsetSet).sort((a, b) => a - b);
      }

      // Highlight active layer token (gold primary) and paired layer onsets (blue active) for this coil
      previewElements.forEach(el => {
        let isCoilMatch = false;
        if (inlineSubCoilId) {
          isCoilMatch = (
            el.dataset.sourceCoilId === inlineSubCoilId ||
            el.dataset.melodySourceCoil === inlineSubCoilId ||
            el.dataset.rhythmSourceCoil === inlineSubCoilId ||
            el.dataset.harmonySourceCoil === inlineSubCoilId ||
            (el.dataset.sourceCoilId === `subCoil_${inlineSubIndex - 1}`)
          );
        } else if (inlineChildCoilId) {
          isCoilMatch = (
            el.dataset.sourceCoilId === inlineChildCoilId ||
            el.dataset.coilId === inlineChildCoilId ||
            el.dataset.coilId === `${enclosingCoil}_coil_${inlineChildIndex}`
          );
        } else {
          isCoilMatch = (
            el.dataset.coilId === enclosingCoil ||
            el.dataset.sourceCoilId === enclosingCoil ||
            (declarativeLayer === 'melody' && el.dataset.melodySourceCoil === enclosingCoil) ||
            (declarativeLayer === 'rhythm' && el.dataset.rhythmSourceCoil === enclosingCoil) ||
            (declarativeLayer === 'harmony' && el.dataset.harmonySourceCoil === enclosingCoil)
          );
        }

        const isLayerMatch = (el.dataset.layer === declarativeLayer);
        const isVoiceMatch = (
          declarativeLayer !== 'melody' ||
          targetVoiceIndex === null ||
          !el.dataset.voiceIndex ||
          el.dataset.voiceIndex === String(targetVoiceIndex)
        );

        if (isCoilMatch && isLayerMatch && isVoiceMatch) {
          let isTokenMatch = false;
          if (activeOnsetIndices.length > 0) {
            const onsetNum = parseInt(el.dataset.sourceOnsetIndex || el.dataset.onsetIndex, 10);
            if (declarativeLayer === 'harmony' && harmonyOnsetOrder.length > 0) {
              const matchedOnsetNum = harmonyOnsetOrder[activeOnsetIndices[0] - 1];
              isTokenMatch = (
                matchedOnsetNum !== undefined &&
                parseInt(el.dataset.onsetIndex, 10) === matchedOnsetNum
              );
            } else {
              isTokenMatch = activeOnsetIndices.includes(onsetNum);
            }
          }

          if (isTokenMatch) {
            el.classList.add('score-highlight-primary', 'score-highlight-active');
          } else {
            el.classList.add('score-highlight-active');
            el.classList.remove('score-highlight-primary');
          }
        } else {
          el.classList.remove('score-highlight-active', 'score-highlight-primary');
        }
      });
      return;
    }

    // 2. Check if on a Compositional / Structural Line
    let targetCoils = new Set();
    let targetWeaves = new Set();
    let isCompositionalLine = false;

    // A. Direct coil or weave reference: e.g. - coil: motif or coil: motif
    const directCoilMatch = currentLine.match(/\bcoil\s*:\s*["']?([_a-zA-Z0-9]+)["']?/);
    if (directCoilMatch) {
      targetCoils.add(directCoilMatch[1]);
      isCompositionalLine = true;
    }
    const directWeaveMatch = currentLine.match(/\bweave\s*:\s*["']?([_a-zA-Z0-9]+)["']?/);
    if (directWeaveMatch) {
      targetWeaves.add(directWeaveMatch[1]);
      isCompositionalLine = true;
    }

    // B. Concat or parents array/list/scalar
    if (/^\s*(concat|parents)\s*:/i.test(currentLine)) {
      isCompositionalLine = true;
      const idsMatch = currentLine.match(/\[(.*?)\]/);
      if (idsMatch) {
        idsMatch[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean).forEach(id => targetCoils.add(id));
      } else {
        const singleMatch = currentLine.match(/(?:concat|parents)\s*:\s*["']?([_a-zA-Z0-9]+)["']?/i);
        if (singleMatch) {
          targetCoils.add(singleMatch[1]);
        }
      }

      // Also add enclosing coil that owns this parents or concat declaration
      for (let l = currentLineNum - 1; l >= 0; l--) {
        const lText = lines[l];
        const idMatch = lText.match(/^\s*id\s*:\s*["']?([_a-zA-Z0-9]+)["']?/);
        if (idMatch) { targetCoils.add(idMatch[1]); break; }
        const coilRefMatch = lText.match(/^\s*-\s*coil\s*:\s*["']?([_a-zA-Z0-9]+)["']?/);
        if (coilRefMatch) { targetCoils.add(coilRefMatch[1]); break; }
        const dictMatch = lText.match(/^\s*([_a-zA-Z0-9]+)\s*:/);
        if (dictMatch && !EXCLUDED_KEYS.has(dictMatch[1].toLowerCase())) {
          targetCoils.add(dictMatch[1]);
          break;
        }
      }
    } else {
      // Check if inside a concat or parents bullet list
      for (let l = currentLineNum - 1; l >= Math.max(0, currentLineNum - 10); l--) {
        const prevL = lines[l];
        if (/^\s*(concat|parents)\s*:/i.test(prevL)) {
          isCompositionalLine = true;
          const coilValMatch = currentLine.match(/^\s*-\s*coil\s*:\s*["']?([_a-zA-Z0-9]+)["']?/i);
          if (coilValMatch) {
            targetCoils.add(coilValMatch[1]);
          } else {
            const bulletMatch = currentLine.match(/^\s*-\s*["']?([_a-zA-Z0-9]+)["']?/);
            if (bulletMatch && bulletMatch[1] !== 'coil' && bulletMatch[1] !== 'weave') {
              targetCoils.add(bulletMatch[1]);
            }
          }
          break;
        }
        if (/^\s*[a-zA-Z0-9_]+\s*:/.test(prevL) && !/^\s*-\s+/.test(prevL)) break;
      }
    }

    // C. Children section
    if (/^\s*children\s*:/i.test(currentLine)) {
      isCompositionalLine = true;
      for (let l = currentLineNum - 1; l >= 0; l--) {
        const prevL = lines[l];
        const wMatch = prevL.match(/^\s*([_a-zA-Z0-9]+)\s*:/);
        if (wMatch && !['weaves', 'coils', 'tapestry', 'knot'].includes(wMatch[1])) {
          targetWeaves.add(wMatch[1]);
          break;
        }
      }
    }

    // D. Structure definition header: id: <name> or <name>: under coils or weaves
    const idDefMatch = currentLine.match(/^\s*id\s*:\s*["']?([_a-zA-Z0-9]+)["']?/);
    if (idDefMatch && declaredIdsCache && declaredIdsCache.has(idDefMatch[1])) {
      targetCoils.add(idDefMatch[1]);
      isCompositionalLine = true;
    }
    const dictHeaderMatch = currentLine.match(/^\s*([_a-zA-Z0-9]+)\s*:/);
    if (dictHeaderMatch && declaredIdsCache && declaredIdsCache.has(dictHeaderMatch[1])) {
      targetCoils.add(dictHeaderMatch[1]);
      isCompositionalLine = true;
    }

    if (!isCompositionalLine || (targetCoils.size === 0 && targetWeaves.size === 0)) {
      // Non-declarative, non-compositional line (metadata, settings, etc.) -> CLEAR ALL
      previewElements.forEach(el => {
        el.classList.remove('score-highlight-active', 'score-highlight-primary');
      });
      return;
    }

    // Highlight all elements belonging to target compositional structures
    previewElements.forEach(el => {
      let isMatch = false;

      if (targetCoils.size > 0) {
        for (const c of targetCoils) {
          if (
            el.dataset.coilId === c ||
            el.dataset.sourceCoilId === c ||
            el.dataset.melodySourceCoil === c ||
            el.dataset.rhythmSourceCoil === c ||
            el.dataset.harmonySourceCoil === c
          ) {
            isMatch = true;
            break;
          }
        }
      }

      if (!isMatch && targetWeaves.size > 0) {
        for (const w of targetWeaves) {
          if (el.dataset.weaveId === w) {
            isMatch = true;
            break;
          }
        }
      }

      if (isMatch) {
        el.classList.add('score-highlight-active');
        el.classList.remove('score-highlight-primary');
      } else {
        el.classList.remove('score-highlight-active', 'score-highlight-primary');
      }
    });
  });
}

// --- Rendering Functions ---
async function renderPdfPages() {
  if (!currentPdfDoc || isRenderingPdf) return;
  isRenderingPdf = true;
  const prevScrollTop = shouldResetPreviewScroll ? 0 : (scoreCanvas ? scoreCanvas.scrollTop : 0);
  const prevScrollLeft = shouldResetPreviewScroll ? 0 : (scoreCanvas ? scoreCanvas.scrollLeft : 0);
  shouldResetPreviewScroll = false;

  try {
    scorePlaceholder.style.display = 'none';
    scoreSvgContainer.innerHTML = '';

    const numPages = currentPdfDoc.numPages;
    const containerWidth = scoreCanvas.clientWidth - 40;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await currentPdfDoc.getPage(pageNum);
      const unscaledViewport = page.getViewport({ scale: 1.0 });

      let scale = currentZoom;
      if (pdfZoomMode === 'FitH') {
        scale = Math.max(containerWidth / unscaledViewport.width, 0.4);
      }

      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: scale * dpr });
      const displayViewport = page.getViewport({ scale: scale });

      const pageWrapper = document.createElement('div');
      pageWrapper.className = 'pdf-page-wrapper';
      pageWrapper.style.width = `${viewport.width / dpr}px`;
      pageWrapper.style.height = `${viewport.height / dpr}px`;

      const canvas = document.createElement('canvas');
      canvas.className = 'pdf-page-canvas';
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      pageWrapper.appendChild(canvas);

      // Fetch annotations from page (LilyPond Point & Click)
      const annotations = await page.getAnnotations();
      if (annotations && annotations.length > 0) {
        const annotLayer = document.createElement('div');
        annotLayer.className = 'pdf-annotation-layer';

        annotations.forEach(annot => {
          const rawUrl = annot.unsafeUrl || annot.url || '';
          if (rawUrl && (rawUrl.startsWith('textedit:') || rawUrl.includes('textedit'))) {
            const rect = displayViewport.convertToViewportRectangle(annot.rect);
            const minX = Math.min(rect[0], rect[2]);
            const minY = Math.min(rect[1], rect[3]);
            const width = Math.abs(rect[2] - rect[0]);
            const height = Math.abs(rect[3] - rect[1]);

            const linkEl = document.createElement('div');
            linkEl.className = 'pdf-point-click-link';
            linkEl.style.position = 'absolute';
            linkEl.style.left = `${minX - 2}px`;
            linkEl.style.top = `${minY - 2}px`;
            linkEl.style.width = `${Math.max(width + 4, 16)}px`;
            linkEl.style.height = `${Math.max(height + 4, 16)}px`;
            linkEl.style.cursor = 'pointer';
            linkEl.style.pointerEvents = 'auto';
            linkEl.title = `Point & Click: Jump to source in YAML`;

            // Attach decoded provenance metadata for real-time highlighting
            const match = rawUrl.match(/:(\d+)(?::(\d+))?(?::(\d+))?$/);
            if (match) {
              const lyLineNum = parseInt(match[1], 10);
              const tagInfo = resolveTagFromLyLine(lyLineNum);
              if (tagInfo) {
                linkEl.dataset.tag = tagInfo.rawTag || '';
                linkEl.dataset.coilId = tagInfo.coilId || '';
                linkEl.dataset.sourceCoilId = tagInfo.sourceCoilId || '';
                linkEl.dataset.melodySourceCoil = tagInfo.melodySourceCoil || '';
                linkEl.dataset.rhythmSourceCoil = tagInfo.rhythmSourceCoil || '';
                linkEl.dataset.harmonySourceCoil = tagInfo.harmonySourceCoil || '';
                linkEl.dataset.weaveId = tagInfo.weaveId || '';
                linkEl.dataset.layer = tagInfo.targetLayer || '';
                linkEl.dataset.voiceIndex = String(tagInfo.voiceIndex || '1');
                linkEl.dataset.onsetIndex = String(tagInfo.onsetIndex || '');
                linkEl.dataset.sourceOnsetIndex = String(tagInfo.sourceOnsetIndex || '');
              }
            }

            linkEl.addEventListener('click', (e) => {
              e.stopPropagation();
              handlePointAndClick(rawUrl);
            });

            annotLayer.appendChild(linkEl);
          }
        });

        pageWrapper.appendChild(annotLayer);
      }

      const ctx = canvas.getContext('2d');
      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
      };

      scoreSvgContainer.appendChild(pageWrapper);
      await page.render(renderContext).promise;
    }

    zoomLevel.textContent = pdfZoomMode === 'FitH' ? 'Fit' : `${Math.round(currentZoom * 100)}%`;
    updateScoreHighlights(editor);

    // Restore scroll depth after rendering
    if (scoreCanvas) {
      scoreCanvas.scrollTop = prevScrollTop;
      scoreCanvas.scrollLeft = prevScrollLeft;
      requestAnimationFrame(() => {
        if (scoreCanvas) {
          scoreCanvas.scrollTop = prevScrollTop;
          scoreCanvas.scrollLeft = prevScrollLeft;
        }
      });
    }
  } catch (err) {
    console.error('Error rendering PDF pages:', err);
  } finally {
    isRenderingPdf = false;
  }
}

async function renderPreview(data) {
  const prevScrollTop = shouldResetPreviewScroll ? 0 : (scoreCanvas ? scoreCanvas.scrollTop : 0);
  const prevScrollLeft = shouldResetPreviewScroll ? 0 : (scoreCanvas ? scoreCanvas.scrollLeft : 0);
  shouldResetPreviewScroll = false;

  if (data.format === 'pdf' && data.pdfBase64) {
    lastPdfBase64 = data.pdfBase64;
    try {
      const binaryString = atob(data.pdfBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      currentPdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
      await renderPdfPages();
      return;
    } catch (err) {
      console.error('PDF.js parse error:', err);
    }
  }

  if (data.svg) {
    currentPdfDoc = null;
    scorePlaceholder.style.display = 'none';
    scoreSvgContainer.innerHTML = data.svg;
    
    // Tag SVG <a> elements with metadata
    const svgLinks = scoreSvgContainer.querySelectorAll('a');
    svgLinks.forEach(link => {
      const href = link.getAttribute('xlink:href') || link.getAttribute('href');
      if (href && href.startsWith('textedit:')) {
        const match = href.match(/:(\d+)(?::(\d+))?(?::(\d+))?$/);
        if (match) {
          const lyLineNum = parseInt(match[1], 10);
          const tagInfo = resolveTagFromLyLine(lyLineNum);
          if (tagInfo) {
            link.dataset.tag = tagInfo.rawTag || '';
            link.dataset.coilId = tagInfo.coilId || '';
            link.dataset.sourceCoilId = tagInfo.sourceCoilId || '';
            link.dataset.melodySourceCoil = tagInfo.melodySourceCoil || '';
            link.dataset.rhythmSourceCoil = tagInfo.rhythmSourceCoil || '';
            link.dataset.harmonySourceCoil = tagInfo.harmonySourceCoil || '';
            link.dataset.weaveId = tagInfo.weaveId || '';
            link.dataset.layer = tagInfo.targetLayer || '';
            link.dataset.voiceIndex = String(tagInfo.voiceIndex || '1');
            link.dataset.onsetIndex = String(tagInfo.onsetIndex || '');
            link.dataset.sourceOnsetIndex = String(tagInfo.sourceOnsetIndex || '');
          }
        }
      }
    });

    applyZoom();
    updateScoreHighlights(editor);
    if (scoreCanvas) {
      scoreCanvas.scrollTop = prevScrollTop;
      scoreCanvas.scrollLeft = prevScrollLeft;
    }
    return;
  }

  scorePlaceholder.style.display = 'block';
  scoreSvgContainer.innerHTML = '';
}

// SVG Click listener for Point & Click
scoreSvgContainer.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (link) {
    const href = link.getAttribute('xlink:href') || link.getAttribute('href');
    if (href && href.startsWith('textedit://')) {
      e.preventDefault();
      handlePointAndClick(href);
    }
  }
});

function renderSvg(svgString) {
  renderPreview({ svg: svgString });
}

function renderLilyPond(lySource) {
  lilypondCode.textContent = lySource || '';
}

function renderOnsets(onsets) {
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

// --- UI State Helpers ---
function setStatus(type, text) {
  statusBadge.className = `badge ${type}`;
  statusBadge.textContent = text;
}

function setDirty(dirty) {
  isDirty = dirty;
  saveStatus.className = `save-status ${dirty ? 'unsaved' : ''}`;
  saveStatus.textContent = dirty ? 'Unsaved' : 'Saved';
}

function showError(msg) {
  errorContent.textContent = msg;
  errorBanner.classList.remove('hidden');
}

function hideError() {
  errorBanner.classList.add('hidden');
  errorContent.textContent = '';
}

function applyZoom() {
  scoreSvgContainer.style.transform = `scale(${currentZoom})`;
  zoomLevel.textContent = `${Math.round(currentZoom * 100)}%`;
}

// --- Event Listeners ---
window.addEventListener('beforeunload', (e) => {
  if (isDirty) {
    e.preventDefault();
    e.returnValue = '';
    return '';
  }
});

scoreSelect.addEventListener('change', (e) => {
  if (e.target.value) {
    currentKnotId = null; // reset knot selection on score switch
    loadScore(e.target.value);
  }
});

if (knotSelect) {
  knotSelect.addEventListener('change', (e) => {
    const selectedKnot = e.target.value;
    if (selectedKnot) {
      currentKnotId = selectedKnot;
      if (currentScoreFile) {
        updateUrlAndStorage(currentScoreFile, selectedKnot);
      }
      triggerCompile(selectedKnot);
    }
  });
}

window.addEventListener('popstate', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const paramScore = urlParams.get('score');
  const paramKnot = urlParams.get('knot');

  let scoreChanged = false;

  if (paramScore && scoreSelect.options.length > 0) {
    const cleanParam = paramScore.toLowerCase().replace(/^scores[\\/]/, '');
    for (let i = 0; i < scoreSelect.options.length; i++) {
      const opt = scoreSelect.options[i];
      if (opt.value.toLowerCase().endsWith(cleanParam)) {
        if (opt.value !== currentScoreFile) {
          if (!confirmDiscardUnsavedChanges()) {
            if (currentScoreFile) {
              updateUrlAndStorage(currentScoreFile, currentKnotId);
            }
            return;
          }
          scoreSelect.value = opt.value;
          currentKnotId = paramKnot || null;
          scoreChanged = true;
          loadScore(opt.value, true);
        }
        break;
      }
    }
  }

  if (!scoreChanged && paramKnot !== undefined && paramKnot !== currentKnotId) {
    currentKnotId = paramKnot;
    if (knotSelect && paramKnot) knotSelect.value = paramKnot;
    triggerCompile(paramKnot);
  }
});

btnNewScore.addEventListener('click', () => {
  createTapestry();
});

if (btnDeleteScore) {
  btnDeleteScore.addEventListener('click', () => {
    deleteTapestry();
  });
}

btnCompile.addEventListener('click', () => triggerCompile());

if (chkAutocompile) {
  chkAutocompile.checked = enableAutocompile;
  chkAutocompile.addEventListener('change', (e) => {
    setAutocompile(e.target.checked);
  });
}

btnSave.addEventListener('click', () => saveScore());
btnExportPdf.addEventListener('click', () => exportStandalonePdf());

// Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    const tabId = btn.dataset.tab;
    document.getElementById(tabId)?.classList.add('active');
    if (tabId === 'score-view' && currentPdfDoc) {
      renderPdfPages();
    }
  });
});

// Zoom Controls
btnZoomIn.addEventListener('click', () => {
  if (currentPdfDoc) {
    pdfZoomMode = 'percent';
    currentZoom = Math.min(currentZoom + 0.15, 3.0);
    renderPdfPages();
  } else {
    currentZoom = Math.min(currentZoom + 0.15, 3.0);
    applyZoom();
  }
});

btnZoomOut.addEventListener('click', () => {
  if (currentPdfDoc) {
    pdfZoomMode = 'percent';
    currentZoom = Math.max(currentZoom - 0.15, 0.3);
    renderPdfPages();
  } else {
    currentZoom = Math.max(currentZoom - 0.15, 0.3);
    applyZoom();
  }
});

btnZoomReset.addEventListener('click', () => {
  currentZoom = 1.0;
  if (currentPdfDoc) {
    pdfZoomMode = 'percent';
    renderPdfPages();
  } else {
    applyZoom();
  }
});

btnZoomFit.addEventListener('click', () => {
  if (currentPdfDoc) {
    pdfZoomMode = 'FitH';
    renderPdfPages();
  } else {
    const containerWidth = scoreCanvas.clientWidth - 48;
    const svgElem = scoreSvgContainer.querySelector('svg');
    if (svgElem) {
      const svgWidth = svgElem.clientWidth || svgElem.getBoundingClientRect().width || 800;
      currentZoom = Math.min(Math.max(containerWidth / svgWidth, 0.4), 2.0);
      applyZoom();
    }
  }
});

// Auto-resize on window change if in Fit mode
window.addEventListener('resize', () => {
  if (pdfZoomMode === 'FitH' && currentPdfDoc) {
    renderPdfPages();
  }
});

btnCopyLy.addEventListener('click', () => {
  navigator.clipboard.writeText(lilypondCode.textContent);
  btnCopyLy.textContent = 'Copied!';
  setTimeout(() => { btnCopyLy.textContent = 'Copy Code'; }, 1500);
});

// --- Preference & Setting Helpers ---
function setAutocompile(enabled) {
  enableAutocompile = enabled;
  localStorage.setItem('ppt_autocompile', String(enableAutocompile));
  if (chkAutocompile) chkAutocompile.checked = enableAutocompile;
  if (settingEnableAutocompile) settingEnableAutocompile.checked = enableAutocompile;
  setStatus('ready', `Auto-compile: ${enableAutocompile ? 'ON' : 'OFF'}`);
}

function toggleAutocompile() {
  setAutocompile(!enableAutocompile);
}

function toggleSolfegeColors() {
  enableSolfegeColors = !enableSolfegeColors;
  localStorage.setItem('ppt_enable_solfege_colors', String(enableSolfegeColors));
  if (settingEnableSolfegeColors) settingEnableSolfegeColors.checked = enableSolfegeColors;
  if (enableSolfegeColors) {
    editor.addOverlay(solfegeOverlay);
  } else {
    editor.removeOverlay(solfegeOverlay);
  }
  setStatus('ready', `Solfège Colors: ${enableSolfegeColors ? 'ON' : 'OFF'}`);
}

function toggleSolfegeContext() {
  enableSolfegeContext = !enableSolfegeContext;
  localStorage.setItem('ppt_enable_solfege_context', String(enableSolfegeContext));
  if (settingEnableSolfegeContext) settingEnableSolfegeContext.checked = enableSolfegeContext;
  updateInlineSolfegeWidget();
  setStatus('ready', `Melody Preview: ${enableSolfegeContext ? 'ON' : 'OFF'}`);
}

function toggleAutocomplete() {
  enableAutocomplete = !enableAutocomplete;
  localStorage.setItem('ppt_enable_autocomplete', String(enableAutocomplete));
  if (settingEnableAutocomplete) settingEnableAutocomplete.checked = enableAutocomplete;
  setStatus('ready', `Autocompletion: ${enableAutocomplete ? 'ON' : 'OFF'}`);
}

function toggleCoilSuggestions() {
  enableCoilSuggestions = !enableCoilSuggestions;
  localStorage.setItem('ppt_enable_coil_suggestions', String(enableCoilSuggestions));
  if (settingEnableCoilSuggestions) settingEnableCoilSuggestions.checked = enableCoilSuggestions;
  setStatus('ready', `Coil Suggestions: ${enableCoilSuggestions ? 'ON' : 'OFF'}`);
}

function openSettingsModal() {
  btnSettings.click();
}

// --- Settings Modal & Preferences ---
let loupeSize = parseInt(localStorage.getItem('ppt_loupe_size') || '220', 10);
let loupePower = parseFloat(localStorage.getItem('ppt_loupe_power') || '2.5');

if (settingLoupeSize && labelLoupeSize) {
  settingLoupeSize.addEventListener('input', (e) => {
    labelLoupeSize.textContent = `${e.target.value} px`;
  });
}

if (settingLoupePower && labelLoupePower) {
  settingLoupePower.addEventListener('input', (e) => {
    labelLoupePower.textContent = `${e.target.value}x`;
  });
}

btnSettings.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    settingLilypondPath.value = data.lilypondPath || '';
    settingStatusHint.textContent = data.exists ? '✓ LilyPond binary verified' : '⚠️ Binary not found at path';
    settingStatusHint.style.color = data.exists ? 'var(--success)' : 'var(--danger)';

    if (settingLoupeSize && labelLoupeSize) {
      settingLoupeSize.value = loupeSize;
      labelLoupeSize.textContent = `${loupeSize} px`;
    }
    if (settingLoupePower && labelLoupePower) {
      settingLoupePower.value = loupePower;
      labelLoupePower.textContent = `${loupePower}x`;
    }

    if (settingEnableAutocompile) {
      settingEnableAutocompile.checked = enableAutocompile;
    }
    if (settingEnableAutocomplete) {
      settingEnableAutocomplete.checked = enableAutocomplete;
    }
    if (settingEnableSolfegeColors) {
      settingEnableSolfegeColors.checked = enableSolfegeColors;
    }
    if (settingEnableCoilSuggestions) {
      settingEnableCoilSuggestions.checked = enableCoilSuggestions;
    }
    if (settingEnableSolfegeContext) {
      settingEnableSolfegeContext.checked = enableSolfegeContext;
    }

    settingsModal.classList.remove('hidden');
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
});

btnCloseSettings.addEventListener('click', () => {
  settingsModal.classList.add('hidden');
});

btnSaveSettings.addEventListener('click', async () => {
  const newPath = settingLilypondPath.value.trim();
  if (settingLoupeSize) {
    loupeSize = parseInt(settingLoupeSize.value, 10);
    localStorage.setItem('ppt_loupe_size', String(loupeSize));
  }
  if (settingLoupePower) {
    loupePower = parseFloat(settingLoupePower.value);
    localStorage.setItem('ppt_loupe_power', String(loupePower));
  }

  if (settingEnableAutocompile) {
    setAutocompile(settingEnableAutocompile.checked);
  }
  if (settingEnableAutocomplete) {
    enableAutocomplete = settingEnableAutocomplete.checked;
    localStorage.setItem('ppt_enable_autocomplete', String(enableAutocomplete));
  }
  if (settingEnableSolfegeColors) {
    const prev = enableSolfegeColors;
    enableSolfegeColors = settingEnableSolfegeColors.checked;
    localStorage.setItem('ppt_enable_solfege_colors', String(enableSolfegeColors));
    if (enableSolfegeColors && !prev) {
      editor.addOverlay(solfegeOverlay);
    } else if (!enableSolfegeColors && prev) {
      editor.removeOverlay(solfegeOverlay);
    }
  }
  if (settingEnableCoilSuggestions) {
    enableCoilSuggestions = settingEnableCoilSuggestions.checked;
    localStorage.setItem('ppt_enable_coil_suggestions', String(enableCoilSuggestions));
  }
  if (settingEnableSolfegeContext) {
    enableSolfegeContext = settingEnableSolfegeContext.checked;
    localStorage.setItem('ppt_enable_solfege_context', String(enableSolfegeContext));
    updateInlineSolfegeWidget();
  }

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lilypondPath: newPath }),
    });
    const data = await res.json();
    alert(data.exists ? 'Settings saved! LilyPond verified.' : 'Settings saved, but LilyPond binary was not found at specified path.');
    settingsModal.classList.add('hidden');
  } catch (err) {
    alert('Failed to save backend settings');
    settingsModal.classList.add('hidden');
  }
});

// --- Magnifier Lens (Loupe) Logic ---
let isMagnifierToggled = false;
let isShiftHeld = false;

function updateMagnifier(e) {
  const active = isMagnifierToggled || isShiftHeld || e.shiftKey;
  if (!active) {
    if (magnifierLens) magnifierLens.classList.add('hidden');
    return;
  }

  // Find canvas element under cursor
  const elements = document.elementsFromPoint(e.clientX, e.clientY);
  const targetCanvas = elements.find(el => el.classList && el.classList.contains('pdf-page-canvas'));

  if (!targetCanvas || !magnifierCanvas || !magnifierCtx) {
    if (magnifierLens) magnifierLens.classList.add('hidden');
    return;
  }

  magnifierLens.classList.remove('hidden');
  magnifierLens.style.width = `${loupeSize}px`;
  magnifierLens.style.height = `${loupeSize}px`;
  magnifierLens.style.left = `${e.clientX}px`;
  magnifierLens.style.top = `${e.clientY}px`;

  const rect = targetCanvas.getBoundingClientRect();
  const relX = (e.clientX - rect.left) * (targetCanvas.width / rect.width);
  const relY = (e.clientY - rect.top) * (targetCanvas.height / rect.height);

  const dpr = window.devicePixelRatio || 1;
  magnifierCanvas.width = loupeSize * dpr;
  magnifierCanvas.height = loupeSize * dpr;

  const srcW = (loupeSize / loupePower) * (targetCanvas.width / rect.width);
  const srcH = (loupeSize / loupePower) * (targetCanvas.height / rect.height);
  const srcX = relX - srcW / 2;
  const srcY = relY - srcH / 2;

  magnifierCtx.clearRect(0, 0, magnifierCanvas.width, magnifierCanvas.height);
  magnifierCtx.fillStyle = '#ffffff';
  magnifierCtx.fillRect(0, 0, magnifierCanvas.width, magnifierCanvas.height);
  magnifierCtx.drawImage(targetCanvas, srcX, srcY, srcW, srcH, 0, 0, magnifierCanvas.width, magnifierCanvas.height);
}

if (btnToggleMagnifier) {
  btnToggleMagnifier.addEventListener('click', () => {
    isMagnifierToggled = !isMagnifierToggled;
    btnToggleMagnifier.classList.toggle('active', isMagnifierToggled);
    if (!isMagnifierToggled && !isShiftHeld && magnifierLens) {
      magnifierLens.classList.add('hidden');
    }
  });
}

if (scoreCanvas) {
  scoreCanvas.addEventListener('mousemove', updateMagnifier);
  scoreCanvas.addEventListener('mouseleave', () => {
    if (magnifierLens) magnifierLens.classList.add('hidden');
  });
}

// --- Refactoring & YAML AST Analyzer Helpers ---

function getLineIndent(line) {
  const m = line.match(/^(\s*)/);
  return m ? m[1].length : 0;
}

function getEnclosingCoilAtPos(cm, pos) {
  if (!cm || !pos) return null;
  const lineCount = cm.lineCount();
  const curLineNo = pos.line;
  const curLine = cm.getLine(curLineNo);

  let startLine = -1;
  let coilType = null;
  let coilId = null;
  let baseIndent = 0;

  for (let l = curLineNo; l >= 0; l--) {
    const line = cm.getLine(l);
    if (/^\s*#/.test(line) || line.trim() === '') continue;

    // Inline child coil: "- coil:"
    const inlineMatch = line.match(/^(\s*)-\s*coil\s*:(.*)$/i);
    if (inlineMatch) {
      startLine = l;
      coilType = 'inline';
      baseIndent = inlineMatch[1].length;
      break;
    }

    // Dictionary coil key inside coils:
    const dictMatch = line.match(/^(\s*)([_a-zA-Z0-9]+)\s*:(?!\s*\[)(.*)$/);
    if (dictMatch) {
      const key = dictMatch[2];
      const EXCLUDED_COIL_KEYS = new Set([
        'tapestry', 'knot', 'engraving', 'weaves', 'coils', 'children',
        'melody', 'rhythm', 'harmony', 'chords', 'pitches', 'concat',
        'parents', 'parent', 'show', 'song', 'title', 'composer', 'arranger',
        'tempo', 'tonic', 'colorNotes', 'omitStem', 'octave', 'meter',
        'duration', 'harmonyOctave', 'harmonyClef', 'melodyClef',
        'voice', 'voices', 'harmonyStaffStyle', 'showHarmonyCoil',
        'showTraditionalHarmony', 'harmonyChangesOnly', 'color',
        'harmonyVoicing', 'melodyAugmentation', 'melodyAugmentationDisplay',
        'projection', 'id'
      ]);

      if (!EXCLUDED_COIL_KEYS.has(key.toLowerCase())) {
        let isUnderCoils = false;
        for (let p = l - 1; p >= 0; p--) {
          const pLine = cm.getLine(p);
          if (/^\s*coils\s*:/i.test(pLine) && getLineIndent(pLine) < dictMatch[1].length) {
            isUnderCoils = true;
            break;
          }
          if (getLineIndent(pLine) <= dictMatch[1].length && /^\s*[a-zA-Z0-9_]+\s*:/i.test(pLine) && !/^\s*coils\s*:/i.test(pLine)) {
            break;
          }
        }
        if (isUnderCoils) {
          startLine = l;
          coilType = 'dict';
          coilId = key;
          baseIndent = dictMatch[1].length;
          break;
        }
      }
    }

    if (/^\s*(weaves|tapestry|knot)\s*:/i.test(line) && getLineIndent(line) <= getLineIndent(curLine)) {
      break;
    }
  }

  if (startLine === -1) return null;

  let endLine = startLine;
  for (let l = startLine + 1; l < lineCount; l++) {
    const line = cm.getLine(l);
    if (line.trim() === '' || /^\s*#/.test(line)) {
      endLine = l;
      continue;
    }
    const indent = getLineIndent(line);
    if (coilType === 'inline') {
      if (indent <= baseIndent || /^\s*-\s*/.test(line)) {
        break;
      }
    } else {
      if (indent <= baseIndent) {
        break;
      }
    }
    endLine = l;
  }

  const fields = {};
  let inHarmonyBlock = false;
  let harmonyBlockIndent = 0;

  for (let l = startLine; l <= endLine; l++) {
    const line = cm.getLine(l);
    if (/^\s*#/.test(line) || !line.trim()) continue;
    const indent = getLineIndent(line);

    const idMatch = line.match(/\bid\s*:\s*["']?([_a-zA-Z0-9]+)["']?/);
    if (idMatch && !coilId) {
      coilId = idMatch[1];
      fields.id = { line: l, value: coilId, fullText: line };
    }

    if (/^\s*harmony\s*:/i.test(line)) {
      const val = line.replace(/^\s*harmony\s*:\s*/i, '').trim();
      fields.harmony = { line: l, value: val, fullText: line };
      inHarmonyBlock = true;
      harmonyBlockIndent = indent;
      continue;
    }

    if (inHarmonyBlock) {
      if (indent <= harmonyBlockIndent && /^\s*[_a-zA-Z0-9]+\s*:/i.test(line) && !/^\s*-\s+/.test(line)) {
        inHarmonyBlock = false;
      }
    }

    if (inHarmonyBlock) {
      if (/^\s*chords\s*:/i.test(line) || /^\s*-\s*chords\s*:/i.test(line)) {
        const val = line.replace(/^\s*(?:-\s*)?chords\s*:\s*/i, '').trim();
        fields.chords = { line: l, value: val, fullText: line };
      } else if (/^\s*rhythm\s*:/i.test(line)) {
        const val = line.replace(/^\s*rhythm\s*:\s*/i, '').trim();
        fields.harmonyRhythm = { line: l, value: val, fullText: line };
      }
    } else {
      if (/^\s*melody\s*:/i.test(line) || /^\s*pitches\s*:/i.test(line)) {
        const val = line.replace(/^\s*(?:melody|pitches)\s*:\s*/i, '').trim();
        fields.melody = { line: l, value: val, fullText: line };
      } else if (/^\s*rhythm\s*:/i.test(line)) {
        const val = line.replace(/^\s*rhythm\s*:\s*/i, '').trim();
        fields.rhythm = { line: l, value: val, fullText: line };
      } else if (/^\s*chords\s*:/i.test(line)) {
        const val = line.replace(/^\s*chords\s*:\s*/i, '').trim();
        fields.chords = { line: l, value: val, fullText: line };
      } else if (/^\s*(?:parents|parent)\s*:/i.test(line)) {
        const val = line.replace(/^\s*(?:parents|parent)\s*:\s*/i, '').trim();
        fields.parents = { line: l, value: val, fullText: line };
      } else if (/^\s*concat\s*:/i.test(line)) {
        const val = line.replace(/^\s*concat\s*:\s*/i, '').trim();
        fields.concat = { line: l, value: val, fullText: line };
      }
    }
  }

  let enclosingWeave = null;
  for (let l = startLine - 1; l >= 0; l--) {
    const line = cm.getLine(l);
    const weaveMatch = line.match(/^(\s*)([_a-zA-Z0-9]+)\s*:(?!\s*\[)/);
    if (weaveMatch) {
      const key = weaveMatch[2];
      if (!['tapestry', 'knot', 'engraving', 'weaves', 'coils', 'children', 'melody', 'rhythm', 'harmony', 'concat', 'parents', 'show', 'song', 'title', 'composer', 'arranger', 'tempo', 'tonic', 'colorNotes', 'omitStem', 'id', 'parent'].includes(key)) {
        for (let p = l - 1; p >= 0; p--) {
          const pLine = cm.getLine(p);
          if (/^\s*weaves\s*:/i.test(pLine)) {
            enclosingWeave = key;
            break;
          }
        }
        if (enclosingWeave) break;
      }
    }
  }

  return {
    type: coilType,
    id: coilId,
    startLine,
    endLine,
    baseIndent,
    fields,
    enclosingWeave
  };
}

function triggerGoToDefinition(cm) {
  const cur = cm.getCursor();
  const target = getTargetIdAtPos(cm, cur);
  if (target) {
    const def = findDefinitionInYaml(cm.getValue(), target.id);
    if (def) {
      cm.setCursor(def);
      cm.scrollIntoView(def, 150);
      cm.addLineClass(def.line, 'background', 'cm-point-click-flash');
      setTimeout(() => {
        cm.removeLineClass(def.line, 'background', 'cm-point-click-flash');
      }, 1200);
      updateInlineSolfegeWidget();
      updatePairedTokenHighlights(cm);
      updateScoreHighlights(cm);
    }
  }
}

function foldAllSections(cm) {
  const lineCount = cm.lineCount();
  for (let l = 0; l < lineCount; l++) {
    cm.foldCode(CodeMirror.Pos(l, 0), null, 'fold');
  }
}

function unfoldAllSections(cm) {
  const lineCount = cm.lineCount();
  for (let l = 0; l < lineCount; l++) {
    cm.foldCode(CodeMirror.Pos(l, 0), null, 'unfold');
  }
}

function insertSnippetById(cm, snippetId) {
  const snip = SNIPPET_TEMPLATES.find(s => s.id === snippetId);
  if (!snip || !cm) return;
  const cur = cm.getCursor();
  const line = cm.getLine(cur.line);
  const baseIndentMatch = line.match(/^(\s*)/);
  const baseIndent = baseIndentMatch ? baseIndentMatch[1] : '';
  const indented = indentSnippet(snip.snippet, baseIndent);
  cm.replaceRange(indented, CodeMirror.Pos(cur.line, 0), CodeMirror.Pos(cur.line, line.length));
  cm.focus();
  updateDeclaredIdsCache(cm);
  updateScoreHighlights(cm);
}

// --- Refactoring Modal Manager ---
let refactorPromiseResolve = null;

function showRefactorDialog({ title, desc, fields, confirmText = 'Apply Refactoring' }) {
  return new Promise((resolve) => {
    refactorPromiseResolve = resolve;

    const modal = document.getElementById('refactor-modal');
    const titleEl = document.getElementById('refactor-title');
    const descEl = document.getElementById('refactor-desc');
    const fieldsEl = document.getElementById('refactor-fields');
    const btnConfirm = document.getElementById('btn-refactor-confirm');

    titleEl.textContent = title;
    descEl.textContent = desc;
    btnConfirm.textContent = confirmText;
    fieldsEl.innerHTML = '';

    fields.forEach((field) => {
      const formGroup = document.createElement('div');
      formGroup.className = 'refactor-form-group';

      if (field.label) {
        const label = document.createElement('label');
        label.textContent = field.label;
        if (field.id) label.htmlFor = field.id;
        formGroup.appendChild(label);
      }

      if (field.type === 'text') {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = field.id || `field_${field.name}`;
        input.name = field.name;
        input.value = field.value || '';
        input.className = 'input-text';
        if (field.placeholder) input.placeholder = field.placeholder;
        formGroup.appendChild(input);
      } else if (field.type === 'checkboxes') {
        const group = document.createElement('div');
        group.className = 'refactor-checkbox-group';
        field.options.forEach((opt) => {
          const lbl = document.createElement('label');
          lbl.className = 'refactor-checkbox-label';
          const chk = document.createElement('input');
          chk.type = 'checkbox';
          chk.name = field.name;
          chk.value = opt.id;
          chk.checked = !!opt.checked;
          lbl.appendChild(chk);
          const span = document.createElement('span');
          span.textContent = opt.label;
          lbl.appendChild(span);
          group.appendChild(lbl);
        });
        formGroup.appendChild(group);
      } else if (field.type === 'radios') {
        const group = document.createElement('div');
        group.className = 'refactor-radio-group';
        field.options.forEach((opt) => {
          const lbl = document.createElement('label');
          lbl.className = 'refactor-radio-label';
          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = field.name;
          radio.value = opt.id;
          radio.checked = !!opt.checked;
          lbl.appendChild(radio);
          const span = document.createElement('span');
          span.textContent = opt.label;
          lbl.appendChild(span);
          group.appendChild(lbl);
        });
      } else if (field.type === 'select') {
        const select = document.createElement('select');
        select.id = field.id || `field_${field.name}`;
        select.name = field.name;
        select.className = 'refactor-select';
        field.options.forEach((opt) => {
          const option = document.createElement('option');
          option.value = opt.id;
          option.textContent = opt.label;
          if (opt.id === field.value) option.selected = true;
          select.appendChild(option);
        });
        if (field.onChange) {
          select.addEventListener('change', (e) => field.onChange(e, fieldsEl));
        }
        formGroup.appendChild(select);
      } else if (field.type === 'html') {
        const htmlContainer = document.createElement('div');
        htmlContainer.innerHTML = field.html || '';
        formGroup.appendChild(htmlContainer);
      }

      fieldsEl.appendChild(formGroup);
    });

    modal.classList.remove('hidden');

    const firstInput = fieldsEl.querySelector('input[type="text"], select');
    if (firstInput) {
      setTimeout(() => {
        firstInput.focus();
        if (firstInput.select && firstInput.tagName === 'INPUT') firstInput.select();
      }, 50);
    }
  });
}

function closeRefactorDialog(confirmed = false) {
  const modal = document.getElementById('refactor-modal');
  if (modal) modal.classList.add('hidden');

  if (refactorPromiseResolve) {
    if (!confirmed) {
      refactorPromiseResolve({ confirmed: false });
    } else {
      const values = {};
      const fieldsEl = document.getElementById('refactor-fields');
      const textInputs = fieldsEl.querySelectorAll('input[type="text"]');
      textInputs.forEach(input => { values[input.name] = input.value.trim(); });

      const selects = fieldsEl.querySelectorAll('select');
      selects.forEach(sel => { values[sel.name] = sel.value; });

      const checkedBoxes = {};
      fieldsEl.querySelectorAll('input[type="checkbox"]').forEach(chk => {
        if (!checkedBoxes[chk.name]) checkedBoxes[chk.name] = [];
        if (chk.checked) checkedBoxes[chk.name].push(chk.value);
      });
      Object.assign(values, checkedBoxes);

      const checkedRadio = fieldsEl.querySelectorAll('input[type="radio"]:checked');
      checkedRadio.forEach(r => { values[r.name] = r.value; });

      refactorPromiseResolve({ confirmed: true, values });
    }
    refactorPromiseResolve = null;
  }
}

// --- Refactoring Operations Engine ---

async function extractParentCoil(cm) {
  const cur = cm.getCursor();
  const coil = getEnclosingCoilAtPos(cm, cur);

  if (!coil) {
    alert('Please place the cursor inside a coil (in coils: or children:) to extract a parent.');
    return;
  }

  const availableLayers = [];
  if (coil.fields.rhythm) availableLayers.push({ id: 'rhythm', label: `Rhythm (${coil.fields.rhythm.value})`, checked: true });
  if (coil.fields.harmony) availableLayers.push({ id: 'harmony', label: `Harmony (${coil.fields.harmony.value})`, checked: true });
  if (coil.fields.melody) availableLayers.push({ id: 'melody', label: `Melody (${coil.fields.melody.value})`, checked: !coil.fields.rhythm && !coil.fields.harmony });

  if (availableLayers.length === 0) {
    alert('The current coil does not have any extractable layers (melody, rhythm, harmony).');
    return;
  }

  const defaultId = `_parent_${coil.id || 'base'}`;

  const destinationOptions = [];
  if (coil.enclosingWeave) {
    destinationOptions.push({ id: 'weave', label: `Current Weave (${coil.enclosingWeave}) coils:`, checked: true });
    destinationOptions.push({ id: 'tapestry', label: 'Top-Level tapestry.coils:', checked: false });
  } else {
    destinationOptions.push({ id: 'tapestry', label: 'Top-Level tapestry.coils:', checked: true });
  }

  const result = await showRefactorDialog({
    title: 'Extract into Parent Coil',
    desc: `Extract shared layers from '${coil.id || 'current coil'}' into a reusable parent coil definition and link via parents:`,
    fields: [
      { type: 'text', name: 'parentId', label: 'New Parent Coil ID:', value: defaultId, placeholder: 'e.g. _verse_base' },
      { type: 'checkboxes', name: 'layers', label: 'Layers to Extract:', options: availableLayers },
      { type: 'radios', name: 'destination', label: 'Target Destination:', options: destinationOptions }
    ],
    confirmText: 'Extract Parent Coil'
  });

  if (!result.confirmed) return;

  const parentId = (result.values.parentId || '').trim();
  const selectedLayers = result.values.layers || [];
  const destination = result.values.destination || 'weave';

  if (!parentId) {
    alert('Parent Coil ID cannot be empty.');
    return;
  }
  if (selectedLayers.length === 0) {
    alert('Please select at least one layer to extract.');
    return;
  }

  const parentIndent = destination === 'weave' ? '      ' : '    ';
  const layerIndent = destination === 'weave' ? '        ' : '      ';
  const parentLines = [`${parentIndent}${parentId}:`];

  selectedLayers.forEach(layerName => {
    if (coil.fields[layerName]) {
      parentLines.push(`${layerIndent}${layerName}: ${coil.fields[layerName].value}`);
    }
  });
  const parentYaml = parentLines.join('\n');

  const docText = cm.getValue();
  const lines = docText.split('\n');

  let insertLine = -1;

  if (destination === 'weave' && coil.enclosingWeave) {
    let inTargetWeave = false;
    for (let l = 0; l < lines.length; l++) {
      const line = lines[l];
      if (new RegExp(`^\\s*${coil.enclosingWeave}\\s*:`).test(line)) {
        inTargetWeave = true;
        continue;
      }
      if (inTargetWeave) {
        if (/^\s*coils\s*:/i.test(line)) {
          insertLine = l + 1;
          break;
        }
        if (/^\s*children\s*:/i.test(line)) {
          lines.splice(l, 0, `    coils:`, parentYaml);
          insertLine = -2;
          break;
        }
        if (/^\s*[a-zA-Z0-9_]+\s*:/i.test(line) && getLineIndent(line) <= 4) {
          break;
        }
      }
    }
    if (insertLine === -1) {
      for (let l = 0; l < lines.length; l++) {
        if (new RegExp(`^\\s*${coil.enclosingWeave}\\s*:`).test(lines[l])) {
          lines.splice(l + 1, 0, `    coils:`, parentYaml);
          insertLine = -2;
          break;
        }
      }
    }
  } else {
    for (let l = 0; l < lines.length; l++) {
      if (/^\s*coils\s*:/i.test(lines[l])) {
        insertLine = l + 1;
        break;
      }
    }
    if (insertLine === -1) {
      for (let l = lines.length - 1; l >= 0; l--) {
        if (lines[l].trim() !== '') {
          lines.splice(l + 1, 0, `  coils:`, parentYaml);
          insertLine = -2;
          break;
        }
      }
    }
  }

  if (insertLine >= 0) {
    lines.splice(insertLine, 0, parentYaml);
  }

  cm.setValue(lines.join('\n'));

  const updatedCoil = getEnclosingCoilAtPos(cm, cm.getCursor());
  if (updatedCoil) {
    const linesToFilter = new Set(selectedLayers.map(l => updatedCoil.fields[l] ? updatedCoil.fields[l].line : -1));
    const currentLines = cm.getValue().split('\n');
    const childIndent = updatedCoil.type === 'inline' ? '        ' : '      ';
    let parentsAdded = false;

    for (let l = updatedCoil.startLine; l <= updatedCoil.endLine; l++) {
      if (linesToFilter.has(l)) {
        currentLines[l] = null;
      } else if (/^\s*(?:parents|parent)\s*:/i.test(currentLines[l])) {
        const existingVal = currentLines[l].replace(/^\s*(?:parents|parent)\s*:\s*/, '').trim();
        if (existingVal.startsWith('[') && existingVal.endsWith(']')) {
          const arr = existingVal.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
          if (!arr.includes(parentId)) arr.push(parentId);
          currentLines[l] = `${childIndent}parents: [${arr.join(', ')}]`;
        } else if (existingVal && existingVal !== parentId) {
          currentLines[l] = `${childIndent}parents: [${existingVal}, ${parentId}]`;
        } else {
          currentLines[l] = `${childIndent}parents: ${parentId}`;
        }
        parentsAdded = true;
      }
    }

    if (!parentsAdded) {
      let targetInsertPos = updatedCoil.startLine + 1;
      if (updatedCoil.fields.id) targetInsertPos = updatedCoil.fields.id.line + 1;
      currentLines.splice(targetInsertPos, 0, `${childIndent}parents: ${parentId}`);
    }

    const filtered = currentLines.filter(line => line !== null);
    cm.setValue(filtered.join('\n'));
  }

  updateDeclaredIdsCache(cm);
  updateScoreHighlights(cm);
  triggerCompile();
}

async function extractInlineCoil(cm) {
  const cur = cm.getCursor();
  const coil = getEnclosingCoilAtPos(cm, cur);

  if (!coil || coil.type !== 'inline') {
    alert('Please place cursor inside an inline child coil (- coil:) within a children block.');
    return;
  }

  const defaultId = coil.id || 'extracted_coil';

  const result = await showRefactorDialog({
    title: 'Extract Inline Coil to Named Coil',
    desc: 'Move this inline coil definition into the coils dictionary and replace with a named reference:',
    fields: [
      { type: 'text', name: 'coilId', label: 'New Coil ID:', value: defaultId, placeholder: 'e.g. verse_motif' }
    ],
    confirmText: 'Extract Named Coil'
  });

  if (!result.confirmed) return;

  const coilId = (result.values.coilId || '').trim();
  if (!coilId) {
    alert('Coil ID cannot be empty.');
    return;
  }

  const lines = cm.getValue().split('\n');
  const targetIndent = coil.enclosingWeave ? '      ' : '    ';
  const fieldIndent = coil.enclosingWeave ? '        ' : '      ';
  const defLines = [`${targetIndent}${coilId}:`];

  for (let l = coil.startLine; l <= coil.endLine; l++) {
    const line = lines[l];
    if (/^\s*-\s*coil\s*:/i.test(line) || /\bid\s*:/i.test(line)) continue;
    const stripped = line.trim();
    if (stripped) {
      defLines.push(`${fieldIndent}${stripped}`);
    }
  }

  const defYaml = defLines.join('\n');

  let inserted = false;
  if (coil.enclosingWeave) {
    let inTargetWeave = false;
    for (let l = 0; l < lines.length; l++) {
      if (new RegExp(`^\\s*${coil.enclosingWeave}\\s*:`).test(lines[l])) {
        inTargetWeave = true;
        continue;
      }
      if (inTargetWeave) {
        if (/^\s*coils\s*:/i.test(lines[l])) {
          lines.splice(l + 1, 0, defYaml);
          inserted = true;
          break;
        }
        if (/^\s*children\s*:/i.test(lines[l])) {
          lines.splice(l, 0, `    coils:`, defYaml);
          inserted = true;
          break;
        }
      }
    }
  }

  if (!inserted) {
    for (let l = 0; l < lines.length; l++) {
      if (/^\s*coils\s*:/i.test(lines[l])) {
        lines.splice(l + 1, 0, defYaml);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      lines.push(`  coils:`, defYaml);
    }
  }

  cm.setValue(lines.join('\n'));

  const updatedCoil = getEnclosingCoilAtPos(cm, cur);
  if (updatedCoil) {
    const updatedLines = cm.getValue().split('\n');
    const childIndentMatch = updatedLines[updatedCoil.startLine].match(/^(\s*)/);
    const childIndent = childIndentMatch ? childIndentMatch[1] : '        ';
    updatedLines.splice(updatedCoil.startLine, (updatedCoil.endLine - updatedCoil.startLine + 1), `${childIndent}- coil: ${coilId}`);
    cm.setValue(updatedLines.join('\n'));
  }

  updateDeclaredIdsCache(cm);
  updateScoreHighlights(cm);
  triggerCompile();
}

async function inlineParentCoil(cm) {
  const cur = cm.getCursor();
  const coil = getEnclosingCoilAtPos(cm, cur);

  if (!coil || !coil.fields.parents) {
    alert('The current coil does not have a parent coil defined (parents:).');
    return;
  }

  const parentRef = coil.fields.parents.value.replace(/[\[\]'"]/g, '').split(',')[0].trim();
  const def = findDefinitionInYaml(cm.getValue(), parentRef);

  if (!def) {
    alert(`Could not locate parent coil definition '${parentRef}' in score.`);
    return;
  }

  const parentCoil = getEnclosingCoilAtPos(cm, def);
  if (!parentCoil) {
    alert(`Could not parse parent coil '${parentRef}'.`);
    return;
  }

  const layersToCopy = [];
  ['melody', 'rhythm', 'harmony'].forEach(layer => {
    if (parentCoil.fields[layer] && !coil.fields[layer]) {
      layersToCopy.push({ layer, value: parentCoil.fields[layer].value });
    }
  });

  const lines = cm.getValue().split('\n');
  const childIndent = coil.type === 'inline' ? '        ' : '      ';

  lines.splice(coil.fields.parents.line, 1);

  layersToCopy.forEach((item, idx) => {
    lines.splice(coil.startLine + 1 + idx, 0, `${childIndent}${item.layer}: ${item.value}`);
  });

  cm.setValue(lines.join('\n'));
  updateDeclaredIdsCache(cm);
  updateScoreHighlights(cm);
  triggerCompile();
}

async function extractWeave(cm) {
  const selectedText = cm.getSelection();

  const defaultId = 'section_weave';

  const result = await showRefactorDialog({
    title: 'Group Selection into Weave',
    desc: 'Extract selected child items into a new named weave in the weaves dictionary:',
    fields: [
      { type: 'text', name: 'weaveId', label: 'New Weave ID:', value: defaultId, placeholder: 'e.g. chorus_part' }
    ],
    confirmText: 'Create Weave'
  });

  if (!result.confirmed) return;

  const weaveId = (result.values.weaveId || '').trim();
  if (!weaveId) {
    alert('Weave ID cannot be empty.');
    return;
  }

  const lines = cm.getValue().split('\n');
  const childrenContent = selectedText.trim()
    ? selectedText.split('\n').map(l => `      ${l.trim()}`).join('\n')
    : `      - coil: verse`;

  const newWeaveYaml = `    ${weaveId}:\n      children:\n${childrenContent}`;

  let insertLine = -1;
  for (let l = 0; l < lines.length; l++) {
    if (/^\s*weaves\s*:/i.test(lines[l])) {
      insertLine = l + 1;
      break;
    }
  }

  if (insertLine !== -1) {
    lines.splice(insertLine, 0, newWeaveYaml);
    cm.setValue(lines.join('\n'));

    if (selectedText.trim()) {
      cm.replaceSelection(`        - weave: ${weaveId}`);
    }
  }

  updateDeclaredIdsCache(cm);
  updateScoreHighlights(cm);
  triggerCompile();
}

async function renameSymbol(cm) {
  const cur = cm.getCursor();
  const target = getTargetIdAtPos(cm, cur);
  const oldId = target ? target.id : null;

  if (!oldId) {
    alert('Please place cursor on a coil or weave ID to rename.');
    return;
  }

  const result = await showRefactorDialog({
    title: `Rename Symbol '${oldId}'`,
    desc: `Rename '${oldId}' across its definition and all references (parents:, concat:, coil:, weave:, harmony:, rhythm:, melody:, from:, use:, etc.) throughout the score:`,
    fields: [
      { type: 'text', name: 'newId', label: 'New ID Name:', value: oldId, placeholder: 'e.g. verse_theme' }
    ],
    confirmText: 'Rename All References'
  });

  if (!result.confirmed) return;

  const newId = (result.values.newId || '').trim();
  if (!newId || newId === oldId) return;

  const docText = cm.getValue();
  const lines = docText.split('\n');
  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const oldIdEsc = escapeRegex(oldId);

  let replacementCount = 0;

  for (let l = 0; l < lines.length; l++) {
    let line = lines[l];
    if (/^\s*#/.test(line)) continue;

    const origLine = line;

    // 1. Definition as dictionary key (e.g. "  verse:")
    line = line.replace(new RegExp(`^(\\s*)${oldIdEsc}(\\s*:)`), `$1${newId}$2`);

    // 2. Definition / reference via id: (e.g. "id: verse")
    line = line.replace(new RegExp(`(\\bid\\s*:\\s*["']?)${oldIdEsc}(["']?)`, 'g'), `$1${newId}$2`);

    // 3. Properties referencing IDs: parents, parent, concat, harmony, chords, rhythm, melody, pitches, coil, weave, from, use
    line = line.replace(new RegExp(`(\\b(?:parents|parent|concat|harmony|chords|rhythm|melody|pitches|coil|weave|from|use)\\s*:\\s*)(.+)`, 'i'), (match, prefix, val) => {
      // Replace standalone word boundaries or dot-separated paths (e.g. "changes.harmony")
      const replacedVal = val.replace(new RegExp(`\\b${oldIdEsc}\\b`, 'g'), newId);
      return prefix + replacedVal;
    });

    // 4. List items (e.g. "  - verse_1" or "  - coil: verse_1" or "  - weave: verse_1")
    if (/^\s*-\s*/.test(line)) {
      line = line.replace(new RegExp(`^(\\s*-\\s*(?:(?:coil|weave)\\s*:\\s*["']?)?)${oldIdEsc}\\b`, 'g'), `$1${newId}`);
    }

    if (line !== origLine) {
      replacementCount++;
    }
    lines[l] = line;
  }

  cm.setValue(lines.join('\n'));
  updateDeclaredIdsCache(cm);
  updateScoreHighlights(cm);
  triggerCompile();

  if (typeof setStatus === 'function') {
    setStatus('ready', `Renamed '${oldId}' → '${newId}' across ${replacementCount} line(s)`);
  }
}

// --- Melody Interval <-> Absolute Conversion Refactoring ---

/**
 * PPT 12-chromatic Solfège base octave [-5, +6] centered on Do (0).
 * Lower bound: So (-5), Upper bound: Fi (+6).
 */
const BASE_OCTAVE_SYLLABLES = {
  '-5': 'So',
  '-4': 'Le',
  '-3': 'La',
  '-2': 'Te',
  '-1': 'Ti',
  '0': 'Do',
  '1': 'Ra',
  '2': 'Re',
  '3': 'Me',
  '4': 'Mi',
  '5': 'Fa',
  '6': 'Fi'
};

const SYLLABLE_TO_SEMITONE = {
  'do': 0, 'ra': 1, 'di': 1, 're': 2, 'me': 3, 'ri': 3,
  'mi': 4, 'fa': 5, 'se': 5, 'fi': 6,
  'so': -5, 'si': -5, 'le': -4, 'la': -3, 'li': -3, 'te': -2, 'ti': -1
};

function parseMelodyToken(token) {
  const clean = token.trim().replace(/^['"]|['"]$/g, '');
  if (!clean || clean === 'R' || clean === '~') {
    return { isRest: true, raw: clean };
  }

  if (/^\d+(?:\.\d+)?$/.test(clean)) {
    const parts = clean.split('.');
    return {
      isRepeat: true,
      count: parseInt(parts[0], 10),
      windowSize: parts[1] ? parseInt(parts[1], 10) : 1,
      raw: clean
    };
  }

  const m = clean.match(/^([a-zA-Z]+?)(x)?([\^_]*)(x)?$/);
  if (!m) {
    return { isUnknown: true, raw: clean };
  }

  let syllable = m[1];
  let hasAxis = Boolean(m[2] || m[4]);
  if (syllable.length > 2 && syllable.toLowerCase().endsWith('x') && !m[2] && !m[4]) {
    syllable = syllable.slice(0, -1);
    hasAxis = true;
  }

  const octStr = m[3] || '';
  let octShift = 0;
  for (const ch of octStr) {
    if (ch === '^') octShift++;
    else if (ch === '_') octShift--;
  }

  const lowerSyllable = syllable.toLowerCase();
  const baseSemitone = SYLLABLE_TO_SEMITONE[lowerSyllable] ?? 0;

  return {
    syllable,
    lowerSyllable,
    hasAxis,
    octShift,
    baseSemitone,
    raw: clean
  };
}

/**
 * Converts a signed semitone offset from Do into a canonical PPT Solfège token.
 * Base octave runs from So (-5) to Fi (+6).
 */
function semitonesToSolfege(semitones) {
  const base = ((semitones + 5) % 12 + 12) % 12 - 5;
  const oct = Math.round((semitones - base) / 12);
  const baseName = BASE_OCTAVE_SYLLABLES[base] || 'Do';

  if (oct > 0) {
    return baseName + '^'.repeat(oct);
  } else if (oct < 0) {
    return baseName + '_'.repeat(-oct);
  }
  return baseName;
}

function convertIntervalToAbsoluteMelody(tokenList) {
  if (!tokenList || tokenList.length === 0) return tokenList;

  const result = [];
  let currentOffset = 0;
  let hasAnchor = false;

  for (let i = 0; i < tokenList.length; i++) {
    const rawTok = tokenList[i].trim();
    if (!rawTok) continue;

    const parsed = parseMelodyToken(rawTok);
    if (parsed.isRest || parsed.isRepeat || parsed.isUnknown) {
      result.push(rawTok);
      continue;
    }

    if (!hasAnchor) {
      currentOffset = parsed.baseSemitone + (parsed.octShift * 12);
      result.push(semitonesToSolfege(currentOffset));
      hasAnchor = true;
    } else {
      const interval = parsed.baseSemitone + (parsed.octShift * 12);
      currentOffset += interval;
      result.push(semitonesToSolfege(currentOffset));
    }
  }

  return result;
}

function convertAbsoluteToIntervalMelody(tokenList) {
  if (!tokenList || tokenList.length === 0) return tokenList;

  const result = [];
  let prevOffset = null;

  for (let i = 0; i < tokenList.length; i++) {
    const rawTok = tokenList[i].trim();
    if (!rawTok) continue;

    const parsed = parseMelodyToken(rawTok);
    if (parsed.isRest || parsed.isRepeat || parsed.isUnknown) {
      result.push(rawTok);
      continue;
    }

    const currentOffset = parsed.baseSemitone + (parsed.octShift * 12);

    if (prevOffset === null) {
      const absName = semitonesToSolfege(currentOffset);
      const withAxis = absName.replace(/^([a-zA-Z]+)([\^_]*)$/, '$1x$2');
      result.push(withAxis);
      prevOffset = currentOffset;
    } else {
      const diff = currentOffset - prevOffset;
      const intervalTok = semitonesToSolfege(diff);
      result.push(intervalTok);
      prevOffset = currentOffset;
    }
  }

  return result;
}

function refactorConvertMelody(cm, targetMode = 'auto') {
  const cur = cm.getCursor();
  const curLineNo = cur.line;
  const curLineText = cm.getLine(curLineNo) || '';

  let targetLineNo = -1;
  let melodyArrayMatch = curLineText.match(/^(\s*(?:melody|pitches)\s*:\s*\[)(.*?)(\])\s*$/);

  if (melodyArrayMatch) {
    targetLineNo = curLineNo;
  } else {
    const coil = getEnclosingCoilAtPos(cm, cur);
    if (coil && coil.fields && coil.fields.melody) {
      targetLineNo = coil.fields.melody.line;
      const targetText = cm.getLine(targetLineNo) || '';
      melodyArrayMatch = targetText.match(/^(\s*(?:melody|pitches)\s*:\s*\[)(.*?)(\])\s*$/);
    }
  }

  // --- Inline array format: melody: [Do, Re, Mi] ---
  if (targetLineNo !== -1 && melodyArrayMatch) {
    const prefix = melodyArrayMatch[1];
    const innerTokensText = melodyArrayMatch[2];
    const suffix = melodyArrayMatch[3];

    const rawTokens = innerTokensText.split(',').map(s => s.trim()).filter(Boolean);
    if (rawTokens.length === 0) {
      alert('Melody array is empty.');
      return;
    }

    const firstParsed = parseMelodyToken(rawTokens[0]);
    const isCurrentlyInterval = firstParsed.hasAxis;

    let newTokens = [];
    let convertedTo = '';

    if (targetMode === 'absolute' || (targetMode === 'auto' && isCurrentlyInterval)) {
      newTokens = convertIntervalToAbsoluteMelody(rawTokens);
      convertedTo = 'Absolute';
    } else {
      newTokens = convertAbsoluteToIntervalMelody(rawTokens);
      convertedTo = 'Interval';
    }

    const newLineText = `${prefix}${newTokens.join(', ')}${suffix}`;
    cm.replaceRange(newLineText, { line: targetLineNo, ch: 0 }, { line: targetLineNo, ch: cm.getLine(targetLineNo).length });

    updateInlineSolfegeWidget();
    updatePairedTokenHighlights(cm);
    updateScoreHighlights(cm);
    triggerCompile();
    setStatus('ready', `Converted melody to ${convertedTo}`);
    return;
  }

  // --- Multi-line format: melody:\n  - Do\n  - Re\n  - Mi ---
  // Find the melody: header line and collect bullet items
  let melodyHeaderLineNo = targetLineNo;
  if (melodyHeaderLineNo === -1) {
    const coil = getEnclosingCoilAtPos(cm, cur);
    if (coil && coil.fields && coil.fields.melody) {
      melodyHeaderLineNo = coil.fields.melody.line;
    }
  }

  if (melodyHeaderLineNo === -1) {
    alert('Please place your cursor on a melody line or within a coil with a melody declaration.');
    return;
  }

  const headerLine = cm.getLine(melodyHeaderLineNo) || '';
  const isMelodyHeader = /^\s*(?:melody|pitches)\s*:\s*$/.test(headerLine);
  if (!isMelodyHeader) {
    alert('Please place your cursor on a melody line or within a coil with a melody array.');
    return;
  }

  const headerIndent = (headerLine.match(/^(\s*)/) || [''])[0].length;
  const totalLines = cm.lineCount();

  // Collect bullet lines
  const bulletLines = []; // { lineNo, indent, token, prefix }
  for (let l = melodyHeaderLineNo + 1; l < Math.min(totalLines, melodyHeaderLineNo + 200); l++) {
    const lText = cm.getLine(l) || '';
    if (!lText.trim()) break;
    const lIndent = (lText.match(/^(\s*)/) || [''])[0].length;
    if (lIndent <= headerIndent) break;
    const bulletMatch = lText.match(/^(\s*-\s+)(\S+)(\s*)$/);
    if (!bulletMatch) break;
    bulletLines.push({ lineNo: l, bulletPrefix: bulletMatch[1], token: bulletMatch[2], trailing: bulletMatch[3] });
  }

  if (bulletLines.length === 0) {
    alert('No melody tokens found in multi-line melody declaration.');
    return;
  }

  const rawTokens = bulletLines.map(b => b.token);
  const firstParsed = parseMelodyToken(rawTokens[0]);
  const isCurrentlyInterval = firstParsed.hasAxis;

  let newTokens = [];
  let convertedTo = '';

  if (targetMode === 'absolute' || (targetMode === 'auto' && isCurrentlyInterval)) {
    newTokens = convertIntervalToAbsoluteMelody(rawTokens);
    convertedTo = 'Absolute';
  } else {
    newTokens = convertAbsoluteToIntervalMelody(rawTokens);
    convertedTo = 'Interval';
  }

  // Replace each bullet line in reverse order (to preserve line numbers)
  for (let i = bulletLines.length - 1; i >= 0; i--) {
    const { lineNo, bulletPrefix, trailing } = bulletLines[i];
    const newLineText = `${bulletPrefix}${newTokens[i] || rawTokens[i]}${trailing}`;
    cm.replaceRange(newLineText, { line: lineNo, ch: 0 }, { line: lineNo, ch: cm.getLine(lineNo).length });
  }

  updateInlineSolfegeWidget();
  updatePairedTokenHighlights(cm);
  updateScoreHighlights(cm);
  triggerCompile();
  setStatus('ready', `Converted melody to ${convertedTo}`);
}

// --- Solfège Pitch & Mode Transposition Engine ---

const NOTE_ACCIDENTAL_OFFSETS = {
  'C': 0, 'B#': 0,
  'C#': 1, 'Db': 1, 'D♭': 1,
  'D': 2,
  'D#': 3, 'Eb': 3, 'E♭': 3,
  'E': 4, 'Fb': 4, 'F♭': 4,
  'F': 5, 'E#': 5,
  'F#': 6, 'Gb': 6, 'G♭': 6,
  'G': 7,
  'G#': 8, 'Ab': 8, 'A♭': 8,
  'A': 9,
  'A#': 10, 'Bb': 10, 'B♭': 10,
  'B': 11, 'Cb': 11, 'C♭': 11,
};

function pitchNameToMidi(pitchName) {
  const match = (pitchName || '').match(/^([A-Ga-g](?:#|b|♭)?)(\d+)$/);
  if (!match) {
    throw new Error(`Invalid pitch name: "${pitchName}"`);
  }
  const note = match[1].toUpperCase().replace('♭', 'b');
  const octave = parseInt(match[2], 10);
  const semitone = NOTE_ACCIDENTAL_OFFSETS[note];
  if (semitone === undefined) {
    throw new Error(`Unknown note: "${note}"`);
  }
  return (octave + 1) * 12 + semitone;
}

function calculateTonicShift(oldTonicName, newTonicName) {
  const oldMidi = pitchNameToMidi(oldTonicName);
  const newMidi = pitchNameToMidi(newTonicName);
  return {
    semitones: oldMidi - newMidi,
    oldMidi,
    newMidi,
  };
}

function transposeSolfegeToken(token, semitones) {
  const clean = (token || '').trim().replace(/^['"]|['"]$/g, '');
  if (!clean || clean === 'R' || clean === '~') return token;
  if (/^\d+(?:\.\d+)?$/.test(clean)) return token;

  const match = clean.match(/^([a-zA-Z]+?)(x)?([\^_]*)(x)?$/);
  if (!match) return token;

  let syllable = match[1];
  const hasAxis = Boolean(match[2] || match[4] || syllable.toLowerCase().endsWith('x'));
  if (syllable.length > 2 && syllable.toLowerCase().endsWith('x')) {
    syllable = syllable.slice(0, -1);
  }

  const octStr = match[3] || '';
  let octShift = 0;
  for (const c of octStr) {
    if (c === '^') octShift++;
    else if (c === '_') octShift--;
  }

  const lowerSyl = syllable.toLowerCase();
  const baseSemitone = SYLLABLE_TO_SEMITONE[lowerSyl] ?? 0;
  const currentTotal = baseSemitone + (octShift * 12);
  const newTotal = currentTotal + semitones;

  const base = ((newTotal + 5) % 12 + 12) % 12 - 5;
  const newOct = Math.round((newTotal - base) / 12);

  const newBaseSyllable = BASE_OCTAVE_SYLLABLES[base] || 'Do';
  let result = newBaseSyllable;
  if (hasAxis) result += 'x';
  if (newOct > 0) result += '^'.repeat(newOct);
  else if (newOct < 0) result += '_'.repeat(Math.abs(newOct));

  return result;
}

function transposeHarmonyToken(token, semitones) {
  const clean = (token || '').trim().replace(/^['"]|['"]$/g, '');
  if (!clean || clean === 'R' || clean === '~') return token;

  let remaining = clean;
  let octaveShift = 0;
  while (remaining.endsWith('^')) {
    octaveShift++;
    remaining = remaining.slice(0, -1);
  }
  while (remaining.endsWith('_')) {
    octaveShift--;
    remaining = remaining.slice(0, -1);
  }

  const ALL_SYLS = '(?:Do|Ra|Di|Re|Me|Ri|Mi|Mie|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti)';
  const bassMatch = remaining.match(new RegExp(`^(${ALL_SYLS})([\\^_]*)x(${ALL_SYLS})(x?)(.*)$`));

  let result = '';

  if (bassMatch) {
    let rawBass = bassMatch[1];
    if (rawBass === 'Mie') rawBass = 'Mi';
    const transposedBass = transposeSolfegeToken(rawBass, semitones).replace(/[\^_x]/g, '');
    const bassOct = bassMatch[2];
    result += transposedBass + bassOct + 'x';

    const rootSyl = bassMatch[3];
    const hasAxis = bassMatch[4] === 'x';
    const rest = bassMatch[5];
    const transposedRoot = transposeSolfegeToken(rootSyl, semitones).replace(/[\^_x]/g, '');
    result += transposedRoot + (hasAxis ? 'x' : '') + rest;
  } else {
    const rootMatch = remaining.match(new RegExp(`^(${ALL_SYLS})(x?)(.*)$`));
    if (rootMatch) {
      const rootSyl = rootMatch[1];
      const hasAxis = rootMatch[2] === 'x';
      const rest = rootMatch[3];
      const transposedRoot = transposeSolfegeToken(rootSyl, semitones).replace(/[\^_x]/g, '');
      result += transposedRoot + (hasAxis ? 'x' : '') + rest;
    } else {
      return token;
    }
  }

  if (octaveShift > 0) result += '^'.repeat(octaveShift);
  else if (octaveShift < 0) result += '_'.repeat(Math.abs(octaveShift));

  return result;
}

// --- Rhythmic Period Scaling & Optimizer Engine ---

const RHYTHM_SYLLABLE_OFFSETS = {
  'do': 0, 'ra': 1, 'di': 1, 're': 2, 'me': 3, 'ri': 3,
  'mi': 4, 'fa': 5, 'se': 5, 'fi': 6, 'so': 7,
  'le': 8, 'si': 8, 'la': 9, 'te': 10, 'li': 10, 'ti': 11
};

function parseRhythmTokenClient(token) {
  let remaining = (token || '').trim();
  let beatSkips = 0;
  while (remaining.startsWith('Dox')) {
    beatSkips++;
    remaining = remaining.slice(3);
  }
  if (!remaining) {
    return { beatSkips: 0, baseSyllable: 'Do', suffixes: [], offsetInBeat: 0, cleanToken: 'Dox' };
  }

  const m = remaining.match(/^(Do|Ra|Di|Re|Me|Ri|Mi|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti)(.*)$/);
  if (!m) return { beatSkips, baseSyllable: 'Do', suffixes: [], offsetInBeat: 0, cleanToken: remaining };

  const baseSyllable = m[1];
  const rest = m[2];
  const baseSemitone = RHYTHM_SYLLABLE_OFFSETS[baseSyllable.toLowerCase()] ?? 0;
  let offsetInBeat = baseSemitone / 12;

  const suffixes = [];
  const suffixRegex = /(Do|Ra|Di|Re|Me|Ri|Mi|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti)/g;
  let sMatch;
  while ((sMatch = suffixRegex.exec(rest)) !== null) {
    const sSyl = sMatch[1];
    suffixes.push(sSyl);
    const sSemi = RHYTHM_SYLLABLE_OFFSETS[sSyl.toLowerCase()] ?? 0;
    const sFrac = sSemi / 12;
    const remainingInterval = 1.0 - offsetInBeat;
    offsetInBeat += sFrac * remainingInterval;
  }

  return {
    beatSkips,
    baseSyllable,
    suffixes,
    offsetInBeat,
    cleanToken: remaining
  };
}

function resolveRhythmTimelineClient(rhythmTokens) {
  if (!rhythmTokens || rhythmTokens.length === 0) return [];
  const parsedTokens = rhythmTokens.map(t => parseRhythmTokenClient(t));
  const timestamps = [];
  let currentBeat = 0;
  let prevOffsetInBeat = -1;

  for (let i = 0; i < parsedTokens.length; i++) {
    const p = parsedTokens[i];
    if (i > 0) {
      if (p.beatSkips > 0) {
        if (p.baseSyllable === 'Do') {
          currentBeat += 1 + p.beatSkips;
        } else if (p.offsetInBeat <= prevOffsetInBeat) {
          currentBeat += 1 + p.beatSkips;
        } else {
          currentBeat += p.beatSkips;
        }
        prevOffsetInBeat = -1;
      } else if (p.baseSyllable === 'Do') {
        currentBeat += 1;
        prevOffsetInBeat = -1;
      } else if (p.offsetInBeat <= prevOffsetInBeat) {
        currentBeat += 1;
        prevOffsetInBeat = -1;
      }
    } else {
      if (p.beatSkips > 0) {
        currentBeat += p.beatSkips;
        prevOffsetInBeat = -1;
      }
    }
    const startBeat = currentBeat + p.offsetInBeat;
    timestamps.push(startBeat);
    prevOffsetInBeat = p.offsetInBeat;
  }
  return timestamps;
}

function expandRhythmEntriesClient(entries, targetCount) {
  const result = [];
  for (const entry of entries) {
    const raw = String(entry).trim();
    if (!raw) continue;
    const matchLookback = raw.match(/^(\d+)\.(\d+)$/);
    const matchSimple = raw.match(/^(\d+)$/);
    if (matchLookback) {
      const repeatCount = parseInt(matchLookback[1], 10);
      const windowSize = parseInt(matchLookback[2], 10);
      if (result.length >= windowSize) {
        const window = result.slice(-windowSize);
        for (let r = 0; r < repeatCount; r++) {
          result.push(...window);
        }
      }
    } else if (matchSimple) {
      const repeatCount = parseInt(matchSimple[1], 10);
      if (result.length > 0) {
        const last = result[result.length - 1];
        for (let r = 0; r < repeatCount; r++) {
          result.push(last);
        }
      }
    } else {
      // Keep compound Dox tokens intact (e.g. DoxDoxDoxDo) — they encode
      // a single onset with beat skips, not separate onsets. Splitting them
      // destroys the timing semantics.
      result.push(raw);
    }
  }

  // Count audible tokens (anything that isn't a bare 'Dox' skip)
  const audibleCount = result.filter(t => t !== 'Dox').length;
  if (targetCount !== undefined && audibleCount < targetCount && result.length > 0) {
    const lastToken = result[result.length - 1] ?? 'Do';
    const needed = targetCount - audibleCount;
    for (let i = 0; i < needed; i++) {
      result.push(lastToken === 'Dox' ? 'Do' : lastToken);
    }
  }

  return result;
}

function offsetInBeatToSolfegeClient(offset) {
  const EPS = 1e-4;
  const modOffset = ((offset % 1.0) + 1.0) % 1.0;
  if (modOffset < EPS || modOffset > 1.0 - EPS) return 'Do';

  const twelfths = modOffset * 12;
  const nearestTwelfth = Math.round(twelfths);
  if (Math.abs(twelfths - nearestTwelfth) < EPS) {
    const SYLLABLES_12 = {
      0: 'Do', 1: 'Ra', 2: 'Re', 3: 'Me', 4: 'Mi', 5: 'Fa',
      6: 'Fi', 7: 'So', 8: 'Le', 9: 'La', 10: 'Te', 11: 'Ti'
    };
    return SYLLABLES_12[nearestTwelfth] ?? 'Do';
  }

  const CANDIDATES = ['Do', 'Ra', 'Re', 'Me', 'Mi', 'Fa', 'Fi', 'So', 'Le', 'La', 'Te', 'Ti'];
  let bestToken = 'Do';
  let bestErr = Infinity;

  for (const base of CANDIDATES) {
    const baseFrac = (RHYTHM_SYLLABLE_OFFSETS[base.toLowerCase()] ?? 0) / 12;
    if (baseFrac <= modOffset + EPS) {
      const remaining = 1.0 - baseFrac;
      if (remaining > EPS) {
        for (const suffix of CANDIDATES) {
          const suffixFrac = (RHYTHM_SYLLABLE_OFFSETS[suffix.toLowerCase()] ?? 0) / 12;
          const candidateOffset = baseFrac + suffixFrac * remaining;
          const err = Math.abs(modOffset - candidateOffset);
          if (err < bestErr) {
            bestErr = err;
            bestToken = base === 'Do' ? suffix : `${base}${suffix}`;
          }
        }
      }
    }
  }

  return bestToken;
}

function timestampsToRhythmTokensClient(timestamps) {
  if (!timestamps || timestamps.length === 0) return [];
  const tokens = [];
  let prevBeat = 0;
  let prevOffset = -1;

  for (let i = 0; i < timestamps.length; i++) {
    const t = timestamps[i];
    const currentBeat = Math.floor(t + 1e-5);
    const offsetInBeat = t - currentBeat;
    const syl = offsetInBeatToSolfegeClient(offsetInBeat);

    if (i === 0) {
      if (currentBeat > 0) {
        tokens.push('Dox'.repeat(currentBeat) + syl);
      } else {
        tokens.push(syl);
      }
    } else {
      const beatDelta = currentBeat - prevBeat;
      if (beatDelta > 0) {
        if (syl === 'Do') {
          if (beatDelta === 1) {
            tokens.push('Do');
          } else {
            tokens.push('Dox'.repeat(beatDelta - 1) + 'Do');
          }
        } else {
          if (offsetInBeat <= prevOffset) {
            const extraSkips = beatDelta - 1;
            if (extraSkips > 0) {
              tokens.push('Dox'.repeat(extraSkips) + syl);
            } else {
              tokens.push(syl);
            }
          } else {
            tokens.push('Dox'.repeat(beatDelta) + syl);
          }
        }
      } else {
        tokens.push(syl);
      }
    }
    prevBeat = currentBeat;
    prevOffset = offsetInBeat;
  }
  return tokens;
}

function calculateHarmonyPhaseOffsetClient(harmonyRhythmTokens, factor) {
  if (!harmonyRhythmTokens || harmonyRhythmTokens.length === 0 || factor <= 0) return 0;
  const timeline = resolveRhythmTimelineClient(harmonyRhythmTokens);
  if (timeline.length === 0) return 0;
  const firstChordBeat = timeline[0];
  const period = 1.0 / factor;
  const rem = ((firstChordBeat % period) + period) % period;
  if (Math.abs(rem) < 1e-4 || Math.abs(rem - period) < 1e-4) {
    return 0;
  }
  return period - rem;
}

function transposeRhythmTokensClient(rhythmTokens, factor, phaseOffset = 0) {
  if (!rhythmTokens || rhythmTokens.length === 0 || factor <= 0) return rhythmTokens;
  const timeline = resolveRhythmTimelineClient(rhythmTokens);
  const scaled = timeline.map(b => (b + phaseOffset) * factor);
  return timestampsToRhythmTokensClient(scaled);
}

function analyzeRhythmComplexityClient(tokens) {
  let doxCount = 0;
  let compoundSuffixCount = 0;
  let subdivisionCount = 0;
  let downbeatCount = 0;

  for (const tok of tokens) {
    const doxMatches = tok.match(/Dox/g);
    if (doxMatches) doxCount += doxMatches.length;

    try {
      const parsed = parseRhythmTokenClient(tok);
      if (parsed.suffixes.length > 0) compoundSuffixCount += parsed.suffixes.length;
      if (parsed.cleanToken === 'Do') downbeatCount++;
      else if (parsed.cleanToken !== 'Dox') subdivisionCount++;
    } catch {
      // Ignored
    }
  }

  const complexityScore = doxCount * 3 + compoundSuffixCount * 6 + subdivisionCount * 1;
  return {
    doxCount,
    compoundSuffixCount,
    subdivisionCount,
    downbeatCount,
    complexityScore,
    totalTokens: tokens.length
  };
}

function suggestOptimalRhythmicPeriodClient(tokens) {
  const currentComplexity = analyzeRhythmComplexityClient(tokens);
  const candidates = [
    { factor: 0.5, label: 'Half Time (2× Beat Density / e.g. Do → Do, Fi)' },
    { factor: 2.0, label: 'Double Time (0.5× Beat Density / e.g. Do → Do, DoxDo)' },
    { factor: 0.25, label: 'Quarter Time (4× Beat Density / e.g. Do → Do, Me, Fi, La)' },
    { factor: 4.0, label: 'Quadruple Time (0.25× Beat Density)' },
    { factor: 1.5, label: 'Dotted / Compound (1.5× Beat Density)' },
    { factor: 3.0, label: 'Triplet (3× Beat Density)' },
  ];

  let bestFactor = 1.0;
  let bestLabel = 'Current Period Length (1×)';
  let bestComplexity = currentComplexity;
  let bestTokens = tokens;
  let bestScore = currentComplexity.complexityScore;

  for (const c of candidates) {
    try {
      const transposed = transposeRhythmTokensClient(tokens, c.factor);
      const complexity = analyzeRhythmComplexityClient(transposed);
      if (complexity.complexityScore < bestScore) {
        bestScore = complexity.complexityScore;
        bestFactor = c.factor;
        bestLabel = c.label;
        bestComplexity = complexity;
        bestTokens = transposed;
      }
    } catch {
      // Ignored
    }
  }

  const doxReductionPercent = currentComplexity.doxCount > 0
    ? Math.max(0, Math.round(((currentComplexity.doxCount - bestComplexity.doxCount) / currentComplexity.doxCount) * 100))
    : 0;

  const suffixReductionPercent = currentComplexity.compoundSuffixCount > 0
    ? Math.max(0, Math.round(((currentComplexity.compoundSuffixCount - bestComplexity.compoundSuffixCount) / currentComplexity.compoundSuffixCount) * 100))
    : 0;

  return {
    recommendedFactor: bestFactor,
    label: bestLabel,
    originalComplexity: currentComplexity,
    recommendedComplexity: bestComplexity,
    doxReductionPercent,
    suffixReductionPercent,
    transposedTokens: bestTokens
  };
}

async function showTonicModeTranspositionModal(cm) {
  const yamlText = cm.getValue();
  const currentTonicMatch = yamlText.match(/\btonic\s*:\s*["']?([A-Ga-g](?:#|b|♭)?\d+)["']?/);
  const currentTonic = currentTonicMatch ? currentTonicMatch[1] : 'C4';

  const modeOptions = [
    { id: 'aeolian', label: 'Aeolian (Natural Minor / La / -3 st)' },
    { id: 'ionian', label: 'Ionian (Major / Do / 0 st)' },
    { id: 'dorian', label: 'Dorian (Re / +2 st)' },
    { id: 'phrygian', label: 'Phrygian (Me / +3 st)' },
    { id: 'lydian', label: 'Lydian (Fa / +5 st)' },
    { id: 'mixolydian', label: 'Mixolydian (So / +7 st)' },
    { id: 'locrian', label: 'Locrian (Ti / -1 st)' },
    { id: 'custom_pitch', label: 'Custom Tonic Pitch (e.g. Eb4, A3, G4)...' },
  ];

  const result = await showRefactorDialog({
    title: 'Transpose Tonic & Mode (Preserve Pitch)',
    desc: 'Shift the root "Do" anchor across modes non-destructively while preserving exact sounding concert pitches:',
    fields: [
      {
        type: 'select',
        name: 'targetMode',
        label: 'Target Mode / Shift Preset:',
        value: 'aeolian',
        options: modeOptions,
        onChange: (e, fieldsEl) => {
          const val = e.target.value;
          const tonicInput = fieldsEl.querySelector('input[name="newTonic"]');
          if (!tonicInput) return;
          try {
            const currentMidi = pitchNameToMidi(currentTonic);
            let semitoneDelta = 0;
            if (val === 'aeolian') semitoneDelta = -3;
            else if (val === 'ionian') semitoneDelta = 0;
            else if (val === 'dorian') semitoneDelta = 2;
            else if (val === 'phrygian') semitoneDelta = 3;
            else if (val === 'lydian') semitoneDelta = 5;
            else if (val === 'mixolydian') semitoneDelta = 7;
            else if (val === 'locrian') semitoneDelta = -1;

            if (val !== 'custom_pitch') {
              const newMidi = currentMidi + semitoneDelta;
              const noteIndex = ((newMidi % 12) + 12) % 12;
              const octave = Math.floor(newMidi / 12) - 1;
              const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
              tonicInput.value = `${NAMES[noteIndex]}${octave}`;
            }
          } catch {
            // Ignored
          }
        }
      },
      {
        type: 'text',
        name: 'newTonic',
        label: 'New Tonic Root Pitch:',
        value: 'A3',
        placeholder: 'e.g. A3, Eb4, G4, D4'
      },
      {
        type: 'radios',
        name: 'scope',
        label: 'Scope:',
        options: [
          { id: 'entire', label: 'Entire Tapestry (All Knots, Melodies & Harmonies)', checked: true },
          { id: 'active_coil', label: 'Active Coil Only' }
        ]
      },
      {
        type: 'checkboxes',
        name: 'preservePitch',
        label: 'Concert Pitch:',
        options: [
          { id: 'preserve', label: 'Preserve sounding pitch (transpose Solfège and Tonic inversely)', checked: true }
        ]
      }
    ],
    confirmText: 'Transpose Tonic'
  });

  if (!result.confirmed) return;

  const targetTonic = (result.values.newTonic || currentTonic).trim();
  const preservePitch = (result.values.preservePitch || []).includes('preserve');
  const scope = result.values.scope || 'entire';

  let shiftSemitones = 0;
  try {
    const shift = calculateTonicShift(currentTonic, targetTonic);
    shiftSemitones = shift.semitones;
  } catch (err) {
    alert(`Invalid tonic pitch: ${targetTonic}`);
    return;
  }

  if (!preservePitch) {
    shiftSemitones = 0;
  }

  const lines = cm.getValue().split('\n');
  const coil = scope === 'active_coil' ? getEnclosingCoilAtPos(cm, cm.getCursor()) : null;
  const startL = coil ? coil.startLine : 0;
  const endL = coil ? coil.endLine : lines.length - 1;

  for (let l = startL; l <= endL; l++) {
    let line = lines[l];
    const melMatch = line.match(/^(\s*(?:melody|pitches)\s*:\s*\[)(.*)(\]\s*)$/i);
    if (melMatch) {
      const tokens = melMatch[2].split(',').map(s => s.trim()).filter(Boolean);
      const transposed = tokens.map(tok => transposeSolfegeToken(tok, shiftSemitones));
      lines[l] = `${melMatch[1]}${transposed.join(', ')}${melMatch[3]}`;
      continue;
    }

    const harmMatch = line.match(/^(\s*(?:harmony|chords)\s*:\s*\[)(.*)(\]\s*)$/i);
    if (harmMatch) {
      const tokens = harmMatch[2].split(',').map(s => s.trim()).filter(Boolean);
      const transposed = tokens.map(tok => transposeHarmonyToken(tok, shiftSemitones));
      lines[l] = `${harmMatch[1]}${transposed.join(', ')}${harmMatch[3]}`;
      continue;
    }

    if (scope === 'entire') {
      const tonicMatch = line.match(/^(\s*tonic\s*:\s*["']?)([^"'\s]+)(["']?.*)$/i);
      if (tonicMatch) {
        lines[l] = `${tonicMatch[1]}${targetTonic}${tonicMatch[3]}`;
      }
    }
  }

  cm.setValue(lines.join('\n'));
  updateInlineSolfegeWidget();
  updatePairedTokenHighlights(cm);
  updateScoreHighlights(cm);
  triggerCompile();
  setStatus('ready', `Transposed tonic from ${currentTonic} to ${targetTonic} (${shiftSemitones >= 0 ? '+' : ''}${shiftSemitones} st)`);
}

async function showRhythmicPeriodTranspositionModal(cm) {
  const yamlText = cm.getValue();
  const cur = cm.getCursor();
  const coil = getEnclosingCoilAtPos(cm, cur);

  let sampleTokens = [];
  if (coil && coil.fields && coil.fields.rhythm) {
    const raw = coil.fields.rhythm.value.replace(/^\[|\]$/g, '');
    sampleTokens = raw.split(',').map(s => s.trim()).filter(Boolean);
  }

  if (sampleTokens.length === 0) {
    const allRhythms = yamlText.match(/\brhythm\s*:\s*\[([^\]]+)\]/gi);
    if (allRhythms && allRhythms.length > 0) {
      const raw = allRhythms[0].replace(/^rhythm\s*:\s*\[|\]$/i, '');
      sampleTokens = raw.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  if (sampleTokens.length === 0) {
    sampleTokens = ['Do', 'Fi', 'Do', 'Fi'];
  }

  const suggestion = suggestOptimalRhythmicPeriodClient(sampleTokens);

  const factorOptions = [
    { id: String(suggestion.recommendedFactor), label: `★ Recommended: ${suggestion.label}` },
    { id: '0.5', label: 'Half Time (2× Beat Density / e.g. Do → Do, Fi)' },
    { id: '2.0', label: 'Double Time (0.5× Beat Density / e.g. Do → Do, DoxDo)' },
    { id: '0.25', label: 'Quarter Time (4× Beat Density / e.g. Do → Do, Me, Fi, La)' },
    { id: '4.0', label: 'Quadruple Time (0.25× Beat Density)' },
    { id: '1.5', label: 'Dotted / Compound (1.5× Beat Density)' },
    { id: '3.0', label: 'Triplet (3× Beat Density)' },
  ];

  const bannerHtml = `
    <div class="refactor-banner refactor-banner-rec">
      <div class="refactor-banner-icon">💡</div>
      <div class="refactor-banner-content">
        <span class="refactor-banner-title">Optimization Suggestion: ${suggestion.label}</span>
        <span class="refactor-banner-desc">Reduces Dox delays by ${suggestion.doxReductionPercent}% and simplifies compound suffixes by ${suggestion.suffixReductionPercent}%.</span>
      </div>
    </div>
    <div class="refactor-stats-grid">
      <div class="refactor-stat-chip">
        <span class="refactor-stat-val">${suggestion.originalComplexity.doxCount} → ${suggestion.recommendedComplexity.doxCount}</span>
        <span class="refactor-stat-label">Dox Delays</span>
      </div>
      <div class="refactor-stat-chip">
        <span class="refactor-stat-val">${suggestion.originalComplexity.compoundSuffixCount} → ${suggestion.recommendedComplexity.compoundSuffixCount}</span>
        <span class="refactor-stat-label">Suffixes</span>
      </div>
      <div class="refactor-stat-chip">
        <span class="refactor-stat-val">${suggestion.originalComplexity.complexityScore} → ${suggestion.recommendedComplexity.complexityScore}</span>
        <span class="refactor-stat-label">Grammar Score</span>
      </div>
    </div>
  `;

  const result = await showRefactorDialog({
    title: 'Transpose Rhythmic Period & Optimize Grammar',
    desc: 'Scale rhythmic period lengths to alter downbeat density and eliminate Dox prefixes or complex suffixes:',
    fields: [
      {
        type: 'html',
        html: bannerHtml
      },
      {
        type: 'select',
        name: 'factor',
        label: 'Period Scaling Factor:',
        value: String(suggestion.recommendedFactor),
        options: factorOptions
      },
      {
        type: 'radios',
        name: 'scope',
        label: 'Scope:',
        options: [
          { id: 'entire', label: 'Entire Tapestry (All Coils & Rhythms)', checked: true },
          { id: 'active_coil', label: 'Active Coil Only' }
        ]
      },
      {
        type: 'checkboxes',
        name: 'compensateTempo',
        label: 'Playback Duration:',
        options: [
          { id: 'tempo', label: 'Compensate tempo (e.g. adjust knot.tempo proportionally to preserve real-time speed)', checked: true }
        ]
      }
    ],
    confirmText: 'Scale Rhythm Period'
  });

  if (!result.confirmed) return;

  const factor = parseFloat(result.values.factor) || 1.0;
  const scope = result.values.scope || 'entire';
  const compensateTempo = (result.values.compensateTempo || []).includes('tempo');

  if (factor === 1.0) return;

  const lines = cm.getValue().split('\n');
  const targetCoil = scope === 'active_coil' ? getEnclosingCoilAtPos(cm, cm.getCursor()) : null;
  const startL = targetCoil ? targetCoil.startLine : 0;
  const endL = targetCoil ? targetCoil.endLine : lines.length - 1;

  for (let l = startL; l <= endL; l++) {
    let line = lines[l];
    const rhythmMatch = line.match(/^(\s*rhythm\s*:\s*\[)(.*)(\]\s*)$/i);
    if (rhythmMatch) {
      const rawTokens = rhythmMatch[2].split(',').map(s => s.trim()).filter(Boolean);

      // Search for associated melody in the same coil to determine target onset count
      let melodyCount = undefined;
      for (let m = Math.max(0, l - 5); m <= Math.min(lines.length - 1, l + 5); m++) {
        const melMatch = lines[m].match(/^(\s*(?:melody|pitches)\s*:\s*\[)(.*)(\]\s*)$/i);
        if (melMatch) {
          const mTokens = melMatch[2].split(',').map(s => s.trim()).filter(Boolean);
          if (mTokens.length > 0) {
            melodyCount = mTokens.length;
            break;
          }
        }
      }

      const expanded = expandRhythmEntriesClient(rawTokens, melodyCount);
      const transposed = transposeRhythmTokensClient(expanded, factor);
      lines[l] = `${rhythmMatch[1]}${transposed.join(', ')}${rhythmMatch[3]}`;
    }

    if (scope === 'entire' && compensateTempo) {
      const tempoMatch = line.match(/^(\s*tempo\s*:\s*)(\d+)(.*)$/i);
      if (tempoMatch) {
        const oldTempo = parseInt(tempoMatch[2], 10);
        const newTempo = Math.round(oldTempo * factor);
        lines[l] = `${tempoMatch[1]}${newTempo}${tempoMatch[3]}`;
      }
    }
  }

  cm.setValue(lines.join('\n'));
  updateInlineSolfegeWidget();
  updatePairedTokenHighlights(cm);
  updateScoreHighlights(cm);
  triggerCompile();
  setStatus('ready', `Transposed rhythmic period by ${factor}×`);
}

// --- Tapestry Project Management Operations ---

async function createTapestry() {
  if (!confirmDiscardUnsavedChanges()) return;

  const result = await showRefactorDialog({
    title: 'Create New Tapestry',
    desc: 'Create a new PPT score with geometric Solfège noteheads and starter motif structure:',
    fields: [
      { type: 'text', name: 'fileName', label: 'File Name (.ppt.yaml):', value: 'new_tapestry', placeholder: 'e.g. moonlight_motif' },
      { type: 'text', name: 'title', label: 'Tapestry Title:', value: 'New Tapestry', placeholder: 'e.g. Moonlight Motif' },
      { type: 'text', name: 'composer', label: 'Composer:', value: 'Composer', placeholder: 'e.g. Midlife Muso' },
      { type: 'text', name: 'tonic', label: 'Tonic Root Pitch:', value: 'C4', placeholder: 'e.g. C4, A4, Eb4' }
    ],
    confirmText: 'Create Tapestry'
  });

  if (!result.confirmed) return;

  const rawName = (result.values.fileName || 'new_tapestry').trim().replace(/\.ppt\.yaml$/, '');
  const fileName = `${rawName}.ppt.yaml`;
  const title = (result.values.title || rawName).trim();
  const composer = (result.values.composer || 'Composer').trim();
  const tonic = (result.values.tonic || 'C4').trim();

  const starterTemplate = `tapestry:
  knot:
    tonic: "${tonic}"
    weave: song
    engraving:
      title: "${title}"
      composer: "${composer}"
      arranger: "Midlife Muso"
      colorNotes: true
      omitStem: true
      noteheadStyle: ppt
      harmonyClef: treble_8
      show:
        - melody
        - harmony
        - melodyCoilInterval
        - rhythmCoil
        - rhythmGrid
        - chordNames

  weaves:
    song:
      children:
        - coil: verse

  coils:
    verse:
      melody: [Dox, Do, Me, So, Me, Do]
      rhythm: [Do, Fi, Do, Fi, Do, 2]
      harmony: [DoMe]
`;

  try {
    setStatus('compiling', 'Creating...');
    const res = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: fileName, content: starterTemplate }),
    });
    const data = await res.json();
    if (data.success) {
      currentScoreFile = data.file;
      clearPreviewWindow('Creating & compiling tapestry...');
      editor.setValue(starterTemplate);
      setDirty(false);
      setStatus('ready', 'Tapestry Created');
      await fetchScores(data.file);
      triggerCompile();
    }
  } catch (err) {
    console.error('Failed to create tapestry:', err);
    setStatus('error', 'Creation Failed');
  }
}

async function deleteTapestry() {
  if (!currentScoreFile) {
    alert('No tapestry is currently loaded to delete.');
    return;
  }

  const result = await showRefactorDialog({
    title: `Delete Tapestry '${currentScoreFile}'`,
    desc: `Are you sure you want to permanently delete '${currentScoreFile}' and all associated notation and PDF exports? This cannot be undone.`,
    fields: [],
    confirmText: 'Delete Tapestry'
  });

  if (!result.confirmed) return;

  try {
    setStatus('compiling', 'Deleting...');
    const res = await fetch('/api/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: currentScoreFile }),
    });
    const data = await res.json();
    if (data.success) {
      currentScoreFile = '';
      isInitialScoreLoadDone = false;
      clearPreviewWindow();
      editor.setValue('');
      setDirty(false);
      await fetchScores();
      setStatus('ready', 'Tapestry Deleted');
    }
  } catch (err) {
    console.error('Failed to delete tapestry:', err);
    setStatus('error', 'Delete Failed');
  }
}

async function renameTapestryFile() {
  if (!currentScoreFile) {
    alert('No tapestry is currently loaded to rename.');
    return;
  }

  const currentBase = currentScoreFile.replace(/\.ppt\.yaml$/, '');
  const result = await showRefactorDialog({
    title: `Rename Tapestry File`,
    desc: `Rename '${currentScoreFile}' and its associated compilation artifacts (.notation.ly, .pdf, .ppt-map.json, .svg, etc.):`,
    fields: [
      { type: 'text', name: 'newFileName', label: 'New File Name (.ppt.yaml):', value: currentBase, placeholder: 'e.g. moonlight_motif' }
    ],
    confirmText: 'Rename File & Artifacts'
  });

  if (!result.confirmed) return;

  const rawName = (result.values.newFileName || '').trim().replace(/\.ppt\.yaml$/, '');
  if (!rawName) {
    alert('File name cannot be empty.');
    return;
  }
  const newFileName = `${rawName}.ppt.yaml`;
  if (newFileName === currentScoreFile) return;

  try {
    setStatus('compiling', 'Renaming...');
    const res = await fetch('/api/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldFile: currentScoreFile, newFile: newFileName })
    });
    const data = await res.json();
    if (data.success) {
      currentScoreFile = data.newFile;
      updateUrlAndStorage(data.newFile);
      await fetchScores(data.newFile);
      setStatus('ready', `Renamed to ${data.newFile}`);
    } else {
      setStatus('error', 'Rename Failed');
      alert(`Rename failed: ${data.error || 'Unknown error'}`);
    }
  } catch (err) {
    console.error('Failed to rename tapestry file:', err);
    setStatus('error', 'Rename Failed');
  }
}

// --- Command Palette Engine ---
const BASE_COMMANDS_LIST = [
  {
    id: 'project-open-tapestry',
    title: 'Open Tapestry...',
    category: 'Project',
    icon: '📂',
    shortcut: 'Ctrl+O',
    action: () => openTapestryPicker()
  },
  {
    id: 'project-create-tapestry',
    title: 'Create Tapestry...',
    category: 'Project',
    icon: '✨',
    shortcut: 'Ctrl+N',
    action: () => createTapestry()
  },
  {
    id: 'project-rename-tapestry-file',
    title: 'Rename Tapestry File & Artifacts...',
    category: 'Project',
    icon: '🏷️',
    action: () => renameTapestryFile()
  },
  {
    id: 'project-save-tapestry',
    title: 'Save Tapestry',
    category: 'Project',
    icon: '💾',
    shortcut: 'Ctrl+S',
    action: () => saveScore()
  },
  {
    id: 'project-delete-tapestry',
    title: 'Delete Current Tapestry...',
    category: 'Project',
    icon: '🗑️',
    action: () => deleteTapestry()
  },
  {
    id: 'pref-toggle-autocompile',
    title: 'Toggle Auto-Compile on Change',
    category: 'Preferences',
    icon: '⚡',
    action: () => toggleAutocompile()
  },
  {
    id: 'pref-toggle-solfege-colors',
    title: 'Toggle Inline Solfège Color Highlighting',
    category: 'Preferences',
    icon: '🎨',
    action: () => toggleSolfegeColors()
  },
  {
    id: 'pref-toggle-solfege-context',
    title: 'Toggle Inline Melody Coil Preview',
    category: 'Preferences',
    icon: '👁️',
    action: () => toggleSolfegeContext()
  },
  {
    id: 'pref-toggle-autocomplete',
    title: 'Toggle Context-Aware Autocompletion',
    category: 'Preferences',
    icon: '💡',
    action: () => toggleAutocomplete()
  },
  {
    id: 'pref-toggle-coil-suggestions',
    title: 'Toggle Dynamic Coil & Weave Suggestions',
    category: 'Preferences',
    icon: '🧶',
    action: () => toggleCoilSuggestions()
  },
  {
    id: 'pref-open-settings',
    title: 'Open Studio Settings...',
    category: 'Preferences',
    icon: '⚙️',
    action: () => openSettingsModal()
  },
  {
    id: 'refactor-extract-parent',
    title: 'Extract into Parent Coil',
    category: 'Refactor',
    icon: '🔄',
    shortcut: 'Ctrl+Alt+P',
    action: (cm) => extractParentCoil(cm)
  },
  {
    id: 'refactor-extract-inline',
    title: 'Extract Inline Coil to Named Coil',
    category: 'Refactor',
    icon: '📦',
    shortcut: 'Ctrl+Alt+C',
    action: (cm) => extractInlineCoil(cm)
  },
  {
    id: 'refactor-inline-parent',
    title: 'Inline / Flatten Parent Coil',
    category: 'Refactor',
    icon: '🔗',
    shortcut: 'Ctrl+Alt+I',
    action: (cm) => inlineParentCoil(cm)
  },
  {
    id: 'refactor-extract-weave',
    title: 'Group Selection into Weave',
    category: 'Refactor',
    icon: '🧶',
    shortcut: 'Ctrl+Alt+W',
    action: (cm) => extractWeave(cm)
  },
  {
    id: 'refactor-rename-symbol',
    title: 'Rename Symbol / ID Globally',
    category: 'Refactor',
    icon: '✏️',
    shortcut: 'F2',
    action: (cm) => renameSymbol(cm)
  },
  {
    id: 'refactor-melody-interval-to-absolute',
    title: 'Convert Melody: Interval to Absolute',
    category: 'Refactor',
    icon: '🎯',
    shortcut: 'Ctrl+Alt+A',
    action: (cm) => refactorConvertMelody(cm, 'absolute')
  },
  {
    id: 'refactor-transpose-tonic-mode',
    title: 'Transpose Tonic & Mode (Preserve Pitch)...',
    category: 'Refactor',
    icon: '🎯',
    action: (cm) => showTonicModeTranspositionModal(cm)
  },
  {
    id: 'refactor-rhythm-period-optimize',
    title: 'Transpose Rhythmic Period & Optimize Grammar...',
    category: 'Refactor',
    icon: '⚡',
    action: (cm) => showRhythmicPeriodTranspositionModal(cm)
  },
  {
    id: 'refactor-duplicate-property',
    title: 'Duplicate Property / Array Item',
    category: 'Refactor',
    icon: '📋',
    shortcut: 'Ctrl+Alt+Enter',
    action: (cm) => duplicatePropertyBlock(cm)
  },
  {
    id: 'refactor-reorder-up',
    title: 'Reorder Property / Array Item Up',
    category: 'Refactor',
    icon: '🔼',
    shortcut: 'Ctrl+Alt+Up',
    action: (cm) => reorderPropertyBlock(cm, 'up')
  },
  {
    id: 'refactor-reorder-down',
    title: 'Reorder Property / Array Item Down',
    category: 'Refactor',
    icon: '🔽',
    shortcut: 'Ctrl+Alt+Down',
    action: (cm) => reorderPropertyBlock(cm, 'down')
  },
  {
    id: 'nav-sibling-up',
    title: 'Navigate to Previous Property Sibling',
    category: 'Navigation',
    icon: '⬆️',
    shortcut: 'Ctrl+Up',
    action: (cm) => navigatePropertySibling(cm, 'up')
  },
  {
    id: 'nav-sibling-down',
    title: 'Navigate to Next Property Sibling',
    category: 'Navigation',
    icon: '⬇️',
    shortcut: 'Ctrl+Down',
    action: (cm) => navigatePropertySibling(cm, 'down')
  },
  {
    id: 'nav-goto-symbol',
    title: 'Go to Named Reference / Symbol...',
    category: 'Navigation',
    icon: '🔍',
    shortcut: 'Ctrl+G',
    action: (cm) => openGotoReferencePalette(cm)
  },
  {
    id: 'refactor-melody-interval-to-absolute',
    title: 'Convert Melody: Interval to Absolute',
    category: 'Refactor',
    icon: '🎯',
    shortcut: 'Ctrl+Alt+A',
    action: (cm) => refactorConvertMelody(cm, 'absolute')
  },
  {
    id: 'refactor-melody-absolute-to-interval',
    title: 'Convert Melody: Absolute to Interval',
    category: 'Refactor',
    icon: '🔄',
    action: (cm) => refactorConvertMelody(cm, 'interval')
  },
  {
    id: 'nav-transpose-up',
    title: 'Transpose Solfège Note Up (+1 semitone)',
    category: 'Music',
    icon: '⬆️',
    action: (cm) => handleSolfegeTranspose(cm, 'up')
  },
  {
    id: 'nav-transpose-down',
    title: 'Transpose Solfège Note Down (-1 semitone)',
    category: 'Music',
    icon: '⬇️',
    action: (cm) => handleSolfegeTranspose(cm, 'down')
  },
  {
    id: 'nav-octave-up',
    title: 'Shift Solfège Note Octave Up (+1 Octave / ^)',
    category: 'Music',
    icon: '⏫',
    action: (cm) => handleSolfegeOctaveShift(cm, 'up')
  },
  {
    id: 'nav-octave-down',
    title: 'Shift Solfège Note Octave Down (-1 Octave / _)',
    category: 'Music',
    icon: '⏬',
    action: (cm) => handleSolfegeOctaveShift(cm, 'down')
  },
  {
    id: 'nav-goto-def',
    title: 'Go to Definition',
    category: 'Navigation',
    icon: '🔍',
    shortcut: 'F12 / Ctrl+Click',
    action: (cm) => triggerGoToDefinition(cm)
  },
  {
    id: 'editor-autocomplete',
    title: 'Trigger Autocomplete & Suggestions',
    category: 'Editor',
    icon: '💡',
    shortcut: 'Ctrl+Space',
    action: (cm) => cm.showHint({ hint: CodeMirror.hint.yaml, completeSingle: false })
  },
  {
    id: 'editor-toggle-comment',
    title: 'Toggle Line Comment',
    category: 'Editor',
    icon: '#️⃣',
    shortcut: 'Ctrl+/',
    action: (cm) => cm.toggleComment()
  },
  {
    id: 'editor-fold-toggle',
    title: 'Fold / Unfold Current Section',
    category: 'Editor',
    icon: '▾',
    shortcut: 'Ctrl+Q',
    action: (cm) => cm.foldCode(cm.getCursor())
  },
  {
    id: 'editor-fold-all',
    title: 'Fold All Sections',
    category: 'Editor',
    icon: '▸',
    action: (cm) => foldAllSections(cm)
  },
  {
    id: 'editor-unfold-all',
    title: 'Unfold All Sections',
    category: 'Editor',
    icon: '▾',
    action: (cm) => unfoldAllSections(cm)
  },
  {
    id: 'score-compile',
    title: 'Compile Sheet Music & LilyPond',
    category: 'Score',
    icon: '▶',
    shortcut: 'Ctrl+Enter',
    action: () => triggerCompile()
  },
  {
    id: 'score-export-pdf',
    title: 'Export PDF',
    category: 'Score',
    icon: '📑',
    action: () => exportStandalonePdf()
  }
];

function getAllCommandsList() {
  const dynamicSnippetCommands = (SNIPPET_TEMPLATES || []).map(s => ({
    id: `snip-cmd-${s.id}`,
    title: `Insert Snippet: ${s.label || s.displayText}`,
    category: s.category || 'Snippets',
    icon: s.icon || '📄',
    action: (cm) => insertSnippetById(cm, s.id)
  }));

  return [...BASE_COMMANDS_LIST, ...dynamicSnippetCommands];
}

const commandPaletteModal = document.getElementById('command-palette-modal');
const paletteSearchInput = document.getElementById('palette-search');
const paletteListEl = document.getElementById('palette-list');
const paletteBackdrop = document.getElementById('palette-backdrop');
const btnCommandPalette = document.getElementById('btn-command-palette');

const refactorModal = document.getElementById('refactor-modal');
const btnCloseRefactor = document.getElementById('btn-close-refactor');
const btnRefactorCancel = document.getElementById('btn-refactor-cancel');
const btnRefactorConfirm = document.getElementById('btn-refactor-confirm');
const refactorBackdrop = document.getElementById('refactor-backdrop');

let paletteActiveIndex = 0;
let paletteFilteredCommands = [];
let isTapestryPickerMode = false;
let isGotoSymbolMode = false;

function openTapestryPicker() {
  if (!commandPaletteModal) return;
  commandPaletteModal.classList.remove('hidden');
  isTapestryPickerMode = true;
  isGotoSymbolMode = false;
  paletteSearchInput.value = '';
  paletteSearchInput.placeholder = 'Search tapestries by title, composer, arranger, tonic...';
  paletteActiveIndex = 0;
  filterPaletteList('');
  setTimeout(() => {
    paletteSearchInput.focus();
  }, 50);
}

function openGotoReferencePalette(cm) {
  if (!commandPaletteModal) return;
  commandPaletteModal.classList.remove('hidden');
  isTapestryPickerMode = false;
  isGotoSymbolMode = true;
  paletteSearchInput.value = '';
  paletteSearchInput.placeholder = 'Go to symbol (type w: for weaves, c: for coils, k: for knots, s: for sections)...';
  paletteActiveIndex = 0;
  filterPaletteList('');
  setTimeout(() => {
    paletteSearchInput.focus();
  }, 50);
}

function scanAllSymbolsInDocument(cm) {
  if (!cm) return [];
  const lines = cm.getValue().split('\n');
  const symbols = [];
  let currentSection = null;
  let sectionIndent = 0;

  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const indent = getLineIndent(line);

    // Section headers
    const sectionMatch = line.match(/^(\s*)(tapestry|knot|knots|weaves|coils|engraving)\s*:/i);
    if (sectionMatch) {
      const secName = sectionMatch[2].toLowerCase();
      if (indent === 0 || secName === 'weaves' || secName === 'coils' || secName === 'knots' || secName === 'knot' || secName === 'engraving') {
        symbols.push({
          type: 'section',
          id: sectionMatch[2],
          line: l,
          ch: line.indexOf(sectionMatch[2]),
          subtitle: 'Section header'
        });
        currentSection = secName;
        sectionIndent = indent;
        continue;
      }
    }

    // Dictionary keys
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
          if (nextL.startsWith('melody:') || nextL.startsWith('children:') || nextL.startsWith('weave:') || nextL.startsWith('tonic:')) {
            preview = nextL.slice(0, 40);
          }
        }

        symbols.push({
          type,
          id: key,
          line: l,
          ch: line.indexOf(key),
          subtitle: preview
        });
      }
    }

    // Inline definitions
    const inlineMatch = line.match(/^\s*-\s*(coil|weave)\s*:\s*["']?([_a-zA-Z0-9]+)["']?/i);
    if (inlineMatch) {
      symbols.push({
        type: inlineMatch[1].toLowerCase(),
        id: inlineMatch[2],
        line: l,
        ch: line.indexOf(inlineMatch[2]),
        subtitle: 'Inline reference'
      });
    }
  }

  return symbols;
}

function openCommandPalette(cm) {
  if (!commandPaletteModal) return;
  commandPaletteModal.classList.remove('hidden');
  isTapestryPickerMode = false;
  isGotoSymbolMode = false;
  paletteSearchInput.value = '';
  paletteSearchInput.placeholder = 'Type a command or search tapestries by title/composer...';
  paletteActiveIndex = 0;
  filterPaletteList('');
  setTimeout(() => {
    paletteSearchInput.focus();
  }, 50);
}

function closeCommandPalette() {
  if (commandPaletteModal) {
    commandPaletteModal.classList.add('hidden');
    isTapestryPickerMode = false;
    isGotoSymbolMode = false;
    editor.focus();
  }
}

function filterPaletteList(query) {
  const q = (query || '').toLowerCase().trim();

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
          editor.setCursor({ line: sym.line, ch: sym.ch || 0 });
          editor.scrollIntoView({ line: sym.line, ch: 0 }, 100);
          editor.addLineClass(sym.line, 'background', 'cm-point-click-flash');
          setTimeout(() => {
            editor.removeLineClass(sym.line, 'background', 'cm-point-click-flash');
          }, 1200);
        }
      };
    });
  } else if (isTapestryPickerMode) {
    paletteFilteredCommands = (cachedScores || []).filter(s => {
      if (!q) return true;
      return (
        (s.title && s.title.toLowerCase().includes(q)) ||
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.composer && s.composer.toLowerCase().includes(q)) ||
        (s.arranger && s.arranger.toLowerCase().includes(q)) ||
        (s.tonic && s.tonic.toLowerCase().includes(q)) ||
        (s.tempo && s.tempo.toLowerCase().includes(q))
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
        action: () => loadScore(s.path)
      };
    });
  } else {
    const allCommands = getAllCommandsList();
    const cmdMatches = allCommands.filter(cmd => {
      if (!q) return true;
      return cmd.title.toLowerCase().includes(q) || cmd.category.toLowerCase().includes(q) || (cmd.shortcut && cmd.shortcut.toLowerCase().includes(q));
    });

    const scoreMatches = q ? (cachedScores || []).filter(s => {
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
        action: () => loadScore(s.path)
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
  closeCommandPalette();
  if (cmd && typeof cmd.action === 'function') {
    setTimeout(() => {
      cmd.action(editor);
    }, 50);
  }
}

if (btnCommandPalette) {
  btnCommandPalette.addEventListener('click', () => openCommandPalette(editor));
}

if (paletteBackdrop) {
  paletteBackdrop.addEventListener('click', closeCommandPalette);
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
      closeCommandPalette();
    }
  });
}

if (btnCloseRefactor) {
  btnCloseRefactor.addEventListener('click', () => closeRefactorDialog(false));
}

if (btnRefactorCancel) {
  btnRefactorCancel.addEventListener('click', () => closeRefactorDialog(false));
}

if (btnRefactorConfirm) {
  btnRefactorConfirm.addEventListener('click', () => closeRefactorDialog(true));
}

if (refactorBackdrop) {
  refactorBackdrop.addEventListener('click', () => closeRefactorDialog(false));
}

const refactorModalCard = document.querySelector('.refactor-card');
if (refactorModalCard) {
  refactorModalCard.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      closeRefactorDialog(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeRefactorDialog(false);
    }
  });
}

// Global Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
  if (e.key === 'Shift') {
    isShiftHeld = true;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveScore();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
    e.preventDefault();
    openTapestryPicker();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    createTapestry();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    triggerCompile();
  }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
    e.preventDefault();
    openCommandPalette(editor);
  }
  if (e.key === 'F1') {
    e.preventDefault();
    openCommandPalette(editor);
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'Shift') {
    isShiftHeld = false;
    if (!isMagnifierToggled && magnifierLens) {
      magnifierLens.classList.add('hidden');
    }
  }
});

// Initialize on Load
bindPlaceholderButtons();
fetchScores();
fetchSnippets();
