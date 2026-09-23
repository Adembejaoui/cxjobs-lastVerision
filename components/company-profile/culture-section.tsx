import React from 'react'
import { ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface CultureItem {
  title: string
  description?: string
  imageUrl?: string
  icon?: string
}

interface CultureSectionProps {
  culture?: { title: string; description?: string; imageUrl?: string }[] | null
}

export function CultureSection({ culture }: CultureSectionProps) {
  const staticCultureItems: CultureItem[] = [
    {
      title: 'Diversity & Inclusion',
      imageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=300&fit=crop',
      icon: '🏢'
    },
    {
      title: 'Work-Life Balance',
      imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=300&fit=crop',
      icon: '⚖️'
    },
    {
      title: 'Continuous Learning',
      imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=300&fit=crop',
      icon: '📚'
    },
    {
      title: 'Team Spirit',
      imageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&h=300&fit=crop',
      icon: '🤝'
    }
  ]

  // Parse culture data from company
  const parseCulture = (): CultureItem[] => {
    if (!culture || culture.length === 0) return staticCultureItems;

    return culture.map((item, index) => ({
      title: item.title || `Culture ${index + 1}`,
      description: item.description || undefined,
      imageUrl: item.imageUrl || undefined,
      icon: ['🏢', '⚖️', '📚', '🤝', '🌟', '💡', '🎯', '🚀', '💪', '🎨', '🌈', '🔥'][index % 12]
    }));
  }

  // Use dynamic culture if provided, otherwise fall back to static
  const displayCulture = culture && culture.length > 0 ? parseCulture() : staticCultureItems

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-foreground">
          Company Culture
        </h2>
        <span className="inline-flex items-center gap-1 text-primary font-semibold hover:opacity-80 transition cursor-pointer">
          View all photos
          <ChevronRight className="h-4 w-4" />
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {displayCulture.map((item, idx) => (
          <Card key={idx} className="overflow-hidden hover:shadow-lg transition cursor-pointer group">
            {/* Fixed 4:3 frame — stays true regardless of card width, so the photo
               never stretches, squashes, or gets cropped differently per breakpoint. */}
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted ring-1 ring-inset ring-black/5">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="absolute inset-0 h-full w-full object-cover object-center transition duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/15 to-secondary/15">
                  <span className="text-6xl opacity-40">{item.icon}</span>
                </div>
              )}

              {/* Gradient anchored to the caption instead of a flat wash, so the photo
                 stays visible and only darkens where the text needs contrast. */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

              <div className="absolute inset-x-0 bottom-0 p-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-[15px] ring-1 ring-white/25 backdrop-blur-sm">
                    {item.icon}
                  </span>
                  <h3 className="font-semibold text-white drop-shadow-sm">{item.title}</h3>
                </div>
                {item.description && (
                  <p className="text-sm text-white/80 mt-1.5 pl-[42px] line-clamp-2">{item.description}</p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}