interface InfoTextProps {
  icon: string
  text: string
}

export function InfoText({ icon, text }: InfoTextProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[15px] text-[#7c8ea8]">{icon}</span>
      <span>{text}</span>
    </div>
  )
}
