interface Value {
  title: string;
  description: string;
  icon: string;
}

const values: Value[] = [
  {
    title: "Empowerment",
    description:
      "We provide job seekers with the data and tools they need to make the best decisions for their career growth.",
    icon: "◎",
  },
  {
    title: "Efficiency",
    description:
      "Streamlining the recruitment cycle from weeks to days using intelligent matching algorithms and verified profiling.",
    icon: "↯",
  },
  {
    title: "Transparency",
    description:
      "Honest feedback, clear expectations, and open communication channels between talent and employers.",
    icon: "◉",
  },
];

export default function ValuesSection() {
  return (
    <section className="bg-[#f7f7f8] px-6 py-16 md:px-10 lg:px-14 lg:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#53c28b]">CORE VALUES</p>
          <h2 className="mt-4 text-3xl font-black tracking-[-0.04em] text-[#19345e] md:text-5xl">
            The Principles That Guide Us
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-[#7a879a] md:text-base">
            We believe that a great hiring experience is built on trust, transparency, and a relentless focus on the individual.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {values.map((value) => (
            <div
              key={value.title}
              className="rounded-2xl border border-[#e6e9ee] bg-white p-7 shadow-[0_6px_18px_rgba(12,24,52,0.05)]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#eef7f2] text-lg font-bold text-[#41be82]">
                {value.icon}
              </div>
              <h3 className="mt-6 text-xl font-extrabold tracking-[-0.03em] text-[#1a365f]">{value.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[#758296]">{value.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
