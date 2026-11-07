'use client'

import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'

interface CultureItem {
  title: string
  description?: string
  imageUrl?: string
  icon: string
}

interface CultureSectionProps {
  culture?: { title: string; description?: string; imageUrl?: string }[] | null
}

const ICONS = ['🏢', '⚖️', '📚', '🤝', '🌟', '💡', '🎯', '🚀', '💪', '🎨', '🌈', '🔥']
const INITIAL_VISIBLE = 4

const STATIC_ITEMS: CultureItem[] = [
  {
    title: 'Diversity & Inclusion',
    imageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=600&fit=crop',
    icon: ICONS[0]
  },
  {
    title: 'Work-Life Balance',
    imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop',
    icon: ICONS[1]
  },
  {
    title: 'Continuous Learning',
    imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=600&fit=crop',
    icon: ICONS[2]
  },
  {
    title: 'Team Spirit',
    imageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=600&fit=crop',
    icon: ICONS[3]
  }
]

function normalize(culture: CultureSectionProps['culture']): CultureItem[] {
  if (!culture || culture.length === 0) return STATIC_ITEMS
  return culture.map((item, i) => ({
    title: item.title?.trim() || `Culture ${i + 1}`,
    description: item.description?.trim() || undefined,
    imageUrl: item.imageUrl || undefined,
    icon: ICONS[i % ICONS.length]
  }))
}

export function CultureSection({ culture }: CultureSectionProps) {
  const items = normalize(culture)

  const [selected, setSelected] = useState<CultureItem | null>(null)
  const [showAll, setShowAll] = useState(false)
  // Track images that failed to load so we can fall back gracefully
  const [failed, setFailed] = useState<Set<string>>(new Set())

  const markFailed = (url?: string) => {
    if (!url) return
    setFailed((prev) => new Set(prev).add(url))
  }

  const hasImage = (item: CultureItem) => !!item.imageUrl && !failed.has(item.imageUrl)

  const visible = showAll ? items : items.slice(0, INITIAL_VISIBLE)
  const hiddenCount = items.length - INITIAL_VISIBLE

  return (
    <section className="space-y-6" aria-labelledby="culture-heading">
      <div className="flex items-center justify-between gap-4">
        <h2 id="culture-heading" className="text-2xl font-bold text-foreground sm:text-3xl">
          Company Culture
        </h2>

        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            aria-expanded={showAll}
            className="inline-flex items-center gap-1 rounded-md px-1 text-sm font-semibold text-primary transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {showAll ? 'Show less' : `Show ${hiddenCount} more`}
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showAll ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
        {visible.map((item, idx) => (
          <Card
            key={`${item.title}-${idx}`}
            onClick={() => setSelected(item)}
            role="button"
            tabIndex={0}
            aria-label={`Open ${item.title}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setSelected(item)
              }
            }}
            // p-0 / gap-0 cancel the default Card padding so the image truly bleeds to the edges
            className="group cursor-pointer gap-0 overflow-hidden p-0 transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-800">
              {hasImage(item) ? (
                <img
                  src={item.imageUrl}
                  alt=""
                  loading="lazy"
                  onError={() => markFailed(item.imageUrl)}
                  className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                />
              ) : (
                // Dark fallback so the white overlay text always has enough contrast
                <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900" />
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-base ring-1 ring-white/25 backdrop-blur-sm"
                  >
                    {item.icon}
                  </span>
                  <h3 className="text-base font-semibold leading-snug text-white sm:text-lg">
                    {item.title}
                  </h3>
                </div>
                {item.description && (
                  <p className="mt-2 line-clamp-2 pl-12 text-sm text-white/85">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] w-full max-w-3xl gap-4 overflow-y-auto p-4 sm:p-6">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 pr-6 text-xl">
                  <span aria-hidden="true">{selected.icon}</span>
                  {selected.title}
                </DialogTitle>
                {/* Always rendered so Radix doesn't warn about a missing description */}
                <DialogDescription className="sr-only">
                  {selected.description ?? `Details about ${selected.title}`}
                </DialogDescription>
              </DialogHeader>
                {selected.description && (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {selected.description}
                </p>
              )}e

              {hasImage(selected) && (
                <div className="overflow-hidden rounded-lg bg-muted">
                  <img
                    src={selected.imageUrl}
                    alt={selected.title}
                    onError={() => markFailed(selected.imageUrl)}
                    // Natural aspect ratio: no letterboxing, capped so it never overflows the screen
                    className="mx-auto max-h-[55vh] w-full object-contain"
                  />
                </div>
              )}

              {/* Only show a description block when there is one */}
            
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}