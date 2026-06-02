export interface Skill {
  id: string;
  name: string;
  level: string | null;
  yearsOfExperience: number | null;
}

export interface Language {
  id: string;
  name: string;
  proficiency: string;
}

export interface Experience {
  id: string;
  company: string;
  title: string;
  location: string | null;
  startDate: Date;
  endDate: Date | null;
  isCurrent: boolean;
  description: string | null;
}

export interface Education {
  id: string;
  school: string;
  degree: string;
  fieldOfStudy: string | null;
  startDate: Date;
  endDate: Date | null;
  isCurrent: boolean;
  description: string | null;
}

export interface Candidate {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  location: string | null;
  headline: string | null;
  summary: string | null;
  avatarUrl: string | null;
  resumeUrl: string | null;
  linkedinUrl: string | null;
  preferredJobTypes: string[];
  skills: Skill[];
  languages: Language[];
  experiences: Experience[];
  education: Education[];
}

export type LeanCandidate = Partial<Candidate> & {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
};

export interface Application {
  id: string;
  status: string;
  coverLetter: string | null;
  cvUrl: string | null;
  notes: string | null;
  isSaved: boolean;
  createdAt: Date;
  candidate?: LeanCandidate | Candidate;
}