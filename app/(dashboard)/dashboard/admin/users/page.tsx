"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Pagination } from "@/components/pagination";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { showSuccess, showError } from "@/lib/toast";
import { Search, Loader2 } from "lucide-react";
import { CroppableImageUpload } from "@/components/dashboard/croppable-image-upload";

interface Company {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  companySize: string | null;
  location: string | null;
  website: string | null;
  foundedYear: number | null;
  description: string | null;
  isRemoteFriendly: boolean;
  isHybridFriendly: boolean;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  facebookUrl: string | null;
  emailCompany: string | null;
  isVerified: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: "CANDIDATE" | "COMPANY";
  isActive: boolean;
  createdAt: string;
  companies?: Company | null;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ApiResponse {
  success: boolean;
  data: User[];
  pagination: PaginationData;
  error?: string;
  code?: string;
}

interface EditCompanyForm {
  name: string;
  slug: string;
  logoUrl: string;
  coverImageUrl: string;
  companySize: string;
  location: string;
  website: string;
  foundedYear: string;
  description: string;
  isRemoteFriendly: boolean;
  isHybridFriendly: boolean;
  linkedinUrl: string;
  twitterUrl: string;
  facebookUrl: string;
  emailCompany: string;
  isVerified: boolean;
}

interface EditFormData {
  name: string;
  email: string;
  isActive: boolean;
  company?: EditCompanyForm;
}

interface PatchResponse {
  success: boolean;
  data: User;
  company?: Company | null;
  error?: string;
  code?: string;
  details?: Record<string, unknown>;
}

const ROLE_TABS = [
  { value: "CANDIDATE", label: "Candidates" },
  { value: "COMPANY", label: "Companies" },
] as const;

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

const DEFAULT_LIMIT = 10;

export default function AdminUsersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: DEFAULT_LIMIT,
    total: 0,
    totalPages: 1,
  });

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [role, setRole] = useState<"CANDIDATE" | "COMPANY">("CANDIDATE");

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<EditFormData>({
    name: "",
    email: "",
    isActive: true,
  });
  const [isSaving, setIsSaving] = useState(false);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      const urlRole = searchParams.get("role") as "CANDIDATE" | "COMPANY" | null;
      const urlSearch = searchParams.get("search") || "";
      const urlPage = parseInt(searchParams.get("page") || "1", 10);

      if (urlRole && (urlRole === "CANDIDATE" || urlRole === "COMPANY")) {
        setRole(urlRole);
      }
      setSearch(urlSearch);
      setDebouncedSearch(urlSearch);
      setPagination((prev) => ({ ...prev, page: urlPage }));
    }
  }, [searchParams]);

  const buildQueryString = useCallback(
    (overrides: Partial<{
      page: number;
      search: string;
      role: "CANDIDATE" | "COMPANY";
    }> = {}) => {
      const params = new URLSearchParams();
      const page = overrides.page ?? pagination.page;
      const searchValue = overrides.search ?? debouncedSearch;
      const roleValue = overrides.role ?? role;

      if (page > 1) params.set("page", String(page));
      if (searchValue) params.set("search", searchValue);
      if (roleValue) params.set("role", roleValue);

      return params.toString();
    },
    [pagination.page, debouncedSearch, role]
  );

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryString = buildQueryString();
      const response = await fetch(`/api/admin/users?${queryString}`);
      const data: ApiResponse = await response.json();

      if (data.success) {
        setUsers(data.data);
        setPagination(data.pagination);
      } else {
        showError(data.error || "Failed to fetch users");
        setUsers([]);
        setPagination((prev) => ({ ...prev, total: 0, totalPages: 1 }));
      }
    } catch {
      showError("Failed to fetch users");
      setUsers([]);
      setPagination((prev) => ({ ...prev, total: 0, totalPages: 1 }));
    } finally {
      setIsLoading(false);
    }
  }, [buildQueryString]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      const queryString = buildQueryString({ search: value, page: 1 });
      router.push(`${pathname}?${queryString}`, { scroll: false });
    }, 300);
  };

  const handleRoleChange = (value: "CANDIDATE" | "COMPANY") => {
    setRole(value);
    const queryString = buildQueryString({ role: value, page: 1 });
    router.push(`${pathname}?${queryString}`, { scroll: false });
  };

  const handlePageChange = (page: number) => {
    const queryString = buildQueryString({ page });
    router.push(`${pathname}?${queryString}`, { scroll: false });
  };

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    const form: EditFormData = {
      name: user.name || "",
      email: user.email || "",
      isActive: user.isActive,
    };

    if (user.role === "COMPANY") {
      const c = user.companies;
      form.company = {
        name: c?.name || "",
        slug: c?.slug || "",
        logoUrl: c?.logoUrl || "",
        coverImageUrl: c?.coverImageUrl || "",
        companySize: c?.companySize || "",
        location: c?.location || "",
        website: c?.website || "",
        foundedYear: c?.foundedYear?.toString() || "",
        description: c?.description || "",
        isRemoteFriendly: c?.isRemoteFriendly ?? false,
        isHybridFriendly: c?.isHybridFriendly ?? false,
        linkedinUrl: c?.linkedinUrl || "",
        twitterUrl: c?.twitterUrl || "",
        facebookUrl: c?.facebookUrl || "",
        emailCompany: c?.emailCompany || "",
        isVerified: c?.isVerified ?? false,
      };
    }

    setEditForm(form);
    setEditDialogOpen(true);
  };

  const handleUserFieldChange = (field: "name" | "email" | "isActive", value: string | boolean) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCompanyFieldChange = (field: keyof EditCompanyForm, value: string | boolean) => {
    setEditForm((prev) => ({
      ...prev,
      company: prev.company
        ? { ...prev.company, [field]: value }
        : { ...getDefaultCompanyForm(), [field]: value },
    }));
  };

  function getDefaultCompanyForm(): EditCompanyForm {
    return {
      name: "",
      slug: "",
      logoUrl: "",
      coverImageUrl: "",
      companySize: "",
      location: "",
      website: "",
      foundedYear: "",
      description: "",
      isRemoteFriendly: false,
      isHybridFriendly: false,
      linkedinUrl: "",
      twitterUrl: "",
      facebookUrl: "",
      emailCompany: "",
      isVerified: false,
    };
  }

  function flattenErrorDetails(details: Record<string, unknown>): string[] {
    const messages: string[] = [];
    for (const value of Object.values(details)) {
      if (typeof value === "string") {
        messages.push(value);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "string") {
            messages.push(item);
          } else if (item && typeof item === "object") {
            messages.push(...flattenErrorDetails(item as Record<string, unknown>));
          }
        }
      } else if (value && typeof value === "object") {
        messages.push(...flattenErrorDetails(value as Record<string, unknown>));
      }
    }
    return messages;
  }

  const validateEditForm = (): boolean => {
    if (!editForm.name.trim()) {
      showError("Account Name is required");
      return false;
    }
    if (!editForm.email.trim()) {
      showError("Email is required");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email)) {
      showError("Invalid email format");
      return false;
    }
    if (editingUser?.role === "COMPANY" && editForm.company) {
      if (!editForm.company.name.trim()) {
        showError("Company Name is required");
        return false;
      }
    }
    return true;
  };

  const handleSaveEdit = async () => {
    if (!editingUser || !validateEditForm()) return;

    setIsSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: editForm.name.trim(),
        email: editForm.email.trim().toLowerCase(),
        isActive: editForm.isActive,
      };

      if (editingUser.role === "COMPANY" && editForm.company) {
        const c = editForm.company;
        const foundedYear = c.foundedYear.trim();

        body.company = {
          name: c.name.trim(),
          slug: c.slug.trim(),
          logoUrl: c.logoUrl || null,
          coverImageUrl: c.coverImageUrl || null,
          companySize: c.companySize || null,
          location: c.location || null,
          website: c.website || null,
          foundedYear: foundedYear ? parseInt(foundedYear) : null,
          description: c.description || null,
          isRemoteFriendly: c.isRemoteFriendly,
          isHybridFriendly: c.isHybridFriendly,
          linkedinUrl: c.linkedinUrl || null,
          twitterUrl: c.twitterUrl || null,
          facebookUrl: c.facebookUrl || null,
          emailCompany: c.emailCompany || null,
          isVerified: c.isVerified,
        };
      }

      const response = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data: PatchResponse = await response.json();

      if (data.success) {
        showSuccess("User updated successfully");
        const updatedUser: User = { ...editingUser, ...data.data };
        if (data.company && updatedUser.role === "COMPANY") {
          updatedUser.companies = {
            ...(editingUser.companies || {}),
            ...data.company,
          } as Company;
        }

        const stillMatches =
          !debouncedSearch ||
          (updatedUser.name || "")
            .toLowerCase()
            .includes(debouncedSearch.toLowerCase()) ||
          (updatedUser.email || "")
            .toLowerCase()
            .includes(debouncedSearch.toLowerCase());

        if (stillMatches) {
          setUsers((prev) =>
            prev.map((u) =>
              u.id === editingUser.id ? updatedUser : u
            )
          );
        } else {
          fetchUsers();
        }

        setEditDialogOpen(false);
        setEditingUser(null);
      } else {
        let message = data.error || "Failed to update user";
        if (data.code === "COMPANY_EMAIL_IN_USE") {
          message = "This email is already associated with a user account. Please use a different company email.";
        } else if (data.details) {
          const msgs = flattenErrorDetails(data.details as Record<string, unknown>);
          if (msgs.length > 0) {
            message = `${message}: ${msgs.join("; ")}`;
          }
        }
        showError(message);
      }
    } catch {
      showError("Failed to update user");
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getActiveBadge = (isActive: boolean) => (
    <Badge variant={isActive ? "success" : "secondary"}>
      {isActive ? "Active" : "Inactive"}
    </Badge>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">User Management</h1>
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs value={role} onValueChange={(v) => handleRoleChange(v as "CANDIDATE" | "COMPANY")} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          {ROLE_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="CANDIDATE">
          <UserTableContent
            users={users}
            isLoading={isLoading}
            pagination={pagination}
            onPageChange={handlePageChange}
            onEditClick={handleEditClick}
            getActiveBadge={getActiveBadge}
            formatDate={formatDate}
            role="CANDIDATE"
            emptyMessage="No candidates found"
          />
        </TabsContent>

        <TabsContent value="COMPANY">
          <UserTableContent
            users={users}
            isLoading={isLoading}
            pagination={pagination}
            onPageChange={handlePageChange}
            onEditClick={handleEditClick}
            getActiveBadge={getActiveBadge}
            formatDate={formatDate}
            role="COMPANY"
            emptyMessage="No companies found"
          />
        </TabsContent>
      </Tabs>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent
          className={editingUser?.role === "COMPANY" ? "max-w-2xl" : "max-w-md"}
        >
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Modify user details. Role cannot be changed.
            </DialogDescription>
          </DialogHeader>
          <DialogBody
            className={
              editingUser?.role === "COMPANY"
                ? "max-h-[60vh] overflow-y-auto"
                : "space-y-4"
            }
          >
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-700">Account</h3>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Account Name</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => handleUserFieldChange("name", e.target.value)}
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => handleUserFieldChange("email", e.target.value)}
                  disabled={isSaving}
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Switch
                  id="edit-active"
                  checked={editForm.isActive}
                  onCheckedChange={(checked) =>
                    handleUserFieldChange("isActive", checked)
                  }
                  disabled={isSaving}
                />
                <Label htmlFor="edit-active" className="text-sm font-medium text-slate-700 cursor-pointer">
                  Active
                </Label>
              </div>
            </div>

            {editingUser?.role === "COMPANY" && editForm.company && (
              <div className="mt-6 space-y-4">
                <h3 className="text-sm font-medium text-slate-700 border-t border-slate-200 pt-4">
                  Company Profile
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="edit-company-name">Company Name</Label>
                    <Input
                      id="edit-company-name"
                      value={editForm.company.name}
                      onChange={(e) =>
                        handleCompanyFieldChange("name", e.target.value)
                      }
                      disabled={isSaving}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="edit-slug">Slug</Label>
                    <Input
                      id="edit-slug"
                      value={editForm.company.slug}
                      onChange={(e) =>
                        handleCompanyFieldChange("slug", e.target.value)
                      }
                      disabled={isSaving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-logo-url">Logo URL</Label>
                    <CroppableImageUpload
                      value={editForm.company.logoUrl}
                      onChange={(url) =>
                        handleCompanyFieldChange("logoUrl", url || "")
                      }
                      type="logo"
                      label="Company Logo"
                      maxSize="2MB"
                      previewClassName="w-full h-40"
                      targetUserId={editingUser?.id}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-cover-image-url">Cover Image URL</Label>
                    <CroppableImageUpload
                      value={editForm.company.coverImageUrl}
                      onChange={(url) =>
                        handleCompanyFieldChange("coverImageUrl", url || "")
                      }
                      type="cover-image"
                      label="Cover Image"
                      maxSize="5MB"
                      previewClassName="w-full aspect-[16/5] object-cover object-center"
                      targetUserId={editingUser?.id}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-company-size">Company Size</Label>
                    <Select
                      value={editForm.company.companySize}
                      onValueChange={(value) =>
                        handleCompanyFieldChange("companySize", value)
                      }
                      disabled={isSaving}
                    >
                      <SelectTrigger id="edit-company-size">
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
                    <Label htmlFor="edit-location">Location</Label>
                    <Select
                      value={editForm.company.location}
                      onValueChange={(value) =>
                        handleCompanyFieldChange("location", value)
                      }
                      disabled={isSaving}
                    >
                      <SelectTrigger id="edit-location">
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
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="edit-website">Website</Label>
                    <Input
                      id="edit-website"
                      type="url"
                      value={editForm.company.website}
                      onChange={(e) =>
                        handleCompanyFieldChange("website", e.target.value)
                      }
                      disabled={isSaving}
                      placeholder="https://example.com"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="edit-founded-year">Founded Year</Label>
                    <Input
                      id="edit-founded-year"
                      type="number"
                      value={editForm.company.foundedYear}
                      onChange={(e) =>
                        handleCompanyFieldChange("foundedYear", e.target.value)
                      }
                      disabled={isSaving}
                      placeholder="e.g. 2015"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="edit-description">Description</Label>
                    <Textarea
                      id="edit-description"
                      value={editForm.company.description}
                      onChange={(e) =>
                        handleCompanyFieldChange("description", e.target.value)
                      }
                      disabled={isSaving}
                      placeholder="Tell candidates about your company..."
                      rows={4}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                      <div>
                        <p className="font-medium text-slate-900">
                          Is Remote Friendly
                        </p>
                        <p className="text-sm text-slate-500">
                          Allow employees to work from anywhere
                        </p>
                      </div>
                      <Switch
                        checked={editForm.company.isRemoteFriendly}
                        onCheckedChange={(checked) =>
                          handleCompanyFieldChange("isRemoteFriendly", checked)
                        }
                        disabled={isSaving}
                      />
                    </div>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                      <div>
                        <p className="font-medium text-slate-900">
                          Is Hybrid Friendly
                        </p>
                        <p className="text-sm text-slate-500">
                          Allow mix of office and remote work
                        </p>
                      </div>
                      <Switch
                        checked={editForm.company.isHybridFriendly}
                        onCheckedChange={(checked) =>
                          handleCompanyFieldChange("isHybridFriendly", checked)
                        }
                        disabled={isSaving}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-linkedin-url">LinkedIn URL</Label>
                    <Input
                      id="edit-linkedin-url"
                      value={editForm.company.linkedinUrl}
                      onChange={(e) =>
                        handleCompanyFieldChange("linkedinUrl", e.target.value)
                      }
                      disabled={isSaving}
                      placeholder="company-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-twitter-url">Twitter URL</Label>
                    <Input
                      id="edit-twitter-url"
                      value={editForm.company.twitterUrl}
                      onChange={(e) =>
                        handleCompanyFieldChange("twitterUrl", e.target.value)
                      }
                      disabled={isSaving}
                      placeholder="@companyname"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="edit-facebook-url">Facebook URL</Label>
                    <Input
                      id="edit-facebook-url"
                      value={editForm.company.facebookUrl}
                      onChange={(e) =>
                        handleCompanyFieldChange("facebookUrl", e.target.value)
                      }
                      disabled={isSaving}
                      placeholder="companyname"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="edit-email-company">Company Contact Email</Label>
                    <Input
                      id="edit-email-company"
                      type="email"
                      value={editForm.company.emailCompany}
                      onChange={(e) =>
                        handleCompanyFieldChange("emailCompany", e.target.value)
                      }
                      disabled={isSaving}
                      placeholder="contact@company.com"
                    />
                    <p className="text-xs text-slate-500">Used for business inquiries. Not used for login.</p>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                      <div>
                        <p className="font-medium text-slate-900">Verified</p>
                        <p className="text-sm text-slate-500">
                          Mark this company as verified
                        </p>
                      </div>
                      <Switch
                        checked={editForm.company.isVerified}
                        onCheckedChange={(checked) =>
                          handleCompanyFieldChange("isVerified", checked)
                        }
                        disabled={isSaving}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface UserTableContentProps {
  users: User[];
  isLoading: boolean;
  pagination: PaginationData;
  onPageChange: (page: number) => void;
  onEditClick: (user: User) => void;
  getActiveBadge: (isActive: boolean) => React.ReactNode;
  formatDate: (dateString: string) => string;
  role: "CANDIDATE" | "COMPANY";
  emptyMessage: string;
}

function UserTableContent({
  users,
  isLoading,
  pagination,
  onPageChange,
  onEditClick,
  getActiveBadge,
  formatDate,
  role,
  emptyMessage,
}: UserTableContentProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="overflow-x-auto">
          <Table>
             <TableHeader>
              <TableRow>
                <TableHead>{role === "COMPANY" ? "Company Name" : "Name"}</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><div className="h-4 w-3/4 bg-slate-200 animate-pulse rounded" /></TableCell>
                  <TableCell><div className="h-4 w-1/2 bg-slate-200 animate-pulse rounded" /></TableCell>
                  <TableCell><div className="h-5 w-20 bg-slate-200 animate-pulse rounded" /></TableCell>
                  <TableCell><div className="h-4 w-24 bg-slate-200 animate-pulse rounded" /></TableCell>
                  <TableCell className="text-right"><div className="h-8 w-20 bg-slate-200 animate-pulse rounded mx-auto" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={onPageChange}
        />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <Table>
         <TableHeader>
            <TableRow>
              <TableHead>{role === "COMPANY" ? "Company Name" : "Name"}</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {role === "COMPANY"
                    ? user.companies?.name || user.name
                    : user.name}
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{getActiveBadge(user.isActive)}</TableCell>
                <TableCell>{formatDate(user.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditClick(user)}
                  >
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {pagination.totalPages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}