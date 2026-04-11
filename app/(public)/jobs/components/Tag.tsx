interface TagProps {
  children: React.ReactNode
  variant: "green" | "slate"
}

export function Tag({ children, variant }: TagProps) {
  return (
    <span
      className={`rounded-full px-4 py-1.5 text-[12px] font-extrabold tracking-[0.04em] ${
        variant === "green"
          ? "bg-[#e8f8ef] text-[#42be84]"
          : "bg-[#edf1f6] text-[#5d7393]"
      }`}
    >
      {children}
    </span>
  )
}
