"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function CompanyOnboardingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    website: "",
    industry: "",
    companySize: "",
    location: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      // Check if already onboarded
      fetch("/api/profile")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data.company && data.data.isOnboarded) {
            // Already completed onboarding, redirect to dashboard
            router.push("/dashboard");
          } else {
            setLoading(false);
          }
        })
        .catch(() => setLoading(false));
    }
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        router.push("/dashboard");
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
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FB]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2563EB]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-[16px] shadow-sm border border-[#E5E7EB] p-8">
          <h1 className="text-[28px] font-bold text-[#111827] mb-2">
            Set Up Your Company
          </h1>
          <p className="text-[14px] text-[#6B7280] mb-8">
            Create your company profile to start posting jobs
          </p>

          {error && (
            <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-[14px] px-4 py-3 rounded-[8px] mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[14px] font-medium text-[#374151] mb-1.5">
                Company Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    name,
                    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
                  }));
                }}
                placeholder="e.g., Tech Solutions Tunisia"
                className="w-full h-[48px] px-4 rounded-[8px] border border-[#D1D5DB] bg-white text-[#111827] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-[14px] font-medium text-[#374151] mb-1.5">
                Company URL Slug *
              </label>
              <input
                type="text"
                required
                value={formData.slug}
                onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
                placeholder="e.g., tech-solutions-tunisia"
                className="w-full h-[48px] px-4 rounded-[8px] border border-[#D1D5DB] bg-white text-[#111827] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
              />
              <p className="text-[12px] text-[#6B7280] mt-1">
                This will be your company page URL: /companies/{formData.slug || "your-slug"}
              </p>
            </div>

            <div>
              <label className="block text-[14px] font-medium text-[#374151] mb-1.5">
                Description *
              </label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Tell candidates about your company..."
                rows={4}
                className="w-full px-4 py-3 rounded-[8px] border border-[#D1D5DB] bg-white text-[#111827] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-[14px] font-medium text-[#374151] mb-1.5">
                Website
              </label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => setFormData((prev) => ({ ...prev, website: e.target.value }))}
                placeholder="e.g., https://example.com"
                className="w-full h-[48px] px-4 rounded-[8px] border border-[#D1D5DB] bg-white text-[#111827] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[14px] font-medium text-[#374151] mb-1.5">
                  Industry *
                </label>
                <select
                  required
                  value={formData.industry}
                  onChange={(e) => setFormData((prev) => ({ ...prev, industry: e.target.value }))}
                  className="w-full h-[48px] px-4 rounded-[8px] border border-[#D1D5DB] bg-white text-[#111827] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                >
                  <option value="">Select industry</option>
                  <option value="Call Center">Call Center</option>
                  <option value="Customer Service">Customer Service</option>
                  <option value="Telecommunications">Telecommunications</option>
                  <option value="Technology">Technology</option>
                  <option value="Finance">Finance</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Retail">Retail</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[14px] font-medium text-[#374151] mb-1.5">
                  Company Size *
                </label>
                <select
                  required
                  value={formData.companySize}
                  onChange={(e) => setFormData((prev) => ({ ...prev, companySize: e.target.value }))}
                  className="w-full h-[48px] px-4 rounded-[8px] border border-[#D1D5DB] bg-white text-[#111827] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                >
                  <option value="">Select size</option>
                  <option value="STARTUP">1-10 employees</option>
                  <option value="SMALL">11-50 employees</option>
                  <option value="MEDIUM">51-200 employees</option>
                  <option value="LARGE">201-1000 employees</option>
                  <option value="ENTERPRISE">1000+ employees</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[14px] font-medium text-[#374151] mb-1.5">
                Location *
              </label>
              <input
                type="text"
                required
                value={formData.location}
                onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                placeholder="e.g., Tunis, Tunisia"
                className="w-full h-[48px] px-4 rounded-[8px] border border-[#D1D5DB] bg-white text-[#111827] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full h-[48px] bg-[#2563EB] text-white font-medium text-[16px] rounded-[8px] hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Creating..." : "Create Company Profile"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
