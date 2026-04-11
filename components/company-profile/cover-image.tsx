import React from 'react'

interface CoverImageProps {
  imageUrl?: string | null
  companyName?: string
}

export function CoverImage({ imageUrl, companyName }: CoverImageProps) {
  // Default cover image from Unsplash
  const defaultImage = 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1600&h=600&fit=crop'

  return (
    <div className="relative w-full h-64 md:h-80 lg:h-96 bg-gradient-to-br from-primary/10 via-primary/5 to-secondary/10 overflow-hidden">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={`${companyName || 'Company'} cover`}
          className="w-full h-full object-cover"
        />
      ) : (
        <img
          src={defaultImage}
          alt="Company cover"
          className="w-full h-full object-cover opacity-80"
        />
      )}
      {/* Overlay gradient for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
    </div>
  )
}
