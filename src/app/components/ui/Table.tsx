type TableProps = {
  headers: string[]
  rows: string[][]
}

export default function Table({ headers, rows }: TableProps) {
  return (
    <div className="fp-card overflow-x-auto">
      <table className="w-full text-sm text-left fp-table">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
