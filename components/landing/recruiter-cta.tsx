export default function RecruiterCTA() {
  return (
    <section className="bg-gradient-to-br from-[#0f766e] to-[#0d9488] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="text-white">
            <h2 className="text-2xl font-bold sm:text-3xl lg:text-4xl">
              Are you a CX Recruiter?
            </h2>
            <p className="mt-4 text-base text-teal-100 sm:text-lg">
              Access our global database of 50,000+ verified multilingual CX professionals ready for immediate placement.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <button className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-teal-700 shadow-lg transition hover:bg-teal-50 hover:shadow-xl md:text-base">
                Post Your Vacancies
              </button>
              <button className="rounded-xl border-2 border-white/40 bg-white/10 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/20 md:text-base">
                View Pricing
              </button>
            </div>
          </div>

          <div className="hidden lg:flex justify-center">
            <div className="relative w-full max-w-sm">
              <div className="rounded-2xl bg-white/10 backdrop-blur-sm p-6 shadow-2xl">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-teal-200" />
                    <div>
                      <div className="h-2.5 w-24 rounded bg-teal-200/60" />
                      <div className="mt-1.5 h-2 w-16 rounded bg-teal-200/40" />
                    </div>
                  </div>
                  <div className="h-px bg-white/20" />
                  <div className="space-y-2.5">
                    <div className="h-2 w-full rounded bg-white/20" />
                    <div className="h-2 w-4/5 rounded bg-white/20" />
                    <div className="h-2 w-3/5 rounded bg-white/20" />
                  </div>
                  <div className="flex gap-2">
                    <div className="h-8 w-20 rounded-lg bg-teal-400/30" />
                    <div className="h-8 w-20 rounded-lg bg-white/20" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
