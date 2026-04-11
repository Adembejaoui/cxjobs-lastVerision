'use client';

import Link from 'next/link';

export default function LeftSection() {
  return (
    <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex-col justify-between p-12 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, rgba(16, 185, 129, 0.3) 0%, transparent 50%),
                           radial-gradient(circle at 75% 75%, rgba(99, 102, 241, 0.3) 0%, transparent 50%)`,
        }} />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-16">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
            <svg
              className="w-6 h-6 text-slate-900"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
            </svg>
          </div>
          <span className="text-white text-xl font-bold">CX Jobs</span>
        </div>

        {/* Main Headline */}
        <div className="mb-12">
          <h1 className="text-5xl lg:text-6xl font-bold text-white leading-tight mb-4">
            Unlock your next{' '}
            <span className="text-emerald-400">career milestone</span>
            {' '}in{' '}
            <span className="block">CX.</span>
          </h1>
          <p className="text-slate-300 text-lg max-w-md">
            Join 50,000+ customer experience professionals finding top roles at global tech leaders and innovative startups.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-2 gap-4 max-w-md">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-slate-300 text-sm">Remote-first roles</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-slate-300 text-sm">Direct hire verified</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-slate-300 text-sm">Career coaching</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-slate-300 text-sm">Priority matching</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 text-slate-400 text-sm border-t border-slate-700 pt-6">
        © 2024 CX Jobs Global Recruitment Platform. All rights reserved.
      </div>
    </div>
  );
}
