import { parseCVWithAI, isAIConfigured, CVParseOutput } from "./ai-service";
import { logger } from "./logger";

/**
 * Common skills to look for in CVs
 */
const COMMON_SKILLS = [
  // Programming Languages
  "JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "C", "Go", "Rust", "PHP", "Ruby",
  "Swift", "Kotlin", "Scala", "R", "MATLAB", "SQL", "HTML", "CSS", "Sass", "Less",
  
  // Frameworks & Libraries
  "React", "Vue", "Angular", "Node.js", "Express", "Next.js", "Nuxt", "Svelte",
  "Django", "Flask", "FastAPI", "Spring", "Laravel", "Rails", ".NET",
  "TensorFlow", "PyTorch", "Pandas", "NumPy", "Scikit-learn",
  
  // Databases
  "PostgreSQL", "MySQL", "MongoDB", "Redis", "SQLite", "Oracle", "SQL Server",
  "Cassandra", "DynamoDB", "Firebase", "Supabase",
  
  // Cloud & DevOps
  "AWS", "Azure", "GCP", "Google Cloud", "Docker", "Kubernetes", "Jenkins",
  "CI/CD", "Git", "GitHub", "GitLab", "Bitbucket", "Terraform", "Ansible",
  
  // Mobile
  "iOS", "Android", "React Native", "Flutter", "Xamarin",
  
  // Soft Skills
  "Communication", "Leadership", "Teamwork", "Problem Solving", "Project Management",
  "Agile", "Scrum", "JIRA", "Confluence",
  
  // Other
  "REST API", "GraphQL", "Microservices", "API", "Machine Learning", "AI",
  "Data Analysis", "Data Science", "DevOps", "UI/UX", "Figma", "Sketch",
];

/**
 * Extract text from a PDF buffer using pdfjs-dist
 * Using older version that doesn't require canvas
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    // Use pdfjs-dist v2 which doesn't require canvas
    const pdfjsLib = await import("pdfjs-dist/build/pdf");
    
    // Set up the workerSrc to avoid loading issues
    if (pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "";
    }
    
    logger.debug("Loading PDF", { bufferLength: buffer.length });
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
    });
    
    const pdf = await loadingTask.promise;
    logger.debug("PDF loaded", { numPages: pdf.numPages });
    
    // Extract text from all pages
    let fullText = "";
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: { str?: string }) => item.str || "")
        .join(" ");
      fullText += pageText + "\n";
    }
    
    logger.debug("PDF text extracted", { textLength: fullText.length });
    return fullText;
  } catch (error) {
    if (error instanceof Error) {
      logger.error("PDF parsing error", { error: error.message });
    } else {
      logger.error("PDF parsing unknown error", { error });
    }
    throw new Error("Failed to parse PDF file");
  }
}

/**
 * Extract email addresses from text
 */
export function extractEmail(text: string): string | undefined {
  const emailRegex = /[\w.-]+@[\w.-]+\.\w{2,}/gi;
  const match = text.match(emailRegex);
  return match ? match[0].toLowerCase() : undefined;
}

/**
 * Extract location from text (city, country)
 */
export function extractLocation(text: string): string | undefined {
  const locationPatterns = [
    /(?:Location|Address|Adresse|Lives? in|Domicile)[:\s]*([^,\n]+(?:,\s*\w+)?)/gi,
    /(?:Tunis|Sfax|Sousse|Kairouan|Bizerte|Gabès|Tunisia|Morocco|Algeria|Libya)/gi,
  ];
  
  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].replace(/^(Location|Address|Adresse|Lives? in|Domicile)[:\s]*/i, "").trim();
    }
  }
  
  return undefined;
}

/**
 * Extract phone numbers from text
 */
export function extractPhone(text: string): string | undefined {
  const phonePatterns = [
    /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,4}/g,
    /(?:Tel|Phone|Téléphone|Mobile|Cell)[:\s]*([+\d\s()-]+)/gi,
    /(\+216\s?\d{2}\s?\d{3}\s?\d{3})/g,
  ];
  
  for (const pattern of phonePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        const digits = match.replace(/\D/g, "");
        if (digits.length >= 8 && digits.length <= 15) {
          const phone = match.trim();
          if (!phone.match(/^(Location|Address|Email|Tel|Phone)/i)) {
            return phone;
          }
        }
      }
    }
  }
  
  return undefined;
}

/**
 * Extract name from text (usually at the top)
 */
export function extractName(text: string): string | undefined {
  const lines = text.split("\n").filter(l => l.trim());
  const firstLine = lines[0]?.trim();
  
  if (firstLine && firstLine.length < 50 && !firstLine.includes("@") && !firstLine.match(/\d{4,}/)) {
    if (!firstLine.toLowerCase().includes("cv") && !firstLine.toLowerCase().includes("resume")) {
      return firstLine;
    }
  }
  
  return undefined;
}

/**
 * Extract skills from text using keyword matching
 */
export function extractSkills(text: string): string[] {
  const foundSkills: string[] = [];
  const lowerText = text.toLowerCase();

  for (const skill of COMMON_SKILLS) {
    // Check for exact match (case-insensitive)
    if (lowerText.includes(skill.toLowerCase())) {
      foundSkills.push(skill);
    }
  }

  // Remove duplicates and return
  return [...new Set(foundSkills)];
}

/**
 * Extract common job titles from text
 */
function extractJobTitle(text: string): string | undefined {
  const titlePatterns = [
    /(?:Title|Post|Post|Titre)[:\s]*([^\n]+)/gi,
    /(?:Call Center Agent|Customer Service|Sales Representative|Technical Support|Admin|Manager|Developer|Engineer)/gi,
  ];
  
  for (const pattern of titlePatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].replace(/^(Title|Post|Post|Titre)[:\s]*/i, "").trim();
    }
  }
  
  return undefined;
}

/**
 * Extract summary from text
 */
function extractSummary(text: string): string | undefined {
  const summaryPatterns = [
    /(?:Summary|Profile|À propos|Professional Summary)[:\s]*([^\n]+(?:\n[^\n]+){0,3})/gi,
  ];
  
  for (const pattern of summaryPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].replace(/\n/g, " ").trim().substring(0, 300);
    }
  }
  
  return undefined;
}

/**
 * Basic CV parsing without AI
 */
export function basicCVParse(text: string): Partial<CVParseOutput> {
  logger.debug("Running basic CV parsing", { textLength: text.length });

  const name = extractName(text);
  const email = extractEmail(text);
  const phone = extractPhone(text);
  const location = extractLocation(text);
  const title = extractJobTitle(text);
  const summary = extractSummary(text);
  const skills = extractSkills(text);

  logger.debug("Basic parsing results", {
    skillsFound: skills.length,
    hasName: !!name,
    hasEmail: !!email,
    hasPhone: !!phone,
  });

  return {
    name,
    email,
    phone,
    location,
    title,
    summary,
    skills,
    experiences: [],
    education: [],
    languages: [],
  };
}

/**
 * Parse a CV file and extract structured information
 */
export async function parseCV(
  buffer: Buffer,
  options?: {
    useAI?: boolean;
    language?: "en" | "fr";
  }
): Promise<CVParseOutput> {
  const useAI = options?.useAI !== false && isAIConfigured();
  const language = options?.language || "en";
  
  logger.debug("CV parse options", { useAI, language, isAIConfigured: isAIConfigured() });

  // Extract text from PDF
  const text = await extractTextFromPDF(buffer);
  logger.debug("PDF text extracted", { textLength: text.length });

  // Basic extraction (always performed)
  const basicData = basicCVParse(text);

  // If AI is available, use it for better extraction
  if (useAI) {
    try {
      const aiResult = await parseCVWithAI({ text, language });

      logger.debug("CV parsing (AI)", {
        skillsCount: aiResult.skills.length,
        experiencesCount: aiResult.experiences.length,
        educationCount: aiResult.education.length,
        languagesCount: aiResult.languages.length,
      });

      // Merge AI results with basic extraction (basic takes precedence for email/phone)
      return {
        name: aiResult.name,
        email: basicData.email || aiResult.email,
        phone: basicData.phone || aiResult.phone,
        location: aiResult.location,
        title: aiResult.title,
        summary: aiResult.summary,
        skills: [...new Set([...(basicData.skills || []), ...(aiResult.skills || [])])],
        experiences: aiResult.experiences,
        education: aiResult.education,
        languages: aiResult.languages,
      };
    } catch (error) {
      logger.warn("AI CV parsing failed, falling back to basic parsing", { error });
    }
  }

  // Return basic parsing results
  logger.debug("CV parsing (basic)", {
    skillsCount: basicData.skills?.length || 0,
  });

  return {
    ...basicData,
    skills: basicData.skills || [],
    experiences: [],
    education: [],
    languages: [],
  } as CVParseOutput;
}

/**
 * Validate if a buffer is a valid PDF
 */
export function isValidPDF(buffer: Buffer): boolean {
  // Check PDF magic number
  return buffer.length > 4 && buffer.toString("ascii", 0, 4) === "%PDF";
}

/**
 * Get file size in MB
 */
export function getFileSizeMB(buffer: Buffer): number {
  return buffer.length / (1024 * 1024);
}
