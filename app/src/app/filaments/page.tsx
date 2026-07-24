'use client';

import { useEffect, useMemo, useState } from 'react';
import { Nav } from '@/components/nav';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Trash2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { Filament } from '@/lib/api/spoolman';
import { parseKValue } from '@/lib/k-value';

export default function FilamentsPage() {
  const { t } = useI18n();
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchFilaments = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/filaments');
      if (!response.ok) throw new Error('Failed to fetch filaments');
      const data = await response.json();
      setFilaments(data.filaments || []);
    } catch {
      setMessage(t('filaments.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilaments();
  }, []);

  const visibleFilaments = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return filaments;
    return filaments.filter((filament) => [
      filament.name,
      filament.material,
      filament.vendor?.name,
      filament.comment,
      String(filament.id),
    ].filter(Boolean).join(' ').toLowerCase().includes(query));
  }, [filaments, search]);

  const cleanUnused = async () => {
    if (!window.confirm(t('filaments.cleanupConfirm'))) return;
    setCleaning(true);
    setMessage(null);
    try {
      const response = await fetch('/api/filaments/cleanup-unused', { method: 'POST' });
      if (!response.ok) throw new Error('Cleanup failed');
      const data = await response.json();
      setMessage(t('filaments.cleanupDone').replace('{count}', String(data.count || 0)));
      await fetchFilaments();
    } catch {
      setMessage(t('filaments.cleanupFailed'));
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">{t('filaments.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('filaments.description')}</p>
          </div>
          <Button variant="destructive" onClick={cleanUnused} disabled={cleaning}>
            {cleaning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            {t('filaments.cleanupUnused')}
          </Button>
        </div>

        <div className="relative max-w-xl">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder={t('filaments.search')} value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>

        {message && <p className="text-sm text-muted-foreground">{message}</p>}

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : visibleFilaments.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">{t('filaments.empty')}</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {visibleFilaments.map((filament) => {
              const kValue = parseKValue(filament.comment);
              const spoolCount = filament.spool_count || 0;
              return (
                <Card key={filament.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-medium truncate">{filament.name || filament.material || `#${filament.id}`}</h2>
                        <p className="text-sm text-muted-foreground truncate">{filament.vendor?.name || '-'} · {filament.material || '-'}</p>
                      </div>
                      <Badge variant={spoolCount > 0 ? 'secondary' : 'outline'}>{spoolCount} {t('filaments.spools')}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">{t('filaments.id')}:</span> {filament.id}</div>
                      <div><span className="text-muted-foreground">{t('filaments.kValue')}:</span> {kValue === undefined ? '-' : kValue.toFixed(4)}</div>
                    </div>
                    {filament.comment && <p className="text-xs text-muted-foreground truncate">{filament.comment}</p>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
