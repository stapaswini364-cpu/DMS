type ButtonProps = {
  label: string
  variant?: 'primary' | 'secondary' | 'danger'
  onClick?: () => void
}

export default function Button({ label, variant = 'primary', onClick }: ButtonProps) {
  const cls = {
    primary:   'fp-btn-primary',
    secondary: 'fp-btn-secondary',
    danger:    'fp-btn-danger',
  }
  return (
    <button
      onClick={onClick}
      className={cls[variant]}
    >
      {label}
    </button>
  )
}
