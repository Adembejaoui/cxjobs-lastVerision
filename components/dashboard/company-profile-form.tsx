"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Globe,
  Linkedin,
  Save,
  Loader2,
  Twitter,
  Facebook,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle2,
  Users,
  MapPin,
  Calendar,
  FileText,
  Sparkles,
} from "lucide-react";
import { CroppableImageUpload } from "@/components/dashboard/croppable-image-upload";
import { CultureEditor } from "@/components/dashboard/culture-editor";
import { CompanyBenefitsEditor, BenefitItem } from "@/components/dashboard/company-benefits-editor";
import { logger } from "@/lib/logger";
import { showError, showSuccess } from "@/lib/toast";

interface CultureItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  icon: string;
}

interface CompanyBenefit {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: string;
  scope: string;
}

interface Company {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  website: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  facebookUrl: string | null;
  companySize: string | null;
  location: string | null;
  foundedYear: number | null;
  benefits: CompanyBenefit[];
  culture: string | unknown;
  userId: string;
  isRemoteFriendly: boolean;
  isHybridFriendly: boolean;
}

interface CompanyProfileFormProps {
  company: Company;
}

const COMPANY_SIZES = [
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-1000", label: "201-1000 employees" },
  { value: "1000+", label: "1000+ employees" },
];

const LOCATIONS = [
  "Tunis",
  "Zaghouan",
  "Ariana",
  "Béja",
  "Ben Arous",
  "Bizerte",
  "Gabès",
  "Gafsa",
  "Jendouba",
  "Kairouan",
  "Kasserine",
  "Kebili",
  "Kef",
  "Mahdia",
  "Manouba",
  "Medenine",
  "Monastir",
  "Nabeul",
  "Sfax",
  "Sidi Bouzid",
  "Siliana",
  "Sousse",
  "Tataouine",
  "Tozeur",
];

// Small reusable section marker used to give each block of the form a
// consistent, quiet identity without wrapping everything in a card.
function SectionIcon({ icon: Icon }: { icon: React.ElementType }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#071738]">
      <Icon className="h-4 w-4 text-white" />
    </div>
  );
}

const pillTriggerClass =
  "rounded-full border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-600 transition-colors data-[state=active]:border-[#071738] data-[state=active]:bg-[#071738] data-[state=active]:text-white data-[state=active]:shadow-none";

export function CompanyProfileForm({ company }: CompanyProfileFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const parseCulture = (): CultureItem[] => {
    if (!company.culture) return [];
    if (typeof company.culture === 'string') {
      try {
        const parsed = JSON.parse(company.culture);
        if (Array.isArray(parsed)) {
           return parsed.map((item: { title?: string; description?: string; imageUrl?: string; icon?: string }, index: number) => ({
            id: `culture-${index}-${Date.now()}`,
            title: item.title || "",
            description: item.description || "",
            imageUrl: item.imageUrl || "",
            icon: item.icon || "",
          }));
        }
      } catch {
        logger.warn("Failed to parse culture data");
      }
    }
    if (Array.isArray(company.culture)) {
      return company.culture.map((item: { title?: string; description?: string; imageUrl?: string; icon?: string }, index: number) => ({
        id: `culture-${index}-${Date.now()}`,
        title: item.title || "",
        description: item.description || "",
        imageUrl: item.imageUrl || "",
        icon: item.icon || "",
      }));
    }
    return [];
  };

  const [formData, setFormData] = useState({
    name: company.name || "",
    description: company.description || "",
    website: company.website || "",
    linkedinUrl: company.linkedinUrl || "",
    twitterUrl: company.twitterUrl || "",
    facebookUrl: company.facebookUrl || "",
    companySize: company.companySize || "",
    location: company.location || "",
    foundedYear: company.foundedYear?.toString() || "",
    logoUrl: company.logoUrl || "",
    coverImageUrl: company.coverImageUrl || "",
    isRemoteFriendly: company.isRemoteFriendly ?? false,
    isHybridFriendly: company.isHybridFriendly ?? false,
  });

  const [cultureItems, setCultureItems] = useState<CultureItem[]>(parseCulture());
  const [benefitItems, setBenefitItems] = useState<BenefitItem[]>(
    (company.benefits || []).map(b => ({
      id: b.id,
      name: b.name,
      description: b.description || '',
      icon: b.icon || 'Heart',
      category: b.category || 'HEALTH',
      scope: b.scope || 'ADDITIONAL'
    }))
  );

  useEffect(() => {
    setCultureItems(parseCulture());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.culture]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (url: string | null) => {
    setFormData((prev) => ({ ...prev, logoUrl: url || "" }));
  };

  const handleCoverChange = (url: string | null) => {
    setFormData((prev) => ({ ...prev, coverImageUrl: url || "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const cultureArray = cultureItems
        .filter((item) => item.title.trim() !== "")
        .map((item) => ({
          title: item.title,
          description: item.description,
          imageUrl: item.imageUrl,
        }));

      const benefitsData = benefitItems
        .filter((b) => b.name.trim().length >= 3)
        .map((b) => ({
          name: b.name,
          description: b.description || null,
          icon: b.icon || null,
          category: b.category || "OTHER",
          scope: b.scope || "ADDITIONAL",
        }));

      const response = await fetch(`/api/profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          slug: company.slug,
          description: formData.description || null,
          website: formData.website || null,
          linkedinUrl: formData.linkedinUrl || null,
          twitterUrl: formData.twitterUrl || null,
          facebookUrl: formData.facebookUrl || null,
          companySize: formData.companySize || null,
          location: formData.location || null,
          foundedYear: formData.foundedYear
            ? parseInt(formData.foundedYear)
            : null,
          isRemoteFriendly: formData.isRemoteFriendly,
          isHybridFriendly: formData.isHybridFriendly,
          benefits: benefitsData,
          logoUrl: formData.logoUrl || null,
          coverImageUrl: formData.coverImageUrl || null,
          culture: cultureArray.length > 0 ? cultureArray : null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update profile");
      }

      setSuccess("Company profile updated successfully!");
      showSuccess("Company profile updated successfully", {
        description: "Your changes have been saved.",
      });
      router.refresh();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to update profile";
      setError(errorMessage);
      showError("Failed to update company profile", {
        description: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const activeBenefitsCount = benefitItems.filter((b) => b.name.trim() !== "").length;
  const activeCultureCount = cultureItems.filter((c) => c.title.trim() !== "").length;

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Company Profile</h1>
        <p className="mt-1 text-sm text-slate-500">This is how candidates will see your company.</p>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-lg bg-red-50 p-4 text-sm text-red-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-6 flex items-start gap-3 rounded-lg bg-green-50 p-4 text-sm text-green-600">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main column: a single flowing document instead of stacked cards */}
        <div>
          <section className="border-b border-slate-200 pb-8">
            <div className="mb-6 flex items-start gap-3">
              <SectionIcon icon={Building2} />
              <div>
                <h2 className="text-base font-semibold text-slate-900">Basic Information</h2>
                <p className="text-sm text-slate-500">Update your company&apos;s basic information</p>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Company Name *</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter company name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companySize" className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-slate-400" />
                  Company Size
                </Label>
                <Select
                  value={formData.companySize}
                  onValueChange={(value) =>
                    handleSelectChange("companySize", value)
                  }
                >
                  <SelectTrigger id="companySize">
                    <SelectValue placeholder="Select company size" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_SIZES.map((size) => (
                      <SelectItem key={size.value} value={size.value}>
                        {size.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location" className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  Location
                </Label>
                <Select
                  value={formData.location}
                  onValueChange={(value) => handleSelectChange("location", value)}
                >
                  <SelectTrigger id="location">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATIONS.map((loc) => (
                      <SelectItem key={loc} value={loc}>
                        {loc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="foundedYear" className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  Founded Year
                </Label>
                <Input
                  id="foundedYear"
                  name="foundedYear"
                  type="number"
                  min="1800"
                  max={new Date().getFullYear()}
                  value={formData.foundedYear}
                  onChange={handleChange}
                  placeholder="e.g. 2015"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="website">Website</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="website"
                    name="website"
                    type="url"
                    value={formData.website}
                    onChange={handleChange}
                    placeholder="https://example.com"
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="border-b border-slate-200 py-8">
            <div className="mb-6 flex items-start gap-3">
              <SectionIcon icon={FileText} />
              <div>
                <h2 className="text-base font-semibold text-slate-900">About Your Company</h2>
                <p className="text-sm text-slate-500">
                  Tell candidates about your company and what makes you unique
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Tell candidates about your company, values, team culture, and what makes you unique..."
                rows={6}
              />
              <p className="text-right text-xs text-slate-500">
                {formData.description.length}/5000 characters
              </p>
            </div>
          </section>

          <section className="pt-8">
            <div className="mb-6 flex items-start gap-3">
              <SectionIcon icon={Sparkles} />
              <div>
                <h2 className="text-base font-semibold text-slate-900">Culture, Benefits &amp; More</h2>
                <p className="text-sm text-slate-500">Round out your profile for candidates</p>
              </div>
            </div>

            <Tabs defaultValue="benefits" className="w-full">
              <TabsList className="mb-6 flex h-auto w-full flex-wrap justify-start gap-2 border-b border-slate-200 bg-transparent p-0 pb-4">
                <TabsTrigger value="benefits" className={pillTriggerClass}>
                  Benefits{activeBenefitsCount > 0 ? ` (${activeBenefitsCount})` : ""}
                </TabsTrigger>
                <TabsTrigger value="culture" className={pillTriggerClass}>
                  Culture{activeCultureCount > 0 ? ` (${activeCultureCount})` : ""}
                </TabsTrigger>
                <TabsTrigger value="social" className={pillTriggerClass}>
                  Social Media
                </TabsTrigger>
                <TabsTrigger value="settings" className={pillTriggerClass}>
                  Work Settings
                </TabsTrigger>
              </TabsList>

              <TabsContent value="benefits">
                <CompanyBenefitsEditor
                  benefits={benefitItems}
                  onChange={setBenefitItems}
                />
              </TabsContent>

              <TabsContent value="culture">
                <CultureEditor
                  value={cultureItems}
                  onChange={setCultureItems}
                  maxItems={12}
                />
              </TabsContent>

              <TabsContent value="social">
                <div className="grid gap-6 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="linkedinUrl">LinkedIn</Label>
                    <div className="relative">
                      <Linkedin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="linkedinUrl"
                        name="linkedinUrl"
                        value={formData.linkedinUrl}
                        onChange={handleChange}
                        placeholder="company-name"
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="twitterUrl">Twitter / X</Label>
                    <div className="relative">
                      <Twitter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="twitterUrl"
                        name="twitterUrl"
                        value={formData.twitterUrl}
                        onChange={handleChange}
                        placeholder="@companyname"
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="facebookUrl">Facebook</Label>
                    <div className="relative">
                      <Facebook className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="facebookUrl"
                        name="facebookUrl"
                        value={formData.facebookUrl}
                        onChange={handleChange}
                        placeholder="companyname"
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="settings">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                    <div>
                      <p className="font-medium text-slate-900">Remote Work</p>
                      <p className="text-sm text-slate-500">Allow employees to work from anywhere</p>
                    </div>
                    <Switch
                      checked={formData.isRemoteFriendly}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, isRemoteFriendly: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                    <div>
                      <p className="font-medium text-slate-900">Hybrid Work</p>
                      <p className="text-sm text-slate-500">Allow mix of office and remote work</p>
                    </div>
                    <Switch
                      checked={formData.isHybridFriendly}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, isHybridFriendly: checked }))
                      }
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </section>
        </div>

        {/* Right rail: the one boxed module on the page, kept in view while the
            document column scrolls */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card className="border-slate-200 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ImageIcon className="h-4 w-4 text-[#071738]" />
                Company Images
              </CardTitle>
              <CardDescription>Upload your company logo and cover image</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <CroppableImageUpload
                value={formData.logoUrl}
                onChange={handleLogoChange}
                type="logo"
                label="Company Logo"
                maxSize="2MB"
                previewClassName="w-full h-40"
              />
              <CroppableImageUpload
                value={formData.coverImageUrl}
                onChange={handleCoverChange}
                type="cover-image"
                label="Cover Image"
                maxSize="5MB"
                previewClassName="h-32"
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 mt-10 flex items-center justify-between gap-4 border-t border-slate-200 bg-white/95 py-4 backdrop-blur-sm">
        <p className="text-xs text-slate-500">* Required field</p>
        <Button
          type="submit"
          disabled={isSaving}
          className="gap-2 bg-[#071738] hover:bg-[#0d224d]"
          size="lg"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </form>
  );
}