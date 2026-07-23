'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/lib/i18n';

interface SummaryCardsProps {
  totalWeight: number;
  totalPrints: number;
  uniqueSpools: number;
}

export function SummaryCards({ totalWeight, totalPrints, uniqueSpools }: SummaryCardsProps) {
  const { t } = useI18n();
  const avgPerPrint = totalPrints > 0 ? totalWeight / totalPrints : 0;

  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t('reports.totalUsed')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalWeight.toFixed(1)}g</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t('reports.usageEvents')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalPrints}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t('reports.avgPerEvent')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{avgPerPrint.toFixed(1)}g</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t('reports.spoolsUsed')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{uniqueSpools}</div>
        </CardContent>
      </Card>
    </div>
  );
}
