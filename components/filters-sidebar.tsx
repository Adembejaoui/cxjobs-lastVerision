'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

const ACTIVITY_TYPES = [
  { id: 'customer-service', label: 'Customer Service' },
  { id: 'sales', label: 'Sales & Telesales' },
  { id: 'technical-support', label: 'Technical Support' },
  { id: 'back-office', label: 'Back Office' },
  { id: 'retention', label: 'Retention' },
  { id: 'collections', label: 'Collections' },
];

const WORK_MODES = [
  { id: 'onsite', label: 'On-site' },
  { id: 'remote', label: 'Remote' },
  { id: 'hybrid', label: 'Hybrid' },
];

interface FiltersSidebarProps {
  selectedFilters: Record<string, boolean>;
  onFilterChange: (filters: Record<string, boolean>) => void;
}

export function FiltersSidebar({
  selectedFilters,
  onFilterChange,
}: FiltersSidebarProps) {
  const handleFilterChange = (filterId: string, checked: boolean) => {
    onFilterChange({
      ...selectedFilters,
      [filterId]: checked,
    });
  };

  const handleClearAll = () => {
    onFilterChange({});
  };

  return (
    <div className="w-64 flex-shrink-0">
      {/* Filters Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-slate-900">Filters</h3>
          <button
            onClick={handleClearAll}
            className="text-sm text-green-600 hover:text-green-700 font-medium"
          >
            Clear All
          </button>
        </div>

        {/* Activity Type */}
        <div className="mb-8">
          <h4 className="text-xs font-bold text-gray-500 uppercase mb-4">
            Activity Type
          </h4>
          <div className="space-y-3">
            {ACTIVITY_TYPES.map((type) => (
              <div key={type.id} className="flex items-center">
                <Checkbox
                  id={type.id}
                  checked={selectedFilters[type.id] || false}
                  onCheckedChange={(checked) =>
                    handleFilterChange(type.id, checked as boolean)
                  }
                  className="rounded"
                />
                <Label
                  htmlFor={type.id}
                  className="ml-3 text-sm text-gray-700 cursor-pointer font-normal"
                >
                  {type.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Work Mode */}
        <div className="mb-8">
          <h4 className="text-xs font-bold text-gray-500 uppercase mb-4">
            Work Mode
          </h4>
          <div className="space-y-3">
            {WORK_MODES.map((mode) => (
              <div key={mode.id} className="flex items-center">
                <Checkbox
                  id={mode.id}
                  checked={selectedFilters[mode.id] || false}
                  onCheckedChange={(checked) =>
                    handleFilterChange(mode.id, checked as boolean)
                  }
                  className="rounded"
                />
                <Label
                  htmlFor={mode.id}
                  className="ml-3 text-sm text-gray-700 cursor-pointer font-normal"
                >
                  {mode.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Salary */}
        <div>
          <h4 className="text-xs font-bold text-gray-500 uppercase mb-4">
            Monthly Salary
          </h4>
          <div className="space-y-4">
            <Slider
              min={1000}
              max={10000}
              step={100}
              defaultValue={[5000]}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-600">
              <span>$1k</span>
              <span>$10k+</span>
            </div>
          </div>
        </div>
      </div>

      {/* Featured BPO Card */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-800 rounded-lg p-6 text-white">
        <div className="text-xs font-bold text-gray-400 uppercase mb-4">
          Featured BPO
        </div>
        <div className="bg-slate-800 rounded-lg p-4 mb-6 flex items-center justify-center h-24 border border-slate-700">
          <span className="text-3xl">🏢</span>
        </div>
        <h3 className="font-bold text-lg mb-3">Join Our Global Support Team</h3>
        <p className="text-sm text-slate-300 mb-6 leading-relaxed">
          Velocity Retail is hiring 200+ agents this month! World-class brands,
          competitive pay, and growth opportunities await.
        </p>
        <ul className="space-y-2 mb-6 text-sm">
          <li className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            Signing Bonus up to $500
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            HMO on Day 1
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            Night Differential Pay
          </li>
        </ul>
        <Button className="w-full bg-green-500 hover:bg-green-600 text-slate-900 font-bold">
          Apply Now
        </Button>
      </div>
    </div>
  );
}
