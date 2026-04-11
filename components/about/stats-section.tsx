interface Stat {
  value: string;
  label: string;
}

const stats: Stat[] = [
  { value: "10k+", label: "Placements Made" },
  { value: "50+", label: "Partner BPOs" },
  { value: "98%", label: "Success Rate" },
  { value: "24/7", label: "Active Support" },
];

export default function StatsSection() {
  return (
    <section className="bg-[#1f4275] px-6 py-8 md:px-10 lg:px-14">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 text-white md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <div className="text-3xl font-black tracking-[-0.04em] text-[#43d08d] md:text-5xl">
              {stat.value}
            </div>
            <div className="mt-2 text-xs font-medium text-white/85 md:text-sm">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
