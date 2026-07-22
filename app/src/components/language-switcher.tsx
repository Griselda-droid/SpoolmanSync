'use client';

import { useI18n, type Language } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();

  const toggle = () => {
    setLang(lang === 'zh' ? 'en' : 'zh');
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      title={t('language')}
      className="text-xs gap-1"
    >
      <Globe className="h-4 w-4" />
      {lang === 'zh' ? 'EN' : '中文'}
    </Button>
  );
}
