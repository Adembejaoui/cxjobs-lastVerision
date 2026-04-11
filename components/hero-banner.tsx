import { Button } from '@/components/ui/button';

export function HeroBanner() {
  return (
    <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-8 text-white overflow-hidden relative">
      <div className="flex items-center gap-8">
        {/* Left: Logo/Image */}
        <div className="flex-shrink-0">
          <div className="bg-slate-800 rounded-lg p-6 w-32 h-32 flex items-center justify-center border border-slate-700">
            <span className="text-4xl">💼</span>
          </div>
        </div>

        {/* Middle: Content */}
        <div className="flex-1">
          <div className="inline-block bg-green-500 text-slate-900 text-xs font-bold px-3 py-1 rounded-full mb-4">
            PROMOTED EMPLOYER
          </div>
          <h1 className="text-4xl font-bold mb-3">
            Build Your Future with CloudSphere
          </h1>
          <p className="text-slate-200 mb-6 leading-relaxed">
            We're expanding our technical support teams in Austin and Remote. Experience a culture of innovation, competitive pay, and rapid career growth.
          </p>

          {/* Stats */}
          <div className="flex gap-6 mb-6">
            <div>
              <p className="text-slate-400 text-sm">STARTING AT</p>
              <p className="text-xl font-bold">$22/hr</p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">OPENINGS</p>
              <p className="text-xl font-bold">50+ Roles</p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">LOCATION</p>
              <p className="text-xl font-bold">Remote</p>
            </div>
          </div>
        </div>

        {/* Right: CTA */}
        <div className="flex-shrink-0">
          <Button
            size="lg"
            className="bg-green-500 hover:bg-green-600 text-slate-900 font-bold h-12 px-8 rounded-lg"
          >
            View All Jobs
          </Button>
        </div>
      </div>
    </div>
  );
}
