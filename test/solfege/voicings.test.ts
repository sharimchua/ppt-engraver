import { describe, it, expect } from 'vitest';
import {
  generateChordVoicing,
  calculateVoiceLeadingDistance,
  generateSmoothVoiceLeading,
  getChordIntervals,
} from '../../src/solfege/voicings.js';

describe('Voicings Engine', () => {
  it('builds standard close tertian triads and 7ths', () => {
    // C4 major triad = [60, 64, 67]
    const cMajor = generateChordVoicing(60, 'Do', { voicing: 'close' });
    expect(cMajor).toEqual([60, 64, 67]);

    // C4 minor triad = [60, 63, 67]
    const cMinor = generateChordVoicing(60, 'DoMe', { voicing: 'close' });
    expect(cMinor).toEqual([60, 63, 67]);

    // C4 dominant 7th = [60, 64, 67, 70]
    const c7 = generateChordVoicing(60, 'DoTe', { voicing: 'close' });
    expect(c7).toEqual([60, 64, 67, 70]);
  });

  it('builds rootless voicings without root tone', () => {
    // C4 rootless major triad (3rd, 5th, 9th = 64, 67, 74)
    const cRootless = generateChordVoicing(60, 'Do', { voicing: 'rootless' });
    expect(cRootless).not.toContain(60);
    expect(cRootless).toEqual([64, 67, 74]);

    // C4 rootless 7th (3rd, 5th, 7th, 9th = 64, 67, 70, 74)
    const c7Rootless = generateChordVoicing(60, 'DoTe', { voicing: 'rootless' });
    expect(c7Rootless).not.toContain(60);
    expect(c7Rootless).toEqual([64, 67, 70, 74]);
  });

  it('builds rootFifth power chords', () => {
    const c5 = generateChordVoicing(60, 'Do', { voicing: 'rootFifth' });
    expect(c5).toEqual([60, 67]);
  });

  it('builds shell voicings', () => {
    // C4 shell with 7th = [60, 70, 76] (Root, 7th, 3rd+12)
    const c7Shell = generateChordVoicing(60, 'DoTe', { voicing: 'shell' });
    expect(c7Shell).toEqual([60, 70, 76]);

    // C4 triad shell = [60, 64, 67]
    const cShell = generateChordVoicing(60, 'Do', { voicing: 'shell' });
    expect(cShell).toEqual([60, 64, 67]);
  });

  it('builds open / spread voicings (1-5-10)', () => {
    // C4 open 1-5-10 = [60, 67, 76] (Root, 5th, 3rd+12)
    const cOpen = generateChordVoicing(60, 'Do', { voicing: 'open' });
    expect(cOpen).toEqual([60, 67, 76]);

    // C4 open 7th 1-5-7-10 = [60, 67, 70, 76]
    const c7Open = generateChordVoicing(60, 'DoTe', { voicing: 'open' });
    expect(c7Open).toEqual([60, 67, 70, 76]);
  });

  it('builds bassOnly and walkingBass voicings', () => {
    const cBass = generateChordVoicing(60, 'Do', { voicing: 'bassOnly' });
    expect(cBass).toEqual([60]);

    const cOct = generateChordVoicing(60, 'Do', { voicing: 'octaves' });
    expect(cOct).toEqual([48, 60]);
  });

  it('calculates smooth voice leading transitions minimizing distance', () => {
    // ii-V-I progression: Dm7 -> G7 -> Cmaj7
    // Dm7 root = 62 (D4). Candidate pcs: [62, 65, 69, 72] (D, F, A, C)
    const dm7 = generateChordVoicing(62, 'ReFaLaDo', { voicing: 'smoothLead' });
    
    // G7 root = 67 (G4). Candidate pcs: [67, 71, 74, 77] (G, B, D, F)
    const g7 = generateChordVoicing(67, 'SoTiReFa', {
      voicing: 'smoothLead',
      previousChordMidi: dm7,
    });

    const dist = calculateVoiceLeadingDistance(dm7, g7);
    expect(dist).toBeLessThan(100); // Very close voice movement
  });
});
