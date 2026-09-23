'use client';

/* eslint-disable @next/next/no-img-element */

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from "@/components/auth/user-provider";
import { ArrowLeft, MapPin, CheckCircle, Loader2, AlertCircle, User, FileText, Languages } from 'lucide-react';

interface JobLanguage {
  id: string
  language: string
  level: string
}

interface JobBenefit {
  id: string
  benefit: {
    id: string
    name: string
    description: string | null
    icon: string | null
    category: string
  }
  customDescription: string | null
}

interface Company {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  location: string | null
  website: string | null
  description: string | null
  isRemoteFriendly: boolean
  isHybridFriendly: boolean
  benefits: { id: string; name: string }[]
}

interface JobOffer {
  id: string
  title: string
  slug: string
  description: string | null
  customLocation: string | null
  contractType: string
  salary: string | null
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
  isRemote: boolean
  isHybrid: boolean
  applicationType: string
  externalApplyUrl: string | null
  benefits: JobBenefit[]
  languages: JobLanguage[]
  company: Company
  _count: {
    applications: number
  }
  createdAt: Date
}

interface CandidateProfile {
  firstName: string | null;
  lastName: string | null;
  headline: string | null;
  location: string | null;
  phone: string | null;
  resumeUrl: string | null;
  skills: { name: string }[];
  languages: { name: string; proficiency: string }[];
  experiences: { title: string; company: string }[];
}

export default function JobApplyPage() {
  const params = useParams();
  const router = useRouter();
  const user = useUser();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [job, setJob] = useState<JobOffer | null>(null);
  const [candidate, setCandidate] = useState<CandidateProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [profileComplete, setProfileComplete] = useState(0);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  
  const [coverLetter, setCoverLetter] = useState('');
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    async function fetchData() {
      // Check auth and role
      if (!user) {
        router.push(`/login?callbackUrl=/jobs/${params.slug}/apply`);
        return;
      }
      
      if (user.role !== 'CANDIDATE') {
        router.push(`/jobs/${params.slug}`);
        return;
      }
      
      if (user.isOnboarded === false) {
        router.push(`/onboarding/candidate`);
        return;
      }

      if (params.slug) {
        try {
          // Fetch job and candidate profile in parallel
          const [jobRes, profileRes] = await Promise.all([
            fetch(`/api/job-offers/by-slug/${params.slug}`),
            fetch('/api/profile'),
          ]);

          const jobData = await jobRes.json();
          const profileData = await profileRes.json();

          if (jobData.success) {
            const jobDataRecord = jobData.data;
            setJob(jobDataRecord);
            
            // Check if this is an EXTERNAL application - redirect if so
            if (jobDataRecord.applicationType === "EXTERNAL" && jobDataRecord.externalApplyUrl) {
              window.open(jobDataRecord.externalApplyUrl, '_blank', 'noopener,noreferrer');
              router.push(`/jobs/${jobDataRecord.slug}`);
              return;
            }
          } else {
            setError(jobData.error || 'Job not found');
          }

          if (profileData.success && profileData.data.candidate) {
            const cand = profileData.data.candidate;
            setCandidate(cand);

            // Calculate profile completion
            const fields = {
              firstName: !!cand.firstName,
              lastName: !!cand.lastName,
              phone: !!cand.phone,
              location: !!cand.location,
              headline: !!cand.headline,
              resumeUrl: !!cand.resumeUrl,
              skills: cand.skills?.length > 0,
              languages: cand.languages?.length > 0,
              experience: cand.experiences?.length > 0,
            };
            
            const completed = Object.values(fields).filter(Boolean).length;
            const completion = Math.round((completed / Object.keys(fields).length) * 100);
            setProfileComplete(completion);

            // Check required fields
            const required = [];
            if (!cand.phone) required.push('phone');
            if (!cand.location) required.push('location');
            setMissingFields(required);
          }
        } catch {
          setError('Failed to load data');
        } finally {
          setLoading(false);
        }
      }
    }

    fetchData();
  }, [params.slug, router, user]);

  const handleCoverLetterChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    if (text.length <= 2000) {
      setCoverLetter(text);
      setCharCount(text.length);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobOfferId: job.id,
          coverLetter: coverLetter.trim(),
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setSubmitted(true);
      } else {
        setError(data.error || 'Failed to submit application');
      }
    } catch {
      setError('Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  const getContractTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      CDI: 'Full-Time',
      CDD: 'Contract',
      FREELANCE: 'Freelance',
      INTERNSHIP: 'Internship',
      PART_TIME: 'Part-Time',
    };
    return labels[type] || type;
  };

  const handleGoToProfile = () => {
    router.push('/dashboard/candidate/profile');
  };

  const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  TND: "د.ت",
}

const formatSalary = (job: JobOffer): string => {
  const symbol = CURRENCY_SYMBOLS[job.salaryCurrency || "USD"] || "$"
  if (job.salary) return `${symbol}${job.salary}`
  if (job.salaryMin && job.salaryMax) return `${symbol}${job.salaryMin.toLocaleString()} - ${symbol}${job.salaryMax.toLocaleString()}`
  if (job.salaryMin) return `From ${symbol}${job.salaryMin.toLocaleString()}`
  if (job.salaryMax) return `Up to ${symbol}${job.salaryMax.toLocaleString()}`
  return "Salary TBD"
}

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 rounded-full border-4 border-[#162f67] border-t-transparent animate-spin"></div>
            <p className="text-slate-600">Loading...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !job) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="container mx-auto px-4 py-8">
          <Button variant="ghost" onClick={() => router.push('/jobs')} className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Jobs
          </Button>
          <div className="text-center py-20">
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Job Not Found</h2>
            <p className="text-slate-600">{error || 'This job listing may have been removed.'}</p>
          </div>
        </div>
      </main>
    );
  }

  // Block if profile incomplete
  if (missingFields.length > 0 || profileComplete < 50) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="container mx-auto px-4 py-8">
          <Button variant="ghost" onClick={() => router.push(`/jobs/${job.slug}`)} className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Job
          </Button>

          <Card className="max-w-lg mx-auto p-8 text-center border-red-100 bg-white rounded-2xl shadow-sm">
            <div className="flex justify-center mb-6">
              <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-3">Complete Your Profile</h2>
            <p className="text-slate-600 mb-6">
              Your profile must be at least 50% complete and require a phone number and location to apply.
            </p>

            {/* Profile Completion Bar */}
            <div className="bg-slate-50 rounded-xl p-4 mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-600">Profile Completion</span>
                <span className="font-semibold text-slate-900">{profileComplete}%</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${profileComplete >= 50 ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{ width: `${profileComplete}%` }}
                ></div>
              </div>
            </div>

            {/* Missing Fields */}
            {missingFields.length > 0 && (
              <div className="text-left mb-6">
                <p className="text-sm text-slate-600 mb-2">Missing required fields:</p>
                <ul className="text-sm text-red-600 space-y-1">
                  {missingFields.includes('phone') && <li>• Phone number</li>}
                  {missingFields.includes('location') && <li>• Location</li>}
                </ul>
              </div>
            )}

            <Button 
              onClick={handleGoToProfile}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-[#162f67] to-[#1e4d9c]"
            >
              Complete Your Profile
            </Button>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Back Button */}
        {!submitted && (
          <Button variant="ghost" onClick={() => router.push(`/jobs/${job.slug}`)} className="mb-6 text-slate-600">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Job Details
          </Button>
        )}

        {/* Job Preview Card */}
        {!submitted && (
          <Card className="p-5 mb-6 border-slate-200 bg-white rounded-2xl shadow-sm">
            <div className="flex gap-4">
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-[#162f67] to-[#1e4d9c] flex items-center justify-center overflow-hidden flex-shrink-0">
                {job.company.logoUrl ? (
                  <img src={job.company.logoUrl} alt={job.company.name} className="w-full h-full object-contain p-2" />
                ) : (
                  <span className="text-lg font-bold text-white">{job.company.name.charAt(0)}</span>
                )}
              </div>
<div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold text-slate-900 truncate">{job.title}</h1>
                <p className="text-slate-600 text-sm">{job.company.name}</p>
                <div className="flex flex-wrap gap-2 items-center text-xs text-slate-500 mt-1">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {job.customLocation || job.company.location || 'Remote'}
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="font-semibold text-[#162f67]">{formatSalary(job)}</span>
                  <span className="text-slate-400">•</span>
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                    {getContractTypeLabel(job.contractType)}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Success Screen */}
        {submitted ? (
          <Card className="p-12 text-center border-slate-200 bg-white rounded-2xl shadow-sm">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-green-100 rounded-full blur-xl"></div>
                <CheckCircle className="h-20 w-20 text-green-600 relative" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Application Submitted!</h2>
            <p className="text-slate-600 max-w-md mx-auto mb-8">
              Thank you for applying to <strong>{job.title}</strong> at <strong>{job.company.name}</strong>. We&apos;ll review your application soon.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="outline" onClick={() => router.push('/dashboard/candidate/applications')} className="rounded-xl">
                View My Applications
              </Button>
              <Button onClick={() => router.push('/jobs')} className="bg-gradient-to-r from-[#162f67] to-[#1e4d9c] rounded-xl">
                Browse More Jobs
              </Button>
            </div>
          </Card>
        ) : (
          /* Application Form */
          <form onSubmit={handleSubmit}>
            <Card className="p-6 border-slate-200 bg-white rounded-2xl shadow-sm">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900 mb-1">Apply Now</h2>
                <p className="text-sm text-slate-500">Write a cover letter to stand out</p>
              </div>

              {/* Profile Summary */}
              <div className="bg-slate-50 rounded-xl p-4 mb-6">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Your Profile</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-700">{candidate?.firstName} {candidate?.lastName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-700">{candidate?.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-700">{candidate?.resumeUrl ? 'Resume attached ✓' : 'No resume'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Languages className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-700">{candidate?.languages?.length || 0} languages</span>
                  </div>
                </div>
              </div>

              {/* Cover Letter Input */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  Cover Letter <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <Textarea
                  value={coverLetter}
                  onChange={handleCoverLetterChange}
                  placeholder="Introduce yourself and explain why you're a great fit for this position..."
                  className="min-h-48 bg-slate-50 border-slate-200 focus:bg-white focus:border-[#162f67] rounded-xl transition-all resize-none"
                />
                <div className="flex justify-between mt-2">
                  <p className="text-xs text-slate-400">
                    {charCount === 0 ? 'Max 2000 characters' : `${2000 - charCount} characters remaining`}
                  </p>
                  {charCount > 1900 && charCount <= 2000 && (
                    <p className="text-xs text-orange-500">Almost at limit</p>
                  )}
                </div>
              </div>
            </Card>

            {/* Submit Button */}
            <div className="mt-6">
              <Button 
                type="submit" 
                disabled={submitting || charCount > 2000}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-[#162f67] to-[#1e4d9c] hover:from-[#1e4d9c] hover:to-[#2a5cb8] shadow-lg"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit Application
                    <CheckCircle className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
