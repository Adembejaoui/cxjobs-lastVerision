import React from 'react'

interface CoverImageProps {
  imageUrl?: string | null
  companyName?: string
  aspectRatio?: string   // e.g. "16/5", "16/4", "3/1"
  objectPosition?: string // e.g. "center", "top", "50% 30%"
}

export function CoverImage({ 
  imageUrl, 
  companyName,
  aspectRatio = '16/5',
  objectPosition = 'center'
}: CoverImageProps) {
  const defaultImage = 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1600&h=600&fit=crop'

  return (
    <div 
      className="relative w-full overflow-hidden bg-linear-to-br from-primary/10 via-primary/5 to-secondary/10"
      style={{ aspectRatio }}
    >
      <img
        src={imageUrl || defaultImage}
        alt={`${companyName || 'Company'} cover`}
        className="w-full h-full object-cover"
        style={{ objectPosition }}
      />
    </div>
  )
}