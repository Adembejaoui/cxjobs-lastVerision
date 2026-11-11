import { parseCVWithAI, isAIConfigured, CVParseOutput } from "./ai-service";
import { logger } from "./logger";
import { AI_ROUTE_DEADLINE_MS } from "./ai-errors";
import { extractPdfTextInWorker, PdfTimeoutError, type PdfExtractOptions } from "./server/pdf-text-worker";

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

/** Resource bounds for untrusted CV PDFs (unchanged). */
const MAX_PDF_PAGES = 30;
const MAX_EXTRACTED_CHARS = 200_000;
/** Total budget for the optional AI step; basic parsing is used past it. */
const AI_CV_PARSE_DEADLINE_MS = 25_000;
// Never give the AI step less than this, even after a slow PDF extraction.
const AI_CV_PARSE_MIN_BUDGET_MS = 5_000;

/**
 * Extract text from a PDF buffer using pdfjs-dist (v6, Node "legacy" build),
 * inside an isolated worker thread with a wall-clock timeout and a heap cap
 * (see lib/server/pdf-text-worker.ts). Page count and extracted text size
 * remain bounded. Every failure — malformed file, timeout, worker crash —
 * surfaces as the same generic error.
 */
export async function extractTextFromPDF(
  buffer: Buffer,
  options: Pick<PdfExtractOptions, "timeoutMs" | "workerSource"> = {}
): Promise<string> {
  try {
    logger.debug("Loading PDF", { bufferLength: buffer.length });
    const text = await extractPdfTextInWorker(buffer, {
      ...options,
      maxPages: MAX_PDF_PAGES,
      maxChars: MAX_EXTRACTED_CHARS,
    });
    logger.debug("PDF text extracted", { textLength: text.length });
    return text;
  } catch (error) {
    logger.error("PDF parsing error", {
      error: error instanceof PdfTimeoutError ? "timeout" : error instanceof Error ? error.name : "unknown",
    });
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
    /** Reports whether the AI step succeeded (only called when it ran). */
    onAIOutcome?: (ok: boolean) => void;
  }
): Promise<CVParseOutput> {
  const startedAt = Date.now();
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
      // Bounded: on timeout we fall back to basic parsing below instead of
      // holding the upload request open (H4).
      // A12: the whole request (PDF extraction + AI) stays within
      // AI_ROUTE_DEADLINE_MS (< 30 s); the AI step gets what is left.
      const remaining = AI_ROUTE_DEADLINE_MS - (Date.now() - startedAt);
      const aiBudget = Math.min(AI_CV_PARSE_DEADLINE_MS, Math.max(AI_CV_PARSE_MIN_BUDGET_MS, remaining));
      const aiResult = await parseCVWithAI(
        { text, language },
        { signal: AbortSignal.timeout(aiBudget) }
      );
      options?.onAIOutcome?.(true);

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
      options?.onAIOutcome?.(false);
      logger.warn("AI CV parsing failed, falling back to basic parsing", {
        error: error instanceof Error ? error.name : "unknown",
        kind: (error as { kind?: string })?.kind,
      });
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
