'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { SpoolColorSwatch } from '@/components/spool-color-swatch';
import { toast } from 'sonner';
import { Loader2, Plus, Check, Palette } from 'lucide-react';
import type { Filament } from '@/lib/api/spoolman';
import { parseKValue } from '@/lib/k-value';

interface FilamentProfile {
  name: string;
  filament_vendor: string;
  filament_type: string;
  filament_density: number;
  nozzle_temperature: number;
  nozzle_temperature_range_high: number;
  nozzle_temperature_range_low: number;
  k_value?: number;
}

// Preset common 3D printing filament colors
const PRESET_COLORS = [
  { label: '黑色', hex: '#000000' },
  { label: '白色', hex: '#FFFFFF' },
  { label: '红色', hex: '#FF0000' },
  { label: '蓝色', hex: '#0066FF' },
  { label: '绿色', hex: '#00CC00' },
  { label: '黄色', hex: '#FFDD00' },
  { label: '橙色', hex: '#FF6600' },
  { label: '紫色', hex: '#8000FF' },
  { label: '灰色', hex: '#808080' },
  { label: '银色', hex: '#C0C0C0' },
  { label: '棕色', hex: '#8B4513' },
  { label: '粉色', hex: '#FF69B4' },
  { label: '青色', hex: '#00CCCC' },
  { label: '金色', hex: '#FFD700' },
  { label: '透明', hex: '#E8E8E8' },
  { label: '深蓝', hex: '#000080' },
];

export function buildFilamentName(vendor: string, material: string, colorLabel?: string): string {
  return [vendor.trim(), material.trim(), colorLabel?.trim()].filter(Boolean).join(' ');
}

function colorLabelForHex(hex: string): string | undefined {
  return PRESET_COLORS.find((color) => color.hex.toLowerCase() === hex.toLowerCase())?.label;
}

interface AddSpoolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddSpoolDialog({ open, onOpenChange, onSuccess }: AddSpoolDialogProps) {
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [filamentsLoading, setFilamentsLoading] = useState(false);
  const [selectedFilament, setSelectedFilament] = useState<Filament | null>(null);
  const [filamentSearch, setFilamentSearch] = useState('');
  const [initialWeight, setInitialWeight] = useState('1000');
  const [spoolWeight, setSpoolWeight] = useState('');
  const [location, setLocation] = useState('');
  const [lotNr, setLotNr] = useState('');
  const [comment, setComment] = useState('');
  const [kValuePresets, setKValuePresets] = useState<{ nickname: string; value: number }[]>([]);
  const [selectedKValueNickname, setSelectedKValueNickname] = useState('');
  const [kValue, setKValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<'select' | 'details'>('select');

  // Create filament sub-dialog state
  const [createFilamentOpen, setCreateFilamentOpen] = useState(false);
  const [newFilamentName, setNewFilamentName] = useState('');
  const [newFilamentMaterial, setNewFilamentMaterial] = useState('');
  const [newFilamentVendor, setNewFilamentVendor] = useState('');
  const [newFilamentColor, setNewFilamentColor] = useState('');
  const [newFilamentDensity, setNewFilamentDensity] = useState('1.24');
  const [newFilamentDiameter, setNewFilamentDiameter] = useState('1.75');
  const [newFilamentKValue, setNewFilamentKValue] = useState('');
  const [creatingFilament, setCreatingFilament] = useState(false);
  const [filamentProfiles, setFilamentProfiles] = useState<Record<string, FilamentProfile>>({});
  const [filamentProfilesLoading, setFilamentProfilesLoading] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState('');

  // Vendor list fetched from Spoolman
  const [vendors, setVendors] = useState<{ id: number; name: string }[]>([]);

  // Fetch filaments when dialog opens
  useEffect(() => {
    if (!open) return;

    setFilamentsLoading(true);
    fetch('/api/filaments')
      .then((res) => res.json())
      .then((data) => {
        if (data.filaments) {
          setFilaments(data.filaments);
        }
      })
      .catch(() => {
        toast.error('加载耗材列表失败');
      })
      .finally(() => {
        setFilamentsLoading(false);
      });
  }, [open]);

  // Fetch vendors when create filament dialog opens
  useEffect(() => {
    if (!createFilamentOpen) return;
    fetch('/api/vendors')
      .then((res) => res.json())
      .then((data) => {
        if (data.vendors) setVendors(data.vendors);
      })
      .catch(() => {});
  }, [createFilamentOpen]);

  useEffect(() => {
    if (!createFilamentOpen || Object.keys(filamentProfiles).length > 0) return;
    setFilamentProfilesLoading(true);
    fetch('/api/filament-profiles')
      .then((res) => res.json())
      .then((data) => {
        if (data.profiles) setFilamentProfiles(data.profiles);
      })
      .catch(() => toast.error('加载官方耗材参数失败，可继续手动填写'))
      .finally(() => setFilamentProfilesLoading(false));
  }, [createFilamentOpen, filamentProfiles]);

  // Reset state when dialog opens/closes
  const resetForm = useCallback(() => {
    setSelectedFilament(null);
    setFilamentSearch('');
    setInitialWeight('1000');
    setSpoolWeight('');
    setLocation('');
    setLotNr('');
    setComment('');
    setSelectedKValueNickname('');
    setKValue('');
    setStep('select');
  }, []);

  useEffect(() => {
    if (!open) {
      // Delay reset so the closing animation doesn't show empty state
      const timer = setTimeout(resetForm, 200);
      return () => clearTimeout(timer);
    }
  }, [open, resetForm]);

  useEffect(() => {
    if (!open) return;
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.kValuePresets)) setKValuePresets(data.kValuePresets);
      })
      .catch(() => {});
  }, [open]);

  // Reset create filament form
  const resetCreateFilamentForm = useCallback(() => {
    setNewFilamentName('');
    setNewFilamentMaterial('');
    setNewFilamentVendor('');
    setNewFilamentColor('');
    setNewFilamentDensity('1.24');
    setNewFilamentDiameter('1.75');
    setNewFilamentKValue('');
    setSelectedProfileId('');
  }, []);

  const applyFilamentProfile = (profileId: string) => {
    setSelectedProfileId(profileId);
    const profile = filamentProfiles[profileId];
    if (!profile) return;
    setNewFilamentName(profile.name);
    const profileName = profile.name
      .replace(new RegExp(`^${profile.filament_vendor}\\s+`, 'i'), '')
      .trim();
    setNewFilamentMaterial(profileName || profile.filament_type);
    setNewFilamentVendor(profile.filament_vendor);
    setNewFilamentDensity(String(profile.filament_density));
    setNewFilamentKValue(profile.k_value === undefined ? '' : String(profile.k_value));
  };

  // Create a new filament in Spoolman
  const handleCreateFilament = async () => {
    if (!newFilamentName.trim()) {
      toast.error('请输入耗材名称');
      return;
    }

    setCreatingFilament(true);
    try {
      const res = await fetch('/api/filaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFilamentName.trim(),
          material: newFilamentMaterial.trim() || undefined,
          vendor: newFilamentVendor.trim() || undefined,
          color_hex: newFilamentColor || undefined,
          density: newFilamentDensity ? parseFloat(newFilamentDensity) : undefined,
          diameter: newFilamentDiameter ? parseFloat(newFilamentDiameter) : undefined,
          k_value: newFilamentKValue.trim() ? Number(newFilamentKValue) : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '创建耗材失败');
      }

      const data = await res.json();
      const createdFilament = data.filament;
      if (!createdFilament?.id) {
        throw new Error('创建成功但未获取到耗材信息');
      }
      toast.success(`耗材「${createdFilament.name}」创建成功`);

      // Refresh filament list
      const filamentsRes = await fetch('/api/filaments');
      const filamentsData = await filamentsRes.json();
      if (Array.isArray(filamentsData.filaments)) {
        setFilaments(filamentsData.filaments);
        // Auto-select the newly created filament
        const created = filamentsData.filaments.find((f: Filament) => f.id === createdFilament.id);
        if (created) {
          setSelectedFilament(created);
          setStep('details');
        }
      }

      setCreateFilamentOpen(false);
      resetCreateFilamentForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建耗材失败');
    } finally {
      setCreatingFilament(false);
    }
  };

  const filteredFilaments = filaments.filter((f) => {
    if (!filamentSearch || !f) return true;
    const search = filamentSearch.toLowerCase();
    return (
      (f.name ?? '').toLowerCase().includes(search) ||
      (f.material ?? '').toLowerCase().includes(search) ||
      (f.vendor?.name ?? '').toLowerCase().includes(search) ||
      (f.color_hex ?? '').toLowerCase().includes(search)
    );
  });

  // Group filaments by vendor for better UX
  const groupedFilaments: Record<string, Filament[]> = filteredFilaments.reduce(
    (acc: Record<string, Filament[]>, f: Filament) => {
      const vendorName = f.vendor?.name || 'Unknown Vendor';
      if (!acc[vendorName]) acc[vendorName] = [];
      acc[vendorName].push(f);
      return acc;
    },
    {}
  );

  const handleFilamentSelect = (filament: Filament) => {
    setSelectedFilament(filament);
    const configuredKValue = parseKValue(filament.comment);
    setKValue(configuredKValue === undefined ? '' : String(configuredKValue));
    setStep('details');
  };

  const handleBack = () => {
    setStep('select');
  };

  const handleSubmit = async () => {
    if (!selectedFilament) {
      toast.error('请选择耗材');
      return;
    }
    if (!initialWeight || parseFloat(initialWeight) <= 0) {
      toast.error('请输入有效的耗材净重');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/spools/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filament_id: selectedFilament.id,
          initial_weight: parseFloat(initialWeight),
          spool_weight: spoolWeight ? parseFloat(spoolWeight) : undefined,
          location: location.trim() || undefined,
          lot_nr: lotNr.trim() || undefined,
          comment: comment.trim() || undefined,
          k_value: kValue.trim() ? Number(kValue) : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '创建料盘失败');
      }

      const data = await res.json();
      toast.success(`料盘 #${data.spool.id} 创建成功`);
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建料盘失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            添加料盘
          </DialogTitle>
          <DialogDescription>
            {step === 'select'
              ? '选择耗材类型以创建新料盘。'
              : '输入料盘详情。'}
          </DialogDescription>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-4">
            {filamentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Command className="rounded-lg border shadow-sm" shouldFilter={false}>
                <CommandInput
                  placeholder="搜索耗材..."
                  value={filamentSearch}
                  onValueChange={setFilamentSearch}
                />
                <CommandList className="max-h-64">
                  <CommandEmpty>未找到耗材</CommandEmpty>
                  {Object.entries(groupedFilaments).map(([vendor, items]) => (
                    <CommandGroup key={vendor} heading={vendor}>
                      {items.map((f) => (
                        <CommandItem
                          key={f.id}
                          value={`${f.id}`}
                          keywords={[f.name ?? '', f.material ?? '', f.vendor?.name ?? '', f.color_hex ?? '']}
                          onSelect={() => handleFilamentSelect(f)}
                          className="flex items-center gap-3 cursor-pointer"
                        >
                          <SpoolColorSwatch
                            filament={f}
                            size="h-5 w-5"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium truncate block">{f.name}</span>
                            <span className="text-xs text-muted-foreground">{f.material}</span>
                          </div>
                          {selectedFilament?.id === f.id && (
                            <Check className="h-4 w-4 text-primary flex-shrink-0" />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
                </CommandList>
              </Command>
            )}
          </div>
        )}

        {step === 'details' && selectedFilament && (
          <div className="space-y-4">
            {/* Selected filament summary */}
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
              <SpoolColorSwatch
                filament={selectedFilament}
                size="h-8 w-8"
              />
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {selectedFilament.vendor?.name && (
                    <span className="text-muted-foreground">{selectedFilament.vendor.name} </span>
                  )}
                  {selectedFilament.name}
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedFilament.material}
                  {selectedFilament.diameter && ` · ${selectedFilament.diameter}mm`}
                  {selectedFilament.density && ` · ${selectedFilament.density}g/cm³`}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto flex-shrink-0"
                onClick={handleBack}
              >
                更换
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="initialWeight">
                  耗材净重 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="initialWeight"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="例如：1000"
                  value={initialWeight}
                  onChange={(e) => setInitialWeight(e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">耗材净重（克），不含料盘重量</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="spoolWeight">料盘重量</Label>
                <Input
                  id="spoolWeight"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="例如：200"
                  value={spoolWeight}
                  onChange={(e) => setSpoolWeight(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">空料盘重量（克）</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="k-value-nickname">K 值预设</Label>
                <Input
                  id="k-value-nickname"
                  list="k-value-presets"
                  placeholder="选择或输入昵称"
                  value={selectedKValueNickname}
                  onChange={(e) => {
                    const nickname = e.target.value;
                    setSelectedKValueNickname(nickname);
                    const preset = kValuePresets.find((item) => item.nickname === nickname);
                    if (preset) setKValue(String(preset.value));
                  }}
                />
                <datalist id="k-value-presets">
                  {kValuePresets.map((preset) => (
                    <option key={preset.nickname} value={preset.nickname} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label htmlFor="k-value">K 值</Label>
                <Input
                  id="k-value"
                  type="number"
                  step="0.0001"
                  placeholder="可手动输入"
                  value={kValue}
                  onChange={(e) => setKValue(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {parseKValue(selectedFilament?.comment) !== undefined
                    ? `耗材配置默认值：${parseKValue(selectedFilament.comment)}`
                    : '未配置耗材默认 K 值，可在此料盘中单独设置'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">存放位置</Label>
              <Input
                id="location"
                placeholder="例如：货架A、干燥箱2"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lotNr">批号</Label>
                <Input
                  id="lotNr"
                  placeholder="例如：LOT-2024-001"
                  value={lotNr}
                  onChange={(e) => setLotNr(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="comment">备注</Label>
                <Input
                  id="comment"
                  placeholder="可选备注"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'select' ? (
            <>
              <Button
                variant="outline"
                onClick={() => setCreateFilamentOpen(true)}
              >
                <Palette className="mr-2 h-4 w-4" />
                创建新耗材
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleBack} disabled={submitting}>
                返回
              </Button>
              <Button onClick={handleSubmit} disabled={submitting || !initialWeight}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    创建中...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    创建料盘
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Create Filament Sub-dialog — outside main dialog to avoid nested portal conflict */}
    <Dialog
      open={createFilamentOpen}
      onOpenChange={(open) => {
        setCreateFilamentOpen(open);
        if (!open) resetCreateFilamentForm();
      }}
    >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              创建新耗材
            </DialogTitle>
            <DialogDescription>
              在 Spoolman 中添加新的耗材类型。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="filamentName">
                  名称 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="filamentName"
                  placeholder="例如：PLA Basic"
                  value={newFilamentName}
                  onChange={(e) => setNewFilamentName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filamentMaterial">材料</Label>
                <Input
                  id="filamentMaterial"
                  placeholder="选择官方 profile 或输入材料..."
                  value={newFilamentMaterial}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewFilamentMaterial(val);
                    setNewFilamentName(buildFilamentName(newFilamentVendor, val, colorLabelForHex(newFilamentColor)));
                  }}
                />
                <select
                  aria-label="官方耗材 profile"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedProfileId}
                  onChange={(e) => applyFilamentProfile(e.target.value)}
                  disabled={filamentProfilesLoading}
                >
                  <option value="">
                    {filamentProfilesLoading ? '加载官方耗材参数...' : '选择官方 profile（可选）'}
                  </option>
                  {Object.entries(filamentProfiles)
                    .sort(([, first], [, second]) => first.name.localeCompare(second.name))
                    .map(([id, profile]) => (
                      <option key={id} value={id}>
                        {profile.name} · {profile.filament_density} g/cm³ · {id}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  选择官方 profile 会自动填充名称、材料、品牌和准确密度。
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filamentVendor">品牌</Label>
              <Input
                id="filamentVendor"
                placeholder="选择或输入品牌..."
                value={newFilamentVendor}
                list="vendor-list"
                onChange={(e) => {
                  const val = e.target.value;
                  setNewFilamentVendor(val);
                  setNewFilamentName(buildFilamentName(val, newFilamentMaterial, colorLabelForHex(newFilamentColor)));
                }}
              />
              <datalist id="vendor-list">
                {vendors.map((v) => (
                  <option key={v.id} value={v.name} />
                ))}
              </datalist>
            </div>

            {/* Color picker with presets */}
            <div className="space-y-2">
              <Label>颜色</Label>
              <div className="grid grid-cols-8 gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    title={color.label}
                    className={`h-8 w-8 rounded-full border-2 transition-all hover:scale-110 ${
                      newFilamentColor === color.hex
                        ? 'border-primary ring-2 ring-primary/30 scale-110'
                        : 'border-border hover:border-primary/50'
                    }`}
                    style={{ backgroundColor: color.hex }}
                    onClick={() => {
                      const newColor = newFilamentColor === color.hex ? '' : color.hex;
                      setNewFilamentColor(newColor);
                      setNewFilamentName(buildFilamentName(newFilamentVendor, newFilamentMaterial, newColor ? color.label : undefined));
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">自定义：</span>
                <Input
                  type="color"
                  value={newFilamentColor || '#000000'}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewFilamentColor(val);
                    setNewFilamentName(buildFilamentName(
                      newFilamentVendor,
                      newFilamentMaterial,
                      colorLabelForHex(val),
                    ));
                  }}
                  className="h-8 w-12 p-0.5 cursor-pointer"
                />
                <Input
                  placeholder="#000000"
                  value={newFilamentColor}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewFilamentColor(val);
                    setNewFilamentName(buildFilamentName(
                      newFilamentVendor,
                      newFilamentMaterial,
                      colorLabelForHex(val),
                    ));
                  }}
                  className="h-8 w-28 font-mono text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="filamentDensity">密度 (g/cm³)</Label>
                <Input
                  id="filamentDensity"
                  type="number"
                  step="0.01"
                  min="0.5"
                  max="5"
                  placeholder="1.24"
                  value={newFilamentDensity}
                  onChange={(e) => setNewFilamentDensity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filamentDiameter">直径 (mm)</Label>
                <Input
                  id="filamentDiameter"
                  type="number"
                  step="0.01"
                  min="0.5"
                  max="5"
                  placeholder="1.75"
                  value={newFilamentDiameter}
                  onChange={(e) => setNewFilamentDiameter(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filamentKValue">K 值</Label>
                <Input
                  id="filamentKValue"
                  type="number"
                  step="0.001"
                  min="0"
                  max="2"
                  placeholder="例如 0.032"
                  value={newFilamentKValue}
                  onChange={(e) => setNewFilamentKValue(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateFilamentOpen(false);
                resetCreateFilamentForm();
              }}
              disabled={creatingFilament}
            >
              取消
            </Button>
            <Button onClick={handleCreateFilament} disabled={creatingFilament || !newFilamentName.trim()}>
              {creatingFilament ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  创建中...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  创建耗材
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
    );
  }
