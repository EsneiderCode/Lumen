import type { ReactNode } from 'react'

export interface TableColumn<T extends object> {
  align?: 'left' | 'right' | 'center'
  key: string
  label: ReactNode
  mono?: boolean
  render?: (row: T, index: number) => ReactNode
  width?: string
}

interface TableProps<T extends object> {
  columns: TableColumn<T>[]
  empty?: ReactNode
  loading?: boolean
  onRowClick?: (row: T, index: number) => void
  rows: T[]
}

const alignClass = {
  left: '',
  right: 'nx-table-right',
  center: 'nx-table-center',
}

function getFallbackValue<T extends object>(row: T, key: string): ReactNode {
  const value = (row as Record<string, unknown>)[key]
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number') return value
  return String(value)
}

export function Table<T extends object>({ columns, empty, loading = false, onRowClick, rows }: TableProps<T>) {
  return (
    <div className="nx-table-wrap">
      <table className="nx-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                className={alignClass[column.align ?? 'left']}
                key={column.key}
                style={column.width ? { width: column.width } : undefined}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td className="nx-table-empty" colSpan={columns.length}>
                [LOADING]
              </td>
            </tr>
          ) : null}
          {!loading && rows.length === 0 ? (
            <tr>
              <td className="nx-table-empty" colSpan={columns.length}>
                {empty ?? 'No records'}
              </td>
            </tr>
          ) : null}
          {!loading
            ? rows.map((row, index) => (
                <tr
                  className={onRowClick ? 'nx-table-clickable' : undefined}
                  key={index}
                  onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                >
                  {columns.map((column) => (
                    <td
                      className={[alignClass[column.align ?? 'left'], column.mono ? 'nx-table-mono' : '']
                        .filter(Boolean)
                        .join(' ')}
                      key={column.key}
                    >
                      {column.render ? column.render(row, index) : getFallbackValue(row, column.key)}
                    </td>
                  ))}
                </tr>
              ))
            : null}
        </tbody>
      </table>
    </div>
  )
}
