"use client";

import { useState } from "react";
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
import { Plus, Trash2, GripVertical, ChevronDown } from "lucide-react";
import { ICON_MAP, DynamicIcon } from "@/lib/icon-map";

export interface BenefitItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  scope: string;
}

interface CompanyBenefitsEditorProps {
  benefits: BenefitItem[];
  onChange: (benefits: BenefitItem[]) => void;
}

const BENEFIT_CATEGORIES = [
  { value: "HEALTH", label: "Health & Wellness", icon: "heart" },
  { value: "FINANCIAL", label: "Financial", icon: "piggy-bank" },
  { value: "WORK_ENVIRONMENT", label: "Work Environment", icon: "building" },
  { value: "CAREER_GROWTH", label: "Career Growth", icon: "rocket" },
  { value: "WORK_LIFE_BALANCE", label: "Work-Life Balance", icon: "sunset" },
  { value: "OTHER", label: "Other", icon: "sparkles" },
];

const ICON_OPTIONS = [
  "heart", "stethoscope", "pill", "bandage", "activity",
  "piggy-bank", "dollar-sign", "credit-card", "receipt", "wallet", "award", "medal",
  "building", "home", "layout", "monitor", "settings", "shield",
  "rocket", "trending-up", "chart-line", "graduation-cap", "book", "trophy",
  "sunset", "coffee", "dumbbell", "tree", "sun", "smile", "star", "sparkles",
  "gift", "users", "video", "phone", "globe", "zap", "target", "clock", "calendar",
];

export function CompanyBenefitsEditor({ benefits, onChange }: CompanyBenefitsEditorProps) {
  // Which row is open. Single-open (accordion) behavior: setting a new id
  // replaces whichever id was previously stored, so only one row is ever expanded.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpanded = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleHeaderKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleExpanded(id);
    }
  };

  // All mutations read from and write to the `benefits` prop directly, with
  // no local copy of the list. Keeping a separate `localBenefits` state that
  // only mirrors the initial prop value is what caused the desync bug: if the
  // parent's `benefits` ever changed for a reason other than this editor's
  // own onChange calls, the local copy would silently go stale.
  const addBenefit = () => {
    const emptyBenefit = benefits.find((b) => b.name.trim().length < 3);
    if (emptyBenefit) {
      setExpandedId(emptyBenefit.id);
      return;
    }

    const newBenefit: BenefitItem = {
      id: `benefit-${Date.now()}`,
      name: "",
      description: "",
      icon: "heart",
      category: "OTHER",
      scope: "ADDITIONAL",
    };
    onChange([...benefits, newBenefit]);
    setExpandedId(newBenefit.id);
  };

  const updateBenefit = (id: string, field: keyof BenefitItem, value: string) => {
    if (field === "name" && value.trim().length > 0 && value.trim().length < 3) {
      return;
    }
    onChange(benefits.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  };

  const removeBenefit = (id: string) => {
    onChange(benefits.filter((b) => b.id !== id));
    setExpandedId((prev) => (prev === id ? null : prev));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Benefits</CardTitle>
        <CardDescription>
          Add benefits that your company offers to employees. CORE benefits will be automatically included in all job postings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {benefits.map((benefit, index) => {
          const isExpanded = expandedId === benefit.id;
          const categoryLabel = BENEFIT_CATEGORIES.find((c) => c.value === benefit.category)?.label;

          return (
            <div
              key={benefit.id}
              className="rounded-lg border border-slate-200 overflow-hidden"
            >
              {/* Header: always visible, click or Enter/Space toggles the body below */}
              <div
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                onClick={() => toggleExpanded(benefit.id)}
                onKeyDown={(e) => handleHeaderKeyDown(e, benefit.id)}
                className="flex cursor-pointer items-center gap-3 p-4 hover:bg-slate-50"
              >
                <GripVertical className="h-4 w-4 shrink-0 text-slate-400 cursor-move" />

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#e8f5ec] to-[#d4f0e4]">
                  <DynamicIcon name={benefit.icon || "heart"} className="h-5 w-5 text-[#16a34a]" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {benefit.name.trim() || `Benefit #${index + 1}`}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {categoryLabel}
                    {benefit.scope === "CORE" ? " · Core benefit" : ""}
                    {benefit.name.trim().length === 0 && (
                      <span className="ml-1 text-amber-500">· Required</span>
                    )}
                    {benefit.name.trim().length > 0 && benefit.name.trim().length < 3 && (
                      <span className="ml-1 text-red-500">· Min 3 characters</span>
                    )}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeBenefit(benefit.id);
                  }}
                  className="text-red-500 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>

                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              </div>

              {/* Body: only mounted while expanded */}
              {isExpanded && (
                <div className="space-y-4 border-t border-slate-200 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Name */}
                    <div className="space-y-2">
                      <Label htmlFor={`name-${benefit.id}`}>Name *</Label>
                      <Input
                        id={`name-${benefit.id}`}
                        value={benefit.name}
                        onChange={(e) => updateBenefit(benefit.id, "name", e.target.value)}
                        placeholder="e.g., Health Insurance"
                        required
                      />
                      {benefit.name.trim().length > 0 && benefit.name.trim().length < 3 && (
                        <p className="text-xs text-red-500">Name must be at least 3 characters</p>
                      )}
                    </div>

                    {/* Category */}
                    <div className="space-y-2">
                      <Label htmlFor={`category-${benefit.id}`}>Category</Label>
                      <Select
                        value={benefit.category}
                        onValueChange={(value) => updateBenefit(benefit.id, "category", value)}
                      >
                        <SelectTrigger id={`category-${benefit.id}`}>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {BENEFIT_CATEGORIES.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Icon */}
                    <div className="space-y-2">
                      <Label htmlFor={`icon-${benefit.id}`}>Icon</Label>
                      <Select
                        value={benefit.icon}
                        onValueChange={(value) => updateBenefit(benefit.id, "icon", value)}
                      >
                        <SelectTrigger id={`icon-${benefit.id}`}>
                          {benefit.icon ? (
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-[#e8f5ec] to-[#d4f0e4]">
                                <DynamicIcon name={benefit.icon} className="h-4 w-4 text-[#16a34a]" />
                              </div>
                              <span>{benefit.icon.replace(/-/g, " ")}</span>
                            </div>
                          ) : (
                            <SelectValue placeholder="Select icon" />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {ICON_OPTIONS.map((icon) => (
                            <SelectItem key={icon} value={icon}>
                              <div className="flex items-center gap-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-[#e8f5ec] to-[#d4f0e4]">
                                  <DynamicIcon name={icon} className="h-4 w-4 text-[#16a34a]" />
                                </div>
                                <span>{icon.replace(/-/g, " ")}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Scope */}
                    <div className="space-y-2">
                      <Label htmlFor={`scope-${benefit.id}`}>Scope</Label>
                      <Select
                        value={benefit.scope}
                        onValueChange={(value) => updateBenefit(benefit.id, "scope", value)}
                      >
                        <SelectTrigger id={`scope-${benefit.id}`}>
                          <SelectValue placeholder="Select scope" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CORE">
                            <span className="flex items-center gap-2">
                              <span className="text-green-600">●</span>
                              CORE - Included in all jobs
                            </span>
                          </SelectItem>
                          <SelectItem value="ADDITIONAL">
                            <span className="flex items-center gap-2">
                              <span className="text-slate-400">●</span>
                              ADDITIONAL - Per job selection
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Description */}
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor={`description-${benefit.id}`}>Description</Label>
                      <Textarea
                        id={`description-${benefit.id}`}
                        value={benefit.description}
                        onChange={(e) => updateBenefit(benefit.id, "description", e.target.value)}
                        placeholder="Describe this benefit..."
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <Button
          type="button"
          variant="outline"
          onClick={addBenefit}
          className="w-full border-dashed"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Benefit
        </Button>

        {benefits.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <p>No benefits added yet.</p>
            <p className="text-sm">Add benefits to showcase what your company offers.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 