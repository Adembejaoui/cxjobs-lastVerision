type CultureTone = "blue" | "wood" | "gray" | "celebrate";

interface CultureCardProps {
  tone: CultureTone;
}

export default function CultureCard({ tone }: CultureCardProps) {
  const toneClass =
    tone === "blue"
      ? "bg-[linear-gradient(135deg,#8fa7b9,#dde7ef)]"
      : tone === "wood"
        ? "bg-[linear-gradient(135deg,#745a43,#d7c2a9)]"
        : tone === "gray"
          ? "bg-[linear-gradient(135deg,#8d98a2,#dde1e5)]"
          : "bg-[linear-gradient(135deg,#c9d3df,#f0d8c8)]";

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-[0_8px_24px_rgba(10,20,40,0.08)]">
      <div className={`aspect-[1.05/0.72] w-full ${toneClass} p-3`}>
        <div className="flex h-full items-end justify-center gap-3 rounded-[16px] bg-white/25 p-3">
          <div className="h-20 w-12 rounded-xl bg-[#4a5564]" />
          <div className="h-24 w-14 rounded-xl bg-[#d9b79a]" />
          <div className="h-16 w-10 rounded-xl bg-[#7b4c38]" />
        </div>
      </div>
    </div>
  );
}
