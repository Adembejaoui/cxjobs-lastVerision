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
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, GripVertical, Heart, DollarSign, Home, TrendingUp, Briefcase, Coffee, Sparkles } from "lucide-react";

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
  { value: "HEALTH", label: "Health & Wellness", icon: Heart },
  { value: "FINANCIAL", label: "Financial", icon: DollarSign },
  { value: "WORK_ENVIRONMENT", label: "Work Environment", icon: Home },
  { value: "CAREER_GROWTH", label: "Career Growth", icon: TrendingUp },
  { value: "WORK_LIFE_BALANCE", label: "Work-Life Balance", icon: Coffee },
  { value: "OTHER", label: "Other", icon: Sparkles },
];

const ICON_OPTIONS = [
  "heart", "dollar-sign", "home", "trending-up", "briefcase", "coffee", 
  "sparkles", "award", "book", "calendar", "check-circle", "clock", 
  "code", "credit-card", "gift", "globe", "graduation-cap", "hammer",
  "layout", "monitor", "music", "phone", "plane", "server", "settings",
  "shield", "smartphone", "smile", "star", "sun", "target", "tree",
  "trophy", "users", "video", "wallet", "zap"
];

export function CompanyBenefitsEditor({ benefits, onChange }: CompanyBenefitsEditorProps) {
  const [localBenefits, setLocalBenefits] = useState<BenefitItem[]>(benefits);

  const addBenefit = () => {
    const newBenefit: BenefitItem = {
      id: `benefit-${Date.now()}`,
      name: "",
      description: "",
      icon: "heart",
      category: "OTHER",
      scope: "ADDITIONAL",
    };
    const updated = [...localBenefits, newBenefit];
    setLocalBenefits(updated);
    onChange(updated);
  };

  const updateBenefit = (id: string, field: keyof BenefitItem, value: string) => {
    const updated = localBenefits.map((b) =>
      b.id === id ? { ...b, [field]: value } : b
    );
    setLocalBenefits(updated);
    onChange(updated);
  };

  const removeBenefit = (id: string) => {
    const updated = localBenefits.filter((b) => b.id !== id);
    setLocalBenefits(updated);
    onChange(updated);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Benefits</CardTitle>
        <CardDescription>
          Add benefits that your company offers to employees. CORE benefits will be automatically included in all job postings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {localBenefits.map((benefit, index) => (
          <div
            key={benefit.id}
            className="rounded-lg border border-slate-200 p-4 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-slate-400 cursor-move" />
                <span className="text-sm font-medium text-slate-600">
                  Benefit #{index + 1}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeBenefit(benefit.id)}
                className="text-red-500 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor={`name-${benefit.id}`}>Name *</Label>
                <Input
                  id={`name-${benefit.id}`}
                  value={benefit.name}
                  onChange={(e) => updateBenefit(benefit.id, "name", e.target.value)}
                  placeholder="e.g., Health Insurance"
                />
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
                    <SelectValue placeholder="Select icon" />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((icon) => (
                      <SelectItem key={icon} value={icon}>
                        {icon}
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
        ))}

        <Button
          type="button"
          variant="outline"
          onClick={addBenefit}
          className="w-full border-dashed"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Benefit
        </Button>

        {localBenefits.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <p>No benefits added yet.</p>
            <p className="text-sm">Add benefits to showcase what your company offers.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}