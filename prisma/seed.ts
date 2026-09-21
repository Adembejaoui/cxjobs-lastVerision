/*import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const FIRST_NAMES = [
  "Amine","Youssef","Mohamed","Fatima","Aicha","Khalid","Nadia","Karim","Sofia","Omar",
  "Leila","Hassan","Maryam","Ali","Zara","Ibrahim","Nora","Adnan","Samira","Mehdi",
  "Rania","Anas","Lin","Wei","Chen","Hiroshi","Yuki","Akira","Jin","Sato",
  "Priya","Raj","Sunita","Vikram","Anika","Arjun","Deepa","Kumar","Shreya","Rohit",
  "Emma","Liam","Olivia","Noah","Ava","Ethan","Sophia","Mason","Mia","Lucas",
  "Isabella","Mason","Charlotte","Benjamin","Amelia","William","Evelyn","James","Harper","Henry",
  "Luna","Alexander","Nova","Michael","Chloe","Daniel","Victoria","Matthew","Ximena","Jackson",
  "Aria","Sebastian","Lily","Jack","Ella","Owen","Aubrey","Samuel","Scarlett","David",
  "Penelope","Joseph","Layla","Carter","Riley","Wyatt","Sarah","John","Natalie","Dylan",
  "Luna","Gabriel","Nora","Julian","Chloe","Wyatt","Lily","Juan","Aria","Diego",
  "Mia","Liam","Zoe","Ethan","Ava","Mason","Ruby","Carter","Aria","Nora",
  "Kai","Aria","Leo","Zoe","Ivy","Finn","Nora","Kai","Asher","Peyton",
  "Naomi","Kaylee","Dakota","Emilia","Jonah","Scarlett","Isaiah","Kinsley","Cole","Jaxon",
  "Alice","Grayson","Layla","Lincoln","Amara","Kaleb","Stella","Allen","Naomi","Braxton",
  "Amara","Jaiden","Nadia","Reagan","Kai","Amaya","Soren","Adeline","Calum","Saoirse",
  "Arjun","Priya","Mateo","Valentina","Caspian","Anastasia","Omari","Zuri","Ezra","Nalani",
  "Kai","Leilani","August","Remy","Indigo","Silas","River","Wren","Cael","Sage",
];

const LAST_NAMES = [
  "Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez",
  "Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin",
  "Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson",
  "Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores",
  "Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Roberts",
  "Evans","Turner","Phillips","Parker","Edwards","Collins","Stewart","Morris","Murphy","Cook",
  "Rogers","Morgan","Peterson","Gray","Hughes","Washington","Butler","Barnes","Cunningham","Dunn",
  "Perry","Powell","Long","Patterson","Hughes","Flores","Washington","Simpson","Alejandro","Miguel",
  "Hassan","Brahim","Youssef","Fatima","Aicha","Khadija","Noura","Imane","Soukaina","Yasmin",
  "Karim","Jamel","Mounir","Rachid","Sami","Tariq","Amine","Bilal","Houcine","Nabil",
  "Othman","Hicham","Mohammed","Ali","Said","Abdul","Malik","Farid","Taoufik","Lotfi",
  "Europa","Asie","Africa","America","Oceania","Mediterranean","Atlas","Sahara","Nile","Congo",
  "Lambert","Moreau","Dubois","Martin","Bernard","Petit","Lefebvre","Rousseau","Garnier","Bonnet",
  "Dupont","Durand","Morel","Fournier","Simon","Lebrun","Girard","Andre","Mercier","Blanc",
  "Costa","Silva","Santos","Souza","Rodrigues","Fernandez","Garcia","Lopez","Martinez","Hernandez",
  "Wong","Li","Zhang","Wang","Liu","Yang","Huang","Zhao","Zhou","Xu",
  "Tanaka","Sato","Suzuki","Watanabe","Takahashi","Ito","Kobayashi","Yamamoto","Nakamura","Hayashi",
  "Kang","Lee","Park","Choi","Jung","Kim","Seo","Ryu","Chang","Shin",
];

const SKILL_NAMES = [
  "Customer Service","Sales","CRM Software","Conflict Resolution","Team Leadership",
  "Zendesk","Salesforce","Intercom","Communication","Problem Solving",
  "Python","JavaScript","React","Node.js","SQL",
  "Data Analysis","Project Management","Marketing","Writing","Design",
  "Photography","Video Editing","Public Speaking","Negotiation","Time Management",
  "Excel","Accounting","Social Media","SEO","Content Writing",
  "Foreign Languages","Teaching","Tutoring","Research","Blogging",
  "Networking","Cybersecurity","Cloud Computing","DevOps","Docker",
  "Kubernetes","Machine Learning","AI","Deep Learning","NLP",
];

const EXPERIENCE_COMPANIES = [
  "TechVision Solutions","CallMax International","BrightStar Telecom","GlobalServe","MediCall Health",
  "DataFlow Corp","CloudNine Systems","Urban Logistics","Prime Retail","Finance Hub",
  "DigitalBridge","NextGen Support","SmartComm","Pacific Enterprises","MetroConnect",
  "Horizon Group","Unity Solutions","Peak Performance","StarLink Telecom","Apex Services",
];

const EXPERIENCE_TITLES = [
  "Senior Customer Service Agent","Customer Service Team Lead","Customer Support Representative",
  "Technical Support Specialist","Sales Representative","Client Success Manager",
  "Call Center Supervisor","Support Desk Analyst","Account Manager","Service Coordinator",
  "Help Desk Technician","Operations Associate","Quality Assurance Analyst","Training Specialist",
];

const EDUCATION_SCHOOLS = [
  "University of Hassan II Casablanca","HEC Casablanca","Mohammed VI Polytechnic University",
  "Al Akhawayn University","ENSIAS","EMI Casablanca","Universite Paris-Saclay","Lyon Business School",
  "American University of Paris","University of London","Harvard Extension","Stanford Online",
  "MIT OpenCourseWare","Cambridge Online","Oxford Continuing Education","ESSEC Business School",
];

const EDUCATION_DEGREES = [
  "Bachelor's Degree","Master's Degree","Associate's Degree","Professional Certificate","Diploma",
  "PhD","MBA","Engineering Diploma","Teaching Certificate","Nursing Degree",
];

const EDUCATION_FIELDS = [
  "Business Administration","Computer Science","Engineering","Marketing","Psychology",
  "Economics","Finance","Management","Information Technology","Healthcare",
  "Education","Communications","Mathematics","Physics","Biology",
];

const LANGUAGE_NAMES = ["English","French","Arabic","Spanish","German","Portuguese","Italian","Chinese","Japanese","Russian"];
const LANGUAGE_PROFICIENCIES = ["Native","Fluent","Advanced","Intermediate","Conversational"];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function main() {
  const CANDIDATE_COUNT = 1000;
  const JOB_SLUG = "senior-customer-service-agent";

  let jobOffer = await prisma.jobOffer.findFirst({ where: { slug: JOB_SLUG } });
  if (!jobOffer) {
    let company = await prisma.companies.findFirst();
    if (!company) {
      const adminUser = await prisma.user.create({
        data: { name: "Admin", email: "admin@cxjobs.com", passwordHash: await bcrypt.hash("Admin@2024", 10), role: "COMPANY" },
      });
      company = await prisma.companies.create({
        data: {
          userId: adminUser.id, name: "CXJobs", slug: "cxjobs", companySize: "10-50",
          location: "Remote", website: "https://cxjobs.com", isVerified: true, isRemoteFriendly: true,
        },
      });
    }
    jobOffer = await prisma.jobOffer.create({
      data: {
        companyId: company.id, title: "Senior Customer Service Agent", slug: JOB_SLUG,
        contractType: "CDI", employmentType: "FULL_TIME", isRemote: true,
        activityType: "CUSTOMER_SERVICE", status: "PUBLISHED",
      },
    });
    console.log("Created fallback job offer:", jobOffer.title);
  } else {
    console.log("Found job offer:", jobOffer.title);
  }

  await prisma.application.deleteMany();
  await prisma.candidateSkill.deleteMany();
  await prisma.experience.deleteMany();
  await prisma.education.deleteMany();
  await prisma.language.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.user.deleteMany({ where: { role: "CANDIDATE" } });

  console.log(`Generating ${CANDIDATE_COUNT} candidates...`);

  const usersData = [];
  const userIds = [];
  for (let i = 0; i < CANDIDATE_COUNT; i++) {
    const id = crypto.randomUUID();
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[i % LAST_NAMES.length];
    const email = `candidate${i + 1}@email.com`;
    const name = `${firstName} ${lastName}`;
    const passwordHash = await bcrypt.hash(`Candidate@2024`, 10);
    userIds.push(id);
    usersData.push({ id, email, name, passwordHash });
  }

  console.log("Creating users...");
  const users = await prisma.user.createMany({ data: usersData });
  console.log(`Created ${users.count} users`);

  console.log("Creating candidates...");
  const candidateIds = [];
  const candidatesData = [];
  for (let i = 0; i < CANDIDATE_COUNT; i++) {
    const cId = crypto.randomUUID();
    candidateIds.push(cId);
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[i % LAST_NAMES.length];
    const userId = userIds[i];
    const location = randomItem([
      "Casablanca, Morocco","Rabat, Morocco","Marrakech, Morocco","Tangier, Morocco",
      "Fez, Morocco","Agadir, Morocco","Fes, Morocco","Meknes, Morocco",
      "Paris, France","Lyon, France","Marseille, France","Toulouse, France",
      "London, UK","Manchester, UK","Birmingham, UK",
      "New York, USA","Los Angeles, USA","Chicago, USA","Toronto, Canada","Montreal, Canada",
      "Dubai, UAE","Abu Dhabi, UAE","Cairo, Egypt","Johannesburg, South Africa",
    ]);
    const headlines = [
      "Senior Customer Service Specialist","Customer Support Leader","Multilingual Support Expert",
      "Technical Support Professional","Client Relations Manager","Call Center Team Lead",
      "Customer Experience Champion","Sales and Support Professional","Business Development Rep",
      "Quality Assurance Specialist","Help Desk Expert","Account Management Professional",
    ];
    candidatesData.push({
      id: cId,
      userId,
      firstName,
      lastName,
      phone: `+212 ${randomInt(6, 9)} ${randomInt(10, 99)} ${randomInt(10, 99)} ${randomInt(10, 99)}`,
      location,
      headline: randomItem(headlines),
      summary: `Experienced professional with ${randomInt(1, 10)}+ years in customer service and related fields. Proven track record of delivering exceptional results and mentoring team members. Skilled in CRM tools, conflict resolution, and cross-cultural communication. Comfortable working in remote and hybrid environments with strong self-discipline and communication skills. Passionate about continuous learning and professional development.`,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=candidate${i + 1}`,
      resumeUrl: `https://resumes.example.com/candidate${i + 1}.pdf`,
      linkedinUrl: `https://linkedin.com/in/candidate${i + 1}`,
      preferredJobTypes: shuffle(["FULL_TIME","PART_TIME","CONTRACT"]).slice(0, randomInt(1, 2)) as string[],
      shiftType: randomItem(["DAY","NIGHT","FLEXIBLE","ROTATION"]),
      targetJobRole: randomItem(["CALL_CENTER","SALES","TECH_SUPPORT","CUSTOMER_SERVICE","ADMIN","GENERAL"]),
      workMode: randomItem(["ONSITE","REMOTE","HYBRID"]),
      dateOfBirth: new Date(randomInt(1985, 2002), randomInt(0, 11), randomInt(1, 28)),
      gender: randomItem(["male","female"]),
      cvParsed: true,
    });
  }
  const candidates = await prisma.candidate.createMany({ data: candidatesData });
  console.log(`Created ${candidates.count} candidates`);

  console.log("Creating skills...");
  const skillsData: { candidateId: string; name: string; level: string; yearsOfExperience: number }[] = [];
  for (let i = 0; i < CANDIDATE_COUNT; i++) {
    const candidateId = candidateIds[i];
    const numSkills = randomInt(2, 5);
    const picked = shuffle([...SKILL_NAMES]).slice(0, numSkills);
    for (const name of picked) {
      skillsData.push({
        candidateId,
        name,
        level: randomItem(["Beginner","Intermediate","Advanced","Expert"]),
        yearsOfExperience: randomInt(1, 10),
      });
    }
  }
  const skills = await prisma.candidateSkill.createMany({ data: skillsData });
  console.log(`Created ${skills.count} skills`);

  console.log("Creating experiences...");
  const experiencesData: {
    candidateId: string; company: string; title: string; location?: string;
    startDate: Date; endDate?: Date; isCurrent: boolean; description?: string;
  }[] = [];
  for (let i = 0; i < CANDIDATE_COUNT; i++) {
    const candidateId = candidateIds[i];
    const numExp = randomInt(1, 3);
    const sortedCompanies = shuffle(EXPERIENCE_COMPANIES).slice(0, numExp);
    for (let j = 0; j < numExp; j++) {
      const startDate = new Date(randomInt(2015, 2023), randomInt(0, 11), randomInt(1, 28));
      const isCurrent = j === 0;
      const endDate = isCurrent ? undefined : new Date(startDate.getTime() + randomInt(6, 48) * 30 * 24 * 60 * 60 * 1000);
      experiencesData.push({
        candidateId,
        company: sortedCompanies[j],
        title: randomItem(EXPERIENCE_TITLES),
        location: randomItem(["Casablanca, Morocco","Remote","Rabat, Morocco","Paris, France","London, UK"]),
        startDate,
        endDate,
        isCurrent,
        description: `Responsible for key tasks and deliverables. Contributed to team goals and achieved measurable results including ${randomInt(90, 99)}% satisfaction scores and process improvements.`,
      });
    }
  }
  const experiences = await prisma.experience.createMany({ data: experiencesData });
  console.log(`Created ${experiences.count} experiences`);

  console.log("Creating education records...");
  const educationData: {
    candidateId: string; school: string; degree: string; fieldOfStudy?: string;
    startDate: Date; endDate?: Date; isCurrent: boolean; description?: string;
  }[] = [];
  for (let i = 0; i < CANDIDATE_COUNT; i++) {
    const candidateId = candidateIds[i];
    const numEdu = randomInt(1, 2);
    for (let j = 0; j < numEdu; j++) {
      const startDate = new Date(randomInt(2010, 2020), randomInt(0, 11), randomInt(1, 28));
      const isCurrent = j === numEdu - 1;
      const endDate = isCurrent ? undefined : new Date(startDate.getFullYear() + randomInt(2, 5), startDate.getMonth(), startDate.getDate());
      educationData.push({
        candidateId,
        school: randomItem(EDUCATION_SCHOOLS),
        degree: randomItem(EDUCATION_DEGREES),
        fieldOfStudy: randomItem(EDUCATION_FIELDS),
        startDate,
        endDate,
        isCurrent,
        description: "Completed relevant coursework and projects with strong academic performance.",
      });
    }
  }
  const education = await prisma.education.createMany({ data: educationData });
  console.log(`Created ${education.count} education records`);

  console.log("Creating languages...");
  const languageData: { candidateId: string; name: string; proficiency: string }[] = [];
  for (let i = 0; i < CANDIDATE_COUNT; i++) {
    const candidateId = candidateIds[i];
    const numLangs = randomInt(1, 3);
    const picked = shuffle(LANGUAGE_NAMES).slice(0, numLangs);
    for (const name of picked) {
      languageData.push({
        candidateId,
        name,
        proficiency: randomItem(LANGUAGE_PROFICIENCIES),
      });
    }
  }
  const languages = await prisma.language.createMany({ data: languageData });
  console.log(`Created ${languages.count} language records`);

  console.log("Creating 1000 applications...");
  const applicationsData = [];
  const coverLetters = [
    "Dear Hiring Team,\n\nI am excited to apply for this position. With my background in customer service and a passion for delivering exceptional experiences, I am confident I would be a valuable addition to your team.\n\nBest regards",
    "Dear Hiring Manager,\n\nI am writing to express my interest in this role. My experience in high-volume support environments and strong communication skills make me a strong candidate.\n\nBest regards",
    "Dear Team,\n\nI recently came across this opportunity and was immediately drawn to it. My skills align well with your requirements, and I am eager to contribute to your organization's success.\n\nBest regards",
    "Dear Recruitment Team,\n\nI would like to submit my application for this position. With a proven track record in client-facing roles, I bring both technical expertise and interpersonal strengths to this role.\n\nBest regards",
    "Hello,\n\nI am passionate about customer experience and believe my background makes me an excellent fit for this position. I look forward to discussing how I can help your team succeed.\n\nBest regards",
  ];
  for (let i = 0; i < CANDIDATE_COUNT; i++) {
    const candidateId = candidateIds[i];
    applicationsData.push({
      candidateId,
      jobOfferId: jobOffer.id,
      coverLetter: coverLetters[i % coverLetters.length],
      status: randomItem(["NOUVEAU","EN_COURS_EXAMEN","ENTRETIEN","EMBAUCHES","REFUSE"]),
      isSaved: i % 5 === 0,
    });
  }
  const applications = await prisma.application.createMany({ data: applicationsData });
  console.log(`Created ${applications.count} applications`);

  const totalApplications = await prisma.application.count();
  const totalCandidates = await prisma.candidate.count();
  const totalJobs = await prisma.jobOffer.count();
  console.log(`\nSeed completed successfully!`);
  console.log(`Total candidates: ${totalCandidates}`);
  console.log(`Total applications: ${totalApplications}`);
  console.log(`Total job offers: ${totalJobs}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });*/