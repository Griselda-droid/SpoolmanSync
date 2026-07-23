'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SpoolColorSwatch } from '@/components/spool-color-swatch';
import { buildFilament } from '@/components/reports/usage-by-spool';
import type { SpoolData } from '@/components/reports/usage-by-spool';
import { useI18n } from '@/lib/i18n';

interface TimeBucket {
  date: string;
  totalWeight: number;
  bySpoolId: Record<number, number>;
}

interface UsageOverTimeProps {
  data: TimeBucket[];
  spools: SpoolData[];
  bucket: string;
}

function formatDate(dateStr: string): string {
  const parts = dateStr.split('-');
  const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getSpoolColor(spool: SpoolData): string {
  if (spool.colorHex) return `#${spool.colorHex}`;
  if (spool.multiColorHexes) {
    const colors = spool.multiColorHexes.split(',');
    if (colors.length > 0) return `#${colors[0]}`;
  }
  return '#888888';
}


function useThemeColors() {
  const [colors, setColors] = useState({ text: '#888888', border: '#e5e5e5', primary: '#3b82f6' });

  useEffect(() => {
    function update() {
      const style = getComputedStyle(document.documentElement);
      let primary = '#3b82f6';
      try {
        const raw = style.getPropertyValue('--primary').trim();
        const el = document.createElement('div');
        el.style.color = raw.startsWith('oklch') || raw.startsWith('hsl') || raw.startsWith('rgb') ? raw : `hsl(${raw})`;
        document.body.appendChild(el);
        primary = getComputedStyle(el).color;
        document.body.removeChild(el);
      } catch { /* use fallback */ }
      setColors({
        text: style.getPropertyValue('--muted-foreground').trim() || '#888888',
        border: style.getPropertyValue('--border').trim() || '#e5e5e5',
        primary,
      });
    }
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
    return () => observer.disconnect();
  }, []);

  return colors;
}

export function UsageOverTime({ data, spools, bucket }: UsageOverTimeProps) {
  const { t } = useI18n();
  const [selectedSpoolId, setSelectedSpoolId] = useState<number | null>(null);
  const theme = useThemeColors();

  // Reset filter if the selected spool disappears from data
  useEffect(() => {
    if (selectedSpoolId !== null && !spools.some(s => s.spoolId === selectedSpoolId)) {
      setSelectedSpoolId(null);
    }
  }, [spools, selectedSpoolId]);

  const spoolLookup = useMemo(() => {
    const map = new Map<number, SpoolData>();
    for (const s of spools) map.set(s.spoolId, s);
    return map;
  }, [spools]);

  // Build chart data based on filter
  const chartData = useMemo(() => {
    if (selectedSpoolId !== null) {
      // Single spool: show that spool's weight per bucket (keep zero-fill days)
      return data.map(tb => ({
        date: tb.date,
        totalWeight: tb.bySpoolId[selectedSpoolId] || 0,
      }));
    }

    // All spools: build stacked data with a key per spool
    // Collect all spool IDs across the entire dataset
    const allIds = new Set<string>();
    for (const tb of data) {
      for (const idStr of Object.keys(tb.bySpoolId)) {
        allIds.add(idStr);
      }
    }

    // Ensure every row has every spool key (missing = 0) for proper stacking
    return data.map(tb => {
      const row: Record<string, unknown> = { date: tb.date };
      for (const idStr of allIds) {
        row[`spool_${idStr}`] = tb.bySpoolId[Number(idStr)] || 0;
      }
      return row;
    });
  }, [data, selectedSpoolId]);

  // Get all spool IDs that appear in the time data (for stacked areas)
  const spoolIdsInData = useMemo(() => {
    const ids = new Set<number>();
    for (const tb of data) {
      for (const id of Object.keys(tb.bySpoolId)) {
        ids.add(Number(id));
      }
    }
    return Array.from(ids);
  }, [data]);

  const tickStyle = { fontSize: 12, fill: theme.text };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>{t('reports.usageOverTime')}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">{t('reports.noUsageData')}</p>
        ) : (
          <>
            {/* Spool filter */}
            {spools.length > 1 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                <Button
                  variant={selectedSpoolId === null ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSelectedSpoolId(null)}
                >
                  {t('reports.allSpools')}
                </Button>
                {spools.map((spool) => (
                  <Button
                    key={spool.spoolId}
                    variant={selectedSpoolId === spool.spoolId ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs flex items-center gap-1"
                    onClick={() => setSelectedSpoolId(spool.spoolId)}
                  >
                    <SpoolColorSwatch
                      filament={buildFilament(spool)}
                      size="h-3 w-3"
                    />
                    <span className="truncate max-w-[100px]">{spool.spoolName}</span>
                  </Button>
                ))}
              </div>
            )}

            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <defs>
                  {selectedSpoolId !== null ? (
                    <linearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={getSpoolColor(spoolLookup.get(selectedSpoolId) || spools[0])}
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor={getSpoolColor(spoolLookup.get(selectedSpoolId) || spools[0])}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  ) : (
                    spoolIdsInData.map(id => {
                      const spool = spoolLookup.get(id);
                      const color = spool ? getSpoolColor(spool) : '#888888';
                      return (
                        <linearGradient key={id} id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={color} stopOpacity={0.05} />
                        </linearGradient>
                      );
                    })
                  )}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={tickStyle}
                  stroke={theme.border}
                />
                <YAxis
                  tickFormatter={(v) => `${v}g`}
                  tick={tickStyle}
                  stroke={theme.border}
                />
                <Tooltip
                  labelFormatter={(v) => formatDate(v as string)}
                  formatter={(value, name) => {
                    const weight = `${Number(value).toFixed(1)}g`;
                    if (selectedSpoolId !== null) return [weight, t('reports.usedLabel')];
                    // Resolve spool name from the key
                    const id = Number(String(name).replace('spool_', ''));
                    const spool = spoolLookup.get(id);
                    return [weight, spool?.spoolName || t('reports.spoolFallback', { id })];
                  }}
                  contentStyle={{
                    backgroundColor: 'var(--popover)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--popover-foreground)',
                  }}
                  labelStyle={{ color: 'var(--popover-foreground)' }}
                  itemStyle={{ color: 'var(--popover-foreground)' }}
                />
                {selectedSpoolId !== null ? (
                  <Area
                    type="monotone"
                    dataKey="totalWeight"
                    stroke={theme.text}
                    fill="url(#usageGradient)"
                    strokeWidth={2}
                  />
                ) : (
                  spoolIdsInData.map(id => (
                      <Area
                        key={id}
                        type="linear"
                        dataKey={`spool_${id}`}
                        stackId="1"
                        stroke={theme.text}
                        fill={`url(#grad-${id})`}
                        strokeWidth={1}
                      />
                  ))
                )}
              </AreaChart>
            </ResponsiveContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}
