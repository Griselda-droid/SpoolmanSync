'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronDown } from 'lucide-react';
import type { SheetSettings, ContentSettings, LayoutSettings } from '@/lib/label-sheet-config';
import { PAPER_SIZES } from '@/lib/label-sheet-config';
import { useI18n } from '@/lib/i18n';

interface LabelSheetSettingsProps {
  sheet: SheetSettings;
  content: ContentSettings;
  layout: LayoutSettings;
  updateSheet: (partial: Partial<SheetSettings>) => void;
  updateContent: (partial: Partial<ContentSettings>) => void;
  updateLayout: (partial: Partial<LayoutSettings>) => void;
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium bg-muted/50 hover:bg-muted transition-colors"
      >
        {title}
        <ChevronDown
          className="h-4 w-4 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      {open && (
        <div className="px-3 py-3 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Shows Tabs on wider screens, Select dropdown on narrow screens.
 * Prevents tab buttons from overlapping adjacent controls at small widths.
 */
function ResponsiveTabSelect({
  value,
  onValueChange,
  options,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <>
      {/* Dropdown on small screens */}
      <div className="sm:hidden">
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {/* Tabs on wider screens */}
      <div className="hidden sm:block">
        <Tabs value={value} onValueChange={onValueChange}>
          <TabsList className="h-8 w-full">
            {options.map((o) => (
              <TabsTrigger key={o.value} value={o.value} className="text-xs px-2">{o.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
    </>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  const [localValue, setLocalValue] = useState(String(value));
  const [editing, setEditing] = useState(false);

  // Sync from props when not actively editing
  useEffect(() => {
    if (!editing) setLocalValue(String(value));
  }, [value, editing]);

  const handleBlur = () => {
    setEditing(false);
    const v = parseFloat(localValue);
    if (!isNaN(v)) {
      const clamped = Math.max(min, Math.min(max, v));
      onChange(clamped);
      setLocalValue(String(clamped));
    } else {
      setLocalValue(String(value));
    }
  };

  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min={min}
          max={max}
          step={step}
          value={localValue}
          onFocus={() => setEditing(true)}
          onChange={(e) => {
            const raw = e.target.value;
            setLocalValue(raw);
            const v = parseFloat(raw);
            if (!isNaN(v) && v >= min && v <= max) onChange(v);
          }}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="h-8 text-xs"
        />
        {suffix && <span className="text-xs text-muted-foreground whitespace-nowrap">{suffix}</span>}
      </div>
    </div>
  );
}

export function LabelSheetSettings({
  sheet,
  content,
  layout,
  updateSheet,
  updateContent,
  updateLayout,
}: LabelSheetSettingsProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-2">
      {/* Print Settings */}
      <CollapsibleSection title={t('labelSettings.print')} defaultOpen>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Paper Size */}
          <div className="space-y-1">
            <Label className="text-xs">{t('labelSettings.paperSize')}</Label>
            <Select
              value={sheet.paperSize}
              onValueChange={(v) => updateSheet({ paperSize: v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(PAPER_SIZES).map((key) => (
                  <SelectItem key={key} value={key}>{t(`labelSettings.paper.${key}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Border */}
          <div className="space-y-1">
            <Label className="text-xs">{t('labelSettings.borders')}</Label>
            <ResponsiveTabSelect
              value={sheet.borderMode}
              onValueChange={(v) => updateSheet({ borderMode: v as SheetSettings['borderMode'] })}
              options={[
                { value: 'none', label: t('labelSettings.none') },
                { value: 'border', label: t('labelSettings.border') },
                { value: 'grid', label: t('labelSettings.grid') },
              ]}
            />
          </div>
        </div>

        {/* Custom size inputs */}
        {sheet.paperSize === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            <NumberInput label={t('labelSettings.width')} value={sheet.customWidthMm} onChange={(v) => updateSheet({ customWidthMm: v })} min={10} max={500} step={0.1} suffix="mm" />
            <NumberInput label={t('labelSettings.height')} value={sheet.customHeightMm} onChange={(v) => updateSheet({ customHeightMm: v })} min={10} max={500} step={0.1} suffix="mm" />
          </div>
        )}

        <div className="grid grid-cols-4 gap-3">
          <NumberInput label={t('labelSettings.columns')} value={sheet.columns} onChange={(v) => updateSheet({ columns: v })} min={1} max={10} />
          <NumberInput label={t('labelSettings.rows')} value={sheet.rows} onChange={(v) => updateSheet({ rows: v })} min={1} max={15} />
          <NumberInput label={t('labelSettings.skip')} value={sheet.skipItems} onChange={(v) => updateSheet({ skipItems: v })} min={0} max={99} />
          <NumberInput label={t('labelSettings.copies')} value={sheet.itemCopies} onChange={(v) => updateSheet({ itemCopies: v })} min={1} max={10} />
        </div>
      </CollapsibleSection>

      {/* Content Settings */}
      <CollapsibleSection title={t('labelSettings.content')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{t('labelSettings.qrCode')}</Label>
            <ResponsiveTabSelect
              value={content.qrMode}
              onValueChange={(v) => updateContent({ qrMode: v as ContentSettings['qrMode'] })}
              options={[
                { value: 'none', label: t('labelSettings.noQr') },
                { value: 'simple', label: t('labelSettings.simple') },
                { value: 'icon', label: t('labelSettings.icon') },
              ]}
            />
          </div>
          <NumberInput
            label={t('labelSettings.textSize')}
            value={content.labelTextSizeMm}
            onChange={(v) => updateContent({ labelTextSizeMm: v })}
            min={1}
            max={10}
            step={0.5}
            suffix="mm"
          />
          <NumberInput
            label={t('labelSettings.qrScale')}
            value={content.qrScalePercent}
            onChange={(v) => updateContent({ qrScalePercent: v })}
            min={25}
            max={150}
            step={5}
            suffix="%"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="showLabel"
              checked={content.showLabel}
              onCheckedChange={(c) => updateContent({ showLabel: !!c })}
            />
            <label htmlFor="showLabel" className="text-xs">{t('labelSettings.printText')}</label>
          </div>

          {content.showLabel && (
            <div className="grid grid-cols-3 gap-2 ml-6">
              <div className="flex items-center space-x-2">
                <Checkbox id="lsVendor" checked={content.showVendor} onCheckedChange={(c) => updateContent({ showVendor: !!c })} />
                <label htmlFor="lsVendor" className="text-xs">{t('labelSettings.vendor')}</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="lsName" checked={content.showName} onCheckedChange={(c) => updateContent({ showName: !!c })} />
                <label htmlFor="lsName" className="text-xs">{t('labelSettings.name')}</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="lsMaterial" checked={content.showMaterial} onCheckedChange={(c) => updateContent({ showMaterial: !!c })} />
                <label htmlFor="lsMaterial" className="text-xs">{t('labelSettings.material')}</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="lsColor" checked={content.showColor} onCheckedChange={(c) => updateContent({ showColor: !!c })} />
                <label htmlFor="lsColor" className="text-xs">{t('labelSettings.colorDot')}</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="lsId" checked={content.showSpoolId} onCheckedChange={(c) => updateContent({ showSpoolId: !!c })} />
                <label htmlFor="lsId" className="text-xs">{t('labelSettings.spoolId')}</label>
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Layout Settings */}
      <CollapsibleSection title={t('labelSettings.layout')}>
        <div className="space-y-2">
          <Label className="text-xs font-medium">{t('labelSettings.margins')}</Label>
          <div className="grid grid-cols-4 gap-2">
            <NumberInput label={t('labelSettings.left')} value={layout.marginLeftMm} onChange={(v) => updateLayout({ marginLeftMm: v })} min={0} max={50} step={0.5} />
            <NumberInput label={t('labelSettings.top')} value={layout.marginTopMm} onChange={(v) => updateLayout({ marginTopMm: v })} min={0} max={50} step={0.5} />
            <NumberInput label={t('labelSettings.right')} value={layout.marginRightMm} onChange={(v) => updateLayout({ marginRightMm: v })} min={0} max={50} step={0.5} />
            <NumberInput label={t('labelSettings.bottom')} value={layout.marginBottomMm} onChange={(v) => updateLayout({ marginBottomMm: v })} min={0} max={50} step={0.5} />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium">{t('labelSettings.safeZones')}</Label>
          <div className="grid grid-cols-4 gap-2">
            <NumberInput label={t('labelSettings.left')} value={layout.safeZoneLeftMm} onChange={(v) => updateLayout({ safeZoneLeftMm: v })} min={0} max={20} step={0.5} />
            <NumberInput label={t('labelSettings.top')} value={layout.safeZoneTopMm} onChange={(v) => updateLayout({ safeZoneTopMm: v })} min={0} max={20} step={0.5} />
            <NumberInput label={t('labelSettings.right')} value={layout.safeZoneRightMm} onChange={(v) => updateLayout({ safeZoneRightMm: v })} min={0} max={20} step={0.5} />
            <NumberInput label={t('labelSettings.bottom')} value={layout.safeZoneBottomMm} onChange={(v) => updateLayout({ safeZoneBottomMm: v })} min={0} max={20} step={0.5} />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium">{t('labelSettings.spacing')}</Label>
          <div className="grid grid-cols-2 gap-2">
            <NumberInput label={t('labelSettings.horizontal')} value={layout.spacingHorizontalMm} onChange={(v) => updateLayout({ spacingHorizontalMm: v })} min={0} max={20} step={0.5} />
            <NumberInput label={t('labelSettings.vertical')} value={layout.spacingVerticalMm} onChange={(v) => updateLayout({ spacingVerticalMm: v })} min={0} max={20} step={0.5} />
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
