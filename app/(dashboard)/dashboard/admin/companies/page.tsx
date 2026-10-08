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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { showError } from "@/lib/toast";
import { Search, Briefcase } from "lucide-react";
import { JobOffersSheet } from "@/components/dashboard/job-offers-sheet";

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
  role: "COMPANY";
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

const DEFAULT_LIMIT = 10;

export default function AdminCompaniesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [companies, setCompanies] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: DEFAULT_LIMIT,
    total: 0,
    totalPages: 1,
  });

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<{ id: string; name: string } | null>(null);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      const urlSearch = searchParams.get("search") || "";
      const urlPage = parseInt(searchParams.get("page") || "1", 10);

      setSearch(urlSearch);
      setDebouncedSearch(urlSearch);
      setPagination((prev) => ({ ...prev, page: urlPage }));
    }
  }, [searchParams]);

  const buildQueryString = useCallback(
    (overrides: Partial<{
      page: number;
      search: string;
    }> = {}) => {
      const params = new URLSearchParams();
      const page = overrides.page ?? pagination.page;
      const searchValue = overrides.search ?? debouncedSearch;

      if (page > 1) params.set("page", String(page));
      if (searchValue) params.set("search", searchValue);
      params.set("role", "COMPANY");

      return params.toString();
    },
    [pagination.page, debouncedSearch]
  );

  const fetchCompanies = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryString = buildQueryString();
      const response = await fetch(`/api/admin/users?${queryString}`);
      const data: ApiResponse = await response.json();

      if (data.success) {
        setCompanies(data.data);
        setPagination(data.pagination);
      } else {
        showError(data.error || "Failed to fetch companies");
        setCompanies([]);
        setPagination((prev) => ({ ...prev, total: 0, totalPages: 1 }));
      }
    } catch {
      showError("Failed to fetch companies");
      setCompanies([]);
      setPagination((prev) => ({ ...prev, total: 0, totalPages: 1 }));
    } finally {
      setIsLoading(false);
    }
  }, [buildQueryString]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

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

  const handlePageChange = (page: number) => {
    const queryString = buildQueryString({ page });
    router.push(`${pathname}?${queryString}`, { scroll: false });
  };

  const handleJobOffersClick = (company: User) => {
    const companyData = company.companies;
    if (companyData) {
      setSelectedCompany({ id: companyData.id, name: companyData.name });
      setSheetOpen(true);
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
        <h1 className="text-2xl font-semibold text-slate-900">Company Management</h1>
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <Input
            placeholder="Search by company name or email..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company Name</TableHead>
                  <TableHead>Manager Email</TableHead>
                  <TableHead>Contact Email</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Created</TableHead>
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
                    <TableCell className="text-right">
                      <div className="h-8 w-20 bg-slate-200 animate-pulse rounded mx-auto" />
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
      ) : companies.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500">No companies found</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company Name</TableHead>
                  <TableHead>Manager Email</TableHead>
                  <TableHead>Contact Email</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">
                      {company.companies?.name || company.name}
                    </TableCell>
                    <TableCell>{company.email}</TableCell>
                    <TableCell>{company.companies?.emailCompany || "-"}</TableCell>
                    <TableCell>{getActiveBadge(company.isActive)}</TableCell>
                    <TableCell>{formatDate(company.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleJobOffersClick(company)}
                        >
                          <Briefcase className="h-4 w-4 mr-1.5" />
                          Job Offers
                        </Button>
                      </div>
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

      <JobOffersSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        companyId={selectedCompany?.id}
        companyName={selectedCompany?.name}
        admin
      />
    </div>
  );
}