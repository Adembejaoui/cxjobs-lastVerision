export default function CTASection() {
  return (
    <section className="px-6 pb-16 pt-6 md:px-10 lg:px-14 lg:pb-24">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[28px] bg-[#1f4275] px-8 py-16 text-center text-white shadow-[0_16px_36px_rgba(15,28,56,0.18)] md:px-12 lg:py-20">
        <div className="pointer-events-none absolute" />
        <h2 className="mx-auto max-w-4xl text-4xl font-black leading-tight tracking-[-0.05em] md:text-6xl">
          Ready to join the next generation of CX?
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-white/80 md:text-base">
          Whether you&apos;re a high-potential agent or a global BPO partner, we&apos;re here to help you grow.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <button className="rounded-xl bg-[#47ca8b] px-8 py-4 text-sm font-extrabold text-[#153864] shadow-[0_10px_24px_rgba(71,202,139,0.28)] md:px-10 md:text-base">
            Apply for Jobs
          </button>
          <button className="rounded-xl border border-white/40 bg-transparent px-8 py-4 text-sm font-extrabold text-white md:px-10 md:text-base">
            Partner With Us
          </button>
        </div>
      </div>
    </section>
  );
}
