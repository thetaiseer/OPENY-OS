











export function Input({ label, placeholder, value, onChange, type = "text", icon: Icon, required }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label &&
      <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          {label}{required && <span style={{ color: 'var(--accent)' }}> *</span>}
        </label>
      }
      <div className="relative">
        {Icon &&
        <div className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
            <Icon size={15} />
          </div>
        }
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="glass-input w-full outline-none transition-all"
          style={{
            color: 'var(--text)',
            paddingLeft: Icon ? '2.25rem' : '14px'
          }} />
        
      </div>
    </div>);

}