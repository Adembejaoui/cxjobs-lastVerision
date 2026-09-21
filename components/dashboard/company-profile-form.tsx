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
import { Building2, Globe, Linkedin, Save, Loader2, Twitter, Facebook, Image as ImageIcon } from "lucide-react";
import { CroppableImageUpload } from "@/components/dashboard/croppable-image-upload";
import { CultureEditor } from "@/components/dashboard/culture-editor";
import { CompanyBenefitsEditor, BenefitItem } from "@/components/dashboard/company-benefits-editor";
import { logger } from "@/lib/logger";

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
      scope: 'COMPANY' as const
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
        .filter((b) => b.name.trim() !== "")
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

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Company Images
          </CardTitle>
          <CardDescription>
            Upload your company logo and cover image
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <CroppableImageUpload
              value={formData.logoUrl}
              onChange={handleLogoChange}
              type="logo"
              label="Company Logo"
              maxSize="2MB"
              previewClassName="w-48 h-48"
            />
            <CroppableImageUpload
              value={formData.coverImageUrl}
              onChange={handleCoverChange}
              type="cover-image"
              label="Cover Image"
              maxSize="5MB"
              previewClassName="h-32"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Basic Information
          </CardTitle>
          <CardDescription>
            Update your company&apos;s basic information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
              <Label htmlFor="companySize">Company Size</Label>
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
              <Label htmlFor="location">Location</Label>
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
              <Label htmlFor="foundedYear">Founded Year</Label>
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

            <div className="space-y-2">
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
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>About Your Company</CardTitle>
          <CardDescription>
            Tell candidates about your company and what makes you unique
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="description">About the Company</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Tell candidates about your company, values, team culture, and what makes you unique..."
              rows={6}
            />
            <p className="text-xs text-slate-500">
              {formData.description.length}/5000 characters
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="benefits" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="benefits">Company Benefits</TabsTrigger>
          <TabsTrigger value="culture">Company Culture</TabsTrigger>
          <TabsTrigger value="social">Social Media</TabsTrigger>
          <TabsTrigger value="settings">Work Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="benefits" className="mt-6">
          <CompanyBenefitsEditor
            benefits={benefitItems}
            onChange={setBenefitItems}
          />
        </TabsContent>

        <TabsContent value="culture" className="mt-6">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Company Culture</CardTitle>
              <CardDescription>
                Showcase your work environment and company values
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CultureEditor
                value={cultureItems}
                onChange={setCultureItems}
                maxItems={12}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social" className="mt-6">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Social Media Links</CardTitle>
              <CardDescription>
                Connect your company&apos;s social media profiles
              </CardDescription>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Work Settings</CardTitle>
              <CardDescription>
                Define your company&apos;s default work policies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 sm:grid-cols-2">
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end mt-6">
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
              Save All Changes
            </>
          )}
        </Button>
      </div>
    </form>
  );
}