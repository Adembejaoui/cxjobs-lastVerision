import Link from "next/link"
import { InfoText } from "./InfoText"
import { Tag } from "./Tag"

export interface JobData {
  title: string
  company: string
  slug: string
  location: string
  salary: string
  department: string
  extra: string
  badge1: string
  badge2: string
  icon: string
  isFirst?: boolean
}

interface JobCardProps {
  job: JobData
  index: number
}

export function JobCard({ job, index }: JobCardProps) {
  return (
    <article className="rounded-[30px] bg-[#f7f9fb] px-5 py-5 shadow-[0_10px_24px_rgba(0,0,0,0.12)] ring-1 ring-[#e8edf4] md:px-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-5">
          <div className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-[18px] bg-[#eef2f6] text-[34px] text-[#1f436d] ring-1 ring-[#dde5ef]">
            {job.isFirst ? (
              <div className="flex h-[48px] w-[48px] items-center justify-center rounded-[8px] bg-[#0f3040] text-[10px] font-semibold tracking-[0.14em] text-[#dce8dd]">
                DSWALI
              </div>
            ) : (
              job.icon
            )}
          </div>

          <div className="min-w-0">
            <h3 className="truncate text-[22px] font-black tracking-[-0.02em] text-[#18345b] md:text-[24px]">
              {job.title}
            </h3>
            <p className="mt-1 text-[18px] font-bold text-[#7b8ca3]">{job.company}</p>

            <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-[16px] font-semibold text-[#72829a]">
              <InfoText icon="⌖" text={job.location} />
              <InfoText icon="◫" text={job.salary} />
              <InfoText icon="⌘" text={job.department} />
              <InfoText icon="◷" text={job.extra} />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start gap-4 lg:items-end">
          <div className="flex flex-wrap gap-2">
            {job.badge1 ? <Tag variant="green">{job.badge1}</Tag> : null}
            {job.badge2 ? <Tag variant="slate">{job.badge2}</Tag> : null}
          </div>

          <div className="grid w-full flex-col gap-3 sm:w-auto sm:flex-row lg:flex-col xl:flex-row">
            <Link 
              href={`/jobs/${job.slug}/apply`}
              className="min-w-[170px] rounded-[18px] bg-[#45c68d] px-7 py-4 text-center text-[18px] font-extrabold text-white shadow-[0_12px_22px_rgba(69,198,141,0.28)] transition hover:translate-y-[-1px]"
            >
              Quick Apply
            </Link>
            <Link 
              href={`/jobs/${job.slug}`}
              className="min-w-[170px] rounded-[18px] border border-[#d7e0ea] bg-white px-7 py-4 text-center text-[18px] font-extrabold text-[#2a476e] transition hover:bg-[#f9fbfd]"
            >
              Details
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}
