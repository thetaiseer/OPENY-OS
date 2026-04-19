import type { ReactNode } from 'react';

interface TableProps {
  columns: string[];
  rows: ReactNode[][];
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
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
