type InputProps = {
  label: string
  placeholder?: string
  error?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export default function Input({ label, placeholder, error, value, onChange }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="fp-label">{label}</label>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="fp-input"
        style={error ? { borderColor: '#DC2626', boxShadow: '0 0 0 3px rgba(220,38,38,0.1)' } : undefined}
      />
      {error && <span className="text-xs" style={{ color: '#DC2626' }}>{error}</span>}
    </div>
  )
}
