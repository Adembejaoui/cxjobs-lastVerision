// Job role configuration for adaptive onboarding
// This file defines the recommended steps and skills based on target job role

export type JobRoleConfig = {
  id: string;
  title: string;
  description: string;
  icon: string;
  steps: string[];
  recommendedSkills: string[];
  recommendedLanguages: string[];
  requiredFields: string[];
  skipEducation: boolean;
  recommendedJobTypes: string[];
};

export const JOB_ROLE_CONFIG: Record<string, JobRoleConfig> = {
  CALL_CENTER: {
    id: "CALL_CENTER",
    title: "Call Center Representative",
    description: "Handle customer inquiries via phone or chat",
    icon: "headset",
    steps: ["skills", "languages", "experience", "preferences"],
    recommendedSkills: [
      "Communication",
      "Active Listening",
      "Customer Service",
      "Problem Solving",
      "Patience",
      "CRM",
      "Call Handling",
      "Keyboard Typing"
    ],
    recommendedLanguages: ["French", "English", "Arabic", "German", "Spanish", "Italian"],
    requiredFields: ["phone", "languages"],
    skipEducation: true,
    recommendedJobTypes: ["FULL_TIME", "PART_TIME", "CDI", "CDD"]
  },
  SALES: {
    id: "SALES",
    title: "Sales Professional",
    description: "Drive revenue through customer relationships",
    icon: "trending-up",
    steps: ["experience", "skills", "languages", "education", "preferences"],
    recommendedSkills: [
      "Negotiation",
      "Communication",
      "B2B Sales",
      "Customer Relationship",
      "CRM",
      "Presentation",
      "Lead Generation",
      "Closing Skills"
    ],
    recommendedLanguages: ["French", "English", "Arabic", "German", "Spanish", "Italian"],
    requiredFields: ["phone", "experience", "languages"],
    skipEducation: false,
    recommendedJobTypes: ["FULL_TIME", "CDI", "FREELANCE"]
  },
  TECH_SUPPORT: {
    id: "TECH_SUPPORT",
    title: "Technical Support",
    description: "Resolve technical issues for customers",
    icon: "settings",
    steps: ["skills", "experience", "education", "languages", "preferences"],
    recommendedSkills: [
      "Technical Knowledge",
      "Problem Solving",
      "IT Support",
      "Troubleshooting",
      "Hardware",
      "Software",
      "Customer Service",
      "Remote Support"
    ],
    recommendedLanguages: ["English", "French", "Arabic", "German", "Spanish", "Italian"],
    requiredFields: ["skills", "education"],
    skipEducation: false,
    recommendedJobTypes: ["FULL_TIME", "CDI", "INTERNSHIP"]
  },
  CUSTOMER_SERVICE: {
    id: "CUSTOMER_SERVICE",
    title: "Customer Service",
    description: "Provide support and assistance to customers",
    icon: "users",
    steps: ["skills", "languages", "experience", "preferences"],
    recommendedSkills: [
      "Communication",
      "Problem Solving",
      "Customer Support",
      "Patience",
      "Empathy",
      "CRM",
      "Written Communication",
      "Teamwork"
    ],
    recommendedLanguages: ["French", "English", "Arabic", "German", "Spanish", "Italian"],
    requiredFields: ["phone", "languages"],
    skipEducation: true,
    recommendedJobTypes: ["FULL_TIME", "PART_TIME", "CDI", "CDD"]
  },
  ADMIN: {
    id: "ADMIN",
    title: "Administrative Role",
    description: "Support operations and office management",
    icon: "briefcase",
    steps: ["experience", "skills", "education", "languages", "preferences"],
    recommendedSkills: [
      "Organization",
      "Time Management",
      "Microsoft Office",
      "Data Entry",
      "Scheduling",
      "Communication",
      "Attention to Detail",
      "Record Keeping"
    ],
    recommendedLanguages: ["French", "English", "Arabic", "German", "Spanish", "Italian"],
    requiredFields: ["experience"],
    skipEducation: false,
    recommendedJobTypes: ["FULL_TIME", "PART_TIME", "CDI"]
  },
  GENERAL: {
    id: "GENERAL",
    title: "General Applicant",
    description: "Open to various opportunities",
    icon: "search",
    steps: ["skills", "languages", "experience", "education", "preferences"],
    recommendedSkills: [
      "Communication",
      "Teamwork",
      "Problem Solving",
      "Adaptability",
      "Computer Literacy",
      "Customer Service",
      "Organization",
      "Time Management"
    ],
    recommendedLanguages: ["French", "English", "Arabic", "German", "Spanish", "Italian"],
    requiredFields: [],
    skipEducation: false,
    recommendedJobTypes: ["FULL_TIME", "PART_TIME", "CDI", "CDD", "INTERNSHIP", "FREELANCE"]
  }
};

export const JOB_ROLES = Object.values(JOB_ROLE_CONFIG);

export const getJobRoleConfig = (roleId: string): JobRoleConfig | undefined => {
  return JOB_ROLE_CONFIG[roleId];
};

export const getRecommendedSkills = (roleId: string): string[] => {
  return JOB_ROLE_CONFIG[roleId]?.recommendedSkills || [];
};

export const getRecommendedLanguages = (roleId: string): string[] => {
  return JOB_ROLE_CONFIG[roleId]?.recommendedLanguages || [];
};

export const getRequiredFields = (roleId: string): string[] => {
  return JOB_ROLE_CONFIG[roleId]?.requiredFields || [];
};

export const shouldSkipEducation = (roleId: string): boolean => {
  return JOB_ROLE_CONFIG[roleId]?.skipEducation || false;
};

export const getOnboardingSteps = (roleId: string): string[] => {
  return JOB_ROLE_CONFIG[roleId]?.steps || JOB_ROLE_CONFIG.GENERAL.steps;
};

export const INTERNATIONAL_LANGUAGES = [
  "Arabic",
  "Bengali",
  "Chinese (Mandarin)",
  "Dutch",
  "English",
  "French",
  "German",
  "Hindi",
  "Italian",
  "Japanese",
  "Korean",
  "Persian (Farsi)",
  "Polish",
  "Portuguese",
  "Russian",
  "Spanish",
  "Swedish",
  "Thai",
  "Turkish",
  "Ukrainian",
  "Urdu",
  "Vietnamese",
];
