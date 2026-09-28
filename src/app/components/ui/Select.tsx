type SelectProps = {
  label: string
  options: { label: string; value: string }[]
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
}

export default function Select({ label, options, value, onChange }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="fp-label">{label}</label>
      <select
        value={value}
        onChange={onChange}
        className="fp-input fp-select"
      >
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}
