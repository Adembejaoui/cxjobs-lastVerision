export interface LegalSection {
  id: string;
  title: string;
  content: string[];
}

export interface LegalDocument {
  slug: string;
  title: string;
  description: string;
  sections: LegalSection[];
  lastUpdated: string;
}

export const TERMS_OF_SERVICE: LegalDocument = {
  slug: "terms",
  title: "Terms of Service",
  description:
    "These Terms of Service define the terms and conditions for using the CXJobs website (www.CXJobs.tn), an online service connecting job seekers with recruiters.",
  lastUpdated: "September 2026",
  sections: [
    {
      id: "purpose",
      title: "1. Purpose",
      content: [
        "These Terms of Service define the terms and conditions for using the CXJobs website (www.CXJobs.tn), an online service connecting job seekers with recruiters.",
      ],
    },
    {
      id: "acceptance",
      title: "2. Acceptance",
      content: [
        "By accessing and using the CXJobs website, every user accepts these Terms of Service without reservation. If the user does not accept these terms, they are invited not to use the platform's services.",
      ],
    },
    {
      id: "services-provided",
      title: "3. Services Provided",
      content: [
        "For candidates:",
        "Profile creation and CV submission",
        "Browsing and applying for job offers",
        "Personalized email alerts",
        "",
        "For recruiters:",
        "Publication of job offers",
        "Access to the CV database according to the subscribed plan",
        "Application management tools",
      ],
    },
    {
      id: "registration",
      title: "4. Registration and User Accounts",
      content: [
        "Registration is free for candidates. Registration is paid for recruiters according to the plans selected.",
        "Each user agrees to provide accurate, up-to-date, and complete information.",
      ],
    },
    {
      id: "user-obligations",
      title: "5. User Obligations",
      content: [
        "Every user agrees to:",
        "Not distribute unlawful, defamatory, or discriminatory content",
        "Respect the confidentiality of the data they have access to",
        "Use CVs solely for recruitment purposes",
        "Not circumvent the functionalities provided by the platform",
      ],
    },
    {
      id: "cv-database",
      title: "6. Use of the CV Database",
      content: [
        "The CV database is accessible to recruiters with a valid subscription.",
        "The use of candidate data is strictly limited to recruitment purposes. Any commercial use, resale, or unauthorized distribution is prohibited.",
      ],
    },
    {
      id: "intellectual-property",
      title: "7. Intellectual Property",
      content: [
        "The content of the website, including texts, logos, design, and database, is protected by intellectual property law.",
        "Any unauthorized reproduction is prohibited.",
      ],
    },
    {
      id: "liability",
      title: "8. Liability",
      content: [
        "CXJobs cannot be held responsible for content published by users or for the outcome of recruitment processes.",
        "CXJobs undertakes to implement the necessary measures to ensure the availability of its services, without providing an absolute guarantee.",
      ],
    },
    {
      id: "termination",
      title: "9. Termination",
      content: [
        "Any user may delete their account at any time.",
        "CXJobs reserves the right to suspend or terminate an account in the event of non-compliance with these Terms of Service.",
      ],
    },
    {
      id: "personal-data",
      title: "10. Personal Data",
      content: [
        "Personal data is processed in accordance with our Privacy Policy.",
      ],
    },
    {
      id: "applicable-law",
      title: "11. Applicable Law",
      content: [
        "These Terms of Service are governed by Tunisian law.",
        "In the event of a dispute, the courts of Tunis shall have jurisdiction.",
      ],
    },
  ],
};

export const PRIVACY_POLICY: LegalDocument = {
  slug: "privacy",
  title: "Privacy Policy",
  description:
    "At CXJobs, protecting your personal data is a priority. This Privacy Policy aims to transparently inform you about how we collect, use, store, and protect your data.",
  lastUpdated: "September 2026",
  sections: [
    {
      id: "introduction",
      title: "1. Introduction",
      content: [
        "At CXJobs, protecting your personal data is a priority.",
        "This Privacy Policy aims to transparently inform you about how we collect, use, store, and protect your data.",
      ],
    },
    {
      id: "data-controller",
      title: "2. Data Controller",
      content: [
        "The data controller is company XY, registered in Tunisia under registration number YZX.",
        "For any questions regarding your data, you can contact us at:",
        "contact@CXJobs.tn",
      ],
    },
    {
      id: "data-collected",
      title: "3. Data We Collect",
      content: [
        "Depending on how you use our platform, we collect the following data:",
        "",
        "Account information:",
        "First name",
        "Last name",
        "Email address",
        "Phone number",
        "Password",
        "",
        "Profile information:",
        "CV",
        "Cover letter",
        "Professional experience",
        "Education level",
        "",
        "Browsing data:",
        "IP address",
        "Browser type",
        "Pages visited",
        "",
        "Location data:",
        "Optional location information",
      ],
    },
    {
      id: "purposes-of-processing",
      title: "4. Purposes of Processing",
      content: [
        "We use your personal data for the following purposes:",
        "Creating and managing your candidate or recruiter account",
        "Connecting you with job offers that match your profile",
        "Sending notification emails or job alerts",
        "Improving our services and conducting statistical analysis",
        "Complying with legal obligations",
      ],
    },
    {
      id: "data-recipients",
      title: "5. Data Recipients",
      content: [
        "Your data may be shared with:",
        "Recruiters or partner companies when you apply for a job offer",
        "Our technical service providers, including hosting, email delivery, and analytics providers",
        "Administrative or judicial authorities when required by law",
      ],
    },
    {
      id: "data-retention",
      title: "6. Data Retention Period",
      content: [
        "Account data: 3 years after the last activity",
        "Application data: 2 years after CV submission",
        "Cookies: up to 13 months",
      ],
    },
    {
      id: "your-rights",
      title: "7. Your Rights",
      content: [
        "In accordance with applicable legislation, you have the following rights:",
        "Right to access your data",
        "Right to rectification",
        "Right to erasure (\"right to be forgotten\")",
        "Right to object to and restrict processing",
        "Right to data portability",
        "",
        "You may exercise these rights at any time by contacting us at:",
        "contact@CXJobs.tn",
      ],
    },
    {
      id: "data-security",
      title: "8. Data Security",
      content: [
        "We implement appropriate technical and organizational measures to ensure the security of your personal data against unauthorized access, loss, or disclosure.",
      ],
    },
    {
      id: "cookies",
      title: "9. Cookies",
      content: [
        "CXJobs uses cookies to improve your user experience and measure audience/traffic.",
        "You can change your preferences at any time through our cookie banner.",
      ],
    },
    {
      id: "changes",
      title: "10. Changes",
      content: [
        "This Privacy Policy may be modified at any time.",
        "The version currently in effect is the version published on our website on the date of your connection.",
      ],
    },
  ],
};

export const LEGAL_DOCUMENTS: LegalDocument[] = [
  TERMS_OF_SERVICE,
  PRIVACY_POLICY,
];

export function getLegalDocument(slug: string): LegalDocument | undefined {
  return LEGAL_DOCUMENTS.find((document) => document.slug === slug);
}

export function getAllLegalDocuments(): LegalDocument[] {
  return LEGAL_DOCUMENTS;
}