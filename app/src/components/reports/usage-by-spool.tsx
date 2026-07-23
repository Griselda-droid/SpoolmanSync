'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SpoolColorSwatch } from '@/components/spool-color-swatch';
import type { Filament } from '@/lib/api/spoolman';
import { useI18n } from '@/lib/i18n';

export interface SpoolData {
  spoolId: number;
  spoolName: string;
  material: string;
  vendor: string;
  colorHex: string | null;
  multiColorHexes: string | null;
  multiColorDirection: string | null;
  totalWeight: number;
  eventCount: number;
}

interface UsageBySpoolProps {
  data: SpoolData[];
}

const DEFAULT_VISIBLE = 10;

function getBarColor(item: SpoolData): string {
  if (item.colorHex) return `#${item.colorHex}`;
  if (item.multiColorHexes) {
    const colors = item.multiColorHexes.split(',');
    if (colors.length > 0) return `#${colors[0]}`;
  }
  return '#888888';
}


function getGradientId(spoolId: number): string {
  return `spool-gradient-${spoolId}`;
}

function hasMultiColor(item: SpoolData): boolean {
  if (!item.multiColorHexes) return false;
  return item.multiColorHexes.split(',').length > 1;
}

export function buildFilament(item: SpoolData): Filament {
  return {
    id: 0,
    name: '',
    vendor: { id: 0, name: item.vendor, registered: '' },
    material: item.material,
    color_hex: item.colorHex,
    multi_color_hexes: item.multiColorHexes,
    multi_color_direction: item.multiColorDirection as Filament['multi_color_direction'],
    density: 0,
    diameter: 0,
  };
}

function useThemeColors() {
  const [colors, setColors] = useState({ text: '#888888', border: '#e5e5e5' });

  useEffect(() => {
    function update() {
      const style = getComputedStyle(document.documentElement);
      setColors({
        text: style.getPropertyValue('--muted-foreground').trim() || '#888888',
        border: style.getPropertyValue('--border').trim() || '#e5e5e5',
      });
    }
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
    return () => observer.disconnect();
  }, []);

  return colors;
}

export function UsageBySpool({ data }: UsageBySpoolProps) {
  const { t } = useI18n();
  const [showAll, setShowAll] = useState(false);
  const [materialFilter, setMaterialFilter] = useState<string | null>(null);
  const theme = useThemeColors();

  // Get unique materials that have usage
  const materials = useMemo(() => {
    const set = new Set(data.map(d => d.material));
    return Array.from(set).sort();
  }, [data]);

  // Map unique spoolId -> display name (the category axis keys on spoolId so each
  // bar resolves to its own spool; this map renders the readable name for ticks/tooltip)
  const nameById = useMemo(() => new Map(data.map(d => [d.spoolId, d.spoolName])), [data]);

  // Reset filter if the selected material disappears from data
  useEffect(() => {
    if (materialFilter && !materials.includes(materialFilter)) {
      setMaterialFilter(null);
    }
  }, [materials, materialFilter]);

  const filteredData = materialFilter
    ? data.filter(d => d.material === materialFilter)
    : data;

  const chartData = showAll ? filteredData : filteredData.slice(0, DEFAULT_VISIBLE);
  const hasMore = filteredData.length > DEFAULT_VISIBLE;

  const tickStyle = { fontSize: 12, fill: theme.text };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>{t('reports.usageBySpool')}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">{t('reports.noUsageData')}</p>
        ) : (
          <>
            {/* Material filter */}
            {materials.length > 1 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                <Button
                  variant={materialFilter === null ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setMaterialFilter(null)}
                >
                  {t('reports.allMaterials')}
                </Button>
                {materials.map((mat) => (
                  <Button
                    key={mat}
                    variant={materialFilter === mat ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setMaterialFilter(mat)}
                  >
                    {mat}
                  </Button>
                ))}
              </div>
            )}

            <Tabs defaultValue="chart">
              <TabsList>
                <TabsTrigger value="chart">{t('reports.chart')}</TabsTrigger>
                <TabsTrigger value="table">{t('reports.table')}</TabsTrigger>
              </TabsList>

              <TabsContent value="chart">
                {chartData.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">{t('reports.noSpoolsMatch')}</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 40)}>
                      <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <defs>
                          {chartData.filter(hasMultiColor).map((item) => {
                            const colors = item.multiColorHexes!.split(',');
                            return (
                              <linearGradient
                                key={item.spoolId}
                                id={getGradientId(item.spoolId)}
                                x1="0"
                                y1="0"
                                x2="1"
                                y2="0"
                              >
                                {colors.map((hex, i) => (
                                  <stop
                                    key={i}
                                    offset={`${(i / (colors.length - 1)) * 100}%`}
                                    stopColor={`#${hex}`}
                                  />
                                ))}
                              </linearGradient>
                            );
                          })}
                        </defs>
                        <XAxis
                          type="number"
                          tickFormatter={(v) => `${v}g`}
                          tick={tickStyle}
                          stroke={theme.border}
                        />
                        <YAxis
                          type="category"
                          dataKey="spoolId"
                          tickFormatter={(id) => nameById.get(Number(id)) ?? `#${id}`}
                          width={150}
                          tick={tickStyle}
                          stroke={theme.border}
                        />
                        <Tooltip
                          formatter={(value) => [`${Number(value).toFixed(1)}g`, t('reports.usedLabel')]}
                          labelFormatter={(id) => nameById.get(Number(id)) ?? `#${id}`}
                          contentStyle={{
                            backgroundColor: 'var(--popover)',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            color: 'var(--popover-foreground)',
                          }}
                          labelStyle={{ color: 'var(--popover-foreground)' }}
                          itemStyle={{ color: 'var(--popover-foreground)' }}
                        />
                        <Bar dataKey="totalWeight" radius={[0, 4, 4, 0]}>
                          {chartData.map((item) => (
                            <Cell
                              key={item.spoolId}
                              fill={
                                hasMultiColor(item)
                                  ? `url(#${getGradientId(item.spoolId)})`
                                  : getBarColor(item)
                              }
                              stroke={theme.text}
                              strokeWidth={1}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    {hasMore && (
                      <div className="mt-2 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowAll(!showAll)}
                        >
                          {showAll ? t('reports.showTop10') : t('reports.showAllSpools', { count: filteredData.length })}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="table">
                {filteredData.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">{t('reports.noSpoolsMatch')}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 pr-4">{t('reports.spool')}</th>
                          <th className="pb-2 pr-4 hidden sm:table-cell">{t('labelSettings.material')}</th>
                          <th className="pb-2 pr-4 hidden md:table-cell">{t('labelSettings.vendor')}</th>
                          <th className="pb-2 pr-4 text-right">{t('reports.used')}</th>
                          <th className="pb-2 text-right">{t('reports.prints')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredData.map((item) => (
                          <tr key={item.spoolId} className="border-b last:border-0">
                            <td className="py-2 pr-4">
                              <div className="flex items-center gap-2">
                                <SpoolColorSwatch
                                  filament={buildFilament(item)}
                                  size="h-5 w-5"
                                />
                                <span className="truncate max-w-[200px]">{item.spoolName}</span>
                              </div>
                            </td>
                            <td className="py-2 pr-4 hidden sm:table-cell text-muted-foreground">
                              {item.material}
                            </td>
                            <td className="py-2 pr-4 hidden md:table-cell text-muted-foreground">
                              {item.vendor}
                            </td>
                            <td className="py-2 pr-4 text-right font-medium">
                              {item.totalWeight.toFixed(1)}g
                            </td>
                            <td className="py-2 text-right text-muted-foreground">
                              {item.eventCount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  );
}
