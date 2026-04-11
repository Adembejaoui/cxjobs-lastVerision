import React from 'react'
import { Card } from '@/components/ui/card'

interface Review {
  rating: number
  role: string
  timeAgo: string
  text: string
}

interface ReviewsProps {
  averageRating?: number
  reviewCount?: number
  reviews?: Review[]
}

export function Reviews({ averageRating = 4.2, reviewCount = 1500, reviews }: ReviewsProps) {
  const staticReviews: Review[] = [
    {
      rating: 4.2,
      role: 'Team Lead',
      timeAgo: '2 days ago',
      text: 'Great management support and the health benefits are the best in the industry.'
    },
    {
      rating: 4.2,
      role: 'Support Agent',
      timeAgo: '1 week ago',
      text: 'Shift flexibility is amazing. I love the hybrid setup they offered me.'
    },
    {
      rating: 4.5,
      role: 'Senior Developer',
      timeAgo: '2 weeks ago',
      text: 'Amazing tech stack and great opportunities for career growth.'
    }
  ]

  const displayReviews = reviews && reviews.length > 0 ? reviews : staticReviews

  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 >= 0.5
    return (
      <div className="flex gap-1">
        {[...Array(5)].map((_, i) => (
          <span key={i} className="text-xl">
            {i < fullStars ? '⭐' : (i === fullStars && hasHalfStar ? '⭐' : '☆')}
          </span>
        ))}
      </div>
    )
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2">
        <h3 className="text-2xl font-bold text-foreground">💬 Workplace Reviews</h3>
      </div>

      <Card className="p-6 bg-muted/30 border border-border">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-5xl font-bold text-foreground">{averageRating}</div>
            <p className="text-sm text-muted-foreground mt-1">Based on {reviewCount.toLocaleString()} reviews</p>
          </div>
          <div className="flex-1">
            {renderStars(averageRating)}
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        {displayReviews.map((review, idx) => (
          <Card key={idx} className="p-4 border border-border hover:shadow-md transition">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">{review.role}</h4>
                <div className="flex items-center gap-1 mt-1">
                  {renderStars(review.rating)}
                </div>
              </div>
              <span className="text-xs text-muted-foreground">{review.timeAgo}</span>
            </div>
            <p className="text-sm text-muted-foreground italic">
              "{review.text}"
            </p>
          </Card>
        ))}
      </div>

      <span className="text-primary font-semibold hover:opacity-80 transition mt-4 block text-center cursor-pointer">
        Read All Reviews →
      </span>
    </section>
  )
}
