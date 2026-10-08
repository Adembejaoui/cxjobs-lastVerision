"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Pagination } from "@/components/pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { showSuccess, showError } from "@/lib/toast";
import { Search, Loader2, Copy, Trash2 } from "lucide-react";
import {
  ALLOWED_INVITATION_DURATIONS,
  type CompanyInvitationStatus,
} from "@/lib/validations/company-invitation";

interface Invitation {
  id: string;
  companyName: string;
  companyEmail: string;
  managerName: string | null;
  managerEmail: string | null;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  status: CompanyInvitationStatus;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ApiResponse {
  success: boolean;
  data: Invitation[];
  pagination: PaginationData;
  error?: string;
  code?: string;
}

interface GenerateResponse {
  success: boolean;
  data: {
    id: string;
    companyName: string;
    companyEmail: string;
    managerName: string | null;
    managerEmail: string | null;
    createdAt: string;
    expiresAt: string;
    status: CompanyInvitationStatus;
    link: string;
  };
  error?: string;
  code?: string;
  details?: Record<string, unknown>;
}

const DEFAULT_LIMIT = 10;

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "created", label: "Created" },
  { value: "closed", label: "Closed" },
] as const;

const STATUS_BADGE_VARIANT: Record<CompanyInvitationStatus, "warning" | "default" | "success" | "secondary"> = {
  PENDING: "warning",
  IN_PROGRESS: "default",
  CREATED: "success",
  CLOSED: "secondary",
};

const STATUS_LABELS: Record<CompanyInvitationStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  CREATED: "Created",
  CLOSED: "Closed",
};

const DURATION_OPTIONS = ALLOWED_INVITATION_DURATIONS.map((d) => ({
  value: String(d),
  label: `${d} days`,
}));

interface TokenFormState {
  managerName: string;
  managerEmail: string;
  companyName: string;
  companyEmail: string;
  durationDays: string;
}

interface RevokeDialogState {
  open: boolean;
  invitation: Invitation | null;
}

interface CopyLinkDialogState {
  open: boolean;
  invitation: Invitation | null;
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

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getStatusBadge(status: CompanyInvitationStatus) {
  return (
    <Badge variant={STATUS_BADGE_VARIANT[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

function getManagerCell(invitation: Invitation) {
  const parts: string[] = [];
  if (invitation.managerName) parts.push(invitation.managerName);
  if (invitation.managerEmail) parts.push(invitation.managerEmail);
  return parts.length > 0 ? parts.join(" ") : "—";
}

export default function AdminTokensPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: DEFAULT_LIMIT,
    total: 0,
    totalPages: 1,
  });

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [form, setForm] = useState<TokenFormState>({
    managerName: "",
    managerEmail: "",
    companyName: "",
    companyEmail: "",
    durationDays: "",
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const [revokeDialog, setRevokeDialog] = useState<RevokeDialogState>({
    open: false,
    invitation: null,
  });
  const [isRevoking, setIsRevoking] = useState(false);

  const [copyLinkDialog, setCopyLinkDialog] = useState<CopyLinkDialogState>({
    open: false,
    invitation: null,
  });
  const [isCopyingLink, setIsCopyingLink] = useState(false);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      const urlSearch = searchParams.get("search") || "";
      const urlStatus = searchParams.get("status") || "";
      const urlPage = parseInt(searchParams.get("page") || "1", 10);

      setSearch(urlSearch);
      setDebouncedSearch(urlSearch);
      setStatusFilter(urlStatus);
      setPagination((prev) => ({ ...prev, page: urlPage }));
    }
  }, [searchParams]);

  const buildQueryString = useCallback(
    (overrides: Partial<{ page: number; search: string; status: string }> = {}) => {
      const params = new URLSearchParams();
      const page = overrides.page ?? pagination.page;
      const searchValue = overrides.search ?? debouncedSearch;
      const statusValue = overrides.status ?? statusFilter;

      if (page > 1) params.set("page", String(page));
      if (searchValue) params.set("search", searchValue);
      if (statusValue) params.set("status", statusValue);

      return params.toString();
    },
    [pagination.page, debouncedSearch, statusFilter]
  );

  const fetchInvitations = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryString = buildQueryString();
      const response = await fetch(`/api/admin/tokens?${queryString}`);
      const data: ApiResponse = await response.json();

      if (data.success) {
        setInvitations(data.data);
        setPagination(data.pagination);
      } else {
        showError(data.error || "Failed to fetch invitations");
        setInvitations([]);
        setPagination((prev) => ({ ...prev, total: 0, totalPages: 1 }));
      }
    } catch {
      showError("Failed to fetch invitations");
      setInvitations([]);
      setPagination((prev) => ({ ...prev, total: 0, totalPages: 1 }));
    } finally {
      setIsLoading(false);
    }
  }, [buildQueryString]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

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

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    const queryString = buildQueryString({ status: value, page: 1 });
    router.push(`${pathname}?${queryString}`, { scroll: false });
  };

  const handlePageChange = (page: number) => {
    const queryString = buildQueryString({ page });
    router.push(`${pathname}?${queryString}`, { scroll: false });
  };

  const handleGenerateClick = () => {
    setForm({
      managerName: "",
      managerEmail: "",
      companyName: "",
      companyEmail: "",
      durationDays: "",
    });
    setGeneratedLink(null);
    setGeneratorOpen(true);
  };

  const validateForm = (): string | null => {
    if (!form.companyName.trim()) {
      return "Company name is required";
    }
    if (form.companyName.trim().length < 2) {
      return "Company name must be at least 2 characters";
    }
    if (!form.companyEmail.trim()) {
      return "Company email is required";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.companyEmail.trim())) {
      return "Invalid company email format";
    }
    if (form.managerEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.managerEmail.trim())) {
      return "Invalid manager email format";
    }
    if (form.managerEmail.trim() && form.companyEmail.trim()) {
      const normalizedManager = form.managerEmail.trim().toLowerCase();
      const normalizedCompany = form.companyEmail.trim().toLowerCase();
      if (normalizedManager === normalizedCompany) {
        return "Company email must be different from the manager email.";
      }
    }
    if (!form.durationDays) {
      return "Token duration is required";
    }
    return null;
  };

  const handleSubmitGenerate = async () => {
    const error = validateForm();
    if (error) {
      showError(error);
      return;
    }

    setIsGenerating(true);
    try {
      const body: Record<string, unknown> = {
        companyName: form.companyName.trim(),
        companyEmail: form.companyEmail.trim(),
        durationDays: parseInt(form.durationDays, 10),
      };

      if (form.managerName.trim()) {
        body.managerName = form.managerName.trim();
      }
      if (form.managerEmail.trim()) {
        body.managerEmail = form.managerEmail.trim();
      }

      const response = await fetch("/api/admin/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data: GenerateResponse = await response.json();

      if (data.success) {
        setGeneratedLink(data.data.link);
      } else {
        let message = data.error || "Failed to create invitation";
        if (data.code === "COMPANY_EMAIL_IN_USE") {
          message = "This company email is already associated with a user account. Please use a different company email.";
        } else if (data.details) {
          const msgs = flattenErrorDetails(data.details);
          if (msgs.length > 0) {
            message = `${message}: ${msgs.join("; ")}`;
          }
        }
        showError(message);
      }
    } catch {
      showError("Failed to create invitation");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = async () => {
    if (generatedLink) {
      await navigator.clipboard.writeText(generatedLink);
      showSuccess("Invitation link copied to clipboard");
    }
  };

  const handleCloseGenerator = () => {
    setGeneratorOpen(false);
    setGeneratedLink(null);
    setForm({
      managerName: "",
      managerEmail: "",
      companyName: "",
      companyEmail: "",
      durationDays: "",
    });
  };

  const handleRevokeClick = (invitation: Invitation) => {
    setRevokeDialog({ open: true, invitation });
  };

  const handleRevokeConfirm = async () => {
    if (!revokeDialog.invitation) return;

    setIsRevoking(true);
    try {
      const response = await fetch(`/api/admin/tokens/${revokeDialog.invitation.id}/revoke`, {
        method: "POST",
      });

      const data = await response.json();

      if (data.success) {
        showSuccess("Invitation revoked");
        setInvitations((prev) =>
          prev.map((inv) =>
            inv.id === revokeDialog.invitation!.id
              ? { ...inv, revokedAt: new Date().toISOString() }
              : inv
          )
        );
      } else {
        showError(data.error || "Failed to revoke invitation");
      }
    } catch {
      showError("Failed to revoke invitation");
    } finally {
      setIsRevoking(false);
      setRevokeDialog({ open: false, invitation: null });
    }
  };

  const canRevoke = (invitation: Invitation) => invitation.status === "PENDING";

  const canCopyLink = (invitation: Invitation) => {
    const now = new Date();
    return (
      invitation.status === "PENDING" &&
      !invitation.revokedAt &&
      !invitation.usedAt &&
      new Date(invitation.expiresAt) > now
    );
  };

  const handleCopyLinkClick = (invitation: Invitation) => {
    setCopyLinkDialog({ open: true, invitation });
  };

  const handleCopyLinkConfirm = async () => {
    if (!copyLinkDialog.invitation) return;

    setIsCopyingLink(true);
    try {
      const response = await fetch(
        `/api/admin/tokens/${copyLinkDialog.invitation.id}/link`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (data.success) {
        await navigator.clipboard.writeText(data.data.link);
        showSuccess("Invitation link copied to clipboard");
      } else {
        showError(data.error || "Failed to copy invitation link");
      }
    } catch {
      showError("Failed to copy invitation link");
    } finally {
      setIsCopyingLink(false);
      setCopyLinkDialog({ open: false, invitation: null });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">Invitations</h1>
        <Button onClick={handleGenerateClick}>Generate Invitation</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <Input
            placeholder="Search by company or manager..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="w-full sm:w-48">
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger>
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company Name</TableHead>
                  <TableHead>Company Email</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="h-4 w-3/4 bg-slate-200 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-1/2 bg-slate-200 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-1/2 bg-slate-200 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-5 w-20 bg-slate-200 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-24 bg-slate-200 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-24 bg-slate-200 animate-pulse rounded" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="h-8 w-16 bg-slate-200 animate-pulse rounded mx-auto" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      ) : invitations.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500">
            {debouncedSearch || statusFilter
              ? "No invitations match your filters"
              : "No invitations found. Create one to get started."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company Name</TableHead>
                  <TableHead>Company Email</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">
                      {invitation.companyName}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {invitation.companyEmail}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {getManagerCell(invitation)}
                    </TableCell>
                    <TableCell>{getStatusBadge(invitation.status)}</TableCell>
                    <TableCell>{formatDate(invitation.createdAt)}</TableCell>
                    <TableCell>{formatDate(invitation.expiresAt)}</TableCell>
                    <TableCell className="text-right">
                      {canCopyLink(invitation) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyLinkClick(invitation)}
                          disabled={isCopyingLink}
                          className="mr-2"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                      {canRevoke(invitation) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevokeClick(invitation)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
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
              onPageChange={handlePageChange}
            />
          )}
        </div>
      )}

      <Dialog open={generatorOpen} onOpenChange={setGeneratorOpen}>
        <DialogContent className={generatedLink ? "max-w-md" : "max-w-lg"}>
          <DialogHeader>
            <DialogTitle>
              {generatedLink ? "Invitation Created" : "Generate Invitation"}
            </DialogTitle>
            <DialogDescription>
              {generatedLink
                ? "Share this link with the manager to have them create their account."
                : "Create a company invitation. The manager will receive a link to set up their account."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {generatedLink ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-slate-50 p-3 break-all text-sm text-slate-700">
                  {generatedLink}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyLink}
                    className="flex-1"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Link
                  </Button>
                  <Button size="sm" onClick={handleCloseGenerator} className="flex-1">
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="managerName"
                    className="text-sm font-medium text-slate-700"
                  >
                    Manager Name (optional)
                  </label>
                  <Input
                    id="managerName"
                    placeholder="Jane Smith"
                    value={form.managerName}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, managerName: e.target.value }))
                    }
                    disabled={isGenerating}
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="managerEmail"
                    className="text-sm font-medium text-slate-700"
                  >
                    Manager Email (optional)
                  </label>
                  <Input
                    id="managerEmail"
                    type="email"
                    placeholder="manager@company.com"
                    value={form.managerEmail}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, managerEmail: e.target.value }))
                    }
                    disabled={isGenerating}
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="companyName"
                    className="text-sm font-medium text-slate-700"
                  >
                    Company Name
                  </label>
                  <Input
                    id="companyName"
                    placeholder="Acme Corp"
                    value={form.companyName}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, companyName: e.target.value }))
                    }
                    disabled={isGenerating}
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="companyEmail"
                    className="text-sm font-medium text-slate-700"
                  >
                    Company Email
                  </label>
                  <Input
                    id="companyEmail"
                    type="email"
                    placeholder="contact@acme.com"
                    value={form.companyEmail}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, companyEmail: e.target.value }))
                    }
                    disabled={isGenerating}
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="durationDays"
                    className="text-sm font-medium text-slate-700"
                  >
                    Token Duration
                  </label>
                  <Select
                    value={form.durationDays}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, durationDays: value }))
                    }
                    disabled={isGenerating}
                  >
                    <SelectTrigger id="durationDays">
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </DialogBody>
          {!generatedLink && (
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setGeneratorOpen(false)}
                disabled={isGenerating}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmitGenerate} disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  "Generate Invitation"
                )}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={revokeDialog.open}
        onOpenChange={(open) => !open && setRevokeDialog({ open, invitation: null })}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Revoke Invitation</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke this invitation? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {revokeDialog.invitation && (
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium text-slate-500">Company:</span>{" "}
                  <span className="text-slate-900">
                    {revokeDialog.invitation.companyName}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-slate-500">Email:</span>{" "}
                  <span className="text-slate-900">
                    {revokeDialog.invitation.companyEmail}
                  </span>
                </div>
                {revokeDialog.invitation.expiresAt && (
                  <div>
                    <span className="font-medium text-slate-500">Expires:</span>{" "}
                    <span className="text-slate-900">
                      {formatDate(revokeDialog.invitation.expiresAt)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevokeDialog({ open: false, invitation: null })}
              disabled={isRevoking}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevokeConfirm}
              disabled={isRevoking}
            >
              {isRevoking ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Revoking...
                </>
              ) : (
                "Revoke Invitation"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={copyLinkDialog.open}
        onOpenChange={(open) =>
          !open && setCopyLinkDialog({ open, invitation: null })
        }
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Copy Invitation Link</DialogTitle>
            <DialogDescription>
              The invitation link will be copied to your clipboard.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {copyLinkDialog.invitation && (
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium text-slate-500">Company:</span>{" "}
                  <span className="text-slate-900">
                    {copyLinkDialog.invitation.companyName}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-slate-500">Email:</span>{" "}
                  <span className="text-slate-900">
                    {copyLinkDialog.invitation.companyEmail}
                  </span>
                </div>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCopyLinkDialog({ open: false, invitation: null })}
              disabled={isCopyingLink}
            >
              Cancel
            </Button>
            <Button onClick={handleCopyLinkConfirm} disabled={isCopyingLink}>
              {isCopyingLink ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Copying...
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
