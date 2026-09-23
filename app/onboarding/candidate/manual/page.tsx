"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/auth/user-provider";
import { JOB_ROLES, getJobRoleConfig } from "@/lib/job-role-config";
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
  { id: "male", label: "male" },
  { id: "female", label: "female" },
  { id: "Prefer not to say", label: "Prefer not to say" },
];

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
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [recommendedSkills, setRecommendedSkills] = useState<string[]>([]);

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
    const skill = skillName || newSkill;
    if (skill.trim() && !formData.skills.some((s) => s.name.toLowerCase() === skill.trim().toLowerCase())) {
      setFormData((prev) => ({
        ...prev,
        skills: [...prev.skills, { name: skill.trim() }],
      }));
      setNewSkill("");
    }
  };

  const handleRemoveSkill = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index),
    }));
  };

  const handleAddRecommendedSkill = (skill: string) => {
    if (!formData.skills.some((s) => s.name.toLowerCase() === skill.toLowerCase())) {
      setFormData((prev) => ({
        ...prev,
        skills: [...prev.skills, { name: skill }],
      }));
    }
  };

  const handleAddExperience = () => {
    if (!newExperience.title || !newExperience.company || !newExperience.startDate) {
      setError("Please fill in all required fields for experience");
      return;
    }
    
    if (!newExperience.current && newExperience.endDate && newExperience.startDate) {
      if (new Date(newExperience.endDate) < new Date(newExperience.startDate)) {
        setError("End date cannot be before start date");
        return;
      }
    }

    setError(null);
    setFormData((prev) => ({
      ...prev,
      experiences: [...prev.experiences, { ...newExperience }],
    }));
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
  };

  const handleAddLanguage = () => {
    if (newLanguage.name && !formData.languages.some((l) => l.name.toLowerCase() === newLanguage.name.toLowerCase())) {
      setFormData((prev) => ({
        ...prev,
        languages: [...prev.languages, { ...newLanguage }],
      }));
      setNewLanguage({ name: "", level: "BASIC" });
      setIsOtherLanguage(false);
    }
  };

  const handleRemoveLanguage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      languages: prev.languages.filter((_, i) => i !== index),
    }));
  };

  const handleAddEducation = () => {
    if (!newEducation.institution || !newEducation.degree || !newEducation.startDate) {
      setError("Please fill in all required fields for education");
      return;
    }
    
    if (newEducation.endDate && newEducation.startDate) {
      if (new Date(newEducation.endDate) < new Date(newEducation.startDate)) {
        setError("End date cannot be before start date");
        return;
      }
    }

    setError(null);
    setFormData((prev) => ({
      ...prev,
      education: [...prev.education, { ...newEducation }],
    }));
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
  };

  const toggleJobType = (type: string) => {
    setFormData((prev) => ({
      ...prev,
      preferredJobTypes: prev.preferredJobTypes.includes(type)
        ? prev.preferredJobTypes.filter((t) => t !== type)
        : [...prev.preferredJobTypes, type],
    }));
  };

  const getStepValidation = () => {
    switch (STEPS[currentStep]) {
      case "profile":
        return !!formData.firstName && !!formData.lastName && !!formData.phone && !!formData.location;
      case "role":
        return !!formData.targetJobRole;
      case "skills":
        return formData.skills.length > 0;
      case "languages":
      case "experience":
      case "education":
        return true;
      case "preferences":
        return !!formData.workMode;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!getStepValidation()) {
      if (STEPS[currentStep] === "profile" && (!formData.firstName || !formData.lastName || !formData.phone || !formData.location)) {
        setError("Please fill in all required fields");
      } else if (STEPS[currentStep] === "role" && !formData.targetJobRole) {
        setError("Please select a target role");
      } else if (STEPS[currentStep] === "skills" && formData.skills.length === 0) {
        setError("Please add at least one skill");
      } else if (STEPS[currentStep] === "preferences" && !formData.workMode) {
        setError("Please select a work mode");
      }
      return;
    }

    setError(null);
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
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="John"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="+216 00 000 000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Tunis, Tunisia"
              />
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
              <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn URL</label>
              <input
                type="url"
                value={formData.linkedinUrl}
                onChange={(e) => setFormData((prev) => ({ ...prev, linkedinUrl: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://linkedin.com/in/..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData((prev) => ({ ...prev, gender: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="" disabled>Select gender</option>
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g.id} value={g.id}>{g.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
        );

      case "role":
        return (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Choose Your Target Role</h2>
              <p className="text-sm text-gray-600">This helps us personalize your profile</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {JOB_ROLES.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, targetJobRole: role.id }))}
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
              {formData.experiences.map((exp, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-gray-900">{exp.title}</div>
                      <div className="text-sm text-gray-600">{exp.company}</div>
                      <div className="text-xs text-gray-500">
                        {exp.startDate} - {exp.current ? "Present" : exp.endDate}
                      </div>
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
              ))}
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
              {formData.education.map((edu, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-gray-900">{edu.degree}</div>
                      <div className="text-sm text-gray-600">{edu.institution}</div>
                      {edu.field && <div className="text-xs text-gray-500">{edu.field}</div>}
                      <div className="text-xs text-gray-500">
                        {edu.startDate} - {edu.endDate}
                      </div>
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
              ))}
            </div>
          </div>
        );

      case "preferences":
        return (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Work Mode</label>
              <div className="grid grid-cols-3 gap-3">
                {WORK_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, workMode: mode.id }))}
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
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Shift Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {SHIFT_TYPES.map((shift) => (
                  <button
                    key={shift.id}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, shiftType: shift.id }))}
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

          <div className="min-h-[280px]">{renderStep()}</div>

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