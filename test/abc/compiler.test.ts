import { describe, it, expect } from 'vitest';
import { pitchToAbc, midiToAbc } from '../../src/abc/pitch.js';
import { beatsToAbcDuration, parseMeterToBeats, deriveAbcMeter } from '../../src/abc/rhythm.js';
import { compileToAbc, chordTokenToLeadSheet, deriveAbcKey, calculateScoreTiming, formatTimestamp } from '../../src/abc/compiler.js';
import type { OnsetStream } from '../../src/schema/onset.js';
import type { ResolvedKnot } from '../../src/solfege/pitch.js';

describe('ABC Pitch Converter', () => {
  it('converts scientific pitches across octaves correctly', () => {
    // Octave 4: Uppercase
    expect(pitchToAbc('C4')).toBe('C');
    expect(pitchToAbc('D4')).toBe('D');
    expect(pitchToAbc('B4')).toBe('B');

    // Octave 5: Lowercase
    expect(pitchToAbc('C5')).toBe('c');
    expect(pitchToAbc('G5')).toBe('g');

    // Octave 6+: Lowercase with quotes
    expect(pitchToAbc('C6')).toBe("c'");
    expect(pitchToAbc('E7')).toBe("e''");

    // Octave 3: Uppercase with comma
    expect(pitchToAbc('C3')).toBe('C,');
    expect(pitchToAbc('A3')).toBe('A,');

    // Octave 2: Uppercase with two commas
    expect(pitchToAbc('C2')).toBe('C,,');

    // Accidentals
    expect(pitchToAbc('F#4')).toBe('^F');
    expect(pitchToAbc('Bb4')).toBe('_B');
    expect(pitchToAbc('F#3')).toBe('^F,');
    expect(pitchToAbc('Eb5')).toBe('_e');
    expect(pitchToAbc('C#6')).toBe("^c'");

    // Rests
    expect(pitchToAbc('rest', true)).toBe('z');
    expect(pitchToAbc(null, true)).toBe('z');
    expect(pitchToAbc('r')).toBe('z');
  });

  it('converts MIDI note numbers to ABC pitch tokens', () => {
    expect(midiToAbc(60)).toBe('C');
    expect(midiToAbc(72)).toBe('c');
    expect(midiToAbc(48)).toBe('C,');
    expect(midiToAbc(66, 'sharp')).toBe('^F');
    expect(midiToAbc(70, 'flat')).toBe('_B'); // Octave 4 Bb
  });
});

describe('ABC Rhythm Converter', () => {
  it('parses time signatures into quarter-note beats per measure', () => {
    expect(parseMeterToBeats('4/4')).toBe(4.0);
    expect(parseMeterToBeats('3/4')).toBe(3.0);
    expect(parseMeterToBeats('2/4')).toBe(2.0);
    expect(parseMeterToBeats('6/8')).toBe(3.0);
    expect(parseMeterToBeats('5/4')).toBe(5.0);

    // PPT Solfège pulse grammar specifications
    expect(parseMeterToBeats('DoRe')).toBe(3.0); // 3/4
    expect(parseMeterToBeats('DoSo')).toBe(2.0); // 2/4
    expect(parseMeterToBeats('DoLa')).toBe(4.0); // 4/4
    expect(parseMeterToBeats('DoMi')).toBe(5.0); // 5/4
    expect(parseMeterToBeats('DoReDiRe')).toBe(3.0); // 6/8
    expect(parseMeterToBeats('DoReDiSo')).toBe(5.0); // 5/4
    expect(parseMeterToBeats(['Dox', 'Re', 'So'])).toBe(3.0);
    expect(parseMeterToBeats([3, 4])).toBe(3.0);
    expect(parseMeterToBeats([6, 8])).toBe(3.0);
  });

  it('derives ABC meter headers and beats per measure from Solfège pulses', () => {
    expect(deriveAbcMeter('DoRe')).toEqual({ meterString: '3/4', beatsPerMeasure: 3.0 });
    expect(deriveAbcMeter('DoSo')).toEqual({ meterString: '2/4', beatsPerMeasure: 2.0 });
    expect(deriveAbcMeter('DoLa')).toEqual({ meterString: '4/4', beatsPerMeasure: 4.0 });
    expect(deriveAbcMeter('DoMi')).toEqual({ meterString: '5/4', beatsPerMeasure: 5.0 });
    expect(deriveAbcMeter('DoSi')).toEqual({ meterString: '6/8', beatsPerMeasure: 3.0 });
    expect(deriveAbcMeter('DoReDiRe')).toEqual({ meterString: '6/8', beatsPerMeasure: 3.0 });
    expect(deriveAbcMeter('DoReDiSo')).toEqual({ meterString: '5/4', beatsPerMeasure: 5.0 });
    expect(deriveAbcMeter(['Dox', 'Re', 'So'])).toEqual({ meterString: '3/4', beatsPerMeasure: 3.0 });
    expect(deriveAbcMeter('3/4')).toEqual({ meterString: '3/4', beatsPerMeasure: 3.0 });
    expect(deriveAbcMeter('6/8')).toEqual({ meterString: '6/8', beatsPerMeasure: 3.0 });
    expect(deriveAbcMeter(undefined)).toEqual({ meterString: '4/4', beatsPerMeasure: 4.0 });
  });

  it('converts beat durations to ABC note length units (L: 1/8)', () => {
    // In L: 1/8, 0.5 beat = 1 unit -> ""
    expect(beatsToAbcDuration(0.5)).toBe('');

    // 1.0 beat (quarter) = 2 units -> "2"
    expect(beatsToAbcDuration(1.0)).toBe('2');

    // 2.0 beats (half) = 4 units -> "4"
    expect(beatsToAbcDuration(2.0)).toBe('4');

    // 4.0 beats (whole) = 8 units -> "8"
    expect(beatsToAbcDuration(4.0)).toBe('8');

    // 1.5 beats (dotted quarter) = 3 units -> "3"
    expect(beatsToAbcDuration(1.5)).toBe('3');

    // 0.25 beat (sixteenth) = 0.5 unit -> "/2"
    expect(beatsToAbcDuration(0.25)).toBe('/2');

    // 0.75 beat (dotted eighth) = 1.5 units -> "3/2"
    expect(beatsToAbcDuration(0.75)).toBe('3/2');
  });
});

describe('ABC Compiler', () => {
  it('translates Solfège chord tokens to standard lead-sheet chord names', () => {
    // When Do is C4 (MIDI 60)
    expect(chordTokenToLeadSheet('Do', 60)).toBe('C');
    expect(chordTokenToLeadSheet('DoMe', 60)).toBe('Cm');
    expect(chordTokenToLeadSheet('DoTe', 60)).toBe('C7');
    expect(chordTokenToLeadSheet('DoTi', 60)).toBe('Cmaj7');
    expect(chordTokenToLeadSheet('ReMeTe', 60)).toBe('Dm7');
    expect(chordTokenToLeadSheet('ReTe', 60)).toBe('D7');
    expect(chordTokenToLeadSheet('SoTe', 60)).toBe('G7');
    expect(chordTokenToLeadSheet('LaMe', 60)).toBe('Am');
    expect(chordTokenToLeadSheet('LaMeTe', 60)).toBe('Am7');
    expect(chordTokenToLeadSheet('FaTi', 60)).toBe('Fmaj7');
    expect(chordTokenToLeadSheet('TiMeFiLa', 60)).toBe('Bdim7');
    expect(chordTokenToLeadSheet('TiMeFiTe', 60)).toBe('Bm7b5');
    expect(chordTokenToLeadSheet('DoMeFiTe', 60)).toBe('Cm7b5');

    // Slash chords
    expect(chordTokenToLeadSheet('SoxDo', 60)).toBe('C/G');
    expect(chordTokenToLeadSheet('MexDoMe', 60)).toBe('Cm/D#');
  });

  it('derives ABC key signature from Knot tonic and scale', () => {
    expect(deriveAbcKey({ doName: 'C4', scale: 'Do', doMidi: 60 } as ResolvedKnot)).toBe('C');
    expect(deriveAbcKey({ doName: 'G4', scale: 'Do', doMidi: 67 } as ResolvedKnot)).toBe('G');
    expect(deriveAbcKey({ tonic: 'A4', scale: 'La', doMidi: 69 } as any)).toBe('Am');
    expect(deriveAbcKey({ doName: 'D4', scale: 'Re', doMidi: 62 } as ResolvedKnot)).toBe('Dm');
    expect(deriveAbcKey({ doName: 'Bb4', scale: 'Do', doMidi: 70 } as ResolvedKnot)).toBe('Bb');
    expect(deriveAbcKey({ doName: 'Eb4', scale: 'Do', doMidi: 63 } as ResolvedKnot)).toBe('Eb');
    expect(deriveAbcKey({ doName: 'F#4', scale: 'Do', doMidi: 66 } as ResolvedKnot)).toBe('F#');
  });

  it('compiles a multi-measure OnsetStream into YuE2 ABC format', () => {
    const onsets: OnsetStream = [
      {
        tag: 'ppt_lead_m1_1',
        pitch: 'A4',
        midiNote: 69,
        scaleDegree: 'La',
        chordTones: ['A4', 'C5', 'E5', 'G5'],
        chordMidi: [69, 72, 76, 79],
        chordRoot: 'LaMeTe',
        coilId: 'm1',
        weaveId: 'lead',
        onsetIndex: 1,
        startBeat: 0,
        durationBeats: 2.0,
      },
      {
        tag: 'ppt_lead_m1_2',
        pitch: 'C5',
        midiNote: 72,
        scaleDegree: 'Do^',
        chordTones: ['A4', 'C5', 'E5', 'G5'],
        chordMidi: [69, 72, 76, 79],
        chordRoot: 'LaMeTe',
        coilId: 'm1',
        weaveId: 'lead',
        onsetIndex: 2,
        startBeat: 2.0,
        durationBeats: 2.0,
      },
      {
        tag: 'ppt_lead_m2_1',
        pitch: 'D5',
        midiNote: 74,
        scaleDegree: 'Re^',
        chordTones: ['D4', 'F#4', 'A4', 'C5'],
        chordMidi: [62, 66, 69, 72],
        chordRoot: 'ReTe', // D7
        coilId: 'm2',
        weaveId: 'lead',
        onsetIndex: 1,
        startBeat: 4.0,
        durationBeats: 4.0,
      },
    ];

    const knot: ResolvedKnot = {
      title: 'Autumn Melody',
      composer: 'Test Author',
      tempo: 120,
      tonic: 'C4',
      scale: 'Do',
      meter: '4/4',
      doMidi: 60,
    } as ResolvedKnot;

    const abc = compileToAbc(onsets, knot, { measuresPerBlock: 2 });

    expect(abc).toContain('X:1');
    expect(abc).toContain('T:Autumn Melody');
    expect(abc).toContain('C:Test Author');
    expect(abc).toContain('M:4/4');
    expect(abc).toContain('L:1/16');
    expect(abc).toContain('Q:1/4=120');
    expect(abc).toContain('V: InsLead clef=treble name="InsLead Melody" snm="Inst."');
    expect(abc).toContain('V: Ins clef=treble name="Ins Melody" snm="Inst."');
    expect(abc).toContain('K:C');
    expect(abc).toContain('% intro');
    expect(abc).toContain('% outro');
    expect(abc).toContain('"Am7"A8c8|"D7"d16|');
    expect(abc).toContain('Z2|');

    // Single-voice mode
    const singleAbc = compileToAbc(onsets, knot, { measuresPerBlock: 2, voiceMode: 'single' });
    expect(singleAbc).toContain('V: InsLead clef=treble name="InsLead Melody" snm="Inst."');
    expect(singleAbc).not.toContain('V: Ins\n');

    // Vocal lyrics mode
    const vocalAbc = compileToAbc(onsets, knot, { measuresPerBlock: 2, isInstrumental: false });
    expect(vocalAbc).toContain('V: Vocal clef=treble name="Vocal Melody" snm="Vocal"');
    expect(vocalAbc).toContain('V: Ins clef=treble name="Ins Melody" snm="Inst."');
    expect(vocalAbc).toContain('% intro');
  });
});

describe('Score Timing Calculator', () => {
  it('formats seconds into m:ss format correctly', () => {
    expect(formatTimestamp(0)).toBe('0:00');
    expect(formatTimestamp(8)).toBe('0:08');
    expect(formatTimestamp(15)).toBe('0:15');
    expect(formatTimestamp(65)).toBe('1:05');
    expect(formatTimestamp(125.4)).toBe('2:05');
  });

  it('calculates exact duration and timed section tags for a 4-measure score at 120 BPM', () => {
    const onsets: OnsetStream = [
      {
        tag: 't1',
        pitch: 'C4',
        weaveId: 'song',
        coilId: 'c1',
        onsetIndex: 1,
        startBeat: 0,
        durationBeats: 8.0, // 2 measures
      },
      {
        tag: 't2',
        pitch: 'G4',
        weaveId: 'song',
        coilId: 'c2',
        onsetIndex: 1,
        startBeat: 8.0,
        durationBeats: 8.0, // 2 measures -> total 16 beats = 4 measures
      },
    ];

    const knot: ResolvedKnot = {
      tempo: 120,
      meter: '4/4',
    } as ResolvedKnot;

    const timing = calculateScoreTiming(onsets, knot, { measuresPerBlock: 2 });

    expect(timing.tempo).toBe(120);
    expect(timing.meter).toBe('4/4');
    expect(timing.beatsPerMeasure).toBe(4.0);
    expect(timing.totalMeasures).toBe(4);
    expect(timing.totalBeats).toBe(16);

    // 4 measures at 120 BPM: 8.0 seconds of music + 2.0s outro decay buffer = 10.0 seconds
    expect(timing.durationSeconds).toBe(10.0);
    expect(timing.formattedDuration).toBe('0:10');

    // Sections: block 0 (intro, 0..2 bars = 0:00-0:04), block 1 (verse, 2..4 bars = 0:04-0:08), outro (0:08-0:10)
    expect(timing.sections.length).toBe(3);
    expect(timing.sections[0].timedTag).toBe('[intro 0:00-0:04]');
    expect(timing.sections[1].timedTag).toBe('[verse 0:04-0:08]');
    expect(timing.sections[2].timedTag).toBe('[outro 0:08-0:10]');

    expect(timing.timedSectionPlan).toBe('[intro 0:00-0:04]\n[verse 0:04-0:08]\n[outro 0:08-0:10]');
  });

  it('calculates timing at 90 BPM with semantic weave names', () => {
    const onsets: OnsetStream = [
      {
        tag: 't1',
        pitch: 'C4',
        weaveId: 'introduction',
        coilId: 'c1',
        onsetIndex: 1,
        startBeat: 0,
        durationBeats: 8.0,
      },
      {
        tag: 't2',
        pitch: 'E4',
        weaveId: 'verse',
        coilId: 'c2',
        onsetIndex: 1,
        startBeat: 8.0,
        durationBeats: 8.0,
      },
      {
        tag: 't3',
        pitch: 'G4',
        weaveId: 'resolution', // mapped to outro
        coilId: 'c3',
        onsetIndex: 1,
        startBeat: 16.0,
        durationBeats: 8.0,
      },
    ];

    const knot: ResolvedKnot = {
      tempo: 90,
      meter: '4/4',
    } as ResolvedKnot;

    const timing = calculateScoreTiming(onsets, knot, { measuresPerBlock: 2 });

    expect(timing.tempo).toBe(90);
    expect(timing.totalMeasures).toBe(6);
    expect(timing.totalBeats).toBe(24);

    // At 90 BPM: 1 beat = 60/90 = 0.6667s, 24 beats = 16.0s.
    // Section 3 is already named outro, so no extra outro buffer is appended.
    expect(timing.durationSeconds).toBe(16.0);
    expect(timing.formattedDuration).toBe('0:16');

    expect(timing.sections.length).toBe(3);
    expect(timing.sections[0].name).toBe('intro');
    expect(timing.sections[1].name).toBe('verse');
    expect(timing.sections[2].name).toBe('outro');
  });

  it('emits V: InsLead when isInstrumental is true or default', () => {
    const onsets: OnsetStream = [
      {
        tag: 't1',
        pitch: 'C4',
        weaveId: 'w1',
        coilId: 'c1',
        onsetIndex: 1,
        startBeat: 0,
        durationBeats: 4.0,
      },
    ];
    const knot: ResolvedKnot = { tempo: 120, meter: '4/4' } as ResolvedKnot;

    // Default (no vocal weave IDs)
    const abcDefault = compileToAbc(onsets, knot);
    expect(abcDefault).toContain('V: InsLead clef=treble name="InsLead Melody" snm="Inst."');
    expect(abcDefault).not.toContain('V: Vocal');

    // Explicit isInstrumental: true
    const abcInst = compileToAbc(onsets, knot, { isInstrumental: true });
    expect(abcInst).toContain('V: InsLead clef=treble name="InsLead Melody" snm="Inst."');
    expect(abcInst).not.toContain('V: Vocal');
  });

  it('emits V: Vocal only when isInstrumental is false', () => {
    const onsets: OnsetStream = [
      {
        tag: 't1',
        pitch: 'C4',
        weaveId: 'w1',
        coilId: 'c1',
        onsetIndex: 1,
        startBeat: 0,
        durationBeats: 4.0,
      },
    ];
    const knot: ResolvedKnot = { tempo: 120, meter: '4/4' } as ResolvedKnot;

    // Explicit isInstrumental: false
    const abcVocal = compileToAbc(onsets, knot, { isInstrumental: false });
    expect(abcVocal).toContain('V: Vocal clef=treble name="Vocal Melody" snm="Vocal"');
    expect(abcVocal).not.toContain('V: InsLead');
  });

  it('compiles scores with DoRe pulse to M:3/4 with 3-beat measure boundaries', () => {
    const onsets: OnsetStream = [
      {
        tag: 't1',
        pitch: 'F4',
        weaveId: 'song',
        coilId: 'c1',
        onsetIndex: 1,
        startBeat: 0,
        durationBeats: 1.0,
      },
      {
        tag: 't2',
        pitch: 'G4',
        weaveId: 'song',
        coilId: 'c1',
        onsetIndex: 2,
        startBeat: 1.0,
        durationBeats: 2.0,
      },
      {
        tag: 't3',
        pitch: 'A4',
        weaveId: 'song',
        coilId: 'c2',
        onsetIndex: 1,
        startBeat: 3.0,
        durationBeats: 3.0,
      },
    ];
    const knot: ResolvedKnot = { tempo: 120, pulse: 'DoRe' } as ResolvedKnot;

    const abc = compileToAbc(onsets, knot);
    expect(abc).toContain('M:3/4');
    expect(abc).toContain('L:1/16');

    const timing = calculateScoreTiming(onsets, knot);
    expect(timing.meter).toBe('3/4');
    expect(timing.beatsPerMeasure).toBe(3.0);
    expect(timing.totalMeasures).toBe(2);
    expect(timing.totalBeats).toBe(6.0);
  });
});


