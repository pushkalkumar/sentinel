import clsx from 'clsx'
import type { ReactNode } from 'react'
import { Skeleton } from './Skeleton'

export interface Column<T> {
  key: string
  header: ReactNode
  align?: 'left' | 'right' | 'center'
  mono?: boolean
  width?: string | number
  render?: (row: T) => ReactNode
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  selectedKey?: string | number | null
  onSelect?: (row: T) => void
  empty: string
  emptyAction?: ReactNode
  loading?: boolean
  error?: string | null
  sticky?: boolean
  className?: string
}

function cellValue<T>(row: T, col: Column<T>): ReactNode {
  if (col.render) return col.render(row)
  const v = (row as Record<string, unknown>)[col.key]
  return v === null || v === undefined ? '' : String(v)
}

/** DESIGN §6.4: 32px rows, 28px signage header, hairline dividers, left signal bar on the selected row. */
export function DataTable<T>({
  columns, rows, rowKey, selectedKey = null, onSelect, empty, emptyAction, loading = false, error = null, sticky = true, className,
}: DataTableProps<T>) {
  const interactive = Boolean(onSelect)
  return (
    <div className={clsx('overflow-auto min-w-0', className)}>
      <table className="w-full border-collapse text-sm">
        <thead className={clsx(sticky && 'sticky top-0 z-[1] bg-surface')}>
          <tr className="h-7 border-b border-line-strong">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                style={{ width: c.width }}
                className={clsx('label-signage font-semibold px-3 whitespace-nowrap', c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left')}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-4">
                <Skeleton />
              </td>
            </tr>
          )}
          {!loading && error && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="h-24 px-3 text-center text-alarm text-sm">{error}</td>
            </tr>
          )}
          {!loading && !error && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="h-24 px-3 text-center text-ink-3 text-sm">
                <div className="flex flex-col items-center gap-2">
                  <span>{empty}</span>
                  {emptyAction}
                </div>
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const k = rowKey(row)
            const selected = selectedKey !== null && k === selectedKey
            return (
              <tr
                key={k}
                tabIndex={interactive ? 0 : undefined}
                aria-selected={interactive ? selected : undefined}
                onClick={interactive ? () => onSelect?.(row) : undefined}
                onKeyDown={interactive ? (e) => { if (e.key === 'Enter') onSelect?.(row) } : undefined}
                className={clsx(
                  'h-8 border-b border-line relative transition-[background-color] duration-[120ms]',
                  interactive && 'cursor-pointer hover:bg-raised',
                  selected && 'bg-signal-dim shadow-[inset_2px_0_0_var(--color-signal)]',
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={clsx(
                      'px-3 py-2 align-middle',
                      c.mono ? 'font-mono text-xs text-ink-2' : 'text-sm text-ink',
                      c.align === 'right' ? 'text-right tabular-nums' : c.align === 'center' ? 'text-center' : 'text-left',
                    )}
                  >
                    {cellValue(row, c)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
