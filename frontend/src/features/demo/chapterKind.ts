// Chapter ids come from the backend script; the screen keys a few behaviours off them loosely
// (phone mock, map layer) so a renamed chapter degrades to the default rather than breaking.
export type ChapterKind = 'calm' | 'smoke' | 'fire' | 'report' | 'respond' | 'rollcall' | 'clear' | 'other'

const PATTERNS: [RegExp, ChapterKind][] = [
  [/report|incident|phone/i, 'report'],
  [/respond|ack|route/i, 'respond'],
  [/roll|drill|muster/i, 'rollcall'],
  [/fire|alarm/i, 'fire'],
  [/smoke|haze/i, 'smoke'],
  [/clear|resolve|end/i, 'clear'],
  [/calm|quiet|morning/i, 'calm'],
]

export function chapterKind(id: string | undefined): ChapterKind {
  if (!id) return 'other'
  for (const [re, kind] of PATTERNS) if (re.test(id)) return kind
  return 'other'
}
