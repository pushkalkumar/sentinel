// Phone (light ground) surface vocabulary, DESIGN_V2 §4: no hairline cards, tone and a soft edge instead of lines.

/** Soft 1px edge at 8 percent. Reads as tone, not a drawn border. Buttons and inputs only, never cards. */
export const RING = 'shadow-[0_0_0_1px_rgba(11,10,9,0.08)]'

/** White slab on the warm canvas. Cards, quotes, summaries. No border, 20px radius. */
export const SLAB = 'bg-f-surface rounded-xl'

/** Text fields. 14px radius, soft edge, teal focus ring. */
export const FIELD_INPUT = `w-full ${SLAB} rounded-lg ${RING} text-f-ink placeholder:text-f-ink-2/70 px-4 outline-none font-field text-[17px] focus:shadow-[0_0_0_2px_var(--color-f-signal)]`

/** Muted footer line: one per page, DESIGN_V2 §2.4. */
export const HONESTY = 'text-[13px] leading-5 text-f-ink-2/80'
