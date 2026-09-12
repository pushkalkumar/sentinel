// Phone (light ground) surface vocabulary, DESIGN_V2 §4: no hairline cards, tone and a soft edge instead of lines.

/** Soft 1px edge at 8 percent. Reads as tone, not a drawn border. Buttons and inputs only, never cards. */
export const RING = 'shadow-[0_0_0_1px_rgba(11,10,9,0.08)]'

/** White slab on the warm canvas. Cards, quotes, summaries. No border, 20px radius. */
export const SLAB = 'bg-f-surface rounded-xl'

/** Text fields. 14px radius, soft edge, teal focus ring. */
export const FIELD_INPUT = `w-full ${SLAB} rounded-lg ${RING} text-f-ink placeholder:text-f-ink-2/70 px-4 outline-none font-field text-[17px] focus:shadow-[0_0_0_2px_var(--color-f-signal)]`

/** Muted footer line: one per page, DESIGN_V2 §2.4. */
export const HONESTY = 'text-[13px] leading-5 text-f-ink-2/80'

/** CONTRACT §4.4 code alphabet: 0, O, 1, I and L are left out so nobody has to guess. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const CODE_CHARS = /[^ABCDEFGHJKMNPQRSTUVWXYZ23456789]/g
export const CODE_LEN = 4
/** The one sentence about the alphabet, used on every screen that shows or takes a code. */
export const CODE_HINT = 'Four characters. No 0, O, 1, I or L.'
