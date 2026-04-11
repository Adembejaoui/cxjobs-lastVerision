interface FilterGroupProps {
  title: string
  children: React.ReactNode
}

export function FilterGroup({ title, children }: FilterGroupProps) {
  return (
    <div className="mb-8 border-b border-[#dee5ee] pb-7">
      <p className="mb-5 text-[13px] font-extrabold tracking-[0.18em] text-[#95a5be]">{title}</p>
      <div className="space-y-4">{children}</div>
    </div>
  )
}
