"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  PlusCircle, 
  X, 
  Trash2, 
  Loader2, 
  Briefcase, 
  DollarSign, 
  FileText, 
  ListChecks,
  MapPin,
  Globe,
  Sparkles
} from "lucide-react";
import { z } from "zod";
import { showSuccess, showError } from "@/lib/toast";
import { logger } from "@/lib/logger";
import {
  contractTypeSchema,
  employmentTypeSchema,
  activityTypeSchema,
  applicationMethodSchema,
  languageLevelSchema,
} from "@/lib/validations/job";

interface JobBenefit {
  id: string;
  benefit: {
    id: string;
    name: string;
  };
}

interface CompanyBenefit {
  id: string;
  name: string;
  description: string | null;
  scope: string;
  category: string;
}

export interface JobLanguage {
  language: string;
  level: string;
}

export interface JobOffer {
   id?: string;
   title?: string;
   location?: string;
   slug?: string;
   description?: string | null;
   requirements?: string[];
   benefitIds?: string[];
   customLocation?: string | null;
   contractType?: string;
   isRemote?: boolean;
   isHybrid?: boolean;
   employmentType?: string | null;
   activityType?: string | null;
   activityCustom?: string | null;
   salary?: string | null;
   salaryMin?: number | null;
   salaryMax?: number | null;
   salaryCurrency?: string | null;
   languages?: JobLanguage[];
   status?: string;
   benefits?: JobBenefit[];
   technicalTools?: string[];
   softSkills?: string[];
   applicationType?: string;
   externalApplyUrl?: string | null;
   expiresAt?: string | null;
 }

interface JobFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job?: Partial<JobOffer> | null;
  onSuccess?: () => void;
}

interface FieldErrors {
  [key: string]: string[];
}

const CONTRACT_TYPES = [
  { value: "CDI", label: "CDI" },
  { value: "CIVP", label: "CIVP" },
  { value: "KARAMA", label: "Karama" },
  { value: "FREELANCE", label: "Freelance" },
];

const EMPLOYMENT_TYPES = [
  { value: "FULL_TIME", label: "Full-time" },
  { value: "PART_TIME", label: "Part-time" },
];

const LANGUAGE_LEVELS = [
  { value: "REQUIRED", label: "Required" },
  { value: "PREFERRED", label: "Preferred" },
  { value: "NICE_TO_HAVE", label: "Nice to Have" },
];

const COMMON_LANGUAGES = [
  "English",
  "French",
  "Spanish",
  "German",
  "Portuguese",
  "Arabic",
  "Mandarin",
  "Japanese",
];

const CURRENCIES = [
  { value: "USD", label: "USD ($)", symbol: "$" },
  { value: "EUR", label: "EUR (€)", symbol: "€" },
  { value: "TND", label: "TND (د.ت)", symbol: "د.ت" },
];

const TECHNICAL_TOOLS = [
  "Salesforce", "HubSpot", "Microsoft Dynamics", "Zendesk", "Freshdesk",
  "Jira Service Management", "ServiceNow", "Twilio", "Aircall",
  "Dialpad", "RingCentral", "Slack", "Microsoft Teams", "Zoom",
  "Freshservice", "HappyFox", "Google Workspace", "Microsoft 365",
  "Trello", "Asana", "Intercom", "Zoho CRM",
];

const SOFT_SKILLS = [
  "Active Listening", "Patience", "Empathy", "Verbal Communication",
  "Written Communication", "Problem Resolution", "Stress Management",
  "Multitasking", "Time Management", "Positive Attitude",
  "Conflict Resolution", "Customer Empathy", "Sales Skills",
  "Team Collaboration", "Adaptability",
];

const ACTIVITY_TYPES = [
  { value: "CUSTOMER_SERVICE", label: "Customer Service" },
  { value: "SALES_LEAD_GENERATION", label: "Sales & Lead Generation" },
  { value: "TECHNICAL_IT_SUPPORT", label: "Technical & IT Support" },
  { value: "DEBT_COLLECTION_LITIGATION", label: "Debt Collection & Litigation" },
  { value: "BACK_OFFICE_DIGITAL_SERVICES", label: "Back-office & Digital Services" },
  { value: "SURVEYS_MARKET_RESEARCH", label: "Surveys & Market Research" },
  { value: "OTHER", label: "Other" },
];

// Zod validation schema for job offer
const jobOfferSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Job title is required"),

  description: z
    .string()
    .trim()
    .min(20, "Job description must contain at least 20 characters"),

  customLocation: z
    .string()
    .trim()
    .min(1, "Location is required"),

  location: z.string().optional(),

  contractType: contractTypeSchema,

  isRemote: z.boolean(),

  isHybrid: z.boolean(),

  employmentType: employmentTypeSchema,

  salary: z.string().optional(),

  salaryMin:z.coerce.number().nonnegative().nullable().optional(),

  salaryMax: z.coerce.number().nonnegative().nullable().optional(),

  salaryCurrency: z.enum(["USD", "EUR", "TND"]).optional(),

  requirements: z.array(z.string()).optional(),

  benefitIds: z.array(z.string()).optional(),

  languages: z
 .array(
   z.object({
     language: z.string().trim().min(1),
level: languageLevelSchema,
   })
 )
 .default([])
 .refine((val) => val.length > 0, {
   message: "At least one language is required",
 }),

  technicalTools: z.array(z.string()).optional(),

  softSkills: z.array(z.string()).optional(),

  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),

  publishedAt: z.string().datetime().nullable().optional(),

  slug: z.string().optional(),

  activityType: activityTypeSchema.optional().default("CUSTOMER_SERVICE"),

  activityCustom: z.string().max(100).optional().nullable(),

  applicationType: applicationMethodSchema.optional().default("INTERNAL"),

   externalApplyUrl: z
     .string()
     .trim()
     .url("Please enter a valid URL")
     .optional()
     .nullable(),
   expiresAt: z
     .string()
     .refine((val) => {
       if (!val || val.trim().length === 0) return true;
       const selectedDate = new Date(val);
       const today = new Date();
       today.setHours(0, 0, 0, 0);
       return selectedDate > today;
     }, {
       message: "Expiration date must be strictly greater than today",
     })
     .optional()
     .nullable(),
 }).refine((data) => {
  if (data.activityType === "OTHER" && (!data.activityCustom || data.activityCustom.trim().length === 0)) {
    return false;
  }
  return true;
}, {
  message: "Custom activity name is required when activity type is 'Other'",
  path: ["activityCustom"],
}).refine((data) => {
  if (data.applicationType === "EXTERNAL") {
    return !!data.externalApplyUrl && data.externalApplyUrl.length > 0;
  }
  return true;
}, {
  message: "External apply URL is required when application type is EXTERNAL",
  path: ["externalApplyUrl"],
});

export function JobFormDialog({ open, onOpenChange, job, onSuccess }: JobFormDialogProps) {
  const router = useRouter();
  const isEditMode = !!job?.id;
  const mode = isEditMode ? "edit" : "create";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isLoadingJob, setIsLoadingJob] = useState(false);

  const [formData, setFormData] = useState<JobOffer>({
    title: job?.title || "",
    description: job?.description || "",
    customLocation: job?.customLocation || "",
    location: job?.location || "",
    contractType: job?.contractType || "CDI",
    isRemote: job?.isRemote || false,
    isHybrid: job?.isHybrid || false,
    employmentType: job?.employmentType || "FULL_TIME",
    activityType: job?.activityType || "CUSTOMER_SERVICE",
    activityCustom: job?.activityCustom || null,
    salary: job?.salary || "",
    salaryMin: job?.salaryMin || null,
    salaryMax: job?.salaryMax || null,
    salaryCurrency: job?.salaryCurrency || "USD",
    requirements: job?.requirements || [],
    benefitIds: job?.benefitIds || [],
    languages: job?.languages || [],
    technicalTools: job?.technicalTools || [],
    softSkills: job?.softSkills || [],
    applicationType: job?.applicationType || "INTERNAL",
    externalApplyUrl: job?.externalApplyUrl || null,
    expiresAt: job?.expiresAt || "",
  });

  const [newRequirement, setNewRequirement] = useState("");
  const [newLanguage, setNewLanguage] = useState({ language: "", level: "REQUIRED" });
  const [newTechnicalTool, setNewTechnicalTool] = useState("");
  const [newSoftSkill, setNewSoftSkill] = useState("");
  const [coreBenefits, setCoreBenefits] = useState<CompanyBenefit[]>([]);
  const [additionalBenefits, setAdditionalBenefits] = useState<CompanyBenefit[]>([]);

  useEffect(() => {
    if (open && isEditMode && job?.id) {
      setIsLoadingJob(true);
      fetch(`/api/job-offers/${job.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            const fullJob = data.data;
            setFormData({
              title: fullJob.title || "",
              description: fullJob.description || "",
              customLocation: fullJob.customLocation || "",
              contractType: fullJob.contractType || "CDI",
              isRemote: fullJob.isRemote || false,
              isHybrid: fullJob.isHybrid || false,
              employmentType: fullJob.employmentType || "FULL_TIME",
              activityType: fullJob.activityType || "CUSTOMER_SERVICE",
              activityCustom: fullJob.activityCustom || null,
              salary: fullJob.salary || "",
              salaryMin: fullJob.salaryMin || null,
              salaryMax: fullJob.salaryMax || null,
              salaryCurrency: fullJob.salaryCurrency || "USD",
              requirements: fullJob.requirements || [],
              benefitIds: fullJob.benefits?.map((b: JobBenefit) => b.benefit.id) || [],
              languages: fullJob.languages?.map((l: JobLanguage) => ({ language: l.language, level: l.level })) || [],
              technicalTools: fullJob.technicalTools || [],
              softSkills: fullJob.softSkills || [],
              location: fullJob.location || "",
               applicationType: fullJob.applicationType || "INTERNAL",
               externalApplyUrl: fullJob.externalApplyUrl || null,
               expiresAt: fullJob.expiresAt ? new Date(fullJob.expiresAt).toISOString().split("T")[0] : "",
             });
          }
        })
        .catch(() => {
          logger.error("Error fetching job");
          showError("Failed to load job details", {
            description: "Please try again later.",
          });
        })
        .finally(() => {
          setIsLoadingJob(false);
        });
} else if (!isEditMode && open) {
      setFormData({
        title: job?.title || "",
        description: job?.description || "",
        customLocation: job?.customLocation || job?.location || "",
        contractType: job?.contractType || "CDI",
        isRemote: job?.isRemote || false,
        isHybrid: job?.isHybrid || false,
        employmentType: job?.employmentType || "FULL_TIME",
        activityType: job?.activityType || "CUSTOMER_SERVICE",
        activityCustom: job?.activityCustom || null,
        salary: job?.salary || "",
        salaryMin: job?.salaryMin || null,
        salaryMax: job?.salaryMax || null,
        salaryCurrency: job?.salaryCurrency || "USD",
        requirements: job?.requirements || [],
        benefitIds: job?.benefitIds || [],
        // Scraped data provides languages as {name, level}; JobOffer uses {language, level}.
        // remap here so the UI (which reads lang.language) displays correctly.
        languages: ((job?.languages || []) as Array<{ name?: string; language?: string; level?: string }>).map((l) => ({
          language: l.language || l.name || "",
          level: l.level?.toUpperCase() || "REQUIRED",
        })),
        technicalTools: job?.technicalTools || [],
        softSkills: job?.softSkills || [],
        location: job?.location || "",
        applicationType: job?.applicationType || "INTERNAL",
        externalApplyUrl: job?.externalApplyUrl || null,
        expiresAt: job?.expiresAt || "",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEditMode, job?.id]);

  useEffect(() => {
    if (open) {
      fetch("/api/company/benefits")
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setCoreBenefits(data.data.core || []);
            setAdditionalBenefits(data.data.additional || []);
          }
        })
        .catch(() => {
          logger.error("Error fetching company benefits");
        });
    }
  }, [open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const addRequirement = () => {
    if (newRequirement.trim()) {
      setFormData((prev) => ({
        ...prev,
        requirements: [...(prev.requirements || []), newRequirement.trim()],
      }));
      setNewRequirement("");
    }
  };

  const removeRequirement = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      requirements: (prev.requirements || []).filter((_, i) => i !== index),
    }));
  };

  const addLanguage = () => {
    if (newLanguage.language.trim()) {
      if (formData.languages?.some(l => l.language.toLowerCase() === newLanguage.language.toLowerCase())) {
        showError("Language already added", {
          description: "This language is already in the list.",
        });
        return;
      }
      setFormData((prev) => ({
        ...prev,
        languages: [...(prev.languages || []), { language: newLanguage.language.trim(), level: newLanguage.level }],
      }));
      setNewLanguage({ language: "", level: "REQUIRED" });
    }
  };

  const removeLanguage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      languages: (prev.languages || []).filter((_, i) => i !== index),
    }));
  };

  const addTechnicalTool = () => {
    if (newTechnicalTool.trim()) {
      if (formData.technicalTools?.some(t => t.toLowerCase() === newTechnicalTool.toLowerCase())) {
        showError("Tool already added", {
          description: "This tool is already in the list.",
        });
        return;
      }
      setFormData((prev) => ({
        ...prev,
        technicalTools: [...(prev.technicalTools || []), newTechnicalTool.trim()],
      }));
      setNewTechnicalTool("");
    }
  };

  const removeTechnicalTool = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      technicalTools: (prev.technicalTools || []).filter((_, i) => i !== index),
    }));
  };

  const addSoftSkill = () => {
    if (newSoftSkill.trim()) {
      if (formData.softSkills?.some(s => s.toLowerCase() === newSoftSkill.toLowerCase())) {
        showError("Skill already added", {
          description: "This skill is already in the list.",
        });
        return;
      }
      setFormData((prev) => ({
        ...prev,
        softSkills: [...(prev.softSkills || []), newSoftSkill.trim()],
      }));
      setNewSoftSkill("");
    }
  };

  const removeSoftSkill = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      softSkills: (prev.softSkills || []).filter((_, i) => i !== index),
    }));
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 50);
  };

  const handleSubmit = async (publishNow: boolean) => {
    setIsSubmitting(true);
    setError(null);
    setFieldErrors({});
    // Validate form data with Zod
    const validationResult = jobOfferSchema.safeParse(formData);
    if (!validationResult.success) {
      // Convert Zod error to field errors format (top-level fields only)
      const errors: FieldErrors = {};
      validationResult.error.issues.forEach((error) => {
        // Get the top-level field name from the path
        const fieldName = String(error.path[0] || "form");
        if (!errors[fieldName]) {
          errors[fieldName] = [];
        }
        // Avoid duplicate error messages for the same field
        if (!errors[fieldName].includes(error.message)) {
          errors[fieldName].push(error.message);
        }
      });
      setFieldErrors(errors);

      Object.entries(errors).forEach(([field, messages]) => {
        showError(field.replace(/([A-Z])/g, " $1"), {
          description: messages[0],
        });
      });

      setIsSubmitting(false);
      return;
    }

    try {
      const slug = job?.slug || generateSlug(formData.title || "");
      const status = publishNow ? "PUBLISHED" : "DRAFT";

      const payload = {
        ...formData,
        slug,
        status,
        publishedAt: publishNow ? new Date().toISOString() : null,
      };

      const endpoint = isEditMode ? `/api/job-offers/${job.id}` : "/api/job-offers";
      const method = isEditMode ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        
        if (data.details && typeof data.details === 'object' && !Array.isArray(data.details)) {
          const errors: FieldErrors = {};
          Object.entries(data.details).forEach(([field, messages]) => {
            if (Array.isArray(messages)) {
              errors[field] = messages;
            }
          });
          setFieldErrors(errors);
        }
        
        throw new Error(data.error || "Failed to save job");
      }

      onOpenChange(false);
      router.refresh();
      onSuccess?.();
      
      if (isEditMode) {
        showSuccess("Job updated successfully!", {
          description: "Your changes have been saved.",
        });
      } else {
        showSuccess("Job created successfully!", {
          description: publishNow
            ? "Your job listing is now live and visible to candidates."
            : "Your job has been saved as a draft.",
        });
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to save job";
      setError(errMsg);
      showError("Failed to save job", {
        description: errMsg || "Please try again later.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCurrencySymbol = () => {
    return CURRENCIES.find(c => c.value === formData.salaryCurrency)?.symbol || "$";
  };

  const isFormValid = () => {
    const result = jobOfferSchema.safeParse(formData);
    return result.success;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-white rounded-2xl shadow-2xl border-0" showCloseButton={false}>
        <DialogHeader className="relative pb-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isEditMode ? 'bg-blue-100' : 'bg-[#162f67]'}`}>
                {isEditMode ? (
                  <Briefcase className="h-5 w-5 text-blue-600" />
                ) : (
                  <Sparkles className="h-5 w-5 text-white" />
                )}
              </div>
              <div className="flex-1 pr-8">
                <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900">
                  {mode === "create" ? "Post New Opportunity" : "Edit Opportunity"}
                </DialogTitle>
                <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
                  {mode === "create" ? "Create a new job listing for candidates" : "Update job details and requirements"}
                </p>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="absolute right-4 top-4 z-10 h-8 w-8 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5 text-slate-500" />
            </button>
          </div>
        </DialogHeader>

        {error && (
          <div className="mx-4 sm:mx-6 mt-4 rounded-xl bg-red-50 border border-red-100 p-3 sm:p-4 flex items-start gap-3">
            <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
              <X className="h-3 w-3 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </div>
        )}

        {isLoadingJob && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-[#162f67]" />
              <p className="text-sm text-slate-500">Loading job details...</p>
            </div>
          </div>
        )}

        {!isLoadingJob && (
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-6">
            <section className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-1 rounded-full bg-linear-to-b from-[#162f67] to-[#1e4d9c]"></div>
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
                  Basic Information
                </h3>
              </div>

              <div className="space-y-4">
                <div className="group">
                  <Label htmlFor="title" className="text-xs font-medium text-slate-600 mb-1.5 block">
                    Job Title <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="title"
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      placeholder="e.g. Senior Customer Support Specialist"
                      className={`pl-10 h-11 bg-slate-50 rounded-xl transition-all ${fieldErrors.title ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : formData.title ? 'border-emerald-500 focus:border-emerald-500' : 'border-slate-200 focus:border-[#162f67]'}`}
                    />
                  </div>
                  {fieldErrors.title && (
                    <p className="text-xs text-red-500 mt-1.5">{fieldErrors.title[0]}</p>
                  )}
                </div>

                <div className="grid gap-4 grid-cols-2">
                  <div className="group">
                    <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Contract Type <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <select
                        value={formData.contractType}
                        onChange={(e) => handleSelectChange("contractType", e.target.value)}
                        className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-[#162f67] transition-all appearance-none cursor-pointer"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.25rem 1.25rem' }}
                      >
                        {CONTRACT_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {fieldErrors.contractType && (
                      <p className="text-xs text-red-500 mt-1.5">
                        {fieldErrors.contractType[0]}
                      </p>
                    )}
                  </div>

                  <div className="group">
                    <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Employment Type <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <select
                        value={formData.employmentType || ""}
                        onChange={(e) => handleSelectChange("employmentType", e.target.value)}
                        className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-[#162f67] transition-all appearance-none cursor-pointer"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.25rem 1.25rem' }}
                      >
                        {EMPLOYMENT_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {fieldErrors.employmentType && (
                      <p className="text-xs text-red-500 mt-1.5">
                        {fieldErrors.employmentType[0]}
                      </p>
                    )}
                  </div>

                  <div className="group">
                    <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Type of Activity <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <select
                        value={formData.activityType || "CUSTOMER_SERVICE"}
                        onChange={(e) => {
                          setFormData((prev) => ({ ...prev, activityType: e.target.value, activityCustom: e.target.value !== "OTHER" ? null : prev.activityCustom }));
                        }}
                        className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-[#162f67] transition-all appearance-none cursor-pointer"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.25rem 1.25rem' }}
                      >
                        {ACTIVITY_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {fieldErrors.activityType && (
                      <p className="text-xs text-red-500 mt-1.5">
                        {fieldErrors.activityType[0]}
                      </p>
                    )}
                  </div>
                </div>

                {formData.activityType === "OTHER" && (
                  <div className="group">
                    <Label htmlFor="activityCustom" className="text-xs font-medium text-slate-600 mb-1.5 block">
                      Custom Activity <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="activityCustom"
                        name="activityCustom"
                        value={formData.activityCustom || ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, activityCustom: e.target.value }))}
                        placeholder="e.g. Customer Support, Telemarketing"
                        className={`pl-10 h-11 bg-slate-50 rounded-xl transition-all ${fieldErrors.activityCustom ? 'border-red-500 focus:border-red-500' : formData.activityCustom ? 'border-emerald-500 focus:border-emerald-500' : 'border-slate-200 focus:border-[#162f67]'}`}
                      />
                    </div>
                    {fieldErrors.activityCustom && (
                      <p className="text-xs text-red-500 mt-1.5">
                        {fieldErrors.activityCustom[0]}
                      </p>
                    )}
                  </div>
                )}

                <div className="group">
                  <Label htmlFor="customLocation" className="text-xs font-medium text-slate-600 mb-1.5 block">
                    Location <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="customLocation"
                      name="customLocation"
                      value={formData.customLocation || ""}
                      onChange={handleChange}
                      placeholder="e.g. Paris, France (leave empty to use company default)"
                      className={`pl-10 h-11 bg-slate-50 rounded-xl transition-all ${fieldErrors.customLocation ? 'border-red-500 focus:border-red-500' : formData.customLocation ? 'border-emerald-500 focus:border-emerald-500' : 'border-slate-200 focus:border-[#162f67]'}`}
                    />
                  </div>
                  {fieldErrors.customLocation && (
                    <p className="text-xs text-red-500 mt-1.5">
                      {fieldErrors.customLocation[0]}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-6 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isRemote || false}
                      onChange={(e) => setFormData((prev) => ({ ...prev, isRemote: e.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-[#162f67] focus:ring-[#162f67]"
                    />
                    <span className="text-sm text-slate-600">Remote</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isHybrid || false}
                      onChange={(e) => setFormData((prev) => ({ ...prev, isHybrid: e.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-[#162f67] focus:ring-[#162f67]"
                    />
                    <span className="text-sm text-slate-600">Hybrid</span>
                  </label>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-1 rounded-full bg-gradient-to-b from-rose-400 to-rose-500"></div>
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
                  Expiration Date
                </h3>
              </div>

              <div className="group">
                <Label htmlFor="expiresAt" className="text-xs font-medium text-slate-600 mb-1.5 block">
                  Expiration Date <span className="text-slate-400">(optional)</span>
                </Label>
                <Input
                  id="expiresAt"
                  name="expiresAt"
                  type="date"
                  value={formData.expiresAt || ""}
                  onChange={handleChange}
                  className="pl-10 h-11 bg-slate-50 rounded-xl transition-all focus:border-[#162f67]"
                />
                <p className="text-xs text-slate-400 mt-1.5">
                  Leave empty to auto-close 1 month after publication
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-indigo-600"></div>
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
                  Application Method
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label
                  className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer transition-all ${
                    formData.applicationType === "INTERNAL"
                      ? "border-[#162f67] bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="applicationType"
                    value="INTERNAL"
                    checked={formData.applicationType === "INTERNAL"}
                    onChange={() => setFormData((prev) => ({ ...prev, applicationType: "INTERNAL" }))}
                    className="h-4 w-4 text-[#162f67] focus:ring-[#162f67]"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">Apply on Platform</p>
                    <p className="text-xs text-slate-500 mt-0.5">Candidates apply directly on the platform</p>
                  </div>
                </label>

                <label
                  className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer transition-all ${
                    formData.applicationType === "EXTERNAL"
                      ? "border-[#162f67] bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="applicationType"
                    value="EXTERNAL"
                    checked={formData.applicationType === "EXTERNAL"}
                    onChange={() => setFormData((prev) => ({ ...prev, applicationType: "EXTERNAL" }))}
                    className="h-4 w-4 text-[#162f67] focus:ring-[#162f67]"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">External ATS / Website</p>
                    <p className="text-xs text-slate-500 mt-0.5">Redirect to company&apos;s application page</p>
                  </div>
                </label>
              </div>

              {formData.applicationType === "EXTERNAL" && (
                <div className="space-y-2">
                  <Label htmlFor="externalApplyUrl" className="text-xs font-medium text-slate-600 mb-1.5 block">
                    Official Apply URL <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="externalApplyUrl"
                      name="externalApplyUrl"
                      value={formData.externalApplyUrl || ""}
                      onChange={handleChange}
                      placeholder="https://company.com/careers/job"
                      className={`pl-10 h-11 bg-slate-50 rounded-xl transition-all ${fieldErrors.externalApplyUrl ? 'border-red-500 focus:border-red-500' : formData.externalApplyUrl ? 'border-emerald-500 focus:border-emerald-500' : 'border-slate-200 focus:border-[#162f67]'}`}
                    />
                  </div>
                  {fieldErrors.externalApplyUrl && (
                    <p className="text-xs text-red-500 mt-1.5">
                      {fieldErrors.externalApplyUrl[0]}
                    </p>
                  )}
                </div>
              )}
            </section>

                 <section className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-1 rounded-full bg-gradient-to-b from-purple-500 to-purple-600"></div>
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
                  Job Description
                </h3>
              </div>

              <div>
                <Label htmlFor="description" className="text-xs font-medium text-slate-600 mb-1.5 block">
                  Detailed Description <span className="text-red-500">*</span>
                </Label>
                  <Textarea
                  id="description"
                  name="description"
                  value={formData.description || ""}
                  onChange={handleChange}
                  placeholder="Describe the role, team culture, and what makes this opportunity unique..."
                  rows={5}
                  className={`bg-slate-50 rounded-xl transition-all resize-none ${fieldErrors.description ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : formData.description && formData.description.length >= 20 ? 'border-emerald-500 focus:border-emerald-500' : 'border-slate-200 focus:border-[#162f67]'}`}
                />
                <div className="flex justify-between mt-1.5">
                  {fieldErrors.description ? (
                    <p className="text-xs text-red-500">
                      {fieldErrors.description[0]}
                    </p>
                  ) : (
                    <div />
                  )}
                  <p className="text-xs text-slate-400">
                    {(formData.description || "").length}/20 minimum
                  </p>
                </div>
              </div>
            </section>
             <section className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-1 rounded-full bg-gradient-to-b from-teal-500 to-teal-600"></div>
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
                  Language Requirements <span className="text-red-500">*</span>
                </h3>
              </div>

              <div className="space-y-2">
                {formData.languages?.map((lang, index) => (
                  <div key={index} className="flex items-center gap-2 group">
                    <div className="flex-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white px-4 py-2.5">
                      <Globe className="h-4 w-4 text-teal-500 flex-shrink-0" />
                      <span className="text-sm text-slate-700 font-medium">{lang.language}</span>
                      <span className="text-xs text-slate-400">({lang.level})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLanguage(index)}
                      className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                <div className="flex items-center gap-2 pt-1">
                  <Input
                    value={newLanguage.language}
                    onChange={(e) => setNewLanguage((prev) => ({ ...prev, language: e.target.value }))}
                    placeholder="Add a language (e.g. English)"
                    className="flex-1 h-11 bg-slate-50 border-slate-200 focus:bg-white focus:border-[#162f67] rounded-xl transition-all"
                    list="common-languages"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addLanguage();
                      }
                    }}
                  />
                  <datalist id="common-languages">
                    {COMMON_LANGUAGES.map((lang) => (
                      <option key={lang} value={lang} />
                    ))}
                  </datalist>
                  <select
                    value={newLanguage.level}
                    onChange={(e) => setNewLanguage((prev) => ({ ...prev, level: e.target.value }))}
                    className="h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-[#162f67] transition-all cursor-pointer"
                  >
                    {LANGUAGE_LEVELS.map((level) => (
                      <option key={level.value} value={level.value}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={addLanguage} 
                    size="sm"
                    className="h-11 px-4 rounded-xl border-slate-200 hover:border-[#162f67] hover:text-[#162f67]"
                  >
                    <PlusCircle className="h-4 w-4 mr-1.5" />
                    Add
                  </Button>
                </div>
              </div>
              {fieldErrors.languages && (
                <p className="text-xs text-red-500 mt-2">
                  {fieldErrors.languages[0]}
                </p>
              )}
            </section>

            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">
                    Optional Details
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Add extra information to make your job offer more attractive.
                  </p>
                </div>
                <span className="rounded-full bg-white border border-slate-200 px-3 py-1 text-xs text-slate-500 shadow-sm">
                  Optional
                </span>
              </div>

            <section className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-1 rounded-full bg-gradient-to-b from-emerald-500 to-emerald-600"></div>
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
                  Compensation
                </h3>
              </div>

              <div className="grid gap-4 grid-cols-3">
                <div className="group col-span-1">
                  <Label htmlFor="salaryMin" className="text-xs font-medium text-slate-600 mb-1.5 block">
                    Min Salary
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
                      {getCurrencySymbol()}
                    </span>
                    <Input
                      id="salaryMin"
                      name="salaryMin"
                      type="number"
                      value={formData.salaryMin || ""}
                      onChange={handleChange}
                      placeholder="35000"
                      className={`pl-8 h-11 bg-slate-50 rounded-xl transition-all ${fieldErrors.salaryMin ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-[#162f67]'}`}
                    />
                  </div>
                </div>

                <div className="group col-span-1">
                  <Label htmlFor="salaryMax" className="text-xs font-medium text-slate-600 mb-1.5 block">
                    Max Salary
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
                      {getCurrencySymbol()}
                    </span>
                    <Input
                      id="salaryMax"
                      name="salaryMax"
                      type="number"
                      value={formData.salaryMax || ""}
                      onChange={handleChange}
                      placeholder="50000"
                      className={`pl-8 h-11 bg-slate-50 rounded-xl transition-all ${fieldErrors.salaryMax ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-[#162f67]'}`}
                    />
                  </div>
                </div>

                <div className="group col-span-1">
                  <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Currency</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <select
                      value={formData.salaryCurrency || "USD"}
                      onChange={(e) => setFormData((prev) => ({ ...prev, salaryCurrency: e.target.value }))}
                      className="w-full h-11 pl-10 pr-8 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-[#162f67] transition-all appearance-none cursor-pointer"
                    >
                      {CURRENCIES.map((curr) => (
                        <option key={curr.value} value={curr.value}>
                          {curr.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </section>

       

            <section className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-1 rounded-full bg-gradient-to-b from-amber-500 to-amber-600"></div>
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
                  Requirements
                </h3>
              </div>

              <div className="space-y-2">
                {formData.requirements?.map((req, index) => (
                  <div key={index} className="flex items-center gap-2 group">
                    <div className="flex-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white px-4 py-2.5">
                      <ListChecks className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      <span className="text-sm text-slate-700">{req}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRequirement(index)}
                      className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                <div className="flex items-center gap-2 pt-1">
                  <Input
                    value={newRequirement}
                    onChange={(e) => setNewRequirement(e.target.value)}
                    placeholder="Add a requirement (e.g. 2+ years experience)"
                    className="flex-1 h-11 bg-slate-50 border-slate-200 focus:bg-white focus:border-[#162f67] rounded-xl transition-all"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addRequirement();
                      }
                    }}
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={addRequirement} 
                    size="sm"
                    className="h-11 px-4 rounded-xl border-slate-200 hover:border-[#162f67] hover:text-[#162f67]"
                  >
                    <PlusCircle className="h-4 w-4 mr-1.5" />
                    Add
                  </Button>
                </div>
              </div>
            </section>

           

            <section className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-1 rounded-full bg-gradient-to-b from-cyan-500 to-cyan-600"></div>
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
                  Technical Tools
                </h3>
              </div>

              <div className="space-y-2">
                {formData.technicalTools?.map((tool, index) => (
                  <div key={index} className="flex items-center gap-2 group">
                    <div className="flex-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white px-4 py-2.5">
                      <Globe className="h-4 w-4 text-cyan-500 flex-shrink-0" />
                      <span className="text-sm text-slate-700">{tool}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTechnicalTool(index)}
                      className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                <div className="flex items-center gap-2 pt-1">
                  <Input
                    value={newTechnicalTool}
                    onChange={(e) => setNewTechnicalTool(e.target.value)}
                    placeholder="Add a technical tool"
                    className="flex-1 h-11 bg-slate-50 border-slate-200 focus:bg-white focus:border-[#162f67] rounded-xl transition-all"
                    list="technical-tools"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTechnicalTool();
                      }
                    }}
                  />
                  <datalist id="technical-tools">
                    {TECHNICAL_TOOLS.map((tool) => (
                      <option key={tool} value={tool} />
                    ))}
                  </datalist>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={addTechnicalTool} 
                    size="sm"
                    className="h-11 px-4 rounded-xl border-slate-200 hover:border-[#162f67] hover:text-[#162f67]"
                  >
                    <PlusCircle className="h-4 w-4 mr-1.5" />
                    Add
                  </Button>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-1 rounded-full bg-gradient-to-b from-rose-500 to-rose-600"></div>
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
                  Soft Skills
                </h3>
              </div>

              <div className="space-y-2">
                {formData.softSkills?.map((skill, index) => (
                  <div key={index} className="flex items-center gap-2 group">
                    <div className="flex-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white px-4 py-2.5">
                      <Globe className="h-4 w-4 text-rose-500 flex-shrink-0" />
                      <span className="text-sm text-slate-700">{skill}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSoftSkill(index)}
                      className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                <div className="flex items-center gap-2 pt-1">
                  <Input
                    value={newSoftSkill}
                    onChange={(e) => setNewSoftSkill(e.target.value)}
                    placeholder="Add a soft skill"
                    className="flex-1 h-11 bg-slate-50 border-slate-200 focus:bg-white focus:border-[#162f67] rounded-xl transition-all"
                    list="soft-skills"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSoftSkill();
                      }
                    }}
                  />
                  <datalist id="soft-skills">
                    {SOFT_SKILLS.map((skill) => (
                      <option key={skill} value={skill} />
                    ))}
                  </datalist>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={addSoftSkill} 
                    size="sm"
                    className="h-11 px-4 rounded-xl border-slate-200 hover:border-[#162f67] hover:text-[#162f67]"
                  >
                    <PlusCircle className="h-4 w-4 mr-1.5" />
                    Add
                  </Button>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-1 rounded-full bg-gradient-to-b from-green-500 to-green-600"></div>
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
                  Company Benefits
                </h3>
              </div>

              <div className="space-y-4">
                {coreBenefits.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-500">Included with all jobs</p>
                    <div className="flex flex-wrap gap-2">
                      {coreBenefits.map((benefit) => (
                        <span
                          key={benefit.id}
                          className="rounded-full border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700"
                        >
                          ✓ {benefit.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {additionalBenefits.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-500">Select additional benefits</p>
                    <div className="grid grid-cols-2 gap-2">
                      {additionalBenefits.map((benefit) => (
                        <label
                          key={benefit.id}
                          className={`flex items-center gap-2 rounded-xl border px-4 py-3 cursor-pointer transition-all ${
                            formData.benefitIds?.includes(benefit.id)
                              ? "border-green-500 bg-green-50"
                              : "border-slate-200 hover:border-green-300"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={formData.benefitIds?.includes(benefit.id) || false}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData((prev) => ({
                                  ...prev,
                                  benefitIds: [...(prev.benefitIds || []), benefit.id],
                                }));
                              } else {
                                setFormData((prev) => ({
                                  ...prev,
                                  benefitIds: (prev.benefitIds || []).filter((id) => id !== benefit.id),
                                }));
                              }
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                          />
                          <span className="text-sm text-slate-700">{benefit.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {coreBenefits.length === 0 && additionalBenefits.length === 0 && (
                  <p className="text-sm text-slate-500 italic">
                    No benefits configured. Go to Company Profile to add benefits.
                  </p>
                )}
              </div>
            </section>
            </div>
          </div>
        )}

        {!isLoadingJob && (
          <DialogFooter className="px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 w-full">
              <p className="text-xs text-slate-400">
                <span className="text-red-500">*</span> Required field
              </p>
              <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSubmit(false)}
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-none h-11 px-4 sm:px-6 rounded-xl border-slate-200 hover:border-slate-300 hover:bg-slate-100"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Draft
                </Button>
                <Button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  disabled={isSubmitting || !isFormValid()}
                  className={`
                    flex-1 sm:flex-none h-11 px-4 sm:px-6 rounded-xl
                    text-white shadow-lg transition-all duration-200
                    ${isFormValid()
                      ? 'bg-gradient-to-r from-[#162f67] to-[#1e4d9c] hover:from-[#1e4d9c] hover:to-[#2a5cb8] shadow-[#162f67]/20'
                      : 'bg-slate-300 cursor-not-allowed shadow-none'
                    }
                  `}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Publish
                </Button>
              </div>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}