"use client"

import { ChevronDown } from "lucide-react";

export default function CXHeroSearch() {
  const popularTags = [
    { label: "Work from Home", active: true },
    { label: "Immediate Start", active: false },
    { label: "Night Shift", active: false },
    { label: "Spanish Speaker", active: false },
  ];

  return (
    <section className="w-full bg-[#eef3f1] px-4 py-12 md:px-8 lg:px-12">
      <div className="mx-auto max-w-[1200px]">
        <div className="text-center">
          <h1 className="mx-auto max-w-[800px] text-balance text-4xl font-black leading-[1] tracking-[-0.04em] text-[#1f3d73] md:text-5xl lg:text-6xl">
            Connect with Top
            <span className="mt-1 block text-[#42ba80]">CX Opportunities</span>
          </h1>

          <div className="mx-auto mt-3 h-[5px] w-[200px] max-w-full rounded-full bg-[#bbe9d2]" />

          <p className="mx-auto mt-6 max-w-[900px] text-balance text-base font-medium leading-[1.5] text-[#4d5f7c] md:text-lg lg:text-xl">
            The specialized hub for high-volume recruitment, multilingual roles, and flexible shifts in the global customer experience industry.
          </p>
        </div>

        <div className="mt-8 w-full rounded-2xl border border-[#e6ebef] bg-white p-3 shadow-[0_12px_40px_rgba(20,34,62,0.1)] md:p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SearchField icon={<SearchIcon />} placeholder="Job title or skill" />
            <SearchField icon={<MapPinIcon />} placeholder="City or Remote" />
            <SearchField icon={<GlobeIcon />} placeholder="Any Language" withChevron />

            <button className="flex h-14 items-center justify-center rounded-xl bg-[#1f3d73] px-6 text-base font-bold tracking-[-0.02em] text-white shadow-[0_8px_20px_rgba(31,61,115,0.2)] transition hover:translate-y-[-1px] md:h-16 md:text-lg">
              <span>Find Opportunities</span>
              <span className="ml-2">→</span>
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <span className="text-sm font-extrabold tracking-[0.04em] text-[#a6b0c3] md:text-base">
            POPULAR:
          </span>

          {popularTags.map((tag) => (
            <button
              key={tag.label}
              className={`rounded-full border px-4 py-2 text-sm font-bold transition md:text-base ${
                tag.active
                  ? "border-[#b6e4cc] bg-[#dff3e8] text-[#42ba80]"
                  : "border-[#d3dce8] bg-[#f8fafc] text-[#66799a]"
              }`}
            >
              {tag.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function SearchField({
  icon,
  placeholder,
  withChevron = false,
}: {
  icon: React.ReactNode;
  placeholder: string;
  withChevron?: boolean;
}) {
  return (
    <div className="flex h-14 items-center justify-between rounded-xl bg-[#f4f6f8] px-4 text-[#6f809d] md:h-16 md:px-5">
      <div className="flex items-center gap-3">
        <span className="text-[#98a6bf]">{icon}</span>
        <span className="text-sm font-medium tracking-[-0.02em] text-[#6c7890] md:text-base">
          {placeholder}
        </span>
      </div>

      {withChevron ? <ChevronDown className="h-5 w-5 text-[#7f8ea8]" /> : null}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m21 21-4.35-4.35"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s-6-4.35-6-10a6 6 0 1 1 12 0c0 5.65-6 10-6 10Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11" r="2.3" stroke="currentColor" strokeWidth="2.2" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.2" />
      <path d="M3 12h18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M12 3a15 15 0 0 1 0 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M12 3a15 15 0 0 0 0 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
