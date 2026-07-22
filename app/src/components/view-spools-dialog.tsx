'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { SpoolColorSwatch } from '@/components/spool-color-swatch';
import { toast } from 'sonner';
import { Loader2, Eye, Search } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-provider';
import type { Spool, Filament } from '@/lib/api/spoolman';

interface ViewSpoolsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SpoolWithFilament extends Spool {
  filament?: Filament;
}

export function ViewSpoolsDialog({ open, onOpenChange }: ViewSpoolsDialogProps) {
  const { t } = useI18n();
  const [spools, setSpools] = useState<SpoolWithFilament[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    Promise.all([
      fetch('/api/spools').then((res) => res.json()),
      fetch('/api/filaments').then((res) => res.json()),
    ])
      .then(([spoolsData, filamentsData]) => {
        const filamentMap = new Map(
          (filamentsData.filaments || []).map((f: Filament) => [f.id, f])
        );

        const spoolsWithFilaments = (spoolsData.spools || []).map((spool: Spool) => ({
          ...spool,
          filament: filamentMap.get(spool.filament_id),
        }));

        setSpools(spoolsWithFilaments);
      })
      .catch(() => {
        toast.error(t('spool', 'failedToLoadSpools'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, t]);

  const filteredSpools = spools.filter((spool) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      spool.filament?.name?.toLowerCase().includes(search) ||
      spool.filament?.material?.toLowerCase().includes(search) ||
      spool.filament?.vendor?.name?.toLowerCase().includes(search) ||
      spool.location?.toLowerCase().includes(search) ||
      spool.lot_nr?.toLowerCase().includes(search) ||
      spool.comment?.toLowerCase().includes(search)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            {t('spool', 'spoolsList')}
          </DialogTitle>
          <DialogDescription>
            {t('spool', 'noExistingSpools')} {spools.length} {t('spool', 'spools')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              placeholder={t('spool', 'searchFilaments')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredSpools.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {spools.length === 0 ? t('spool', 'noExistingSpools') : 'No results found'}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">{t('spool', 'filament')}</TableHead>
                    <TableHead>{t('spool', 'material')}</TableHead>
                    <TableHead>{t('spool', 'vendor')}</TableHead>
                    <TableHead className="text-right">{t('spool', 'weight')} (g)</TableHead>
                    <TableHead className="text-right">{t('spool', 'remaining')} (g)</TableHead>
                    <TableHead>{t('spool', 'location')}</TableHead>
                    <TableHead>{t('spool', 'lotNr')}</TableHead>
                    <TableHead>{t('spool', 'comment')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSpools.map((spool) => (
                    <TableRow key={spool.id}>
                      <TableCell>
                        {spool.filament && (
                          <SpoolColorSwatch
                            filament={spool.filament}
                            size="h-6 w-6"
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{spool.filament?.name}</span>
                          {spool.filament?.diameter && (
                            <span className="text-xs text-muted-foreground">
                              {spool.filament.diameter}mm {spool.filament.density && `· ${spool.filament.density}g/cm³`}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{spool.filament?.vendor?.name || 'Unknown'}</TableCell>
                      <TableCell className="text-right">
                        {spool.initial_weight?.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {(spool.initial_weight! - (spool.used_weight || 0)).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm">{spool.location || '-'}</TableCell>
                      <TableCell className="text-sm">{spool.lot_nr || '-'}</TableCell>
                      <TableCell className="text-sm max-w-xs truncate">{spool.comment || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('spool', 'cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
