export default function HeroSection() {
  return (
    <section className="px-6 py-12 md:px-10 lg:px-14 lg:py-16">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_1.02fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#edf7f1] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#4ac58a]">
            <span className="h-2 w-2 rounded-full bg-[#4ac58a]" />
            Our Story
          </div>

          <h1 className="mt-5 max-w-xl text-5xl font-black leading-[0.95] tracking-[-0.05em] text-[#17345d] md:text-7xl lg:text-[76px]">
            Bridging the <br /> Gap Between <br />
            <span className="text-[#45c888] italic">Talent</span> and <br /> BPOs
          </h1>

          <p className="mt-6 max-w-xl text-sm leading-7 text-[#6f7d91] md:text-base md:leading-8">
            Revolutionizing the CX hiring ecosystem by connecting world-class talent with industry-leading partners through innovation, transparency, and a human-centric approach.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button className="rounded-xl bg-[#183d73] px-6 py-4 text-sm font-extrabold text-white shadow-[0_12px_24px_rgba(24,61,115,0.22)]">
              Explore Open Roles
            </button>
            <button className="rounded-xl bg-white px-6 py-4 text-sm font-semibold text-[#1c3457] shadow-[0_6px_18px_rgba(10,20,40,0.06)]">
              How We Help Partners
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border-4 border-white bg-white shadow-[0_16px_34px_rgba(12,24,52,0.16)]">
          <div className="aspect-[1.18/0.78] w-full bg-[linear-gradient(135deg,#6a7b71_0%,#c0b29e_40%,#f1dfc8_100%)] p-4">
            <div className="flex h-full items-end gap-4 rounded-[14px] bg-[linear-gradient(180deg,#ebe7df,#cab69b)] p-4">
              <div className="h-28 w-20 rounded-2xl bg-[#2d2a28]" />
              <div className="h-24 w-16 rounded-2xl bg-[#7d624c]" />
              <div className="ml-auto h-32 w-20 rounded-2xl bg-[#ba7a39]" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
