import React from 'react'
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
        <h2 className="text-3xl font-bold text-foreground pb-3 border-l-4 border-primary">
          Company Culture
        </h2>
        <span className="text-primary font-semibold hover:opacity-80 transition cursor-pointer">
          View All Photos →
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {displayCulture.map((item, idx) => (
          <Card key={idx} className="overflow-hidden hover:shadow-lg transition cursor-pointer group">
            <div className="relative h-48 bg-muted overflow-hidden">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                  <span className="text-6xl opacity-50">{item.icon}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition" />
              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{item.icon}</span>
                  <h3 className="font-semibold text-white drop-shadow-md">{item.title}</h3>
                </div>
                {item.description && (
                  <p className="text-sm text-white/80 mt-1 line-clamp-2">{item.description}</p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}
