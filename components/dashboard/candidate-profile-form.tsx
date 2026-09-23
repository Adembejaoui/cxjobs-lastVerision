"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  User, MapPin, Phone, Linkedin, Calendar,
  Save, Loader2, Plus, Trash2, Briefcase, GraduationCap, Languages,
  Settings, Upload, Eye
} from "lucide-react";
import { CroppableImageUpload } from "@/components/dashboard/croppable-image-upload";

interface Experience {
  id?: string;
  company: string;
  title: string;
  location: string | null;
  startDate: Date | string;
  endDate: Date | string | null;
  isCurrent: boolean;
  description: string | null;
}

interface Education {
  id?: string;
  school: string;
  degree: string;
  fieldOfStudy: string | null;
  startDate: Date | string;
  endDate: Date | string | null;
  isCurrent: boolean;
  description: string | null;
}

interface Language {
  id?: string;
  name: string;
  proficiency: string | null;
}

interface Skill {
  id?: string;
  name: string;
  level: string | null;
  yearsOfExperience?: number | null;
}

interface Candidate {
  id: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  headline: string | null;
  summary: string | null;
  location: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  avatarUrl: string | null;
  resumeUrl: string | null;
  cvParsed: boolean;
  targetJobRole: string | null;
  preferredJobTypes: string[];
  workMode: string | null;
  shiftType: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  user?: {
    email: string | null;
  };
  experiences?: Experience[];
  education?: Education[];
  languages?: Language[];
  skills?: Skill[];
}

interface CandidateProfileFormProps {
  candidate: Candidate;
}

const PROFICIENCY_LEVELS = [
  { value: "BASIC", label: "Basic" },
  { value: "CONVERSATIONAL", label: "Conversational" },
  { value: "FLUENT", label: "Fluent" },
  { value: "NATIVE", label: "Native" },
];

const SKILL_LEVELS = [
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
  { value: "EXPERT", label: "Expert" },
];

const WORK_MODES = [
  { value: "ONSITE", label: "On-site" },
  { value: "REMOTE", label: "Remote" },
  { value: "HYBRID", label: "Hybrid" },
];

const SHIFT_TYPES = [
  { value: "DAY", label: "Day Shift" },
  { value: "NIGHT", label: "Night Shift" },
  { value: "FLEXIBLE", label: "Flexible" },
  { value: "ROTATION", label: "Rotation" },
];

const GENDER_OPTIONS = [
  { value: "male", label: "male" },
  { value: "female", label: "female" },
  { value: "Prefer not to say", label: "Prefer not to say" },
];

const TUNISIA_GOVERNORATES = [
  "Ariana", "Beja", "Ben Arous", "Bizerte", "Gabes", "Gafsa", "Jendouba", "Kairouan",
  "Kasserine", "Kebili", "Kef", "Mahdia", "Manouba", "Medenine", "Monastir", "Nabeul",
  "Sfax", "Sidi Bouzid", "Siliana", "Sousse", "Tunis", "Tataouine", "Tozeur", "Zaghouan"
];

const validatePhone = (phone: string): string | null => {
  if (!phone) return null;
  
  const cleaned = phone.replace(/\s/g, "");
  
  if (/^\+216/.test(phone)) {
    if (!/^\+216\d{8}$/.test(cleaned)) {
      return "Phone must be +216 followed by 8 digits (e.g., +216 11 222 333)";
    }
  } else {
    if (!/^\d{8}$/.test(cleaned)) {
      return "Phone must be 8 digits (e.g., 11 222 333)";
    }
  }
  return null;
};

const formatPhoneNumber = (phone: string): string => {
  let digits = phone.replace(/\D/g, "");
  
  if (digits.length === 0) return "";
  if (digits.length > 8) digits = digits.slice(0, 8);
  
  const formatted = `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)}`.trim();
  return `+216 ${formatted}`;
};

const validateSummary = (summary: string): string | null => {
  if (!summary) return null;
  if (summary.length < 15) {
    return "Summary must be at least 15 characters";
  }
  return null;
};

const JOB_TYPES = [
  { value: "FULL_TIME", label: "Full-time" },
  { value: "PART_TIME", label: "Part-time" },
  { value: "CDI", label: "CDI" },
  { value: "CIVP", label: "CIVP" },
  { value: "KARAMA", label: "Karama" },
  { value: "FREELANCE", label: "Freelance" },
];

export function CandidateProfileForm({ candidate }: CandidateProfileFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "personal");

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams, activeTab]);

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ phone?: string; summary?: string }>({});
  const [locationQuery, setLocationQuery] = useState("");
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const filteredGovernorates = TUNISIA_GOVERNORATES.filter(g => 
    g.toLowerCase().includes(locationQuery.toLowerCase())
  );
  const cvInputRef = useRef<HTMLInputElement>(null);
  const locationInputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showLocationDropdown && locationInputRef.current && !locationInputRef.current.contains(e.target as Node)) {
        setShowLocationDropdown(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showLocationDropdown]);


  const [personalData, setPersonalData] = useState({
    firstName: candidate.firstName ?? "",
    lastName: candidate.lastName ?? "",
    headline: candidate.headline ?? "",
    summary: candidate.summary ?? "",
    location: candidate.location ?? "",
    phone: candidate.phone ?? "",
    linkedinUrl: candidate.linkedinUrl ?? "",
    avatarUrl: candidate.avatarUrl ?? "",
    targetJobRole: candidate.targetJobRole ?? null,
    dateOfBirth: candidate.dateOfBirth ? new Date(candidate.dateOfBirth).toISOString().slice(0, 10) : "",
    gender: candidate.gender ?? null,
  });

  const [preferencesData, setPreferencesData] = useState({
    workMode: candidate.workMode ?? null,
    shiftType: candidate.shiftType ?? null,
    preferredJobTypes: candidate.preferredJobTypes ?? [],
  });

  const [experiences, setExperiences] = useState<Experience[]>(
    candidate.experiences?.length ? candidate.experiences.map(e => ({
      id: e.id ?? undefined,
      company: e.company ?? "",
      title: e.title ?? "",
      location: e.location ?? "",
      startDate: e.startDate ? new Date(e.startDate).toISOString().slice(0, 7) : "",
      endDate: e.endDate ? new Date(e.endDate).toISOString().slice(0, 7) : "",
      isCurrent: e.isCurrent ?? false,
      description: e.description ?? "",
    })) : [{
      company: "",
      title: "",
      location: "",
      startDate: "",
      endDate: "",
      isCurrent: false,
      description: "",
    }]
  );

  const [education, setEducation] = useState<Education[]>(
    candidate.education?.length ? candidate.education.map(e => ({
      id: e.id ?? undefined,
      school: e.school ?? "",
      degree: e.degree ?? "",
      fieldOfStudy: e.fieldOfStudy ?? "",
      startDate: e.startDate ? new Date(e.startDate).toISOString().slice(0, 7) : "",
      endDate: e.endDate ? new Date(e.endDate).toISOString().slice(0, 7) : "",
      isCurrent: e.isCurrent ?? false,
      description: e.description ?? "",
    })) : [{
      school: "",
      degree: "",
      fieldOfStudy: "",
      startDate: "",
      endDate: "",
      isCurrent: false,
      description: "",
    }]
  );

  const [languages, setLanguages] = useState<Language[]>(
    candidate.languages?.length ? candidate.languages.map(l => ({
      id: l.id ?? undefined,
      name: l.name ?? "",
      proficiency: l.proficiency ?? "BASIC",
    })) : [{ name: "", proficiency: "BASIC" }]
  );

  const [skills, setSkills] = useState<Skill[]>(
    candidate.skills?.length ? candidate.skills.map(s => ({
      id: s.id ?? undefined,
      name: s.name ?? "",
      level: s.level ?? "INTERMEDIATE",
    })) : [{ name: "", level: "INTERMEDIATE" }]
  );

  const handlePersonalChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setPersonalData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhoneBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPersonalData(prev => ({ ...prev, phone: formatted }));
  };

  const handleLocationSelect = (location: string) => {
    setPersonalData(prev => ({ ...prev, location }));
    setLocationQuery("");
    setShowLocationDropdown(false);
  };

  const handleLocationInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPersonalData(prev => ({ ...prev, location: value }));
    setLocationQuery(value);
    setShowLocationDropdown(value.length > 0);
  };

  const handlePreferencesChange = (name: string, value: string) => {
    setPreferencesData(prev => ({ ...prev, [name]: value }));
  };

  const toggleJobType = (type: string) => {
    setPreferencesData(prev => ({
      ...prev,
      preferredJobTypes: prev.preferredJobTypes.includes(type)
        ? prev.preferredJobTypes.filter((t) => t !== type)
        : [...prev.preferredJobTypes, type],
    }));
  };

  const addExperience = () => {
    setExperiences(prev => [...prev, {
      company: "",
      title: "",
      location: "",
      startDate: "",
      endDate: "",
      isCurrent: false,
      description: "",
    }]);
  };

  const removeExperience = (index: number) => {
    setExperiences(prev => prev.filter((_, i) => i !== index));
  };

  const updateExperience = (index: number, field: keyof Experience, value: string | boolean) => {
    setExperiences(prev => prev.map((exp, i) => 
      i === index ? { ...exp, [field]: value } : exp
    ));
  };

  const addEducation = () => {
    setEducation(prev => [...prev, {
      school: "",
      degree: "",
      fieldOfStudy: "",
      startDate: "",
      endDate: "",
      isCurrent: false,
      description: "",
    }]);
  };

  const removeEducation = (index: number) => {
    setEducation(prev => prev.filter((_, i) => i !== index));
  };

  const updateEducation = (index: number, field: keyof Education, value: string) => {
    setEducation(prev => prev.map((edu, i) => 
      i === index ? { ...edu, [field]: value } : edu
    ));
  };

  const addLanguage = () => {
    setLanguages(prev => [...prev, { name: "", proficiency: "BASIC" }]);
  };

  const removeLanguage = (index: number) => {
    setLanguages(prev => prev.filter((_, i) => i !== index));
  };

  const updateLanguage = (index: number, field: keyof Language, value: string) => {
    setLanguages(prev => prev.map((lang, i) => 
      i === index ? { ...lang, [field]: value } : lang
    ));
  };

  const addSkill = () => {
    setSkills(prev => [...prev, { name: "", level: "INTERMEDIATE" }]);
  };

  const removeSkill = (index: number) => {
    setSkills(prev => prev.filter((_, i) => i !== index));
  };

  const updateSkill = (index: number, field: keyof Skill, value: string) => {
    setSkills(prev => prev.map((skill, i) => 
      i === index ? { ...skill, [field]: value } : skill
    ));
  };
  const handleCVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedTypes.includes(file.type)) {
      setError("Please upload a PDF or Word document");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("File size must be less than 5MB");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch("/api/upload?type=cv", {
        method: "POST",
        body: formData,
      });

      const data = await uploadResponse.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to upload CV");
      }

      const url = data.data?.url;

      await fetch(`/api/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeUrl: url }),
      });

      setSuccess("CV uploaded successfully!");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to upload CV");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setFieldErrors({});

    const phoneError = validatePhone(personalData.phone);
    const summaryError = validateSummary(personalData.summary);

    if (phoneError || summaryError) {
      setFieldErrors({ phone: phoneError || undefined, summary: summaryError || undefined });
      if (phoneError) setError(phoneError);
      if (summaryError) setError(summaryError);
      return;
    }

    setIsSaving(true);

    try {
      const validExperiences = experiences.filter(exp => exp.company && exp.title);
      const validEducation = education.filter(edu => edu.school && edu.degree);
      const validLanguages = languages.filter(lang => lang.name);
      const validSkills = skills.filter(skill => skill.name);

      const transformedEducation = validEducation.map(edu => ({
        id: edu.id,
        institution: edu.school,
        degree: edu.degree,
        field: edu.fieldOfStudy,
        startDate: edu.startDate,
        endDate: edu.endDate || null,
      }));

      const transformedLanguages = validLanguages.map(lang => ({
        id: lang.id,
        name: lang.name,
        level: lang.proficiency || "BASIC",
      }));

      const response = await fetch(`/api/profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...personalData,
          ...preferencesData,
          experiences: validExperiences,
          education: transformedEducation,
          languages: transformedLanguages,
          skills: validSkills,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update profile");
      }

      setSuccess("Profile updated successfully!");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 mb-6">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-green-50 p-4 text-sm text-green-600 mb-6">
          {success}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6 lg:grid-cols-6 bg-gray-100">
          <TabsTrigger value="personal" className="text-xs sm:text-sm">Personal</TabsTrigger>
          <TabsTrigger value="experience" className="text-xs sm:text-sm">Experience</TabsTrigger>
          <TabsTrigger value="education" className="text-xs sm:text-sm">Education</TabsTrigger>
          <TabsTrigger value="languages" className="text-xs sm:text-sm">Languages</TabsTrigger>
          <TabsTrigger value="skills" className="text-xs sm:text-sm">Skills</TabsTrigger>
          <TabsTrigger value="preferences" className="text-xs sm:text-sm">Preferences</TabsTrigger>
        </TabsList>

        {/* Personal Information Tab */}
        <TabsContent value="personal">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar Upload */}
              <CroppableImageUpload
                value={personalData.avatarUrl}
                onChange={(url) => setPersonalData((prev) => ({ ...prev, avatarUrl: url || "" }))}
                type="avatar"
                label="Profile Photo"
                maxSize="2MB"
                previewClassName="w-24 h-24 rounded-full"
              />

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" name="firstName" value={personalData.firstName} onChange={handlePersonalChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" name="lastName" value={personalData.lastName} onChange={handlePersonalChange} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="headline">Professional Headline</Label>
                <Input id="headline" name="headline" value={personalData.headline} onChange={handlePersonalChange} placeholder="e.g., Call Center Agent" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="summary">Summary</Label>
                <Textarea id="summary" name="summary" value={personalData.summary} onChange={handlePersonalChange} rows={4} />
                {fieldErrors.summary && (
                  <p className="text-sm text-red-500">{fieldErrors.summary}</p>
                )}
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="location">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Location
                  </Label>
<div className="relative" ref={locationInputRef}>
                    <Input 
                      id="location" 
                      name="location" 
                      value={personalData.location} 
                      onChange={handleLocationInputChange}
                      onFocus={() => locationQuery.length > 0 && setShowLocationDropdown(true)}
                      placeholder="Search governorate..." 
                      autoComplete="off"
                    />
                    {showLocationDropdown && filteredGovernorates.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 max-h-60 overflow-auto rounded-md border bg-white shadow-lg">
                        {filteredGovernorates.map((gov) => (
                          <div
                            key={gov}
                            onClick={() => handleLocationSelect(gov)}
                            className="cursor-pointer px-3 py-2 hover:bg-gray-100"
                          >
                            {gov}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">
                    <Phone className="w-4 h-4 inline mr-1" />
                    Phone
                  </Label>
                  <Input id="phone" name="phone" type="tel" value={personalData.phone} onChange={handlePersonalChange} onBlur={handlePhoneBlur} placeholder="+216 12 345 678" />
                  {fieldErrors.phone && (
                    <p className="text-sm text-red-500">{fieldErrors.phone}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="linkedinUrl">
                  <Linkedin className="w-4 h-4 inline mr-1" />
                  LinkedIn URL
                </Label>
                <Input id="linkedinUrl" name="linkedinUrl" type="url" value={personalData.linkedinUrl} onChange={handlePersonalChange} placeholder="https://linkedin.com/in/yourprofile" />
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Date of Birth
                  </Label>
                  <Input id="dateOfBirth" name="dateOfBirth" type="date" value={personalData.dateOfBirth} onChange={handlePersonalChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select value={personalData.gender || undefined} onValueChange={(value) => setPersonalData(prev => ({ ...prev, gender: value }))}>
                    <SelectTrigger id="gender">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map((g) => (
                        <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* CV Upload */}
              <div className="space-y-2">
                <Label>Resume / CV</Label>
                <div className="flex items-center gap-4">
                  <label htmlFor="cv-upload" className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    <input id="cv-upload" ref={cvInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleCVUpload} disabled={isUploading} />
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {isUploading ? "Uploading..." : "Upload CV"}
                  </label>
                  <span className="text-sm text-gray-500">PDF or Word (max 5MB)</span>
                </div>
                {candidate.resumeUrl && (
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-green-600">Current CV uploaded</p>
                    <a 
                      href={candidate.resumeUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                    >
                      <Eye className="h-4 w-4" />
                      View CV
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Experience Tab */}
        <TabsContent value="experience">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Work Experience
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {experiences.map((exp, index) => (
                <div key={index} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-medium">Experience {index + 1}</h4>
                    {experiences.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeExperience(index)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Job Title *</Label>
                      <Input value={exp.title || ''} onChange={(e) => updateExperience(index, 'title', e.target.value)} placeholder="Software Engineer" />
                    </div>
                    <div className="space-y-2">
                      <Label>Company *</Label>
                      <Input value={exp.company || ''} onChange={(e) => updateExperience(index, 'company', e.target.value)} placeholder="Tech Corp" />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 mt-4">
                    <div className="space-y-2">
                      <Label>Location</Label>
                      <Input value={exp.location || ''} onChange={(e) => updateExperience(index, 'location', e.target.value)} placeholder="Paris, France" />
                    </div>
                    <div className="space-y-2 flex items-center">
                      <Label className="flex items-center gap-2">
                        <input type="checkbox" checked={exp.isCurrent} onChange={(e) => updateExperience(index, 'isCurrent', e.target.checked)} className="rounded" />
                        Currently working here
                      </Label>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 mt-4">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input type="month" value={exp.startDate as string || ''} onChange={(e) => updateExperience(index, 'startDate', e.target.value)} />
                    </div>
                    {!exp.isCurrent && (
                      <div className="space-y-2">
                        <Label>End Date</Label>
                        <Input type="month" value={(exp.endDate as string) || ''} onChange={(e) => updateExperience(index, 'endDate', e.target.value)} />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 mt-4">
                    <Label>Description</Label>
                    <Textarea value={exp.description || ''} onChange={(e) => updateExperience(index, 'description', e.target.value)} rows={3} />
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addExperience} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Experience
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Education Tab */}
        <TabsContent value="education">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Education
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {education.map((edu, index) => (
                <div key={index} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-medium">Education {index + 1}</h4>
                    {education.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeEducation(index)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>School/University *</Label>
                      <Input value={edu.school || ''} onChange={(e) => updateEducation(index, 'school', e.target.value)} placeholder="Harvard University" />
                    </div>
                    <div className="space-y-2">
                      <Label>Degree *</Label>
                      <Input value={edu.degree || ''} onChange={(e) => updateEducation(index, 'degree', e.target.value)} placeholder="Bachelor of Science" />
                    </div>
                  </div>
                  <div className="space-y-2 mt-4">
                    <Label>Field of Study</Label>
                    <Input value={edu.fieldOfStudy || ''} onChange={(e) => updateEducation(index, 'fieldOfStudy', e.target.value)} placeholder="Computer Science" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 mt-4">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input type="month" value={edu.startDate as string || ''} onChange={(e) => updateEducation(index, 'startDate', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input type="month" value={edu.endDate as string || ''} onChange={(e) => updateEducation(index, 'endDate', e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addEducation} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Education
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Languages Tab */}
        <TabsContent value="languages">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Languages className="h-5 w-5" />
                Languages
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {languages.map((lang, index) => (
                  <div key={index} className="flex gap-4 items-end">
                    <div className="flex-1 space-y-2">
                      <Label>Language</Label>
                      <Input value={lang.name || ''} onChange={(e) => updateLanguage(index, 'name', e.target.value)} placeholder="English" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label>Proficiency</Label>
                      <Select value={lang.proficiency || ''} onValueChange={(value) => updateLanguage(index, 'proficiency', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROFICIENCY_LEVELS.map(level => (
                            <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {languages.length > 1 && (
                      <Button type="button" variant="ghost" onClick={() => removeLanguage(index)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" onClick={addLanguage} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Language
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Skills Tab */}
        <TabsContent value="skills">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Skills
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {skills.map((skill, index) => (
                  <div key={index} className="flex gap-4 items-end">
                    <div className="flex-1 space-y-2">
                      <Label>Skill</Label>
                      <Input value={skill.name || ''} onChange={(e) => updateSkill(index, 'name', e.target.value)} placeholder="React, Python, Project Management..." />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label>Level</Label>
                      <Select value={skill.level || ''} onValueChange={(value) => updateSkill(index, 'level', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SKILL_LEVELS.map(level => (
                            <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {skills.length > 1 && (
                      <Button type="button" variant="ghost" onClick={() => removeSkill(index)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" onClick={addSkill} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Skill
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Job Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-3">Work Mode</Label>
                <div className="grid grid-cols-3 gap-3">
                  {WORK_MODES.map((mode) => (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => handlePreferencesChange("workMode", mode.value)}
                      className={`p-3 rounded-lg border-2 transition-colors ${preferencesData.workMode === mode.value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}
                    >
                      <div className="text-sm font-medium text-gray-900">{mode.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-3">Shift Type</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {SHIFT_TYPES.map((shift) => (
                    <button
                      key={shift.value}
                      type="button"
                      onClick={() => handlePreferencesChange("shiftType", shift.value)}
                      className={`p-3 rounded-lg border-2 transition-colors ${preferencesData.shiftType === shift.value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}
                    >
                      <div className="text-sm font-medium text-gray-900">{shift.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-3">Job Type</Label>
                <div className="flex flex-wrap gap-2">
                  {JOB_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => toggleJobType(type.value)}
                      className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${preferencesData.preferredJobTypes.includes(type.value) ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-300 text-gray-700"}`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Submit Button */}
      <div className="flex justify-end pt-6">
        <Button type="submit" disabled={isSaving} className="gap-2 bg-[#071738] hover:bg-[#0d224d]">
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save All Changes
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
