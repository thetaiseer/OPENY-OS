import type { ReactNode } from 'react';

interface TableRow {
  id: string;
  cells: ReactNode[];
}

interface TableProps {
  columns: string[];
  rows: TableRow[];
}

export default function Table({ columns, rows }: TableProps) {
  return (
    <div className="ds-table-wrap">
      <table className="ds-table">
        <thead>
          <tr>
            {columns.map(column => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id}>
              {row.cells.map((cell, cellIndex) => (
                <td key={`${row.id}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
