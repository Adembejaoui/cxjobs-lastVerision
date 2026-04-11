interface PagerButtonProps {
  children: React.ReactNode
  active?: boolean
  onClick?: () => void
}

export function PagerButton({ children, active = false, onClick }: PagerButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-12 w-12 items-center justify-center rounded-full border text-[18px] font-extrabold transition ${
        active
          ? "border-[#18345b] bg-[#18345b] text-white shadow-lg"
          : "border-[#d8e1eb] bg-white text-[#1b385f] hover:bg-[#f6f8fb]"
      }`}
    >
      {children}
    </button>
  )
}
