"use client"

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Globe } from "lucide-react";

const languages = [
  "English",
  "French",
  "Spanish",
  "Arabic",
  "German",
  "Portuguese",
  "Italian",
  "Mandarin",
];

const locations = [
  "Remote",
  "Tunis",
  "Zaghouan",
  "Ariana",
  "Béja",
  "Ben Arous",
  "Bizerte",
  "Gabès",
  "Gafsa",
  "Jendouba",
  "Kairouan",
  "Kasserine",
  "Kebili",
  "Kef",
  "Mahdia",
  "Manouba",
  "Medenine",
  "Monastir",
  "Nabeul",
  "Sfax",
  "Sidi Bouzid",
  "Siliana",
  "Sousse",
  "Tataouine",
  "Tozeur",
];

export default function CXHeroSearch() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [location, setLocation] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const popularTags = [
    { label: "Work from Home", active: true },
    { label: "Immediate Start", active: false },
    { label: "Night Shift", active: false },
    { label: "Spanish Speaker", active: false },
  ];

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const params = new URLSearchParams();
    const trimmedSearch = searchQuery.trim();
    const trimmedLocation = location.trim();

    if (trimmedSearch) {
      params.set("search", trimmedSearch);
    }
    if (trimmedLocation) {
      params.set("location", trimmedLocation);
    }
    if (selectedLanguage) {
      params.set("language", selectedLanguage);
    }

    const queryString = params.toString();
    router.push(queryString ? `/jobs?${queryString}` : "/jobs");
  };

  return (
    <section className="flex w-full flex-1 flex-col justify-center bg-[#eef3f1] px-4 py-6  sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <h1 className="mx-auto max-w-[800px] text-balance text-3xl font-black leading-[1] tracking-[-0.04em] text-[#1f3d73] md:text-4xl lg:text-5xl">
            Connect with Top
            <span className="mt-1 block text-[#42ba80]">CX Opportunities</span>
          </h1>

          <div className="mx-auto mt-3 h-[5px] w-[200px] max-w-full rounded-full bg-[#bbe9d2]" />

          <p className="mx-auto mt-4 max-w-[900px] text-balance text-base font-medium leading-[1.5] text-[#4d5f7c] md:text-lg lg:text-xl">
            The specialized hub for high-volume recruitment, multilingual roles, and flexible shifts in the global customer experience industry.
          </p>
        </div>

        <form className="mt-8 w-full rounded-2xl border border-[#e6ebef] bg-white p-3 shadow-[0_12px_40px_rgba(20,34,62,0.1)] md:p-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(220px,auto)]">
            <SearchField icon={<SearchIcon />}>
              <input
                aria-label="Job title or skill"
                className="w-full bg-transparent text-sm font-medium tracking-[-0.02em] text-[#6c7890] outline-none placeholder:text-[#98a6bf] md:text-base"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Job title or skill"
                type="text"
                value={searchQuery}
              />
            </SearchField>
            <SearchField icon={<MapPinIcon />} >
              <select
                aria-label="Location"
                className="w-full cursor-pointer bg-transparent text-sm font-medium tracking-[-0.02em] text-[#6c7890] outline-none md:text-base"
                onChange={(event) => setLocation(event.target.value)}
                value={location}
              >
                <option value="">Any City</option>
                {locations.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </SearchField>
            <SearchField icon={<Globe />} >
              <select
                aria-label="Language"
                className="w-full cursor-pointer bg-transparent text-sm font-medium tracking-[-0.02em] text-[#6c7890] outline-none md:text-base"
                onChange={(event) => setSelectedLanguage(event.target.value)}
                value={selectedLanguage}
              >
                <option value="">Any Language</option>
                {languages.map((language) => (
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </select>
            </SearchField>

            <button
              className="flex h-14 items-center justify-center rounded-xl bg-[#1f3d73] px-6 text-base font-bold tracking-[-0.02em] text-white shadow-[0_8px_20px_rgba(31,61,115,0.2)] transition hover:translate-y-[-1px] md:h-16 md:text-lg"
              type="submit"
            >
              <span>Find Opportunities</span>
              <span className="ml-2">→</span>
            </button>
          </div>
        </form>

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
              type="button"
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
  children,
  icon,
  withChevron = false,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  withChevron?: boolean;
}) {
  return (
    <div className="flex min-h-14 items-center justify-between rounded-xl bg-[#f4f6f8] px-4 text-[#6f809d] md:min-h-16 md:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="text-[#98a6bf]">{icon}</span>
        {children}
      </div>

      {withChevron ? <ChevronDown className="h-5 w-5 shrink-0 text-[#7f8ea8]" /> : null}
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
