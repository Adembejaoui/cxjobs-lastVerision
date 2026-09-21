import {
  Target,
  Handshake,
  User,
} from "lucide-react";

export interface CareerGuideSection {
  title: string;
  content: string[];
  tips?: string[];
}

export interface CareerGuide {
  slug: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  icon: React.ElementType;
  readingTime: string;
  color: string;
  bgColor: string;
  sections: CareerGuideSection[];
  keyTakeaways: string[];
}

export const CAREER_GUIDES: CareerGuide[] = [
  {
    slug: "how-to-find-the-right-job",
    title: "How to Find the Right Job",
    shortDescription:
      "Master job search strategies, use filters effectively, and avoid common mistakes to land your ideal role faster.",
    fullDescription:
      "Finding the right job isn't just about applying to everything—it's about strategy. This guide walks you through proven techniques to identify opportunities that match your skills, values, and career goals.",
    icon: Target,
    readingTime: "8 min read",
    color: "text-teal-600",
    bgColor: "bg-teal-50 border-teal-100",
    sections: [
      {
        title: "Job Search Strategy",
        content: [
          "Start by defining what you're looking for: role type, industry, company size, location preferences, and salary expectations.",
          "Create a target list of 20-30 companies that align with your values and career trajectory.",
          "Set up job alerts on CXJobs and other platforms for your target roles to be among the first applicants.",
          "Allocate dedicated time blocks for job searching (e.g., 1-2 hours daily) rather than sporadic browsing.",
          "Track your applications in a spreadsheet with columns for company, role, date applied, status, and follow-up dates.",
        ],
        tips: [
          "Apply within the first 48 hours of a job posting—early applicants have a significant advantage.",
          "Tailor your resume for each application; generic applications rarely pass ATS filters.",
        ],
      },
      {
        title: "Using Filters Effectively",
        content: [
          "Use keyword filters strategically: combine role titles with specific skills (e.g., 'React Developer' + 'TypeScript').",
          "Filter by experience level to avoid wasting time on roles that are too junior or too senior.",
          "Use location filters wisely: include 'Remote' and 'Hybrid' options to expand your reach.",
          "Save your most-used filter combinations as saved searches for quick access.",
          "Don't over-filter—start broad, then narrow down based on results.",
        ],
        tips: [
          "The 'Posted within last week' filter ensures you're applying to active opportunities.",
          "Use the company size filter to target startups (fast growth) vs. enterprises (stability).",
        ],
      },
      {
        title: "Understanding Job Descriptions",
        content: [
          "Distinguish between 'requirements' (must-haves) and 'preferred qualifications' (nice-to-haves).",
          "Look for keywords that indicate company culture: 'fast-paced,' 'collaborative,' 'autonomous,' 'innovative.'",
          "Identify the core problems the role solves—this helps you tailor your application and interview answers.",
          "Check for red flags: vague responsibilities, unrealistic expectations, or excessive requirements for the level.",
          "Research the tech stack and tools mentioned to assess your fit and identify learning gaps.",
        ],
        tips: [
          "If you meet 70% of requirements, apply—many 'requirements' are wish lists.",
          "The order of requirements often indicates priority; focus on the first 3-5 items.",
        ],
      },
      {
        title: "Choosing Relevant Opportunities",
        content: [
          "Evaluate company mission, values, and Glassdoor reviews before applying.",
          "Consider the learning trajectory: will this role advance your skills in your desired direction?",
          "Assess the team structure and manager—your direct manager impacts growth more than the company.",
          "Look at the company's funding stage, growth trajectory, and market position.",
          "Factor in total compensation: base salary, equity, bonuses, benefits, and work-life balance.",
        ],
        tips: [
          "Reach out to current employees on LinkedIn for insider perspectives before interviewing.",
          "Prioritize roles where you can demonstrate clear impact within the first 90 days.",
        ],
      },
      {
        title: "Common Job-Search Mistakes",
        content: [
          "Spray-and-pray: applying to hundreds of jobs with generic materials.",
          "Ignoring your network—referrals increase interview chances by 10x.",
          "Not following up after applying or interviewing.",
          "Focusing only on job boards; 80% of roles are filled through networking and internal referrals.",
          "Neglecting your online presence—recruiters Google you before calling.",
          "Accepting the first offer without negotiating or evaluating alternatives.",
        ],
        tips: [
          "Quality over quantity: 10 tailored applications beat 100 generic ones.",
          "Always send a thank-you email within 24 hours of an interview.",
        ],
      },
    ],
    keyTakeaways: [
      "Define your target criteria before you start searching",
      "Use filters strategically and save your best combinations",
      "Read job descriptions for cultural signals, not just requirements",
      "Research companies thoroughly before investing time in applications",
      "Avoid spray-and-pray; focus on quality, tailored applications",
    ],
  },
  {
    slug: "how-to-succeed-in-a-job-interview",
    title: "How to Succeed in a Job Interview",
    shortDescription:
      "Prepare thoroughly, research companies effectively, master common questions, and follow up professionally.",
    fullDescription:
      "The interview is your moment to shine. This comprehensive guide covers everything from preparation and company research to answering tough questions and the critical follow-up that sets you apart.",
    icon: Handshake,
    readingTime: "10 min read",
    color: "text-blue-600",
    bgColor: "bg-blue-50 border-blue-100",
    sections: [
      {
        title: "Interview Preparation",
        content: [
          "Review the job description line by line; prepare specific examples for each key requirement using the STAR method (Situation, Task, Action, Result).",
          "Prepare 3-5 'signature stories' that demonstrate your impact, leadership, problem-solving, and adaptability.",
          "Practice your 'Tell me about yourself' pitch (90 seconds): present role → relevant past → why this role/company.",
          "Prepare thoughtful questions for each interviewer (see 'Questions to Ask Recruiters' section).",
          "Test your tech setup for video interviews: camera, microphone, lighting, and background.",
          "Plan your outfit (even for video)—dress one level above the company's daily dress code.",
        ],
        tips: [
          "Record yourself answering common questions to refine delivery and eliminate filler words.",
          "Prepare a 'cheat sheet' with key metrics, project names, and numbers for quick reference.",
        ],
      },
      {
        title: "Researching the Company",
        content: [
          "Study the company website: mission, values, products/services, recent news, and leadership team.",
          "Read recent press releases, blog posts, and earnings calls (for public companies).",
          "Check Glassdoor, Blind, and LinkedIn for employee reviews and interview experiences.",
          "Understand the business model: how they make money, target market, and competitive landscape.",
          "Research your interviewers on LinkedIn—find common connections, shared backgrounds, or interests.",
          "Know their tech stack, recent product launches, and technical challenges (from engineering blogs).",
        ],
        tips: [
          "Mention a specific company initiative or blog post in your answers to show deep research.",
          "Prepare 2-3 insights about their industry/market to demonstrate strategic thinking.",
        ],
      },
      {
        title: "Common Interview Questions",
        content: [
          "Behavioral: 'Tell me about a time you failed/handled conflict/led a project/met a tight deadline.'",
          "Technical: Role-specific questions—review fundamentals and be ready to whiteboard/code live.",
          "Situational: 'How would you handle X scenario?'—use a framework: clarify, analyze, propose, iterate.",
          "Strengths/Weaknesses: Be honest about weaknesses but show active improvement steps.",
          "Why this company/role?: Connect your values, skills, and goals to their specific needs.",
          "Salary expectations: Research market rates (Levels.fyi, Glassdoor); give a range, not a number.",
        ],
        tips: [
          "For behavioral questions, always use STAR: Situation, Task, Action, Result (quantify results).",
          "When asked about weaknesses, choose a real one and explain your mitigation strategy.",
        ],
      },
      {
        title: "How to Present Yourself",
        content: [
          "Project confidence through posture, eye contact, and measured speech pace.",
          "Listen actively—pause 1-2 seconds before answering to show thoughtfulness.",
          "Be concise: aim for 2-3 minute answers; offer to elaborate if they want more detail.",
          "Show enthusiasm for the role and company—genuine interest is memorable.",
          "Demonstrate cultural fit by referencing their values in your answers.",
          "Admit when you don't know something: 'I haven't encountered that, but here's how I'd approach it...'",
        ],
        tips: [
          "Smile and use the interviewer's name naturally—builds rapport instantly.",
          "Mirror the interviewer's communication style (formal vs. casual, detailed vs. high-level).",
        ],
      },
      {
        title: "Questions to Ask Recruiters",
        content: [
          "Role-focused: 'What does success look like in the first 90 days?' 'What's the biggest challenge the team faces?'",
          "Team-focused: 'How is the team structured?' 'How does this role collaborate with other departments?'",
          "Growth-focused: 'What learning opportunities exist?' 'How are promotions and reviews structured?'",
          "Culture-focused: 'How would you describe the team culture?' 'What's your favorite thing about working here?'",
          "Company-focused: 'What are the company's top priorities this year?' 'How does this team contribute to that?'",
          "Closing: 'What are the next steps in the process?' 'Is there anything about my background that gives you pause?'",
        ],
        tips: [
          "Never say 'I don't have any questions'—it signals low interest.",
          "Ask questions tailored to each interviewer's role (hiring manager vs. peer vs. HR).",
        ],
      },
      {
        title: "Follow-Up After the Interview",
        content: [
          "Send personalized thank-you emails within 24 hours to each interviewer—reference specific discussion points.",
          "Reiterate your interest and briefly reinforce 1-2 key qualifications discussed.",
          "If you forgot to mention something important, include it briefly in the follow-up.",
          "Connect with interviewers on LinkedIn with a personalized note.",
          "Follow up on the timeline they provided; if no timeline, wait 5-7 business days.",
          "If rejected, ask for feedback: 'I'd appreciate any feedback to help me improve for future opportunities.'",
        ],
        tips: [
          "Handwritten notes stand out for final-round interviews at smaller companies.",
          "Stay engaged with the company's content on LinkedIn while waiting—shows sustained interest.",
        ],
      },
    ],
    keyTakeaways: [
      "Prepare signature stories using STAR method for behavioral questions",
      "Research the company deeply—reference specifics in your answers",
      "Ask thoughtful, role-specific questions to each interviewer",
      "Send personalized thank-you notes within 24 hours",
      "Follow up professionally on the timeline provided",
    ],
  },
  {
    slug: "how-to-build-a-strong-professional-profile",
    title: "How to Build a Strong Professional Profile",
    shortDescription:
      "Complete your candidate profile, showcase skills and experience, add certifications, and maximize recruiter visibility.",
    fullDescription:
      "Your professional profile is your digital handshake with recruiters. This guide shows you how to optimize every section of your CXJobs profile to attract the right opportunities and stand out in searches.",
    icon: User,
    readingTime: "7 min read",
    color: "text-purple-600",
    bgColor: "bg-purple-50 border-purple-100",
    sections: [
      {
        title: "Completing the Candidate Profile",
        content: [
          "Upload a professional headshot: clear face, neutral background, friendly expression (profiles with photos get 14x more views).",
          "Write a compelling headline (120 chars): Current role + key specialization + value proposition (e.g., 'Senior React Developer | Fintech Specialist | Building Scalable Payment Systems').",
          "Craft a strong summary (200-300 words): Who you are, what you do, key achievements, and what you're looking for.",
          "Set your location preferences accurately—include 'Open to Remote' and 'Open to Relocation' if applicable.",
          "Specify your notice period and availability honestly.",
          "Add your portfolio, GitHub, LinkedIn, and personal website links.",
        ],
        tips: [
          "Update your headline quarterly to reflect new skills or career direction.",
          "Use keywords from target job descriptions in your summary for searchability.",
        ],
      },
      {
        title: "Highlighting Skills and Experience",
        content: [
          "List 10-15 core skills: prioritize those matching your target roles; group by category (Languages, Frameworks, Tools, Methodologies).",
          "For each role: Company, title, dates, 4-6 bullet points with quantified achievements (not just responsibilities).",
          "Use the formula: Action verb + Context + Result (e.g., 'Reduced API latency by 40% by implementing Redis caching, improving user experience for 500K+ users.').",
          "Include relevant projects with links: describe the problem, your role, tech stack, and outcome.",
          "Don't hide employment gaps—briefly explain (freelancing, upskilling, caregiving, etc.).",
          "Feature 2-3 'Featured Projects' at the top of your profile for maximum visibility.",
        ],
        tips: [
          "Quantify everything: percentages, dollar amounts, team sizes, user counts, time saved.",
          "Use industry-standard skill names (e.g., 'React.js' not 'React JS') for better matching.",
        ],
      },
      {
        title: "Adding Languages and Certifications",
        content: [
          "List languages with proficiency levels: Native, Fluent, Professional Working, Limited Working, Elementary.",
          "Prioritize certifications relevant to your target roles; include issuing organization and date.",
          "For in-progress certifications, note 'Expected [Month Year]'—shows commitment to growth.",
          "Include notable online courses (Coursera, edX, specialized bootcamps) with completion certificates.",
          "Add speaking engagements, publications, or open-source contributions as credibility signals.",
          "Renew expired certifications or note 'Previously certified in...' if still relevant.",
        ],
        tips: [
          "Cloud certifications (AWS, Azure, GCP) and security certs are high-value across industries.",
          "Group certifications by category (Cloud, Security, Agile, Domain-Specific) for readability.",
        ],
      },
      {
        title: "Keeping Information Updated",
        content: [
          "Set a quarterly calendar reminder to review and update your profile.",
          "Add new skills, projects, and achievements immediately after completing them.",
          "Update your headline and summary when your career focus shifts.",
          "Refresh your 'Open to Work' status and preferences as your situation changes.",
          "Remove outdated skills (e.g., legacy technologies you no longer use) to keep the profile focused.",
          "Verify contact information and notification settings monthly.",
        ],
        tips: [
          "Treat your profile like a living document, not a one-time setup.",
          "After each significant project or role change, spend 15 minutes updating your profile.",
        ],
      },
      {
        title: "Improving Recruiter Visibility",
        content: [
          "Enable 'Open to Work' (visible to recruiters only or publicly) in your profile settings.",
          "Optimize for search: use standard job titles and skill keywords recruiters actually search for.",
          "Engage with CXJobs content: save jobs, follow companies, and apply thoughtfully—activity signals relevance.",
          "Complete your profile to 100%—incomplete profiles rank lower in recruiter searches.",
          "Request recommendations from former managers/colleagues; 3+ recommendations significantly boost credibility.",
          "Share thoughtful industry insights occasionally (if the platform supports posts) to demonstrate expertise.",
        ],
        tips: [
          "Recruiters search by skills first—ensure your top 10 skills match your target roles exactly.",
          "A 100% complete profile with a photo gets 40% more recruiter messages.",
        ],
      },
    ],
    keyTakeaways: [
      "Complete every profile section—100% completion dramatically increases visibility",
      "Quantify achievements with metrics, not just responsibilities",
      "Use standard keywords recruiters search for in skills and headlines",
      "Keep your profile current with quarterly updates",
      "Enable 'Open to Work' and engage with platform content",
    ],
  },
];

export function getCareerGuide(slug: string): CareerGuide | undefined {
  return CAREER_GUIDES.find((guide) => guide.slug === slug);
}

export function getAllCareerGuides(): CareerGuide[] {
  return CAREER_GUIDES;
}