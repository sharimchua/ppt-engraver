\version "2.24.4"

melodyVoice = {
  \clef treble
  \accidentalStyle forget
  \cadenzaOn
  \tag #'ppt_verse_introMotif_1 c'4
  \tag #'ppt_verse_introMotif_2 e'4
  \tag #'ppt_verse_introMotif_3 g'4
  \tag #'ppt_verse_introMotif_4 c''4
  \bar "|"
  \tag #'ppt_verse_cadence_1 b'4
  \tag #'ppt_verse_cadence_2 c''4
  \cadenzaOff
}

harmonyVoice = {
  \clef treble
  \accidentalStyle forget
  \cadenzaOn
  \tag #'ppt_verse_introMotif_1 <c' e' g'>4
  \tag #'ppt_verse_introMotif_2 <c' e' g'>4
  \tag #'ppt_verse_introMotif_3 <c' e' g'>4
  \tag #'ppt_verse_introMotif_4 <c' e' g'>4
  \bar "|"
  \tag #'ppt_verse_cadence_1 <g b d'>4
  \tag #'ppt_verse_cadence_2 <g b d'>4
  \cadenzaOff
}

\score {
  <<
    \new ChordNames {
      \set chordChanges = ##t
      \harmonyVoice
    }
    \new PianoStaff <<
      \new Staff \melodyVoice
      \new Staff \harmonyVoice
    >>
  >>
  \layout {
    \context {
      \Staff
      \remove "Time_signature_engraver"
    }
  }
}
