'use client';

import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';

interface PeriodOption {
  label: string;
  days: number | null; // null = all time
}

const PERIODS = (t: (key: string) => string): PeriodOption[] => [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '1y', days: 365 },
  { label: t('reports.allTime'), days: null },
];

interface PeriodSelectorProps {
  selectedDays: number | null;
  onChange: (days: number | null) => void;
}

export function PeriodSelector({ selectedDays, onChange }: PeriodSelectorProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap gap-2">
      {PERIODS(t).map((period) => (
        <Button
          key={period.label}
          variant={selectedDays === period.days ? 'default' : 'outline'}
          size="sm"
          onClick={() => onChange(period.days)}
        >
          {period.label}
        </Button>
      ))}
    </div>
  );
}
