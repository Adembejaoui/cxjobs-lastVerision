import { Button } from '@/components/ui/button';

interface JobCardProps {
  job: {
    id: number;
    title: string;
    company: string;
    location: string;
    salary: string;
    category: string;
    badges: string[];
    logo: string;
  };
}

const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  IMMEDIATE: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  FEATURED: { bg: 'bg-amber-100', text: 'text-amber-700' },
  'HIGH COMMISSION': { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  'ON-SITE': { bg: 'bg-blue-100', text: 'text-blue-700' },
  'FULL-TIME': { bg: 'bg-gray-100', text: 'text-gray-700' },
  URGENT: { bg: 'bg-red-100', text: 'text-red-700' },
  REMOTE: { bg: 'bg-slate-100', text: 'text-slate-700' },
  HYBRID: { bg: 'bg-purple-100', text: 'text-purple-700' },
};

export function JobCard({ job }: JobCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 flex items-start gap-6 hover:shadow-md transition-shadow">
      {/* Logo */}
      <div className="flex-shrink-0">
        <div className="w-16 h-16 bg-slate-800 rounded-lg flex items-center justify-center text-2xl">
          {job.logo}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {job.title}
            </h3>
            <p className="text-gray-600 text-sm">{job.company}</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            {job.badges.map((badge) => {
              const colors = BADGE_COLORS[badge] || {
                bg: 'bg-gray-100',
                text: 'text-gray-700',
              };
              return (
                <span
                  key={badge}
                  className={`text-xs font-bold px-2 py-1 rounded ${colors.bg} ${colors.text}`}
                >
                  {badge}
                </span>
              );
            })}
          </div>
        </div>

        {/* Details */}
        <div className="flex flex-wrap gap-6 mt-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <span>📍</span>
            {job.location}
          </div>
          <div className="flex items-center gap-2">
            <span>💰</span>
            {job.salary}
          </div>
          <div className="flex items-center gap-2">
            <span>📌</span>
            {job.category}
          </div>
          <div className="flex items-center gap-2">
            <span>🌙</span>
            Night Shift
          </div>
        </div>
      </div>

      {/* CTA Buttons */}
      <div className="flex-shrink-0 flex flex-col gap-2">
        <Button
          size="sm"
          className="bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg px-6"
        >
          Quick Apply
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-slate-900 hover:bg-gray-100 font-medium"
        >
          Details
        </Button>
      </div>
    </div>
  );
}
