"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Wand2, CheckCircle, FileText, AlertCircle } from "lucide-react";

interface ParsedData {
  name?: string;  // AI returns 'name' instead of firstName/lastName
  firstName?: string;
  lastName?: string;
  title?: string;  // AI returns 'title' for headline
  headline?: string;
  summary?: string;
  location?: string;
  phone?: string;
  email?: string;
  linkedinUrl?: string;
  experiences?: Array<{
    company: string;
    title: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    isCurrent?: boolean;
    description?: string;
  }>;
  education?: Array<{
    institution: string;  // AI returns 'institution', not 'school'
    degree: string;
    field?: string;
    startDate?: string;
    endDate?: string;
  }>;
  languages?: Array<{ name: string; level?: string }>;  // AI returns objects
  skills?: string[];
}

interface AIAutofillModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDataExtracted: (data: ParsedData) => void;
}

type Step = "upload" | "parsing" | "review" | "success";

export function AIAutofillModal({ open, onOpenChange, onDataExtracted }: AIAutofillModalProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<Step>("upload");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [cvUrl, setCvUrl] = useState<string | null>(null);

  const resetModal = () => {
    setStep("upload");
    setIsUploading(false);
    setError(null);
    setParsedData(null);
    setUploadedFile(null);
    setCvUrl(null);
  };

  const handleClose = () => {
    resetModal();
    onOpenChange(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedTypes.includes(file.type)) {
      setError("Please upload a PDF or Word document");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("File size must be less than 5MB");
      return;
    }

    setUploadedFile(file);
    setError(null);

    // Start upload and parsing process
    await processFile(file);
  };

  const processFile = async (file: File) => {
    setIsUploading(true);
    setStep("parsing");

    try {
      // Upload file first
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch("/api/upload?type=cv", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        const data = await uploadResponse.json();
        throw new Error(data.error || "Failed to upload file");
      }

      const uploadData = await uploadResponse.json();
      const fileUrl = uploadData.data?.url;
      setCvUrl(fileUrl);
      
      if (!fileUrl) {
        throw new Error("Failed to get file URL from upload response");
      }
      
      if (!uploadedFile) {
        throw new Error("No file selected");
      }
      
      setIsUploading(true);

      // Create FormData with the file
      const parseFormData = new FormData();
      parseFormData.append("cv", uploadedFile);
      parseFormData.append("language", "en");
      parseFormData.append("useAI", "true");

      // Parse with AI - don't set Content-Type, let browser set multipart/form-data
      const parseResponse = await fetch("/api/onboarding/cv-parse", {
        method: "POST",
        body: parseFormData,
      });

      if (!parseResponse.ok) {
        const errorData = await parseResponse.json();
        throw new Error(errorData.error || "Failed to parse CV");
      }

      const parseResult = await parseResponse.json();
      
      if (parseResult.success && parseResult.data) {
        setParsedData(parseResult.data);
        setStep("review");
      } else {
        throw new Error("Could not extract data from CV");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred while processing your CV");
      setStep("upload");
    } finally {
      setIsUploading(false);
    }
  };

  const handleApplyData = async () => {
    if (!parsedData) return;

    try {
      // Transform AI output to match API schema
      // Skills: AI returns strings, API expects objects with name property
      const transformedData = {
        resumeUrl: cvUrl,
        firstName: parsedData.firstName || (parsedData.name ? parsedData.name.split(' ')[0] : undefined),
        lastName: parsedData.lastName || (parsedData.name ? parsedData.name.split(' ').slice(1).join(' ') : undefined),
        headline: parsedData.title,
        summary: parsedData.summary,
        location: parsedData.location,
        phone: parsedData.phone,
        email: parsedData.email,
        skills: parsedData.skills?.map((skill: string) => ({ name: skill })) ?? [],
        experiences: parsedData.experiences?.map((exp: Record<string, unknown>) => ({
          title: exp.title || "",
          company: exp.company || "",
          startDate: exp.startDate || "",
          endDate: (exp.endDate === null || exp.endDate === "null" || exp.endDate === "") 
            ? null 
            : exp.endDate,
          isCurrent: exp.endDate === null || exp.endDate === "null" || exp.endDate === "",
        })) ?? [],
        education: parsedData.education?.map((edu: Record<string, unknown>) => ({
          institution: edu.institution || "",
          degree: edu.degree || "",
          field: edu.field || "",
          startDate: edu.startDate || "",
          endDate: (edu.endDate === null || edu.endDate === "null" || edu.endDate === "") 
            ? null 
            : edu.endDate,
        })) ?? [],
        languages: parsedData.languages?.map((lang: Record<string, unknown>) => ({
          name: lang.name || "",
          level: lang.level || "",
        })) ?? [],
      };

      // Save the parsed data using POST (upsert)
      const response = await fetch(`/api/profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(transformedData),
      });

      if (!response.ok) {
        throw new Error("Failed to save profile data");
      }

      // Pass data to parent component
      onDataExtracted(parsedData);
      setStep("success");
      
      // Close modal after success
      setTimeout(() => {
        handleClose();
        router.refresh();
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save data");
    }
  };

  const handleTryAgain = () => {
    resetModal();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-purple-500" />
            AI Auto-Fill Profile
          </DialogTitle>
          <DialogDescription>
            Upload your CV and let AI extract your information automatically
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {/* Error Message */}
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* Upload Step */}
          {step === "upload" && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-purple-100">
                <Upload className="h-10 w-10 text-purple-500" />
              </div>
              <h3 className="mb-2 text-lg font-medium">Upload Your CV</h3>
              <p className="mb-4 text-center text-sm text-slate-500">
                Drag and drop or click to upload your CV
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Upload className="mr-2 h-4 w-4" />
                Choose File
              </Button>
              <p className="mt-2 text-xs text-slate-400">PDF or Word document (max 5MB)</p>
            </div>
          )}

          {/* Parsing Step */}
          {(step === "parsing") && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="mb-4 relative">
                <Loader2 className="h-20 w-20 animate-spin text-purple-500" />
                <Wand2 className="absolute inset-0 m-auto h-8 w-8 text-purple-700" />
              </div>
              <h3 className="mb-2 text-lg font-medium">
                {isUploading ? "Uploading..." : "Extracting Information..."}
              </h3>
              <p className="text-center text-sm text-slate-500">
                {isUploading 
                  ? "Please wait while we upload your CV"
                  : "Our AI is analyzing your CV to extract your information"
                }
              </p>
              {uploadedFile && (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
                  <FileText className="h-4 w-4 text-slate-500" />
                  <span className="text-sm text-slate-600">{uploadedFile.name}</span>
                </div>
              )}
            </div>
          )}

          {/* Review Step */}
          {step === "review" && parsedData && (
            <div className="max-h-[400px] overflow-y-auto">
              <h3 className="mb-4 text-lg font-medium">Extracted Information</h3>
              
              <div className="space-y-4">
                {/* Personal Info */}
                <div className="rounded-lg border border-slate-200 p-3">
                  <h4 className="mb-2 text-sm font-medium text-slate-700">Personal Information</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {parsedData.firstName && (
                      <div>
                        <span className="text-slate-500">First Name:</span>
                        <p className="font-medium">{parsedData.firstName}</p>
                      </div>
                    )}
                    {parsedData.lastName && (
                      <div>
                        <span className="text-slate-500">Last Name:</span>
                        <p className="font-medium">{parsedData.lastName}</p>
                      </div>
                    )}
                    {parsedData.headline && (
                      <div className="col-span-2">
                        <span className="text-slate-500">Headline:</span>
                        <p className="font-medium">{parsedData.headline}</p>
                      </div>
                    )}
                    {parsedData.location && (
                      <div>
                        <span className="text-slate-500">Location:</span>
                        <p className="font-medium">{parsedData.location}</p>
                      </div>
                    )}
                    {parsedData.phone && (
                      <div>
                        <span className="text-slate-500">Phone:</span>
                        <p className="font-medium">{parsedData.phone}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Summary */}
                {parsedData.summary && (
                  <div className="rounded-lg border border-slate-200 p-3">
                    <h4 className="mb-2 text-sm font-medium text-slate-700">Summary</h4>
                    <p className="text-sm text-slate-600 line-clamp-3">{parsedData.summary}</p>
                  </div>
                )}

                {/* Experience */}
                {parsedData.experiences && parsedData.experiences.length > 0 && (
                  <div className="rounded-lg border border-slate-200 p-3">
                    <h4 className="mb-2 text-sm font-medium text-slate-700">
                      Experience ({parsedData.experiences.length})
                    </h4>
                    <div className="space-y-2">
                      {parsedData.experiences.slice(0, 3).map((exp, i) => (
                        <div key={i} className="text-sm">
                          <p className="font-medium">{exp.title}</p>
                          <p className="text-slate-500">{exp.company}</p>
                        </div>
                      ))}
                      {parsedData.experiences.length > 3 && (
                        <p className="text-xs text-slate-400">+{parsedData.experiences.length - 3} more</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Education */}
                {parsedData.education && parsedData.education.length > 0 && (
                  <div className="rounded-lg border border-slate-200 p-3">
                    <h4 className="mb-2 text-sm font-medium text-slate-700">
                      Education ({parsedData.education.length})
                    </h4>
                    <div className="space-y-2">
                      {parsedData.education.slice(0, 2).map((edu, i) => (
                        <div key={i} className="text-sm">
                          <p className="font-medium">{edu.degree}</p>
                          <p className="text-slate-500">{edu.institution}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Skills */}
                {parsedData.skills && parsedData.skills.length > 0 && (
                  <div className="rounded-lg border border-slate-200 p-3">
                    <h4 className="mb-2 text-sm font-medium text-slate-700">
                      Skills ({parsedData.skills.length})
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {parsedData.skills.slice(0, 10).map((skill, i) => (
                        <span key={i} className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
                          {skill}
                        </span>
                      ))}
                      {parsedData.skills.length > 10 && (
                        <span className="text-xs text-slate-400">+{parsedData.skills.length - 10} more</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Languages */}
                {parsedData.languages && parsedData.languages.length > 0 && (
                  <div className="rounded-lg border border-slate-200 p-3">
                    <h4 className="mb-2 text-sm font-medium text-slate-700">
                      Languages ({parsedData.languages.length})
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {parsedData.languages.map((lang, i) => (
                        <span key={i} className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                          {lang.name}{lang.level && ` (${lang.level})`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Success Step */}
          {step === "success" && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-10 w-10 text-green-500" />
              </div>
              <h3 className="mb-2 text-lg font-medium text-green-600">Profile Updated!</h3>
              <p className="text-center text-sm text-slate-500">
                Your profile has been automatically filled with the extracted information.
              </p>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}
          
          {step === "review" && (
            <>
              <Button variant="outline" onClick={handleTryAgain}>
                Try Again
              </Button>
              <Button onClick={handleApplyData} className="bg-purple-600 hover:bg-purple-700">
                Apply to Profile
              </Button>
            </>
          )}

          {step === "success" && (
            <Button onClick={handleClose}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
