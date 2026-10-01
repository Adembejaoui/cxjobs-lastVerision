import "dotenv/config";
import { PrismaClient, Prisma } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const PERF_JOB_COUNT = Number(process.env.PERF_JOB_COUNT) || 5000;
const SLUG_PREFIX = "perf-job";
const BATCH_SIZE = 1000;

const now = new Date();
const sixMonthsAhead = new Date(now);
sixMonthsAhead.setMonth(sixMonthsAhead.getMonth() + 6);

type JobTheme = {
  title: string | string[];
  descriptions: string[];
  requirements: string[];
  technicalTools: string[];
  softSkills: string[];
  activityType: Prisma.JobOfferCreateManyInput["activityType"];
  salaryBand: [number, number];
  isRemote: boolean;
};

const THEMES: JobTheme[] = [
  {
    title: "React Developer",
    descriptions: [
      "We're hiring a React Developer to build engaging user interfaces for our flagship product. You'll join a product team developing modern web applications with React, TypeScript, and Node.js. The role emphasizes clean component design and performant React patterns built on a solid HTML foundation.",
      "Join our engineering team as a React Developer. We build scalable frontend applications using React and TypeScript, with Node.js services powering the backend. You'll collaborate with UX designers to craft responsive experiences using modern HTML and component-based architecture.",
      "React Developer opportunity focused on React and TypeScript. Build maintainable user interfaces with React hooks and state management, integrate with Node.js APIs, and ensure accessibility best practices across HTML markup.",
    ],
    requirements: ["3+ years React experience", "TypeScript proficiency", "Node.js experience"],
    technicalTools: ["React", "TypeScript", "Node.js", "HTML", "CSS"],
    softSkills: ["Problem Solving", "Teamwork"],
    activityType: "TECHNICAL_IT_SUPPORT",
    salaryBand: [65000, 95000],
    isRemote: false,
  },
  {
    title: "Frontend Developer",
    descriptions: [
      "Seeking a Frontend Developer skilled in JavaScript and Angular. You'll build responsive web interfaces using TypeScript, HTML5, and CSS, translating designs into pixel-perfect, interactive experiences across browsers.",
      "Frontend Developer role focused on JavaScript and Angular development. Work with TypeScript, HTML, and CSS to create modern, responsive user experiences for our customer-facing applications.",
      "We are looking for a Frontend Developer to champion JavaScript and Angular. Build single-page applications with TypeScript, semantic HTML, and modern CSS frameworks.",
    ],
    requirements: ["JavaScript proficiency", "Angular experience", "TypeScript", "CSS"],
    technicalTools: ["JavaScript", "Angular", "TypeScript", "HTML", "CSS"],
    softSkills: ["Attention to Detail", "Communication"],
    activityType: "TECHNICAL_IT_SUPPORT",
    salaryBand: [60000, 90000],
    isRemote: true,
  },
  {
    title: "Full Stack Developer",
    descriptions: [
      "Full Stack Developer opportunity working across the stack with React on the frontend and Node.js on the backend. Build and deploy full-stack applications using JavaScript, TypeScript, SQL databases, Docker containers, and AWS cloud services.",
      "We're looking for a Full Stack Developer to deliver end-to-end solutions. You'll work with React, Node.js, JavaScript, and TypeScript on the application tier, backed by SQL and deployed via Docker on AWS.",
      "Join as a Full Stack Developer to own the full development lifecycle. React and Node.js form the core of our stack, with JavaScript and TypeScript keeping code consistent, SQL for data, and Docker on AWS for deployment.",
    ],
    requirements: ["Full stack JavaScript", "React", "Node.js", "TypeScript", "SQL", "Docker", "AWS"],
    technicalTools: ["React", "Node.js", "JavaScript", "TypeScript", "SQL", "Docker", "AWS"],
    softSkills: ["Teamwork", "Problem Solving"],
    activityType: "TECHNICAL_IT_SUPPORT",
    salaryBand: [70000, 110000],
    isRemote: true,
  },
  {
    title: "Python Developer",
    descriptions: [
      "Python Developer position working on data-intensive backend services. Build robust applications using Python and Django, query PostgreSQL and SQL databases, and deploy with Docker in a cloud-native environment.",
      "Join our team as a Python Developer. You'll develop backend services using Python and Django, querying PostgreSQL via SQL and containerizing deployments with Docker.",
      "Python Developer role building scalable backend systems. Implement Python and Django services, interact with PostgreSQL and SQL, and run Dockerized deployments for data processing pipelines.",
    ],
    requirements: ["Python", "Django", "PostgreSQL", "SQL"],
    technicalTools: ["Python", "Django", "PostgreSQL", "SQL", "Docker"],
    softSkills: ["Problem Solving", "Analytical Thinking"],
    activityType: "TECHNICAL_IT_SUPPORT",
    salaryBand: [65000, 100000],
    isRemote: false,
  },
  {
    title: "Java Developer",
    descriptions: [
      "Java Developer role building enterprise backend services. Work with Java and the Spring framework, integrating with SQL databases and deploying applications using Docker containers.",
      "Seeking a Java Developer experienced with Java and Spring. You'll develop backend services, manage SQL data layers, and package applications as Docker containers.",
      "Java Developer to join a team building high-throughput services. Java and Spring are core to the stack, with SQL persistence and Docker-based deployment.",
    ],
    requirements: ["Java", "Spring", "SQL"],
    technicalTools: ["Java", "Spring", "SQL", "Docker"],
    softSkills: ["Teamwork", "Problem Solving"],
    activityType: "TECHNICAL_IT_SUPPORT",
    salaryBand: [70000, 105000],
    isRemote: false,
  },
  {
    title: "C#/.NET Developer",
    descriptions: [
      "C#/.NET Developer to build enterprise applications. Develop server-side logic using C# and the .NET platform, working with SQL databases and deploying via Docker containers.",
      "Join our engineering team as a C#/.NET Developer. You'll write C# applications on the .NET platform, integrate with SQL data stores, and run deployments in Docker.",
      "C#/.NET Developer role focused on building robust backend services. Use C# and the .NET ecosystem, with SQL for persistence and Docker for containerization.",
    ],
    requirements: ["C#", ".NET", "SQL"],
    technicalTools: ["C#", ".NET", "SQL", "Docker"],
    softSkills: ["Attention to Detail", "Teamwork"],
    activityType: "TECHNICAL_IT_SUPPORT",
    salaryBand: [68000, 102000],
    isRemote: false,
  },
  {
    title: "DevOps Engineer",
    descriptions: [
      "DevOps Engineer role focused on cloud infrastructure and automation. Manage AWS environments, build CI/CD pipelines, and orchestrate containerized workloads with Docker, Kubernetes on Linux hosts.",
      "Seeking a DevOps Engineer to own cloud-native deployments. You'll manage AWS resources, implement CI/CD workflows, and operate Docker and Kubernetes clusters on Linux.",
      "DevOps Engineer to scale and secure our production platforms. AWS is the primary cloud, with Docker and Kubernetes orchestration running on Linux, driven by automated CI/CD pipelines.",
    ],
    requirements: ["AWS", "Docker", "Kubernetes", "Linux", "CI/CD"],
    technicalTools: ["Docker", "AWS", "Linux", "Kubernetes", "CI/CD"],
    softSkills: ["Problem Solving", "Teamwork"],
    activityType: "TECHNICAL_IT_SUPPORT",
    salaryBand: [80000, 130000],
    isRemote: true,
  },
  {
    title: "Data Analyst",
    descriptions: [
      "Data Analyst position turning data into insights. Query PostgreSQL and SQL databases, analyze trends, and perform statistical data analysis. Proficient in Excel and data visualization tools.",
      "We're hiring a Data Analyst to drive data-driven decisions. You'll use SQL and PostgreSQL to extract insights, conduct statistical analysis, and model data with Excel and visualization tools.",
      "Data Analyst to join our analytics practice. Extract trends with SQL and PostgreSQL, run statistical data analysis, and produce reports using Excel and visualization tools.",
    ],
    requirements: ["SQL", "PostgreSQL", "Data Analysis", "Excel"],
    technicalTools: ["SQL", "PostgreSQL", "Excel", "Statistics"],
    softSkills: ["Analytical Thinking", "Attention to Detail"],
    activityType: "TECHNICAL_IT_SUPPORT",
    salaryBand: [55000, 85000],
    isRemote: true,
  },
  {
    title: "Data Engineer",
    descriptions: [
      "Data Engineer role building data pipelines and platforms. Design ETL processes using SQL and PostgreSQL, deploy on AWS with Docker containers, and integrate Java services for data transformation.",
      "Seeking a Data Engineer to architect robust data infrastructure. Work with PostgreSQL and SQL, orchestrate pipelines on AWS, run Dockerized Java components, and ensure scalable data processing.",
      "Data Engineer to own our data platform. SQL and PostgreSQL are the backbone, AWS hosts Dockerized Java components, and pipelines process data at scale.",
    ],
    requirements: ["SQL", "PostgreSQL", "Java", "Docker", "AWS"],
    technicalTools: ["SQL", "PostgreSQL", "AWS", "Docker", "Java"],
    softSkills: ["Problem Solving", "Teamwork"],
    activityType: "TECHNICAL_IT_SUPPORT",
    salaryBand: [80000, 125000],
    isRemote: true,
  },
  {
    title: "Technical Support Engineer",
    descriptions: [
      "Technical Support Specialist role supporting cloud-native applications. Troubleshoot Node.js services running in Docker containers on AWS, with deep Linux system knowledge.",
      "Technical Support Engineer position providing expert support for our Node.js stack. Investigate issues across AWS deployments, Docker containers, and Linux environments.",
      "Join as a Technical Support Engineer supporting Node.js services. Resolve production issues across AWS, Docker, and Linux environments with systematic troubleshooting.",
    ],
    requirements: ["Node.js", "Docker", "AWS", "Linux"],
    technicalTools: ["Node.js", "Docker", "AWS", "Linux"],
    softSkills: ["Problem Solving", "Communication"],
    activityType: "TECHNICAL_IT_SUPPORT",
    salaryBand: [50000, 75000],
    isRemote: false,
  },
  {
    title: "Sales Representative",
    descriptions: [
      "Sales Representative to drive new business and revenue growth. Lead the sales cycle from prospecting to closing, communicate with prospects, deliver exceptional customer service, and support marketing campaigns.",
      "We're seeking a Sales Representative to expand our market presence. You'll manage the full sales cycle, build relationships through strong communication, provide customer service, and collaborate on marketing initiatives.",
      "Sales Representative role owning the full sales lifecycle. Conduct sales conversations, maintain communication with leads, ensure customer service excellence, and feed insights to marketing.",
    ],
    requirements: ["Sales experience", "Communication", "Customer Service"],
    technicalTools: ["CRM", "Sales Enablement"],
    softSkills: ["Communication", "Customer Service", "Negotiation"],
    activityType: "SALES_LEAD_GENERATION",
    salaryBand: [45000, 80000],
    isRemote: false,
  },
  {
    title: "Customer Success Specialist",
    descriptions: [
      "Customer Success Specialist ensuring client satisfaction and retention. Provide proactive customer service, communicate with stakeholders, and support upsell opportunities through consultative sales.",
      "Join our Customer Success team as a Specialist. Drive customer service excellence, maintain clear communication with clients, and collaborate on renewal sales opportunities.",
      "Customer Success Specialist to maximize client value. Deliver customer service and onboarding, foster communication between teams, and identify sales expansion opportunities.",
    ],
    requirements: ["Customer Service", "Communication", "Sales"],
    technicalTools: ["CRM"],
    softSkills: ["Communication", "Customer Service", "Negotiation"],
    activityType: "CUSTOMER_SERVICE",
    salaryBand: [45000, 70000],
    isRemote: true,
  },
  {
    title: "Communication Specialist",
    descriptions: [
      "Communication Specialist to craft and coordinate internal and external messaging. Develop content, facilitate communication across teams, and support internal communications initiatives.",
      "Seeking a Communication Specialist to lead messaging strategy. Build communication programs, coordinate with stakeholders, and ensure consistent communication across the organization.",
      "Communication Specialist role driving organizational messaging. Create content, manage communication flows, and align messaging across internal teams.",
    ],
    requirements: ["Communication", "Content creation"],
    technicalTools: ["Content Tools"],
    softSkills: ["Communication", "Writing"],
    activityType: "OTHER",
    salaryBand: [45000, 65000],
    isRemote: true,
  },
  {
    title: "Marketing Specialist",
    descriptions: [
      "Marketing Specialist to execute demand-generation campaigns. Manage marketing programs, track campaign performance, and communicate results to the marketing team.",
      "We're hiring a Marketing Specialist to drive brand awareness. You'll plan marketing initiatives, coordinate communication efforts, and analyze campaign effectiveness.",
      "Marketing Specialist to grow our market reach. Design and run marketing campaigns, measure performance, and communicate insights across the marketing team.",
    ],
    requirements: ["Marketing", "Communication"],
    technicalTools: ["Analytics", "SEO"],
    softSkills: ["Communication", "Analytical Thinking"],
    activityType: "SURVEYS_MARKET_RESEARCH",
    salaryBand: [45000, 70000],
    isRemote: true,
  },
  {
    title: ["Office Administrator", "Administrative Assistant", "HR Coordinator", "Logistics Specialist", "Records Manager", "Facilities Coordinator", "Procurement Officer", "Data Entry Clerk", "Project Coordinator"],
    descriptions: [
      "The successful candidate will provide administrative support for daily operations. Responsibilities include scheduling appointments, maintaining filing systems, coordinating meetings, and managing visitor access for the office.",
      "Office support role handling clerical duties. Manage correspondence, scheduling, filing systems, and visitor access. Maintain records and coordinate logistics for internal teams.",
      "Administrative support position for a growing organization. Handle scheduling, visitor management, record keeping, and office logistics coordination.",
    ],
    requirements: ["Administrative experience", "Organization", "Attention to detail"],
    technicalTools: ["Office Suite"],
    softSkills: ["Organization", "Reliability", "Attention to Detail"],
    activityType: "BACK_OFFICE_DIGITAL_SERVICES",
    salaryBand: [35000, 55000],
    isRemote: false,
  },
];

// Weighted cycle of length 100 guarantees deterministic, reproducible skill
// distribution regardless of PERF_JOB_COUNT. Each index maps to a theme via
// (i % 100), so the dataset is fully deterministic and safe to re-run.
const THEME_CYCLE: JobTheme[] = [];
const WEIGHTS: [JobTheme, number][] = [
  [THEMES[0], 14], // React Developer -> React, TypeScript, Node.js, HTML
  [THEMES[1], 10], // Frontend Developer -> JavaScript, Angular, TypeScript, HTML, CSS
  [THEMES[2], 4], // Full Stack Developer -> React, Node.js, JavaScript, TypeScript, SQL, Docker, AWS
  [THEMES[3], 11], // Python Developer -> Python, SQL, PostgreSQL, Docker, Django
  [THEMES[4], 6], // Java Developer -> Java, Spring, SQL, Docker
  [THEMES[5], 5], // C#/.NET Developer -> C#, .NET, SQL, Docker
  [THEMES[6], 6], // DevOps Engineer -> Docker, AWS, Linux, Kubernetes, CI/CD
  [THEMES[7], 4], // Data Analyst -> SQL, PostgreSQL, Excel, Statistics, Data Analysis
  [THEMES[8], 3], // Data Engineer -> SQL, PostgreSQL, AWS, Docker, Java
  [THEMES[9], 5], // Technical Support -> Node.js, Docker, AWS, Linux
  [THEMES[10], 8], // Sales Representative -> Sales, Communication, Customer Service, Marketing
  [THEMES[11], 6], // Customer Success -> Customer Service, Communication, Sales
  [THEMES[12], 6], // Communication Specialist -> Communication
  [THEMES[13], 3], // Marketing Specialist -> Marketing, Communication
  [THEMES[14], 9], // Unrelated Admin -> no candidate-test skills
];
for (const [theme, weight] of WEIGHTS) {
  for (let w = 0; w < weight; w++) THEME_CYCLE.push(theme);
}
// THEME_CYCLE.length === 100

const LOCATIONS = ["Remote", "London", "Paris", "Berlin", "Barcelona", "Amsterdam", "Madrid", "Dublin"];
const LEVELS = ["Mid-level", "Senior", "Junior", "Lead"];

function padSlug(n: number): string {
  return `${SLUG_PREFIX}-${String(n).padStart(5, "0")}`;
}

function buildJobData(index: number, companyId: string): Prisma.JobOfferCreateManyInput {
  const theme = THEME_CYCLE[index % THEME_CYCLE.length];
  const title = Array.isArray(theme.title) ? theme.title[index % theme.title.length] : theme.title;
  const description = theme.descriptions[index % theme.descriptions.length];
  const level = LEVELS[index % LEVELS.length];
  const location = LOCATIONS[index % LOCATIONS.length];
  const suffix = ` Seniority: ${level}. Work location: ${location}.`;

  const salaryBand = theme.salaryBand;
  const salaryMin = salaryBand[0] + ((index * 1373) % 5) * 1000;
  const salaryMax = salaryBand[1] + ((index * 1373) % 7) * 1000;

  return {
    companyId,
    title,
    slug: padSlug(index + 1),
    description: description + suffix,
    requirements: theme.requirements,
    softSkills: theme.softSkills,
    technicalTools: theme.technicalTools,
    metaTitle: title,
    metaDescription: description.slice(0, 160),
    status: "PUBLISHED",
    publishedAt: now,
    expiresAt: sixMonthsAhead,
    deletedAt: null,
    contractType: "CDI",
    employmentType: index % 8 === 0 ? "PART_TIME" : "FULL_TIME",
    isRemote: index % 5 === 0 ? true : theme.isRemote,
    isHybrid: index % 7 === 0 ? true : false,
    salaryMin,
    salaryMax,
    salaryCurrency: "USD",
    activityType: theme.activityType,
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const startTime = Date.now();

  const prevCount = await prisma.jobOffer.count();
  const prevPerfCount = await prisma.jobOffer.count({ where: { slug: { startsWith: `${SLUG_PREFIX}-` } } });

  const companies = await prisma.companies.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });
  if (companies.length === 0) {
    throw new Error("No active companies found. Run the main seed first (prisma db seed).");
  }

  const data: Prisma.JobOfferCreateManyInput[] = [];
  for (let i = 0; i < PERF_JOB_COUNT; i++) {
    const companyId = companies[i % companies.length].id;
    data.push(buildJobData(i, companyId));
  }

  const chunks = chunk(data, BATCH_SIZE);
  let inserted = 0;
  for (const [idx, c] of chunks.entries()) {
    const res = await prisma.jobOffer.createMany({ data: c, skipDuplicates: true });
    inserted += res.count;
    const done = (idx + 1) * c.length;
    console.log(`  batch ${idx + 1}/${chunks.length}: inserted=${res.count} (processed ${Math.min(done, PERF_JOB_COUNT)}/${PERF_JOB_COUNT})`);
  }

  const newTotal = await prisma.jobOffer.count();
  const newPerfCount = await prisma.jobOffer.count({ where: { slug: { startsWith: `${SLUG_PREFIX}-` } } });
  const publishedCount = await prisma.jobOffer.count({ where: { status: "PUBLISHED", deletedAt: null } });

  const elapsed = (Date.now() - startTime) / 1000;

  console.log("\n=== Performance JobOffer seed ===");
  console.log(`PERF_JOB_COUNT = ${PERF_JOB_COUNT}`);
  console.log(`Previous total JobOffers: ${prevCount}`);
  console.log(`Previous perf JobOffers:  ${prevPerfCount}`);
  console.log(`Inserted this run:        ${inserted}`);
  console.log(`New perf JobOffers:       ${newPerfCount}`);
  console.log(`New total JobOffers:      ${newTotal}`);
  console.log(`Published & non-deleted:  ${publishedCount}`);
  console.log(`Elapsed:                  ${elapsed.toFixed(2)}s`);
  console.log(`Idempotent:               true (createMany skipDuplicates on unique slug)`);
  if (newPerfCount < PERF_JOB_COUNT) {
    console.log(
      `Note: ${PERF_JOB_COUNT - newPerfCount} perf slug(s) already existed and were skipped. ` +
        "Re-run with the same PERF_JOB_COUNT to confirm 0 inserts."
    );
  }

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
