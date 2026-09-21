import { ContractType, EmploymentType } from "@/app/generated/prisma/enums";
import OpenAI from "openai";
import { logger } from "./logger";

// Initialize OpenAI client
const getOpenAIClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
};

/**
 * Input for job description generation
 */
export interface JobGenerationInput {
  title: string;
  company?: string;
  location?: string;
  contractType?: ContractType;
  employmentType?: EmploymentType;
  workMode?: string;
  requirements?: string[];
  benefits?: string[];
  language?: "en" | "fr";
}

/**
 * Output from job description generation
 */
export interface JobGenerationOutput {
  description: string;
  requirements: string[];
  benefits: string[];
  excerpt: string;
}

/**
 * Input for extracting a job offer from URL/text content
 */
export interface JobUrlScrapeInput {
  content: string;
  language?: "en" | "fr";
}

/**
 * Output from URL scraping — matches all JobOffer DB fields
 */
export interface JobUrlScrapeOutput {
  title: string;
  description: string;
  requirements?: string[];
  salary?: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string;
  location: string;
  contractType?: string;
  experienceLevel?: string;
  isRemote?: boolean;
  isHybrid?: boolean;
  activityType?: string;
  activityCustom?: string;
  technicalTools?: string[];
  softSkills?: string[];
  languages?: Array<{ name: string; level?: string }>;
}

/**
 * Generate a professional job description using AI
 */
export async function generateJobDescription(
  input: JobGenerationInput
): Promise<JobGenerationOutput> {
  const openai = getOpenAIClient();
  const language = input.language || "en";

  const contractTypeLabels: Record<string, string> = {
    CDI: "Permanent Contract (CDI)",
    CDD: "Fixed-term Contract (CDD)",
    FREELANCE: "Freelance",
    INTERNSHIP: "Internship",
    PART_TIME: "Part-time",
  };

  const workModeLabels: Record<string, string> = {
    ONSITE: "On-site",
    REMOTE: "Remote",
    HYBRID: "Hybrid",
  };

  const prompt = language === "fr" 
    ? `Générez une offre d'emploi professionnelle pour le poste suivant:
    
      Titre: ${input.title}
      Entreprise: ${input.company || "Une entreprise leader"}
      Lieu: ${input.location || "Non spécifié"}
Type de contrat: ${input.contractType ? contractTypeLabels[input.contractType] : "Non spécifié"}
Mode de travail: ${input.workMode ? workModeLabels[input.workMode] : "Non spécifié"}

${input.requirements?.length ? `Exigences existantes à inclure: ${input.requirements.join(", ")}` : ""}
${input.benefits?.length ? `Avantages existants à inclure: ${input.benefits.join(", ")}` : ""}

Veuillez fournir:
1. Une description d'emploi attrayante (2-3 paragraphes)
2. Une liste de 5-8 exigences clés
3. Une liste de 4-6 avantages
4. Un résumé court (1-2 phrases)

Format de réponse JSON avec les clés: description, requirements (tableau), benefits (tableau), excerpt.`
    : `Generate a professional job description for the following position:
    
      Title: ${input.title}
      Company: ${input.company || "A leading company"}
      Location: ${input.location || "Not specified"}
Contract Type: ${input.contractType ? contractTypeLabels[input.contractType] : "Not specified"}
Work Mode: ${input.workMode ? workModeLabels[input.workMode] : "Not specified"}

${input.requirements?.length ? `Existing requirements to include: ${input.requirements.join(", ")}` : ""}
${input.benefits?.length ? `Existing benefits to include: ${input.benefits.join(", ")}` : ""}

Please provide:
1. A compelling job description (2-3 paragraphs)
2. A list of 5-8 key requirements
3. A list of 4-6 benefits
4. A short excerpt (1-2 sentences)

Format the response as JSON with keys: description, requirements (array), benefits (array), excerpt.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1500,
    });

    const content = completion.choices[0].message.content;
    
    if (!content) {
      throw new Error("No response from AI");
    }

    const result = JSON.parse(content);

    return {
      description: result.description || "",
      requirements: Array.isArray(result.requirements) ? result.requirements : [],
      benefits: Array.isArray(result.benefits) ? result.benefits : [],
      excerpt: result.excerpt || "",
    };
  } catch (error) {
    logger.error("AI generation failed", { error });
    throw new Error("Failed to generate job description");
  }
}

/**
 * Input for CV parsing with AI
 */
export interface CVParseInput {
  text: string;
  language?: "en" | "fr";
}

/**
 * Output from CV parsing
 */
export interface CVParseOutput {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  title?: string;
  summary?: string;
  skills: string[];
  experiences: Array<{
    title: string;
    company: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }>;
  education: Array<{
    institution: string;
    degree: string;
    field?: string;
    startDate?: string;
    endDate?: string;
  }>;
  languages: Array<{
    name: string;
    level?: string;
  }>;
}

/**
 * Parse CV text using AI to extract structured information
 */
export async function parseCVWithAI(
  input: CVParseInput
): Promise<CVParseOutput> {
  const openai = getOpenAIClient();
  const language = input.language || "en";

  // Get more text from the CV (8000 chars for better context)
  const cvText = input.text.substring(0, 8000);

  const prompt = language === "fr"
    ? `Vous êtes un expert en analyse de CV. Analysez le texte suivant et extrayez toutes les informations de manière PRÉCISE et COMPLÈTE.

Texte du CV:
${cvText}

INSTRUCTIONS TRÈS IMPORTANTES:
1. Trouvez le NOM COMPLET (prénom et nom) - souvent au début du CV
2. Trouvez l'EMAIL - cherche les patterns comme @email.com ou "Email:"
3. Trouvez le TÉLÉPHONE - cherche les numbers avec + ou format téléphone
4. Trouvez la LOCALISATION (ville, pays) - souvent près de "Address" ou "Location"
5. Trouvez le TITRE PROFESSIONNEL - souvent sous le nom
6. Le RÉSUMÉ est généralement sous "Summary", "Profile" ou "À propos"
7. Pour les COMPÉTENCES, liste TOUT ce qui ressemble à un skill (techniques et soft skills)
8. Pour l'EXPÉRIENCE, chaque job doit avoir: title, company, dates (format YYYY-MM), description
9. Pour l'ÉDUCATION, chaque diplôme: institution, degree, field, dates
10. Pour les LANGUES: name et niveau (Basique/Courant/Natif ou A1-C2)

Sois TRÈS PRÉCIS et ne suppose pas - utilise seulement ce que tu vois dans le texte.
Si un champ n'est pas trouvé, utilise null ou une chaîne vide.

JSON attendu:
{
  "name": "Prénom Nom",
  "email": "email@exemple.com",
  "phone": "+216 12 345 678",
  "location": "Tunis, Tunisia",
  "title": "Call Center Agent",
  "summary": "Résumé professionnel en 2-3 phrases",
  "skills": ["Compétence1", "Compétence2", "Compétence3"],
  "experiences": [
    {"title": "Titre du poste", "company": "Entreprise", "location": "Ville", "startDate": "2020-01", "endDate": "2023-06", "current": false, "description": "Description des responsabilités"}
  ],
  "education": [
    {"institution": "Université", "degree": "Licence", "field": "Informatique", "startDate": "2017", "endDate": "2021"}
  ],
  "languages": [
    {"name": "Français", "level": "Courant"}, {"name": "Anglais", "level": "Basique"}
  ]
}`
    : `You are a CV parsing expert. Analyze the following resume text and extract ALL information ACCURATELY and COMPLETELY.

Resume CV:
${cvText}

VERY IMPORTANT INSTRUCTIONS:
1. Find FULL NAME - usually at the very top of the CV
2. Find EMAIL - look for patterns like @email.com or "Email:"
3. Find PHONE - look for numbers with + or phone format (like +216, +1, 00216)
4. Find LOCATION (city, country) - often near "Address" or "Location"
5. Find JOB TITLE - usually right below the name
6. SUMMARY is typically under "Summary", "Profile" or "Professional Overview"
7. For SKILLS, list EVERYTHING that looks like a skill (both technical and soft skills)
8. For EXPERIENCE, each job should have: title, company, dates (format YYYY-MM), description
9. For EDUCATION, each degree: institution, degree, field, dates
10. For LANGUAGES: name and level (Native/Fluent/Conversational/Basic or A1-C2)

Be VERY PRECISE and never guess - only use what you see in the text.
If a field is not found, use null or empty string.

Expected JSON:
{
  "name": "John Doe",
  "email": "john.doe@email.com",
  "phone": "+216 12 345 678",
  "location": "Tunis, Tunisia",
  "title": "Call Center Agent",
  "summary": "Professional summary in 2-3 sentences",
  "skills": ["Customer Service", "Communication", "French", "English", "Problem Solving"],
  "experiences": [
    {"title": "Customer Service Representative", "company": "Tech Corp", "location": "Tunis", "startDate": "2020-01", "endDate": "2023-06", "current": false, "description": "Handled customer inquiries and resolved issues"}
  ],
  "education": [
    {"institution": "University of Tunis", "degree": "Bachelor", "field": "Computer Science", "startDate": "2017", "endDate": "2021"}
  ],
  "languages": [
    {"name": "French", "level": "Fluent"}, {"name": "English", "level": "Basic"}
  ]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 3000,
    });

    const content = completion.choices[0].message.content;
    
    if (!content) {
      throw new Error("No response from AI");
    }

    const result = JSON.parse(content);

    // Log a safe summary — never log full PII fields (name, email, phone, etc.)
    logger.info("AI parsed CV result", {
      skillsCount: Array.isArray(result.skills) ? result.skills.length : 0,
      experiencesCount: Array.isArray(result.experiences) ? result.experiences.length : 0,
      educationCount: Array.isArray(result.education) ? result.education.length : 0,
      languagesCount: Array.isArray(result.languages) ? result.languages.length : 0,
    });

    return {
      name: result.name || "",
      email: result.email || "",
      phone: result.phone || "",
      location: result.location || "",
      title: result.title || "",
      summary: result.summary || "",
      skills: Array.isArray(result.skills) ? result.skills.filter((s: string) => s && s.trim()) : [],
      experiences: Array.isArray(result.experiences) ? result.experiences.filter((e: { title?: string }) => e && e.title) : [],
      education: Array.isArray(result.education) ? result.education.filter((e: { institution?: string }) => e && e.institution) : [],
      languages: Array.isArray(result.languages) ? result.languages.filter((l: { name?: string }) => l && l.name) : [],
    };
  } catch (error) {
    logger.error("AI CV parsing failed", { error });
    throw new Error("Failed to parse CV with AI");
  }
}

/**
 * Extract structured job offer data from URL/content text using AI
 */
export async function extractJobFromUrlText(
  input: JobUrlScrapeInput
): Promise<JobUrlScrapeOutput> {
  const openai = getOpenAIClient();
  const language = input.language || "en";

  // Limit content to avoid token overflow
  const content = input.content.substring(0, 4000);

  const prompt = language === "fr"
    ? `Tu es un assistant qui extrait des informations d'offre d'emploi depuis du texte brut ou du HTML.

Voici le contenu de la page:
${content}

Extrais TOUTES les informations d'offre d'emploi que tu peux trouver et retourne UNIQUEMENT du JSON valide avec ces clés:

{
  "title": "Titre du poste",
  "description": "Description complète de l'offre",
  "requirements": ["exigence 1", "exigence 2"],
  "salary": "ex: 50000-60000 EUR",
  "salaryMin": 50000,
  "salaryMax": 60000,
  "salaryCurrency": "EUR",
  "location": "Paris, France",
  "contractType": "CDI" | "CDD" | "FREELANCE" | "INTERNSHIP" | "PART_TIME" | "APPRENTICESHIP",
  "experienceLevel": "JUNIOR" | "MID" | "SENIOR" | "LEAD" | "EXECUTIVE",
  "activityType": "CUSTOMER_SERVICE" | "SALES_LEAD_GENERATION" | "TECHNICAL_IT_SUPPORT" | "DEBT_COLLECTION_LITIGATION" | "BACK_OFFICE_DIGITAL_SERVICES" | "SURVEYS_MARKET_RESEARCH" | "OTHER",
  "activityCustom": "string (required if activityType is OTHER)",
  "isRemote": true,
  "isHybrid": false,
  "technicalTools": ["Salesforce", "HubSpot"],
  "softSkills": ["Communication", "Empathy"],
  "languages": [{"name": "Anglais", "level": "REQUIRED"}]
}

RÈGLES CRITIQUES:
- title, description, et location sont OBLIGATOIRES - si absent, utilise une chaîne vide "".
- Si une information n'est PAS clairement présente, utilise null (pour les nombres) ou false (pour les booléens) ou un tableau vide [].
- NE JAMAIS inventer d'informations. Utilise seulement ce qui est visible dans le texte.
- Pour contractType, experienceLevel, et activityType, utilise UNIQUEMENT les valeurs de la liste ci-dessus.
- Pour activityType, choisis la valeur la plus appropriée selon le poste. Si aucun ne correspond, utilise "OTHER" et remplis activityCustom.
- Pour les langues, extrais TOUTES les langues mentionnées dans les exigences ou la description.
- Pour les salaires, convertis TOUJOURS en nombres (pas de texte comme "negociable" ou "competitive").`
    : `You are a job-offer extraction assistant. Extract all job information from the raw content below.

Content:
${content}

Extract ALL available job information and return ONLY valid JSON with these exact keys:

{
  "title": "Job title",
  "description": "Full job description",
  "requirements": ["requirement 1", "requirement 2"],
  "salary": "e.g. 50000-60000 USD",
  "salaryMin": 50000,
  "salaryMax": 60000,
  "salaryCurrency": "USD",
  "location": "City, Country",
  "contractType": "CDI" | "CDD" | "FREELANCE" | "INTERNSHIP" | "PART_TIME" | "APPRENTICESHIP",
  "experienceLevel": "JUNIOR" | "MID" | "SENIOR" | "LEAD" | "EXECUTIVE",
  "activityType": "CUSTOMER_SERVICE" | "SALES_LEAD_GENERATION" | "TECHNICAL_IT_SUPPORT" | "DEBT_COLLECTION_LITIGATION" | "BACK_OFFICE_DIGITAL_SERVICES" | "SURVEYS_MARKET_RESEARCH" | "OTHER",
  "activityCustom": "string (required if activityType is OTHER)",
  "isRemote": true,
  "isHybrid": false,
  "technicalTools": ["Salesforce", "HubSpot"],
  "softSkills": ["Communication", "Empathy"],
  "languages": [{"name": "English", "level": "REQUIRED"}]
}

CRITICAL RULES:
- title, description, and location ARE REQUIRED - if not found, use an empty string "".
- If information is NOT clearly present, use null (for strings/numbers), false (for booleans), or an empty array [].
- NEVER invent information. Only use what is visible in the text.
- For contractType, experienceLevel, and activityType, use ONLY the values listed above.
- For activityType, choose the most appropriate value based on the job. If none match, use "OTHER" and fill activityCustom.
- For languages, extract ALL languages mentioned in requirements or description.
- For salary, if you see a range like "35k-45k", convert to 35000 and 45000. If only a single number, set both salaryMin and salaryMax to it.
- If salary is described as "competitive", "negotiable", or "based on experience", return null.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 1500,
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error("No response from AI");

    const result: JobUrlScrapeOutput = JSON.parse(content);
    return result;
  } catch (error) {
    logger.error("Job URL scraping failed", { error });
    throw new Error("Failed to extract job data from URL");
  }
}

/**
 * Check if OpenAI API key is configured
 */
export function isAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
