/**
 * Lightweight, dependency-free Standard MIDI File (SMF Format 1) generator.
 * 
 * Used for validating the resolved onset stream via audio/MIDI playback (Phase 1).
 */
import { writeFileSync } from 'node:fs';
import type { OnsetStream } from '../schema/onset.js';

export interface MidiOptions {
  /** Tempo in beats per minute (default: 120) */
  tempo?: number;
  /** Ticks per quarter note (default: 480) */
  ticksPerQuarter?: number;
  /** Note duration in quarter notes for placeholder timing (default: 1) */
  durationQuarterNotes?: number;
}

/**
 * Encodes an integer as a MIDI Variable-Length Quantity (VLQ).
 */
function toVariableLength(value: number): number[] {
  const bytes: number[] = [];
  let buffer = value & 0x7f;
  
  while ((value >>= 7) > 0) {
    buffer <<= 8;
    buffer |= (value & 0x7f) | 0x80;
  }
  
  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) {
      buffer >>= 8;
    } else {
      break;
    }
  }
  
  return bytes;
}

/**
 * Helper to write a 16-bit big-endian integer.
 */
function uint16(value: number): number[] {
  return [(value >> 8) & 0xff, value & 0xff];
}

/**
 * Helper to write a 32-bit big-endian integer.
 */
function uint32(value: number): number[] {
  return [
    (value >> 24) & 0xff,
    (value >> 16) & 0xff,
    (value >> 8) & 0xff,
    value & 0xff,
  ];
}

/**
 * Converts microsecond tempo from BPM.
 */
function bpmToMicroseconds(bpm: number): number {
  return Math.round(60_000_000 / bpm);
}

/**
 * Creates a complete Standard MIDI File (Format 1) binary buffer from an onset stream.
 * 
 * - Track 0: Conductor / Tempo track
 * - Track 1: Melody (Channel 0)
 * - Track 2: Harmony Triads (Channel 1)
 * 
 * @param onsets - The resolved onset stream
 * @param options - MIDI options (tempo, ticksPerQuarter, etc.)
 * @returns Uint8Array containing valid SMF binary data
 */
export function createMidiBuffer(
  onsets: OnsetStream,
  options: MidiOptions = {},
): Uint8Array {
  const bpm = options.tempo ?? 120;
  const ppq = options.ticksPerQuarter ?? 480;
  const durationTicks = Math.round((options.durationQuarterNotes ?? 1) * ppq);
  const usPerQuarter = bpmToMicroseconds(bpm);
  
  // === Track 0: Conductor (Tempo) ===
  const track0Events: number[] = [
    // Delta 0, Set Tempo meta event (FF 51 03 tt tt tt)
    0x00, 0xff, 0x51, 0x03,
    (usPerQuarter >> 16) & 0xff,
    (usPerQuarter >> 8) & 0xff,
    usPerQuarter & 0xff,
    // Delta 0, End of Track meta event (FF 2F 00)
    0x00, 0xff, 0x2f, 0x00,
  ];

  // === Track 1: Melody (Channel 0) ===
  const track1Events: number[] = [];
  // Track Name: "Melody"
  const melodyName = Buffer.from('Melody');
  track1Events.push(0x00, 0xff, 0x03, melodyName.length, ...melodyName);

  for (const onset of onsets) {
    const pitch = onset.midiNote;
    // Note On: Delta 0, 90 (channel 0), pitch, velocity 90
    track1Events.push(0x00, 0x90, pitch, 0x5a);
    // Note Off: Delta durationTicks, 80 (channel 0), pitch, velocity 0
    track1Events.push(...toVariableLength(durationTicks), 0x80, pitch, 0x00);
  }
  // End of Track
  track1Events.push(0x00, 0xff, 0x2f, 0x00);

  // === Track 2: Harmony Triads (Channel 1) ===
  const track2Events: number[] = [];
  // Track Name: "Harmony"
  const harmonyName = Buffer.from('Harmony');
  track2Events.push(0x00, 0xff, 0x03, harmonyName.length, ...harmonyName);

  for (const onset of onsets) {
    const triad = onset.chordMidi; // [root, 3rd, 5th]
    
    // Note On for all 3 chord tones at delta 0
    track2Events.push(0x00, 0x91, triad[0], 0x48);
    track2Events.push(0x00, 0x91, triad[1], 0x48);
    track2Events.push(0x00, 0x91, triad[2], 0x48);
    
    // Note Off for all 3 chord tones after durationTicks
    track2Events.push(...toVariableLength(durationTicks), 0x81, triad[0], 0x00);
    track2Events.push(0x00, 0x81, triad[1], 0x00);
    track2Events.push(0x00, 0x81, triad[2], 0x00);
  }
  // End of Track
  track2Events.push(0x00, 0xff, 0x2f, 0x00);

  // === Assemble Tracks into SMF Format 1 ===
  const tracks = [track0Events, track1Events, track2Events];
  
  // Header chunk: MThd, length=6, format=1, numTracks=3, division=ppq
  const header: number[] = [
    0x4d, 0x54, 0x68, 0x64, // "MThd"
    0x00, 0x00, 0x00, 0x06, // chunk length = 6
    ...uint16(1),           // format 1
    ...uint16(tracks.length), // 3 tracks
    ...uint16(ppq),         // division (PPQ)
  ];

  const fullBytes: number[] = [...header];

  for (const trk of tracks) {
    fullBytes.push(
      0x4d, 0x54, 0x72, 0x6b, // "MTrk"
      ...uint32(trk.length),   // track chunk length
      ...trk,
    );
  }

  return new Uint8Array(fullBytes);
}

/**
 * Exports an onset stream as a `.mid` standard MIDI file to disk.
 * 
 * @param onsets - The resolved onset stream
 * @param filePath - Output file path (.mid)
 * @param options - MIDI options (tempo, ticksPerQuarter, etc.)
 */
export function writeMidiFile(
  onsets: OnsetStream,
  filePath: string,
  options: MidiOptions = {},
): void {
  const buffer = createMidiBuffer(onsets, options);
  writeFileSync(filePath, buffer);
}
