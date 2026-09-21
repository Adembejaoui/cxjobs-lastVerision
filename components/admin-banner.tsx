"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";

export interface AdminBanner {
  id: string;
  priority: number;
  mode?: "rich" | "image";
  title?: string;
  description?: string;
  image?: string | null;
  backgroundImage?: string | null;
  badge?: string | null;
  ctaText?: string | null;
  ctaLink?: string | null;
  ctaExternal?: boolean;
}

interface AdminBannerCardProps {
  banner: AdminBanner;
}

export function AdminBannerCard({ banner }: AdminBannerCardProps) {
  const aspectClass = banner.priority === 1 ? "aspect-[16/5]" : "aspect-square";

  if (banner.mode === "image" && banner.backgroundImage) {
    const content = (
      <div
        className={`relative flex flex-col items-center justify-center rounded-[26px] bg-cover bg-center p-6 text-center text-white shadow-[0_18px_36px_rgba(0,0,0,0.35)] md:p-10 ${aspectClass}`}
        style={{ backgroundImage: `url(${banner.backgroundImage})` }}
      >
        <div className="relative z-10 max-w-2xl">
          {banner.badge && (
            <span className="mb-3 inline-block rounded-full bg-[#42c789] px-3 py-1 text-[11px] font-extrabold tracking-[0.12em] text-white">
              {banner.badge}
            </span>
          )}
          {banner.title && (
            <h3 className="text-[20px] font-black leading-tight tracking-[-0.02em] md:text-[28px]">
              {banner.title}
            </h3>
          )}
          {banner.description && (
            <p className="mt-2 line-clamp-3 text-[14px] leading-6 text-white/90 md:text-[16px]">
              {banner.description}
            </p>
          )}
          {banner.ctaText && (
            <div className="mt-4 inline-flex items-center gap-3">
              <span className="rounded-[18px] bg-[#45c68d] px-5 py-3 text-[14px] font-extrabold text-white shadow-[0_14px_26px_rgba(69,198,141,0.35)] transition hover:translate-y-[-1px]">
                {banner.ctaText}
              </span>
              {banner.ctaLink && !banner.ctaExternal && (
                <span className="text-[12px] font-semibold text-white/90">→</span>
              )}
            </div>
          )}
        </div>
      </div>
    );

    if (banner.ctaLink) {
      if (banner.ctaExternal) {
        return (
          <a
            href={banner.ctaLink}
            target="_blank"
            rel="noopener noreferrer"
            className="block no-underline"
          >
            {content}
          </a>
        );
      }
      return (
        <Link href={banner.ctaLink} className="block no-underline">
          {content}
        </Link>
      );
    }

    return content;
  }

  if (banner.backgroundImage) {
    const content = (
      <div
        className={`relative flex flex-col items-center justify-center rounded-[26px] bg-cover bg-center p-6 text-center text-white shadow-[0_18px_36px_rgba(0,0,0,0.35)] md:p-10 ${aspectClass}`}
        style={{ backgroundImage: `url(${banner.backgroundImage})` }}
      >
        <div className="absolute inset-0 rounded-[26px] bg-black/50" />

        <div className="relative z-10 max-w-2xl">
          {banner.badge && (
            <span className="mb-3 inline-block rounded-full bg-[#42c789] px-3 py-1 text-[11px] font-extrabold tracking-[0.12em] text-white">
              {banner.badge}
            </span>
          )}
          {banner.title && (
            <h3 className="text-[20px] font-black leading-tight tracking-[-0.02em] md:text-[28px]">
              {banner.title}
            </h3>
          )}
          {banner.description && (
            <p className="mt-2 line-clamp-3 text-[14px] leading-6 text-white/90 md:text-[16px]">
              {banner.description}
            </p>
          )}
          {banner.ctaText && (
            <div className="mt-4 inline-flex items-center gap-3">
              <span className="rounded-[18px] bg-[#45c68d] px-5 py-3 text-[14px] font-extrabold text-white shadow-[0_14px_26px_rgba(69,198,141,0.35)] transition hover:translate-y-[-1px]">
                {banner.ctaText}
              </span>
              {banner.ctaLink && !banner.ctaExternal && (
                <span className="text-[12px] font-semibold text-white/90">→</span>
              )}
            </div>
          )}
        </div>
      </div>
    );

    if (banner.ctaLink) {
      if (banner.ctaExternal) {
        return (
          <a
            href={banner.ctaLink}
            target="_blank"
            rel="noopener noreferrer"
            className="block no-underline"
          >
            {content}
          </a>
        );
      }
      return (
        <Link href={banner.ctaLink} className="block no-underline">
          {content}
        </Link>
      );
    }

    return content;
  }

  const content = (
    <div className={`flex h-full flex-col justify-between rounded-[26px] bg-gradient-to-r from-[#18345b] to-[#1f4675] p-6 text-white shadow-[0_18px_36px_rgba(0,0,0,0.35)] md:p-8 ${aspectClass}`}>
      <div className="flex items-start gap-4">
        {banner.image && (
          <div className="hidden h-[80px] w-[80px] shrink-0 items-center justify-center rounded-[18px] border-[6px] border-[#e9edf3] bg-white md:flex">
            <img
              src={banner.image}
              alt={banner.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="flex-1">
          {banner.badge && (
            <span className="mb-3 inline-block rounded-full bg-[#42c789] px-3 py-1 text-[11px] font-extrabold tracking-[0.12em] text-white">
              {banner.badge}
            </span>
          )}
          <h3 className="text-[20px] font-black leading-tight tracking-[-0.02em] md:text-[26px]">
            {banner.title}
          </h3>
          {banner.description && (
            <p className="mt-2 line-clamp-2 text-[14px] leading-6 text-[#d7e2f0] md:text-[16px]">
              {banner.description}
            </p>
          )}
        </div>
      </div>

      {banner.ctaText && (
        <div className="mt-4 flex items-center gap-3">
          <span className="rounded-[18px] bg-[#45c68d] px-5 py-3 text-[14px] font-extrabold text-white shadow-[0_14px_26px_rgba(69,198,141,0.35)] transition hover:translate-y-[-1px]">
            {banner.ctaText}
          </span>
          {banner.ctaLink && !banner.ctaExternal && (
            <span className="text-[12px] font-semibold text-[#d7e2f0]">→</span>
          )}
        </div>
      )}
    </div>
  );

  if (banner.ctaLink) {
    if (banner.ctaExternal) {
      return (
        <a
          href={banner.ctaLink}
          target="_blank"
          rel="noopener noreferrer"
          className="block no-underline"
        >
          {content}
        </a>
      );
    }
    return (
      <Link href={banner.ctaLink} className="block no-underline">
        {content}
      </Link>
    );
  }

  return content;
}
