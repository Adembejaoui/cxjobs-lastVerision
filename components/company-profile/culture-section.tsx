import React from 'react'
import { Card } from '@/components/ui/card'

/* eslint-disable @next/next/no-img-element */

interface CultureItem {
  title: string
  description?: string
  imageUrl?: string
  icon?: string
}

interface CultureSectionProps {
  culture?: { title: string; description?: string; imageUrl?: string; icon?: string }[] | null
}

export function CultureSection({ culture }: CultureSectionProps) {
  const staticCultureItems: CultureItem[] = [
    {
      title: 'Diversity & Inclusion',
      imageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=600&fit=crop',
      icon: '🏢'
    },
    {
      title: 'Work-Life Balance',
      imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop',
      icon: '⚖️'
    },
    {
      title: 'Continuous Learning',
      imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=600&fit=crop',
      icon: '📚'
    },
    {
      title: 'Team Spirit',
      imageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=600&fit=crop',
      icon: '🤝'
    }
  ]

  // Parse culture data from company
  const parseCulture = (): CultureItem[] => {
    if (!culture || culture.length === 0) return staticCultureItems

    return culture.map((item, index) => ({
      title: item.title || `Culture ${index + 1}`,
      description: item.description || undefined,
      imageUrl: item.imageUrl || undefined,
      icon: item.icon || ['🏢', '⚖️', '📚', '🤝', '🌟', '💡', '🎯', '🚀', '💪', '🎨', '🌈', '🔥'][index % 12]
    }))
  }

  // Use dynamic culture if provided, otherwise fall back to static
  const displayCulture = culture && culture.length > 0 ? parseCulture() : staticCultureItems

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-foreground pb-3">
          Company Culture
        </h2>
        <span className="text-primary font-semibold hover:opacity-80 transition cursor-pointer">
          View All Photos →
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {displayCulture.map((item, idx) => (
          <Card
            key={idx}
            className="overflow-hidden hover:shadow-xl transition cursor-pointer group p-0 border-0"
          >
            <div className="relative w-full bg-muted overflow-hidden">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-full h-auto block transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="w-full aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                  <span className="text-7xl opacity-50">{item.icon}</span>
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

              <div className="absolute bottom-0 left-0 right-0 p-6">
                <div className="flex items-center gap-3">
                  <span className="text-4xl leading-none">{item.icon}</span>
                  <h3 className="text-2xl font-bold text-white drop-shadow-md leading-tight">
                    {item.title}
                  </h3>
                </div>
                {item.description && (
                  <p className="text-base text-white/85 mt-2 line-clamp-2">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}