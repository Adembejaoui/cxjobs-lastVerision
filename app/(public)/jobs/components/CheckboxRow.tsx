interface CheckboxRowProps {
  label: string
  checked?: boolean
  onChange?: (checked: boolean) => void
}

export function CheckboxRow({ label, checked = false, onChange }: CheckboxRowProps) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-[16px] font-semibold text-[#344865]">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange?.(!checked)}
        className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
          checked 
            ? "border-[#45c68d] bg-[#45c68d] text-white" 
            : "border-[#c9d3e0] bg-transparent text-transparent hover:border-[#45c68d]"
        }`}
      >
        {checked && <span className="text-[10px] font-bold">✓</span>}
      </button>
      <span>{label}</span>
    </label>
  )
}
