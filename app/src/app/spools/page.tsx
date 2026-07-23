'use client';

import { useState, useEffect, useMemo } from 'react';
import { Nav } from '@/components/nav';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SpoolColorSwatch } from '@/components/spool-color-swatch';
import { useI18n } from '@/lib/i18n';
import { Loader2, Search, ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import type { Spool } from '@/lib/api/spoolman';

type SortField = 'registered' | 'name' | 'remaining_weight';
type SortDir = 'asc' | 'desc';
type FilterType = 'all' | 'active' | 'archived';

export default function SpoolsPage() {
  const { t } = useI18n();
  const [spools, setSpools] = useState<Spool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortField, setSortField] = useState<SortField>('registered');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedSpool, setSelectedSpool] = useState<Spool | null>(null);

  useEffect(() => {
    fetchSpools();
  }, []);

  const fetchSpools = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/spools');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setSpools(data.spools || []);
    } catch (err) {
      setError(t('spools.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const filteredAndSorted = useMemo(() => {
    let result = [...spools];

    // Filter
    if (filter === 'active') result = result.filter((s) => !s.archived);
    if (filter === 'archived') result = result.filter((s) => s.archived);

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          (s.filament?.name ?? '').toLowerCase().includes(q) ||
          (s.filament?.material ?? '').toLowerCase().includes(q) ||
          (s.filament?.vendor?.name ?? '').toLowerCase().includes(q) ||
          (s.location ?? '').toLowerCase().includes(q) ||
          (s.lot_nr ?? '').toLowerCase().includes(q) ||
          (s.comment ?? '').toLowerCase().includes(q) ||
          s.id.toString().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = (a.filament?.name ?? '').localeCompare(b.filament?.name ?? '');
      } else if (sortField === 'remaining_weight') {
        cmp = (a.remaining_weight ?? 0) - (b.remaining_weight ?? 0);
      } else {
        cmp = new Date(a.registered).getTime() - new Date(b.registered).getTime();
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [spools, search, filter, sortField, sortDir]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Nav />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 space-y-4">
        <h1 className="text-xl md:text-2xl font-bold">{t('spools.title')}</h1>

        {/* Toolbar: search + filter + sort */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('spools.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex gap-1">
            {(['all', 'active', 'archived'] as FilterType[]).map((f) => (
              <Button
                key={f}
                variant={filter === f ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(f)}
              >
                {t(`spools.filter${f.charAt(0).toUpperCase() + f.slice(1)}`)}
              </Button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold">{filteredAndSorted.length}</div>
              <div className="text-xs text-muted-foreground">
                {filter === 'all' ? t('spools.filterAll') : filter === 'active' ? t('spools.filterActive') : t('spools.filterArchived')}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold">
                {Math.round(filteredAndSorted.reduce((sum, s) => sum + (s.remaining_weight || 0), 0))}g
              </div>
              <div className="text-xs text-muted-foreground">{t('spools.remaining')}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold">
                {Math.round(filteredAndSorted.reduce((sum, s) => sum + (s.used_weight || 0), 0))}g
              </div>
              <div className="text-xs text-muted-foreground">{t('spools.used')}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold">
                {filteredAndSorted.filter((s) => !s.archived).length}
              </div>
              <div className="text-xs text-muted-foreground">{t('spools.filterActive')}</div>
            </CardContent>
          </Card>
        </div>

        {/* Sort controls */}
        <div className="flex gap-2 text-sm text-muted-foreground">
          <span className="py-1">{t('spools.sortNewest')}:</span>
          {([
            { field: 'registered' as SortField, label: t('spools.sortNewest') },
            { field: 'name' as SortField, label: t('spools.sortName') },
            { field: 'remaining_weight' as SortField, label: t('spools.sortWeight') },
          ]).map(({ field, label }) => (
            <Button
              key={field}
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => handleSort(field)}
            >
              {label}
              {sortField === field && (sortDir === 'asc' ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />)}
            </Button>
          ))}
        </div>

        {/* Spool list */}
        {error ? (
          <div className="text-center py-10 text-destructive">{error}</div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">{t('spools.noSpools')}</div>
        ) : (
          <div className="space-y-2">
            {filteredAndSorted.map((spool) => (
              <Card
                key={spool.id}
                className={`cursor-pointer hover:bg-accent/50 transition-colors ${
                  selectedSpool?.id === spool.id ? 'ring-2 ring-primary' : ''
                } ${spool.archived ? 'opacity-60' : ''}`}
                onClick={() => setSelectedSpool(selectedSpool?.id === spool.id ? null : spool)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <SpoolColorSwatch filament={spool.filament} size="h-8 w-8" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">
                          {spool.filament?.vendor?.name && (
                            <span className="text-muted-foreground">{spool.filament.vendor.name} </span>
                          )}
                          {spool.filament?.name || spool.filament?.material || `#${spool.id}`}
                        </span>
                        {spool.archived && (
                          <Badge variant="secondary" className="text-xs">{t('spools.filterArchived')}</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {spool.filament?.material && `${spool.filament.material} · `}
                        {t('spools.remaining')}: {Math.round(spool.remaining_weight || 0)}g
                        {spool.location && ` · ${spool.location}`}
                      </div>
                    </div>
                    <div className="text-right text-sm flex-shrink-0">
                      <div className="font-medium">#{spool.id}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(spool.registered).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {selectedSpool?.id === spool.id && (
                    <div className="mt-3 pt-3 border-t grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">{t('spools.total')}:</span>
                        <span className="ml-1 font-medium">{Math.round(spool.initial_weight || 0)}g</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t('spools.remaining')}:</span>
                        <span className="ml-1 font-medium">{Math.round(spool.remaining_weight || 0)}g</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t('spools.used')}:</span>
                        <span className="ml-1 font-medium">{Math.round(spool.used_weight || 0)}g</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t('spools.location')}:</span>
                        <span className="ml-1 font-medium">{spool.location || '-'}</span>
                      </div>
                      {spool.lot_nr && (
                        <div>
                          <span className="text-muted-foreground">{t('spools.lotNumber')}:</span>
                          <span className="ml-1 font-medium">{spool.lot_nr}</span>
                        </div>
                      )}
                      {spool.comment && (
                        <div>
                          <span className="text-muted-foreground">{t('spools.comment')}:</span>
                          <span className="ml-1">{spool.comment}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">{t('spools.registered')}:</span>
                        <span className="ml-1">{new Date(spool.registered).toLocaleString()}</span>
                      </div>
                      {spool.last_used && (
                        <div>
                          <span className="text-muted-foreground">{t('spools.lastUsed')}:</span>
                          <span className="ml-1">{new Date(spool.last_used).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Footer stats */}
        <div className="text-center text-xs text-muted-foreground py-4">
          {filteredAndSorted.length} {t('spools.filterAll').toLowerCase()} ·{' '}
          {Math.round(filteredAndSorted.reduce((sum, s) => sum + (s.remaining_weight || 0), 0))}g {t('spools.remaining').toLowerCase()} ·{' '}
          {Math.round(filteredAndSorted.reduce((sum, s) => sum + (s.used_weight || 0), 0))}g {t('spools.used').toLowerCase()}
        </div>
      </main>
    </div>
  );
}
