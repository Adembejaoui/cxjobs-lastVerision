export default function MissionSection() {
  return (
    <section className="px-6 py-16 md:px-10 lg:px-14 lg:py-20">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.05fr_1fr] lg:items-center">
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
          <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-[0_10px_24px_rgba(0,0,0,0.10)]">
            <div className="aspect-[1.05/1] w-full bg-[linear-gradient(135deg,#d7c29d_0%,#7c5737_35%,#1d1d1d_100%)] p-3">
              <div className="flex h-full items-end gap-2 rounded-[10px] bg-[linear-gradient(160deg,#b7905c,#3c2d24)] p-3">
                <div className="h-16 w-10 rounded-md bg-[#182535]" />
                <div className="h-20 w-12 rounded-md bg-[#ecdecf]" />
                <div className="ml-auto h-24 w-16 rounded-md bg-[#6a7e8f]" />
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-[0_10px_24px_rgba(0,0,0,0.10)]">
            <div className="aspect-[1.05/1] w-full bg-[linear-gradient(180deg,#efe2d5,#d5c2b2)] p-4">
              <div className="flex h-full items-end justify-center gap-3 rounded-[10px] bg-[#efe8df] p-4">
                <div className="flex h-24 w-16 items-start justify-center rounded-t-[40px] bg-[#c78567] pt-3">
                  <div className="h-6 w-8 rounded-full bg-[#7c4e3e]" />
                </div>
                <div className="h-20 w-20 rounded-lg bg-[#6f7a84]" />
                <div className="absolute" />
              </div>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#53c28b]">OUR MISSION</p>
          <h2 className="mt-4 max-w-xl text-3xl font-black leading-tight tracking-[-0.04em] text-[#19345e] md:text-5xl">
            Improving the CX Hiring Ecosystem for Everyone
          </h2>
          <div className="mt-6 space-y-5 text-sm leading-7 text-[#617086] md:text-base md:leading-8">
            <p>
              Our journey began with a simple observation: the recruitment process in the BPO industry was fragmented. Talent was struggling to find the right environment, and high-growth BPOs were losing speed due to hiring inefficiencies.
            </p>
            <p>
              We built CX Jobs to create a seamless, human-centric connection. We don't just post jobs; we facilitate careers and fuel the growth of global service providers through technology-driven matching.
            </p>
          </div>
          <div className="mt-8 text-sm italic text-[#334867] md:text-base">
            <span className="font-semibold">"Excellence in every connection."</span>
            <br />— Founding Principles
          </div>
        </div>
      </div>
    </section>
  );
}
