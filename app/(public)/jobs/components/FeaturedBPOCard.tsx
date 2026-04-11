export function FeaturedBPOCard() {
  return (
    <div className="overflow-hidden rounded-[26px] bg-gradient-to-br from-[#223f6a] to-[#173258] p-7 text-white shadow-[0_16px_34px_rgba(0,0,0,0.35)]">
      <div className="mb-5 flex justify-end">
        <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold tracking-[0.12em] text-[#dfe7f4]">
          FEATURED BPO
        </span>
      </div>

      <div className="mx-auto mb-6 flex h-[86px] w-[86px] items-center justify-center rounded-[26px] border-[8px] border-white bg-[#eff3f8] text-[28px] text-[#274364] shadow-md">
        ▥
      </div>

      <h3 className="mx-auto mb-4 max-w-[210px] text-center text-[18px] font-extrabold leading-6">
        Join Our Global Support Team
      </h3>
      <p className="mb-6 text-center text-[14px] leading-6 text-[#d8e2ef]">
        Velocity Retail is hiring 200+ agents this month! Work with world-class brands.
      </p>

      <div className="mb-7 space-y-3 text-[14px] text-[#eaf5f0]">
        {[
          "Signing Bonus up to $500",
          "HMO on Day 1",
          "Night Differential Pay",
        ].map((item) => (
          <div key={item} className="flex items-center gap-3">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#45c68d] text-[12px] font-bold text-white">
              ✓
            </div>
            <span>{item}</span>
          </div>
        ))}
      </div>

      <button className="w-full rounded-[14px] bg-[#45c68d] py-4 text-[16px] font-extrabold text-white shadow-lg transition hover:translate-y-[-1px]">
        Apply Now
      </button>
    </div>
  )
}
