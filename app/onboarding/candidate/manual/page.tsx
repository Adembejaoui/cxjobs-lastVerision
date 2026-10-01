"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/auth/user-provider";
import { JOB_ROLES, getJobRoleConfig, getRequiredFields } from "@/lib/job-role-config";
import { normalizeLinkedInUrl } from "@/lib/validations/linkedin";
import { logger } from "@/lib/logger";
import { CroppableImageUpload } from "@/components/dashboard/croppable-image-upload";

interface FormData {
  targetJobRole: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location: string;
  headline: string;
  summary: string;
  avatarUrl: string;
  resumeUrl: string;
  linkedinUrl: string;
  workMode: string;
  shiftType: string;
  preferredJobTypes: string[];
  dateOfBirth: string;
  gender: string;
  skills: { name: string; level?: string }[];
  experiences: { title: string; company: string; location: string; startDate: string; endDate: string; current: boolean; description: string }[];
  languages: { name: string; level: string }[];
  education: { institution: string; degree: string; field: string; startDate: string; endDate: string }[];
}

const initialFormData: FormData = {
  targetJobRole: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  location: "",
  headline: "",
  summary: "",
  avatarUrl: "",
  resumeUrl: "",
  linkedinUrl: "",
  workMode: "",
  shiftType: "",
  preferredJobTypes: [],
  dateOfBirth: "",
  gender: "",
  skills: [],
  experiences: [],
  languages: [],
  education: [],
};

const ROLE_ICONS: Record<string, string> = {
  CALL_CENTER: "🎧",
  SALES: "📈",
  TECH_SUPPORT: "⚙️",
  CUSTOMER_SERVICE: "👥",
  ADMIN: "📋",
  GENERAL: "🔍",
};

const ROLE_COLORS: Record<string, string> = {
  CALL_CENTER: "border-blue-200 bg-blue-50 hover:border-blue-400 hover:bg-blue-100",
  SALES: "border-green-200 bg-green-50 hover:border-green-400 hover:bg-green-100",
  TECH_SUPPORT: "border-purple-200 bg-purple-50 hover:border-purple-400 hover:bg-purple-100",
  CUSTOMER_SERVICE: "border-orange-200 bg-orange-50 hover:border-orange-400 hover:bg-orange-100",
  ADMIN: "border-gray-200 bg-gray-50 hover:border-gray-400 hover:bg-gray-100",
  GENERAL: "border-indigo-200 bg-indigo-50 hover:border-indigo-400 hover:bg-indigo-100",
};

const WORK_MODES = [
  { id: "ONSITE", label: "On-site", icon: "🏢" },
  { id: "REMOTE", label: "Remote", icon: "🏠" },
  { id: "HYBRID", label: "Hybrid", icon: "🔄" },
];

const SHIFT_TYPES = [
  { id: "DAY", label: "Day Shift", icon: "☀️" },
  { id: "NIGHT", label: "Night Shift", icon: "🌙" },
  { id: "FLEXIBLE", label: "Flexible", icon: "⏰" },
  { id: "ROTATION", label: "Rotation", icon: "🔃" },
];

const JOB_TYPES = [
  { id: "FULL_TIME", label: "Full-time" },
  { id: "PART_TIME", label: "Part-time" },
  { id: "CDI", label: "CDI" },
  { id: "CIVP", label: "CIVP" },
  { id: "KARAMA", label: "Karama" },
  { id: "FREELANCE", label: "Freelance" },
];

const GENDER_OPTIONS = [
  { id: "Male", label: "Male" },
  { id: "Female", label: "Female" },
];

type ValidationErrors = Record<string, string>;

const FIELD_ERROR_CLASS = "mt-1 text-sm text-red-600";
const INVALID_INPUT_CLASS =
  "border-red-400 focus:ring-red-500 focus:border-red-500";

const STEPS = ["profile", "role", "skills", "languages", "experience", "education", "preferences"];
const STEP_TITLES: Record<string, string> = {
  profile: "Personal Information",
  role: "Target Role",
  skills: "Skills",
  languages: "Languages",
  experience: "Experience",
  education: "Education",
  preferences: "Job Preferences",
};

const FIELD_LABELS: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  phone: "Phone number",
  location: "Location",
  targetJobRole: "Target job role",
  skills: "Skill",
  languages: "Language",
  experiences: "Experience",
  education: "Education entry",
  workMode: "Work mode",
  linkedinUrl: "LinkedIn URL",
  dateOfBirth: "Date of birth",
  gender: "Gender",
};

const REQUIRED_FIELD_MESSAGES: Record<string, string> = {
  firstName: "First name is required.",
  lastName: "Last name is required.",
  phone: "Phone number is required.",
  location: "Location is required.",
  targetJobRole: "Please select a target job role.",
  skills: "Please add at least one skill.",
  languages: "Please add at least one language.",
  experiences: "Please add at least one experience.",
  education: "Please add at least one education entry.",
  workMode: "Please select a work mode.",
  gender: "Please select Male or Female.",
  dateOfBirth: "Date of birth is required.",
};

const isBlank = (value: unknown): boolean =>
  value === null || value === undefined || (typeof value === "string" && value.trim().length === 0);

const isValidDate = (value: string): boolean => {
  if (!value) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
};

const isRoleFieldRequired = (roleId: string, field: string): boolean => {
  if (!roleId) return false;
  return getRequiredFields(roleId).includes(field);
};

const hasValidSkills = (skills: FormData["skills"]): boolean =>
  Array.isArray(skills) && skills.some((skill) => typeof skill?.name === "string" && skill.name.trim().length > 0);

const hasValidLanguages = (languages: FormData["languages"]): boolean =>
  Array.isArray(languages) &&
  languages.some((language) => typeof language?.name === "string" && language.name.trim().length > 0);

const hasValidExperience = (experiences: FormData["experiences"]): boolean =>
  Array.isArray(experiences) &&
  experiences.some(
    (experience) =>
      !isBlank(experience?.title) && !isBlank(experience?.company) && !isBlank(experience?.startDate)
  );

const hasValidEducation = (education: FormData["education"]): boolean =>
  Array.isArray(education) &&
  education.some(
    (entry) => !isBlank(entry?.institution) && !isBlank(entry?.degree) && !isBlank(entry?.startDate)
  );

const validateStep = (step: string, data: FormData): ValidationErrors => {
  const errors: ValidationErrors = {};
  const roleId = data.targetJobRole;

  if (step === "profile") {
    if (isBlank(data.firstName)) errors.firstName = REQUIRED_FIELD_MESSAGES.firstName;
    if (isBlank(data.lastName)) errors.lastName = REQUIRED_FIELD_MESSAGES.lastName;
    if (isBlank(data.phone)) errors.phone = REQUIRED_FIELD_MESSAGES.phone;
    if (isBlank(data.location)) errors.location = REQUIRED_FIELD_MESSAGES.location;

    // Shared candidate LinkedIn rule: a bare "linkedin.com/in/x" is accepted,
    // anything that is not a LinkedIn URL is rejected with a field-specific
    // message. Empty stays valid because the field is optional.
    if (!isBlank(data.linkedinUrl)) {
      const linkedinResult = normalizeLinkedInUrl(data.linkedinUrl);
      if (!linkedinResult.ok) {
        errors.linkedinUrl = linkedinResult.error;
      }
    }
    if (data.gender !== "Male" && data.gender !== "Female") {
      errors.gender = REQUIRED_FIELD_MESSAGES.gender;
    }
    if (isBlank(data.dateOfBirth)) {
      errors.dateOfBirth = REQUIRED_FIELD_MESSAGES.dateOfBirth;
    } else if (!isValidDate(data.dateOfBirth)) {
      errors.dateOfBirth = "Please enter a valid date of birth.";
    }
  }

  if (step === "role") {
    if (isBlank(data.targetJobRole)) errors.targetJobRole = REQUIRED_FIELD_MESSAGES.targetJobRole;
  }

  if (step === "skills") {
    if (!hasValidSkills(data.skills)) errors.skills = REQUIRED_FIELD_MESSAGES.skills;
  }

  if (step === "languages") {
    if (isRoleFieldRequired(roleId, "languages")) {
      if (!hasValidLanguages(data.languages)) {
        errors.languages = REQUIRED_FIELD_MESSAGES.languages;
      } else {
        const invalid = data.languages.find(
          (language) =>
            typeof language?.name === "string" && language.name.trim().length > 0 && isBlank(language.level)
        );
        if (invalid) {
          errors.languages = `Please select a proficiency level for ${invalid.name.trim()}.`;
        }
      }
    }
  }

  if (step === "experience") {
    if (isRoleFieldRequired(roleId, "experiences") || isRoleFieldRequired(roleId, "experience")) {
      if (!hasValidExperience(data.experiences)) {
        errors.experiences = REQUIRED_FIELD_MESSAGES.experiences;
      } else {
        data.experiences.forEach((experience, index) => {
          if (isBlank(experience?.title)) {
            errors[`experiences.${index}.title`] = `Experience #${index + 1}: job title is required.`;
          }
          if (isBlank(experience?.company)) {
            errors[`experiences.${index}.company`] = `Experience #${index + 1}: company name is required.`;
          }
          if (isBlank(experience?.startDate)) {
            errors[`experiences.${index}.startDate`] = `Experience #${index + 1}: start date is required.`;
          }
          if (
            !experience?.current &&
            !isBlank(experience?.endDate) &&
            !isBlank(experience?.startDate) &&
            new Date(experience.endDate) < new Date(experience.startDate)
          ) {
            errors[`experiences.${index}.endDate`] =
              `Experience #${index + 1}: end date cannot be before the start date.`;
          }
        });
      }
    }
  }

  if (step === "education") {
    if (isRoleFieldRequired(roleId, "education")) {
      if (!hasValidEducation(data.education)) {
        errors.education = REQUIRED_FIELD_MESSAGES.education;
      } else {
        data.education.forEach((entry, index) => {
          if (isBlank(entry?.institution)) {
            errors[`education.${index}.institution`] = `Education #${index + 1}: institution is required.`;
          }
          if (isBlank(entry?.degree)) {
            errors[`education.${index}.degree`] = `Education #${index + 1}: degree is required.`;
          }
          if (isBlank(entry?.startDate)) {
            errors[`education.${index}.startDate`] = `Education #${index + 1}: start date is required.`;
          }
          if (
            !isBlank(entry?.endDate) &&
            !isBlank(entry?.startDate) &&
            new Date(entry.endDate) < new Date(entry.startDate)
          ) {
            errors[`education.${index}.endDate`] =
              `Education #${index + 1}: end date cannot be before the start date.`;
          }
        });
      }
    }
  }

  if (step === "preferences") {
    if (isBlank(data.workMode)) errors.workMode = REQUIRED_FIELD_MESSAGES.workMode;
  }

  return errors;
};

const errorKeysForStep = (step: string, errors: ValidationErrors): string[] =>
  Object.keys(errors).filter((key) => {
    const [root] = key.split(".");
    return step === "profile"
      ? ["firstName", "lastName", "phone", "location", "linkedinUrl", "dateOfBirth", "gender"].includes(root)
      : step === "role"
      ? root === "targetJobRole"
      : step === "skills"
      ? root === "skills"
      : step === "languages"
      ? root === "languages"
      : step === "experience"
      ? root === "experiences"
      : step === "education"
      ? root === "education"
      : step === "preferences"
      ? root === "workMode"
      : false;
  });

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className={FIELD_ERROR_CLASS}>
      {message}
    </p>
  );
}

export default function ManualOnboardingPage() {
  const router = useRouter();
  const user = useUser();
  const email = user?.email ?? "";
  const name = user?.name ?? null;
  const isOnboarded = user?.isOnboarded ?? false;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ValidationErrors>({});
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [recommendedSkills, setRecommendedSkills] = useState<string[]>([]);
  const firstInputErrorRef = useRef<HTMLInputElement | null>(null);
  const firstSectionErrorRef = useRef<HTMLDivElement | null>(null);
  const stepContentRef = useRef<HTMLDivElement | null>(null);

  const clearFieldError = (...keys: string[]) => {
    if (keys.length === 0) return;
    setFieldErrors((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const key of keys) {
        for (const existing of Object.keys(next)) {
          if (existing === key || existing.startsWith(`${key}.`)) {
            delete next[existing];
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  };

  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    clearFieldError(String(key));
  };

  const [newSkill, setNewSkill] = useState("");
  const [newExperience, setNewExperience] = useState({
    title: "",
    company: "",
    location: "",
    startDate: "",
    endDate: "",
    current: false,
    description: "",
  });
  const [newLanguage, setNewLanguage] = useState({ name: "", level: "BASIC" });
  const [isOtherLanguage, setIsOtherLanguage] = useState(false);
  const [newEducation, setNewEducation] = useState({
    institution: "",
    degree: "",
    field: "",
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    if (isOnboarded) {
      router.push("/dashboard");
      return;
    }
    setFormData((prev) => ({
      ...prev,
      email: email || "",
      firstName: name?.split(" ")[0] || "",
      lastName: name?.split(" ").slice(1).join(" ") || "",
    }));
    setLoading(false);
  }, [isOnboarded, router, email, name]);

  useEffect(() => {
    if (formData.targetJobRole) {
      const config = getJobRoleConfig(formData.targetJobRole);
      if (config) {
        setRecommendedSkills(config.recommendedSkills);
        if (!formData.headline) {
          setFormData((prev) => ({ ...prev, headline: config.title }));
        }
      }
    }
  }, [formData.targetJobRole, formData.headline]);

  const handleAddSkill = (skillName?: string) => {
    const skill = (skillName || newSkill).trim();
    if (!skill) {
      setError("Please enter a skill name before adding it.");
      return;
    }
    if (formData.skills.some((s) => s.name.toLowerCase() === skill.toLowerCase())) {
      setError(`"${skill}" is already in your skill list.`);
      return;
    }
    setError(null);
    setFormData((prev) => ({
      ...prev,
      skills: [...prev.skills, { name: skill }],
    }));
    setNewSkill("");
    clearFieldError("skills");
  };

  const handleRemoveSkill = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index),
    }));
    clearFieldError("skills");
  };

  const handleAddRecommendedSkill = (skill: string) => {
    if (!formData.skills.some((s) => s.name.toLowerCase() === skill.toLowerCase())) {
      setFormData((prev) => ({
        ...prev,
        skills: [...prev.skills, { name: skill }],
      }));
      clearFieldError("skills");
    }
  };

  const handleAddExperience = () => {
    const draftErrors: ValidationErrors = {};
    if (isBlank(newExperience.title)) draftErrors.title = "Job title is required.";
    if (isBlank(newExperience.company)) draftErrors.company = "Company name is required.";
    if (isBlank(newExperience.startDate)) draftErrors.startDate = "Start date is required.";
    if (!newExperience.current && newExperience.endDate && newExperience.startDate) {
      if (!isValidDate(newExperience.endDate)) {
        draftErrors.endDate = "Please enter a valid end date.";
      } else if (new Date(newExperience.endDate) < new Date(newExperience.startDate)) {
        draftErrors.endDate = "End date cannot be before the start date.";
      }
    }

    if (Object.keys(draftErrors).length > 0) {
      setError(
        `Please complete the required experience fields: ${Object.values(draftErrors).join(" ")}`
      );
      return;
    }

    setError(null);
    setFormData((prev) => ({
      ...prev,
      experiences: [...prev.experiences, { ...newExperience }],
    }));
    clearFieldError("experiences");
    setNewExperience({
      title: "",
      company: "",
      location: "",
      startDate: "",
      endDate: "",
      current: false,
      description: "",
    });
  };

  const handleRemoveExperience = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      experiences: prev.experiences.filter((_, i) => i !== index),
    }));
    clearFieldError("experiences");
  };

  const handleAddLanguage = () => {
    const name = newLanguage.name.trim();
    if (!name) {
      setError("Please select or type a language name before adding it.");
      return;
    }
    if (isBlank(newLanguage.level)) {
      setError("Please select a proficiency level for this language.");
      return;
    }
    if (formData.languages.some((l) => l.name.toLowerCase() === name.toLowerCase())) {
      setError(`"${name}" is already in your language list.`);
      return;
    }
    setError(null);
    setFormData((prev) => ({
      ...prev,
      languages: [...prev.languages, { name, level: newLanguage.level }],
    }));
    setNewLanguage({ name: "", level: "BASIC" });
    setIsOtherLanguage(false);
    clearFieldError("languages");
  };

  const handleRemoveLanguage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      languages: prev.languages.filter((_, i) => i !== index),
    }));
    clearFieldError("languages");
  };

  const handleAddEducation = () => {
    const draftErrors: ValidationErrors = {};
    if (isBlank(newEducation.institution)) draftErrors.institution = "Institution is required.";
    if (isBlank(newEducation.degree)) draftErrors.degree = "Degree is required.";
    if (isBlank(newEducation.startDate)) draftErrors.startDate = "Start date is required.";
    if (newEducation.endDate && newEducation.startDate) {
      if (!isValidDate(newEducation.endDate)) {
        draftErrors.endDate = "Please enter a valid end date.";
      } else if (new Date(newEducation.endDate) < new Date(newEducation.startDate)) {
        draftErrors.endDate = "End date cannot be before the start date.";
      }
    }

    if (Object.keys(draftErrors).length > 0) {
      setError(
        `Please complete the required education fields: ${Object.values(draftErrors).join(" ")}`
      );
      return;
    }

    setError(null);
    setFormData((prev) => ({
      ...prev,
      education: [...prev.education, { ...newEducation }],
    }));
    clearFieldError("education");
    setNewEducation({
      institution: "",
      degree: "",
      field: "",
      startDate: "",
      endDate: "",
    });
  };

  const handleRemoveEducation = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== index),
    }));
    clearFieldError("education");
  };

  const toggleJobType = (type: string) => {
    setFormData((prev) => ({
      ...prev,
      preferredJobTypes: prev.preferredJobTypes.includes(type)
        ? prev.preferredJobTypes.filter((t) => t !== type)
        : [...prev.preferredJobTypes, type],
    }));
  };

  const getStepValidation = (): ValidationErrors => validateStep(STEPS[currentStep], formData);

  const handleSelectRole = (roleId: string) => {
    setFormData((prev) => ({ ...prev, targetJobRole: roleId }));
    clearFieldError("targetJobRole", "languages", "experiences", "education", "skills", "workMode");
  };

  const handleNext = () => {
    const stepErrors = getStepValidation();

    if (Object.keys(stepErrors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...stepErrors }));
      const missingLabels = Array.from(new Set(Object.keys(stepErrors).map((key) => FIELD_LABELS[key.split(".")[0]] ?? "A required field")));
      setError(`Please complete the following to continue: ${missingLabels.join(", ")}.`);
      requestAnimationFrame(() => {
        const target = firstInputErrorRef.current ?? firstSectionErrorRef.current;
        if (target) {
          target.focus();
          target.scrollIntoView({ behavior: "smooth", block: "center" });
        } else if (stepContentRef.current) {
          stepContentRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
      return;
    }

    setError(null);
    setFieldErrors((prev) => {
      const next = { ...prev };
      errorKeysForStep(STEPS[currentStep], next).forEach((key) => delete next[key]);
      return next;
    });

    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSave();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.success) {
        router.push("/dashboard/candidate/profile");
        router.refresh();
      } else {
        setError(data.error || "Failed to save profile");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const renderStep = () => {
    const currentStepKey = STEPS[currentStep];

    switch (currentStepKey) {
      case "profile":
        return (
          <div className="space-y-5">
            <div className="flex justify-center mb-6">
              <CroppableImageUpload
                value={formData.avatarUrl}
                onChange={(url) => setFormData((prev) => ({ ...prev, avatarUrl: url || "" }))}
                type="avatar"
                label="Profile Photo"
                maxSize="2MB"
                previewClassName="w-24 h-24 rounded-full"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                <input
                  id="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => updateField("firstName", e.target.value)}
                  aria-invalid={!!fieldErrors.firstName}
                  aria-describedby={fieldErrors.firstName ? "firstName-error" : undefined}
                  ref={fieldErrors.firstName ? firstInputErrorRef : undefined}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${fieldErrors.firstName ? INVALID_INPUT_CLASS : ""}`}
                  placeholder="John"
                />
                <FieldError id="firstName-error" message={fieldErrors.firstName} />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                <input
                  id="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => updateField("lastName", e.target.value)}
                  aria-invalid={!!fieldErrors.lastName}
                  aria-describedby={fieldErrors.lastName ? "lastName-error" : undefined}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${fieldErrors.lastName ? INVALID_INPUT_CLASS : ""}`}
                  placeholder="Doe"
                />
                <FieldError id="lastName-error" message={fieldErrors.lastName} />
              </div>
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                aria-invalid={!!fieldErrors.phone}
                aria-describedby={fieldErrors.phone ? "phone-error" : undefined}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${fieldErrors.phone ? INVALID_INPUT_CLASS : ""}`}
                placeholder="+216 00 000 000"
              />
              <FieldError id="phone-error" message={fieldErrors.phone} />
            </div>

            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
              <input
                id="location"
                type="text"
                value={formData.location}
                onChange={(e) => updateField("location", e.target.value)}
                aria-invalid={!!fieldErrors.location}
                aria-describedby={fieldErrors.location ? "location-error" : undefined}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${fieldErrors.location ? INVALID_INPUT_CLASS : ""}`}
                placeholder="Tunis, Tunisia"
              />
              <FieldError id="location-error" message={fieldErrors.location} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Headline</label>
              <input
                type="text"
                value={formData.headline}
                onChange={(e) => setFormData((prev) => ({ ...prev, headline: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={formData.targetJobRole ? getJobRoleConfig(formData.targetJobRole)?.title : "e.g., Call Center Agent"}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Summary</label>
              <textarea
                value={formData.summary}
                onChange={(e) => setFormData((prev) => ({ ...prev, summary: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Tell us about yourself..."
              />
            </div>

            <div>
              <label htmlFor="linkedinUrl" className="block text-sm font-medium text-gray-700 mb-1">LinkedIn URL</label>
              <input
                id="linkedinUrl"
                type="text"
                value={formData.linkedinUrl}
                onChange={(e) => updateField("linkedinUrl", e.target.value)}
                aria-invalid={!!fieldErrors.linkedinUrl}
                aria-describedby={fieldErrors.linkedinUrl ? "linkedinUrl-error" : undefined}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${fieldErrors.linkedinUrl ? INVALID_INPUT_CLASS : ""}`}
                placeholder="linkedin.com/in/yourprofile"
              />
              <FieldError id="linkedinUrl-error" message={fieldErrors.linkedinUrl} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                <input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => updateField("dateOfBirth", e.target.value)}
                  aria-invalid={!!fieldErrors.dateOfBirth}
                  aria-describedby={fieldErrors.dateOfBirth ? "dateOfBirth-error" : undefined}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${fieldErrors.dateOfBirth ? INVALID_INPUT_CLASS : ""}`}
                />
                <FieldError id="dateOfBirth-error" message={fieldErrors.dateOfBirth} />
              </div>
              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
                <select
                  id="gender"
                  value={formData.gender}
                  onChange={(e) => updateField("gender", e.target.value)}
                  aria-invalid={!!fieldErrors.gender}
                  aria-describedby={fieldErrors.gender ? "gender-error" : undefined}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${fieldErrors.gender ? INVALID_INPUT_CLASS : ""}`}
                >
                  <option value="" disabled>Select gender</option>
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g.id} value={g.id}>{g.label}</option>
                  ))}
                </select>
                <FieldError id="gender-error" message={fieldErrors.gender} />
              </div>
            </div>
          </div>
          
        );

      case "role":
        return (
          <div className="space-y-5">
            <div>
              <h2 id="targetJobRole-label" className="text-lg font-semibold text-gray-900 mb-1">Choose Your Target Role</h2>
              <p className="text-sm text-gray-600">This helps us personalize your profile</p>
            </div>
            <div
              id="targetJobRole-group"
              role="group"
              aria-labelledby="targetJobRole-label"
              aria-describedby={fieldErrors.targetJobRole ? "targetJobRole-error" : undefined}
              tabIndex={-1}
              ref={fieldErrors.targetJobRole ? firstSectionErrorRef : undefined}
              className={`grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-lg ${fieldErrors.targetJobRole ? "outline outline-1 outline-red-300 outline-offset-4" : ""}`}
            >
              {JOB_ROLES.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => handleSelectRole(role.id)}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 text-left hover:shadow-md ${
                    formData.targetJobRole === role.id
                      ? "border-blue-500 bg-blue-50"
                      : ROLE_COLORS[role.id]
                  }`}
                >
                  <div className="text-2xl mb-2">{ROLE_ICONS[role.id]}</div>
                  <div className="text-sm font-semibold text-gray-900">{role.title}</div>
                  <div className="text-xs text-gray-600 mt-1 line-clamp-2">{role.description}</div>
                </button>
              ))}
            </div>
            <FieldError id="targetJobRole-error" message={fieldErrors.targetJobRole} />
          </div>
        );

      case "skills":
        return (
          <div className="space-y-5">
            {recommendedSkills.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recommended skills for {getJobRoleConfig(formData.targetJobRole)?.title}
                </label>
                <p className="text-xs text-gray-500 mb-3">Click to add these skills quickly</p>
                <div className="flex flex-wrap gap-2">
                  {recommendedSkills
                    .filter((skill) => !formData.skills.some((s) => s.name.toLowerCase() === skill.toLowerCase()))
                    .map((skill, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleAddRecommendedSkill(skill)}
                        className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium hover:bg-blue-100 transition-colors"
                      >
                        + {skill}
                      </button>
                    ))}
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Add Your Skills</label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddSkill())}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Communication, French"
                />
                <button
                  type="button"
                  onClick={() => handleAddSkill()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.skills.map((skill, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm"
                  >
                    {skill.name}
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(index)}
                      className="ml-2 text-gray-400 hover:text-gray-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <FieldError id="skills-error" message={fieldErrors.skills} />
            </div>
          </div>
        );

      case "languages":
        return (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Add Language</label>
              <div className="flex gap-2 mb-3">
                <select
                  value={isOtherLanguage ? "OTHER" : newLanguage.name === "" ? "" : newLanguage.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "OTHER") {
                      setIsOtherLanguage(true);
                      setNewLanguage((prev) => ({ ...prev, name: "" }));
                    } else {
                      setIsOtherLanguage(false);
                      setNewLanguage((prev) => ({ ...prev, name: val }));
                    }
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a language</option>
                  <option value="Arabic">Arabic</option>
                  <option value="Dutch">Dutch</option>
                  <option value="English">English</option>
                  <option value="French">French</option>
                  <option value="Italian">Italian</option>
                  <option value="Portuguese">Portuguese</option>
                  <option value="Spanish">Spanish</option>
                  <option value="OTHER">Other</option>
                </select>
                {isOtherLanguage && (
                  <input
                    type="text"
                    value={newLanguage.name}
                    onChange={(e) => setNewLanguage((prev) => ({ ...prev, name: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your language"
                    autoFocus
                  />
                )}
                <select
                  value={newLanguage.level}
                  onChange={(e) => setNewLanguage((prev) => ({ ...prev, level: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="BASIC">Basic</option>
                  <option value="CONVERSATIONAL">Conversational</option>
                  <option value="FLUENT">Fluent</option>
                  <option value="NATIVE">Native</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddLanguage}
                  disabled={!newLanguage.name}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.languages.map((lang, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-sm font-medium"
                  >
                    {lang.name} - {lang.level}
                    <button
                      type="button"
                      onClick={() => handleRemoveLanguage(index)}
                      className="ml-2 text-green-500 hover:text-green-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <FieldError id="languages-error" message={fieldErrors.languages} />
            </div>
          </div>
        );

      case "experience":
        return (
          <div className="space-y-5">
            <div className="bg-gray-50 p-4 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-3">Add Work Experience</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Job Title <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={newExperience.title}
                    onChange={(e) => setNewExperience((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Customer Service Agent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Company <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={newExperience.company}
                    onChange={(e) => setNewExperience((prev) => ({ ...prev, company: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Company name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
                  <input
                    type="text"
                    value={newExperience.location}
                    onChange={(e) => setNewExperience((prev) => ({ ...prev, location: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="City, Country"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Start Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={newExperience.startDate}
                    onChange={(e) => setNewExperience((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                  <input
                    type="date"
                    value={newExperience.endDate}
                    onChange={(e) => setNewExperience((prev) => ({ ...prev, endDate: e.target.value }))}
                    disabled={newExperience.current}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:bg-gray-100"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newExperience.current}
                      onChange={(e) => setNewExperience((prev) => ({ ...prev, current: e.target.checked, endDate: e.target.checked ? "" : prev.endDate }))}
                      className="rounded border-gray-300 text-blue-600"
                    />
                    <span className="text-sm text-gray-700">I currently work here</span>
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                  <textarea
                    value={newExperience.description}
                    onChange={(e) => setNewExperience((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    placeholder="Describe your responsibilities and achievements..."
                    rows={2}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddExperience}
                disabled={!newExperience.title || !newExperience.company || !newExperience.startDate}
                className="w-full mt-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add Experience
              </button>
            </div>

            <div className="space-y-3">
              {formData.experiences.map((exp, index) => {
                const entryErrors = [
                  fieldErrors[`experiences.${index}.title`],
                  fieldErrors[`experiences.${index}.company`],
                  fieldErrors[`experiences.${index}.startDate`],
                  fieldErrors[`experiences.${index}.endDate`],
                ].filter(Boolean) as string[];
                return (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-gray-900">{exp.title}</div>
                      <div className="text-sm text-gray-600">{exp.company}</div>
                      <div className="text-xs text-gray-500">
                        {exp.startDate} - {exp.current ? "Present" : exp.endDate}
                      </div>
                      {entryErrors.map((message) => (
                        <p key={message} role="alert" className={FIELD_ERROR_CLASS}>{message}</p>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveExperience(index)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      ×
                    </button>
                  </div>
                </div>
                );
              })}
              <FieldError id="experiences-error" message={fieldErrors.experiences} />
            </div>
          </div>
        );

      case "education":
        return (
          <div className="space-y-5">
            <div className="bg-gray-50 p-4 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-3">Add Education</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Institution <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={newEducation.institution}
                    onChange={(e) => setNewEducation((prev) => ({ ...prev, institution: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., University of Tunis"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Degree <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={newEducation.degree}
                    onChange={(e) => setNewEducation((prev) => ({ ...prev, degree: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Bachelor, Master"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Field of Study</label>
                  <input
                    type="text"
                    value={newEducation.field}
                    onChange={(e) => setNewEducation((prev) => ({ ...prev, field: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Computer Science"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Start Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={newEducation.startDate}
                    onChange={(e) => setNewEducation((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                  <input
                    type="date"
                    value={newEducation.endDate}
                    onChange={(e) => setNewEducation((prev) => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddEducation}
                disabled={!newEducation.institution || !newEducation.degree || !newEducation.startDate}
                className="w-full mt-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add Education
              </button>
            </div>

            <div className="space-y-3">
              {formData.education.map((edu, index) => {
                const entryErrors = [
                  fieldErrors[`education.${index}.institution`],
                  fieldErrors[`education.${index}.degree`],
                  fieldErrors[`education.${index}.startDate`],
                  fieldErrors[`education.${index}.endDate`],
                ].filter(Boolean) as string[];
                return (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-gray-900">{edu.degree}</div>
                      <div className="text-sm text-gray-600">{edu.institution}</div>
                      {edu.field && <div className="text-xs text-gray-500">{edu.field}</div>}
                      <div className="text-xs text-gray-500">
                        {edu.startDate} - {edu.endDate}
                      </div>
                      {entryErrors.map((message) => (
                        <p key={message} role="alert" className={FIELD_ERROR_CLASS}>{message}</p>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveEducation(index)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      ×
                    </button>
                  </div>
                </div>
                );
              })}
              <FieldError id="education-error" message={fieldErrors.education} />
            </div>
          </div>
        );

      case "preferences":
        return (
          <div className="space-y-5">
            <div>
              <label id="workMode-label" className="block text-sm font-medium text-gray-700 mb-3">Work Mode</label>
              <div
                role="group"
                aria-labelledby="workMode-label"
                aria-describedby={fieldErrors.workMode ? "workMode-error" : undefined}
                tabIndex={-1}
                ref={fieldErrors.workMode ? firstSectionErrorRef : undefined}
                className={`grid grid-cols-3 gap-3 rounded-lg ${fieldErrors.workMode ? "outline outline-1 outline-red-300 outline-offset-4" : ""}`}
              >
                {WORK_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => updateField("workMode", mode.id)}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      formData.workMode === mode.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="text-xl mb-1">{mode.icon}</div>
                    <div className="text-sm font-medium text-gray-900">{mode.label}</div>
                  </button>
                ))}
              </div>
              <FieldError id="workMode-error" message={fieldErrors.workMode} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Shift Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {SHIFT_TYPES.map((shift) => (
                  <button
                    key={shift.id}
                    type="button"
                    onClick={() => updateField("shiftType", shift.id)}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      formData.shiftType === shift.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="text-xl mb-1">{shift.icon}</div>
                    <div className="text-xs font-medium text-gray-900">{shift.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Job Type</label>
              <div className="flex flex-wrap gap-2">
                {JOB_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => toggleJobType(type.id)}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                      formData.preferredJobTypes.includes(type.id)
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 hover:border-gray-300 text-gray-700"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading || status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const selectedRole = formData.targetJobRole ? getJobRoleConfig(formData.targetJobRole) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="text-sm text-gray-500">
              Step {currentStep + 1} of {STEPS.length}
            </div>
            {selectedRole && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-2xl">{ROLE_ICONS[formData.targetJobRole]}</span>
                <span className="font-medium text-gray-700">{selectedRole.title}</span>
              </div>
            )}
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              {STEPS.map((step, index) => (
                <div key={step} className="flex items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                      index < currentStep
                        ? "bg-green-500 text-white"
                        : index === currentStep
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {index < currentStep ? "✓" : index + 1}
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className={`flex-1 h-1 mx-2 rounded ${index < currentStep ? "bg-green-500" : "bg-gray-200"}`} />
                  )}
                </div>
              ))}
            </div>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-900">{STEP_TITLES[STEPS[currentStep]]}</h2>
              <p className="text-xs text-gray-500">Step {currentStep + 1} of {STEPS.length}</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <div ref={stepContentRef} className="min-h-[280px]">{renderStep()}</div>

          <div className="flex justify-between mt-6 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 0}
              className="px-4 h-12 border-2 border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:border-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={saving}
              className="px-8 h-12 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving..." : currentStep === STEPS.length - 1 ? "Complete Profile" : "Continue"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto mt-6">
        <button
          type="button"
          onClick={() => router.push("/onboarding/candidate/cv")}
          className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:border-green-400 hover:text-green-600 transition-colors"
        >
          Or upload your CV instead →
        </button>
      </div>
    </div>
  );
}