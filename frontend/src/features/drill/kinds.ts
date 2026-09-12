import type { DrillKind } from '@/lib/types'

export const DRILL_KIND_LABEL: Record<DrillKind, string> = {
  fire: 'Fire drill',
  lockdown: 'Lockdown drill',
  earthquake: 'Earthquake drill',
}

export const DRILL_KINDS: DrillKind[] = ['fire', 'lockdown', 'earthquake']
