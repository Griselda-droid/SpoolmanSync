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
import { ViewSpoolsDialog } from '@/components/view-spools-dialog';
import { toast } from 'sonner';
import { Loader2, Plus, Check, Eye } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-provider';
import type { Filament } from '@/lib/api/spoolman';

interface AddSpoolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddSpoolDialog({ open, onOpenChange, onSuccess }: AddSpoolDialogProps) {
  const { t } = useI18n();
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [filamentsLoading, setFilamentsLoading] = useState(false);
  const [selectedFilament, setSelectedFilament] = useState<Filament | null>(null);
  const [filamentSearch, setFilamentSearch] = useState('');
  const [initialWeight, setInitialWeight] = useState('');
  const [spoolWeight, setSpoolWeight] = useState('');
  const [location, setLocation] = useState('');
  const [lotNr, setLotNr] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<'select' | 'details'>('select');
  const [viewSpoolsOpen, setViewSpoolsOpen] = useState(false);

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
        toast.error(t('spool', 'failedToLoadSpools'));
      })
      .finally(() => {
        setFilamentsLoading(false);
      });
  }, [open, t]);

  // Reset state when dialog opens/closes
  const resetForm = useCallback(() => {
    setSelectedFilament(null);
    setFilamentSearch('');
    setInitialWeight('');
    setSpoolWeight('');
    setLocation('');
    setLotNr('');
    setComment('');
    setStep('select');
  }, []);

  useEffect(() => {
    if (!open) {
      // Delay reset so the closing animation doesn't show empty state
      const timer = setTimeout(resetForm, 200);
      return () => clearTimeout(timer);
    }
  }, [open, resetForm]);

  const filteredFilaments = filaments.filter((f) => {
    if (!filamentSearch) return true;
    const search = filamentSearch.toLowerCase();
    return (
      f.name.toLowerCase().includes(search) ||
      f.material.toLowerCase().includes(search) ||
      f.vendor?.name?.toLowerCase().includes(search) ||
      f.color_hex?.toLowerCase().includes(search)
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
    setStep('details');
  };

  const handleBack = () => {
    setStep('select');
  };

  const handleSubmit = async () => {
    if (!selectedFilament) {
      toast.error(t('spool', 'pleasSelectFilament'));
      return;
    }
    if (!initialWeight || parseFloat(initialWeight) <= 0) {
      toast.error(t('spool', 'pleaseEnterValidWeight'));
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
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t('spool', 'failedToCreateSpool'));
      }

      const data = await res.json();
      toast.success(`Spool #${data.spool.id} ${t('spool', 'createSuccess')}`);
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('spool', 'failedToCreateSpool'));
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
              {t('spool', 'addSpool')}
            </DialogTitle>
            <DialogDescription>
              {step === 'select'
                ? t('spool', 'chooseSpool')
                : t('spool', 'enterSpoolDetails')}
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
                    placeholder={t('spool', 'searchFilaments')}
                    value={filamentSearch}
                    onValueChange={setFilamentSearch}
                  />
                  <CommandList className="max-h-64">
                    <CommandEmpty>{t('spool', 'noFilamentsFound')}</CommandEmpty>
                    {Object.entries(groupedFilaments).map(([vendor, items]) => (
                      <CommandGroup key={vendor} heading={vendor}>
                        {items.map((f) => (
                          <CommandItem
                            key={f.id}
                            value={`${f.id}`}
                            keywords={[f.name, f.material, f.vendor?.name ?? '', f.color_hex ?? '']}
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
                  {t('spool', 'change')}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="initialWeight">
                    {t('spool', 'initialWeight')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="initialWeight"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={t('spool', 'weightExample')}
                    value={initialWeight}
                    onChange={(e) => setInitialWeight(e.target.value)}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">{t('spool', 'totalWeightInGrams')}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="spoolWeight">{t('spool', 'spoolWeight')}</Label>
                  <Input
                    id="spoolWeight"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={t('spool', 'weightExample')}
                    value={spoolWeight}
                    onChange={(e) => setSpoolWeight(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{t('spool', 'emptySpoolWeight')}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">{t('spool', 'location')}</Label>
                <Input
                  id="location"
                  placeholder={t('spool', 'shelfExample')}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lotNr">{t('spool', 'lotNr')}</Label>
                  <Input
                    id="lotNr"
                    placeholder={t('spool', 'lotExample')}
                    value={lotNr}
                    onChange={(e) => setLotNr(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comment">{t('spool', 'comment')}</Label>
                  <Input
                    id="comment"
                    placeholder={t('spool', 'optionalNotes')}
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
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  {t('spool', 'cancel')}
                </Button>
                <Button variant="secondary" onClick={() => setViewSpoolsOpen(true)}>
                  <Eye className="mr-2 h-4 w-4" />
                  {t('spool', 'viewExistingSpools')}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleBack} disabled={submitting}>
                  {t('spool', 'back')}
                </Button>
                <Button onClick={handleSubmit} disabled={submitting || !initialWeight}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('spool', 'creating')}
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      {t('spool', 'create')}
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ViewSpoolsDialog open={viewSpoolsOpen} onOpenChange={setViewSpoolsOpen} />
    </>
  );
}
