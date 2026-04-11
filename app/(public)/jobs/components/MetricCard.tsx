interface MetricCardProps {
  label: string
  value: string
}

export function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className="min-w-[136px] rounded-[18px] border border-white/10 bg-white/5 px-5 py-4 shadow-inner backdrop-blur-sm">
      <p className="text-[11px] font-extrabold tracking-[0.12em] text-[#49c88f]">{label}</p>
      <p className="mt-1 text-[17px] font-black text-white md:text-[18px]">{value}</p>
    </div>
  )
}
