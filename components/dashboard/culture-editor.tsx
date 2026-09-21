"use client";

import { useState, useRef } from "react";
import { Plus, X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ImageUpload } from "@/components/dashboard/image-upload";
import { cn } from "@/lib/utils";

interface CultureItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  icon: string;
}

interface CultureEditorProps {
  value: CultureItem[];
  onChange: (items: CultureItem[]) => void;
  className?: string;
  maxItems?: number;
}

interface CultureTemplate {
  title: string;
  description: string;
  icon: string;
}

const CULTURE_TEMPLATES: CultureTemplate[] = [
  { title: "Diversity & Inclusion", description: "Building a diverse and inclusive workplace where everyone belongs.", icon: "🏢" },
  { title: "Work-Life Balance", description: "We value your time and promote a healthy work-life balance.", icon: "⚖️" },
  { title: "Continuous Learning", description: "Growing together through mentorship, training, and knowledge sharing.", icon: "📚" },
  { title: "Team Spirit", description: "Collaborating, celebrating, and supporting each other every step of the way.", icon: "🤝" },
  { title: "Innovation", description: "Pushing boundaries and embracing creative solutions to challenges.", icon: "💡" },
  { title: "Sustainability", description: "Committing to environmentally responsible practices and positive impact.", icon: "🌟" },
  { title: "Growth Mindset", description: "Encouraging curiosity, adaptability, and continuous improvement.", icon: "🎯" },
  { title: "Collaboration", description: "Working together across teams to achieve shared goals and success.", icon: "🚀" },
  { title: "Wellness", description: "Supporting physical and mental well-being of every team member.", icon: "💪" },
  { title: "Creativity", description: "Fostering an environment where new ideas flourish.", icon: "🎨" },
  { title: "Recognition", description: "Celebrating achievements and recognizing outstanding contributions.", icon: "🏆" },
  { title: "Community", description: "Giving back and making a difference in the communities we serve.", icon: "🌈" },
];

const ALL_ICONS = [
  "🏢", "⚖️", "📚", "🤝", "🌟", "💡", "🎯", "🚀", "💪", "🎨",
  "🌈", "🔥", "🏆", "🎉", "🧩", "🔬", "🌍", "📈", "🎓", "🧠",
  "⚡", "🎪", "🌿", "🦄",
];

function getStableIcon(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ALL_ICONS[Math.abs(hash) % ALL_ICONS.length];
}

export function CultureEditor({
  value,
  onChange,
  className,
  maxItems = 12,
}: CultureEditorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const idCounter = useRef(0);

  const addItem = (template?: CultureTemplate) => {
    if (value.length >= maxItems) return;

    let newItem: CultureItem;
    if (template) {
      newItem = {
        id: `culture-${idCounter.current++}`,
        title: template.title,
        description: template.description,
        imageUrl: "",
        icon: template.icon,
      };
    } else {
      newItem = {
        id: `culture-${idCounter.current++}`,
        title: "",
        description: "",
        imageUrl: "",
        icon: "",
      };
    }
    onChange([...value, newItem]);
    setExpandedId(newItem.id);
    setShowPicker(false);
  };

  const updateItem = (id: string, updates: Partial<CultureItem>) => {
    onChange(
      value.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      )
    );
  };

  const removeItem = (id: string) => {
    onChange(value.filter((item) => item.id !== id));
    if (expandedId === id) {
      setExpandedId(null);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-semibold">Company Culture</Label>
          <p className="text-xs text-slate-500 mt-1">
            Showcase your company culture with images and descriptions
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          disabled={value.length >= maxItems}
          size="sm"
          variant="outline"
          className="gap-1"
        >
          <Plus className="h-4 w-4" />
          Add Culture Item
        </Button>
      </div>

      {showPicker && value.length < maxItems && (
        <div className="border border-dashed border-slate-300 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-slate-700">Choose a culture type:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {CULTURE_TEMPLATES.map((template) => (
              <Button
                key={template.title}
                type="button"
                variant="outline"
                className="h-auto py-3 px-3 flex flex-col items-center gap-1 hover:bg-primary/5 hover:border-primary/30 transition-colors"
                onClick={() => addItem(template)}
              >
                <span className="text-2xl">{template.icon}</span>
                <span className="text-xs font-medium leading-tight">{template.title}</span>
              </Button>
            ))}
            <Button
              type="button"
              variant="outline"
              className="h-auto py-3 px-3 flex flex-col items-center gap-1 hover:bg-slate-50 hover:border-slate-400 transition-colors border-dashed"
              onClick={() => addItem()}
            >
              <span className="text-2xl">✨</span>
              <span className="text-xs font-medium leading-tight">Custom Culture</span>
            </Button>
          </div>
        </div>
      )}

      {value.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center">
          <div className="text-4xl mb-2">🏢</div>
          <p className="text-slate-600 font-medium">No culture items yet</p>
          <p className="text-sm text-slate-400 mt-1">
            Add items to showcase your company culture and work environment
          </p>
          <Button
            type="button"
            onClick={() => setShowPicker(true)}
            className="mt-4"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Your First Culture Item
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {value.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 cursor-grab">
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-lg">
                      {item.icon || getStableIcon(item.title || "culture")}
                    </span>
                    <span className="font-medium text-slate-900 truncate flex-1">
                      {item.title || "Untitled Culture Item"}
                    </span>
                  </div>
                </div>
              </CardHeader>

              {expandedId === item.id && (
                <CardContent className="p-4 pt-2 space-y-4 border-t">
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Icon Selector */}
                    <div className="space-y-2">
                      <Label htmlFor={`icon-${item.id}`}>Icon</Label>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 border border-slate-200 rounded-md">
                        {ALL_ICONS.map((icon) => (
                          <button
                            key={icon}
                            type="button"
                            onClick={() => updateItem(item.id, { icon })}
                            className={`w-8 h-8 flex items-center justify-center rounded-md text-lg transition-colors ${
                              item.icon === icon
                                ? "bg-primary/10 border border-primary"
                                : "hover:bg-slate-100"
                            }`}
                          >
                            {icon}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Image Upload */}
                    <ImageUpload
                      value={item.imageUrl}
                      onChange={(url) => updateItem(item.id, { imageUrl: url || "" })}
                      type="culture-image"
                      aspectRatio="video"
                      label="Culture Image"
                      previewClassName="h-32"
                      currentImageUrl={item.imageUrl}
                    />
                  </div>

                  <div className="space-y-4">
                    {/* Title */}
                    <div className="space-y-2">
                      <Label htmlFor={`title-${item.id}`}>Title *</Label>
                      <Input
                        id={`title-${item.id}`}
                        value={item.title}
                        onChange={(e) => updateItem(item.id, { title: e.target.value })}
                        placeholder="e.g., Team Building Events"
                        maxLength={100}
                      />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <Label htmlFor={`desc-${item.id}`}>Description</Label>
                      <Textarea
                        id={`desc-${item.id}`}
                        value={item.description}
                        onChange={(e) => updateItem(item.id, { description: e.target.value })}
                        placeholder="Describe this culture aspect..."
                        rows={3}
                        maxLength={500}
                      />
                      <p className="text-xs text-slate-400">
                        {item.description.length}/500 characters
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.id)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {value.length > 0 && value.length < maxItems && !showPicker && (
        <Button
          type="button"
          variant="outline"
          className="w-full gap-1"
          onClick={() => setShowPicker(true)}
        >
          <Plus className="h-4 w-4" />
          Add Another Culture Item ({value.length}/{maxItems})
        </Button>
      )}
    </div>
  );
}
