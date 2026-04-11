"use client";

import { useState } from "react";
import { Plus, X, Loader2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUpload } from "@/components/dashboard/image-upload";
import { cn } from "@/lib/utils";

interface CultureItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
}

interface CultureEditorProps {
  value: CultureItem[];
  onChange: (items: CultureItem[]) => void;
  className?: string;
  maxItems?: number;
}

const ICONS = ["🏢", "⚖️", "📚", "🤝", "🌟", "💡", "🎯", "🚀", "💪", "🎨", "🌈", "🔥"];

export function CultureEditor({
  value,
  onChange,
  className,
  maxItems = 12,
}: CultureEditorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const addItem = () => {
    if (value.length >= maxItems) return;
    
    const newItem: CultureItem = {
      id: `culture-${Date.now()}`,
      title: "",
      description: "",
      imageUrl: "",
    };
    onChange([...value, newItem]);
    setExpandedId(newItem.id);
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

  const getRandomIcon = () => {
    return ICONS[Math.floor(Math.random() * ICONS.length)];
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
          onClick={addItem}
          disabled={value.length >= maxItems}
          size="sm"
          variant="outline"
          className="gap-1"
        >
          <Plus className="h-4 w-4" />
          Add Culture Item
        </Button>
      </div>

      {value.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center">
          <div className="text-4xl mb-2">🏢</div>
          <p className="text-slate-600 font-medium">No culture items yet</p>
          <p className="text-sm text-slate-400 mt-1">
            Add items to showcase your company culture and work environment
          </p>
          <Button
            type="button"
            onClick={addItem}
            className="mt-4"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Your First Culture Item
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {value.map((item, index) => (
            <Card key={item.id} className="overflow-hidden">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 cursor-grab">
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-lg">
                      {item.title ? getRandomIcon() : "📷"}
                    </span>
                    <span className="font-medium text-slate-900 truncate flex-1">
                      {item.title || "Untitled Culture Item"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    >
                      {expandedId === item.id ? "Collapse" : "Edit"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.id)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {expandedId === item.id && (
                <CardContent className="p-4 pt-2 space-y-4 border-t">
                  <div className="grid gap-4 md:grid-cols-2">
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
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {value.length > 0 && value.length < maxItems && (
        <Button
          type="button"
          onClick={addItem}
          variant="outline"
          className="w-full gap-1"
        >
          <Plus className="h-4 w-4" />
          Add Another Culture Item ({value.length}/{maxItems})
        </Button>
      )}
    </div>
  );
}
