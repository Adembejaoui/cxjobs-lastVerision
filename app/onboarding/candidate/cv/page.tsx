"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/auth/user-provider";
import { JOB_ROLES } from "@/lib/job-role-config";
import { logger } from "@/lib/logger";

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

export default function CVOnboardingPage() {
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
  
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvParsing, setCvParsing] = useState(false);
  const [cvUploadDragging, setCvUploadDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleCVFileSelect = (file: File) => {
    if (file.type !== "application/pdf") {
      setError("Only PDF files are supported. Please upload your CV in PDF format.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File size exceeds the maximum limit of 5MB.");
      return;
    }
    setCvFile(file);
    setError(null);
  };

  const handleCVDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setCvUploadDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleCVFileSelect(file);
    }
  };

  const handleCVUpload = async () => {
    if (!cvFile) return;

    setCvParsing(true);
    setError(null);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append("cv", cvFile);

      const res = await fetch("/api/onboarding/cv-parse", {
        method: "POST",
        body: uploadFormData,
      });

      const data = await res.json();

      if (data.success && data.data) {
        const parsed = data.data;

        let firstName = "";
        let lastName = "";
        if (parsed.name) {
          const nameParts = parsed.name.split(" ");
          firstName = nameParts[0] || "";
          lastName = nameParts.slice(1).join(" ") || "";
        } else if (parsed.firstName) {
          firstName = parsed.firstName;
          lastName = parsed.lastName || "";
        }

        let uploadedResumeUrl = "";
        try {
          const uploadFormDataCV = new FormData();
          uploadFormDataCV.append("file", cvFile);
          const uploadRes = await fetch("/api/upload?type=cv", {
            method: "POST",
            body: uploadFormDataCV,
          });
          const uploadData = await uploadRes.json();
          if (uploadData.success && uploadData.data?.url) {
            uploadedResumeUrl = uploadData.data.url;
          }
        } catch {
          logger.error("CV upload failed");
        }

        const updatedFormData = {
          firstName: firstName || "",
          lastName: lastName || "",
          email: formData.email || parsed.email || "",
          phone: parsed.phone || "",
          location: parsed.location || "",
          headline: parsed.title || "",
          summary: parsed.summary || "",
          avatarUrl: "",
          resumeUrl: uploadedResumeUrl || "",
          linkedinUrl: "",
          workMode: "",
          shiftType: "",
          preferredJobTypes: [] as string[],
          targetJobRole: "",
          skills: parsed.skills?.map((s: string) => ({ name: s })) || [],
          experiences: parsed.experiences?.map((e: { title: string; company: string; startDate: string; endDate?: string; description?: string }) => ({
            title: e.title || "",
            company: e.company || "",
            location: "",
            startDate: e.startDate || "",
            endDate: e.endDate || "",
            current: false,
            description: e.description || "",
          })) || [],
          education: parsed.education?.map((e: { institution: string; degree: string; field?: string; startDate: string; endDate?: string }) => ({
            institution: e.institution || "",
            degree: e.degree || "",
            field: e.field || "",
            startDate: e.startDate || "",
            endDate: e.endDate || "",
          })) || [],
          languages: parsed.languages?.map((l: { name: string; level?: string }) => ({ name: l.name, level: l.level || "FLUENT" })) || [],
        };

        setFormData(updatedFormData);
        setCurrentStep(1);
      } else {
        setError(data.error || "Failed to parse CV. Please try again or choose manual onboarding.");
      }
    } catch {
      logger.error("CV parsing failed");
      setError("An error occurred while parsing your CV. Please try again.");
    } finally {
      setCvParsing(false);
    }
  };

  const handleSelectRole = (roleId: string) => {
    setFormData((prev) => ({ ...prev, targetJobRole: roleId }));
  };

  const handleSaveAndContinue = async () => {
    if (!formData.targetJobRole) {
      setError("Please select a target role");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const sanitizedData = {
        ...formData,
        targetJobRole: formData.targetJobRole,
        workMode: null,
        shiftType: null,
      };

      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sanitizedData),
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



  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
          {currentStep === 0 ? (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Upload Your CV</h1>
                <p className="text-sm text-gray-600">We&apos;ll extract your information from the PDF</p>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setCvUploadDragging(true);
                }}
                onDragLeave={() => setCvUploadDragging(false)}
                onDrop={handleCVDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  cvUploadDragging
                    ? "border-blue-500 bg-blue-50"
                    : cvFile
                    ? "border-green-500 bg-green-50"
                    : "border-gray-300 hover:border-gray-400"
                }`}
              >
                {cvFile ? (
                  <div className="space-y-3">
                    <div className="text-4xl">📄</div>
                    <div className="font-medium text-gray-900">{cvFile.name}</div>
                    <button
                      type="button"
                      onClick={() => setCvFile(null)}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-4xl">📁</div>
                    <div className="font-medium text-gray-900">Drag & drop your CV here</div>
                    <div className="text-sm text-gray-500">or</div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      Browse Files
                    </button>
                    <div className="text-xs text-gray-500">PDF only, max 5MB</div>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCVFileSelect(file);
                }}
                className="hidden"
              />

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/onboarding/candidate")}
                  className="flex-1 h-12 border-2 border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:border-gray-300 transition-colors"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={handleCVUpload}
                  disabled={!cvFile || cvParsing}
                  className="flex-1 h-12 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {cvParsing ? "Parsing..." : "Continue"}
                </button>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Choose Your Target Role</h1>
                <p className="text-sm text-gray-600">Select the type of job you&apos;re looking for</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/onboarding/candidate")}
                  className="flex-1 h-12 border-2 border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:border-gray-300 transition-colors"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndContinue}
                  disabled={saving || !formData.targetJobRole}
                  className="flex-1 h-12 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? "Saving..." : "Complete"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto mt-6">
        <button
          type="button"
          onClick={() => router.push("/onboarding/candidate/manual")}
          className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          Or fill manually instead →
        </button>
      </div>
    </div>
  );
}