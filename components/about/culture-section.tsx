import CultureCard from "./culture-card";

export default function CultureSection() {
  return (
    <section className="px-6 py-16 md:px-10 lg:px-14 lg:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#53c28b]">LIFE AT CX JOBS</p>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.04em] text-[#19345e] md:text-5xl">
              Our Office Culture
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#728096] md:text-base">
              We practice what we preach. Our internal culture is as vibrant and supportive as the ecosystems we build for our partners.
            </p>
          </div>
          <a className="text-sm font-semibold text-[#22324b] underline-offset-4 hover:underline" href="#">
            Follow us on Instagram →
          </a>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-[1.05fr_1fr]">
          <div className="overflow-hidden rounded-2xl bg-white shadow-[0_8px_24px_rgba(10,20,40,0.08)]">
            <div className="aspect-[1.18/0.82] w-full bg-[linear-gradient(135deg,#d5d9d9,#f3f2ef_35%,#bababa_100%)] p-4">
              <div className="flex h-full items-end justify-center gap-4 rounded-[18px] bg-[linear-gradient(180deg,#ebedea,#d9dad7)] p-6">
                <div className="h-28 w-16 rounded-xl bg-[#7b4f38]" />
                <div className="h-36 w-20 rounded-xl bg-[#cfcfcf]" />
                <div className="h-32 w-20 rounded-xl bg-[#434a55]" />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 sm:grid-rows-2">
            <CultureCard tone="blue" />
            <CultureCard tone="wood" />
            <CultureCard tone="gray" />
            <CultureCard tone="celebrate" />
          </div>
        </div>
      </div>
    </section>
  );
}
