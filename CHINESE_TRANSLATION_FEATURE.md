# SpoolmanSync Chinese Translation & Spool List Features

## Overview

This update adds comprehensive Chinese language support and a new "View Existing Spools" feature to SpoolmanSync.

## Features Added

### 1. **Internationalization (i18n) System**

- **Multi-language support**: English and Chinese (简体中文)
- **Persistent language preference**: Language choice is saved to localStorage
- **Context-based translation**: Uses React Context for efficient translations
- **Easy to extend**: Simple structure for adding more languages

#### Files:
- `app/src/lib/i18n/translations.ts` - Translation dictionaries
- `app/src/lib/i18n/i18n-context.ts` - i18n context definition
- `app/src/lib/i18n/i18n-provider.tsx` - Provider component

#### Usage:
```tsx
import { useI18n } from '@/lib/i18n/i18n-context';

function MyComponent() {
  const { t, language, setLanguage } = useI18n();
  
  return <div>{t('spool', 'addSpool')}</div>;
}
```

### 2. **Language Switcher Component**

- Located in navbar/header
- Dropdown menu with English/中文 options
- Real-time language switching
- Visual indicator of current language

#### Component: `app/src/components/language-switcher.tsx`

```tsx
import { LanguageSwitcher } from '@/components/language-switcher';

// Add to your nav/header
<LanguageSwitcher />
```

### 3. **View Existing Spools Dialog**

- **New button**: "View Existing Spools" next to "Add Spool"
- **Features**:
  - Searchable table of all spools in Spoolman
  - Columns: Filament, Material, Vendor, Total Weight, Remaining Weight, Location, Lot Number, Comment
  - Real-time filtering by any column
  - Color swatch indicators for filament colors
  - Shows remaining filament weight calculated from usage
  - Full i18n support

#### Component: `app/src/components/view-spools-dialog.tsx`

## Integration Steps

### Step 1: Wrap app with I18nProvider

Update `app/src/app/layout.tsx`:

```tsx
import { I18nProvider } from '@/lib/i18n/i18n-provider';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <I18nProvider>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
```

### Step 2: Add Language Switcher to Navigation

Update `app/src/components/nav.tsx`:

```tsx
import { LanguageSwitcher } from '@/components/language-switcher';

export function Nav() {
  return (
    <nav>
      {/* existing nav items */}
      <div className="ml-auto flex items-center gap-2">
        <LanguageSwitcher />
        {/* other nav items */}
      </div>
    </nav>
  );
}
```

### Step 3: Update Components to Use i18n

All UI text should use the `t()` function:

```tsx
const { t } = useI18n();

return (
  <Button>{t('spool', 'addSpool')}</Button>
);
```

## Translation Keys

### Available Sections:

- **nav**: Navigation items
- **dashboard**: Dashboard page
- **spool**: Spool management
- **settings**: Settings page
- **common**: Common/shared translations

### Example Translation Keys:

```typescript
// English
t('spool', 'addSpool')           // "Add Spool"
t('spool', 'viewExistingSpools') // "View Existing Spools"
t('spool', 'spoolsList')         // "Spools List"
t('spool', 'remaining')          // "Remaining"

// Chinese
t('spool', 'addSpool')           // "添加料卷"
t('spool', 'viewExistingSpools') // "查看现有料卷"
t('spool', 'spoolsList')         // "料卷列表"
t('spool', 'remaining')          // "剩余"
```

## Adding New Languages

1. Update `app/src/lib/i18n/translations.ts`:

```typescript
export const translations = {
  en: { /* ... */ },
  zh: { /* ... */ },
  es: {  // New language
    nav: { /* Spanish translations */ },
    dashboard: { /* ... */ },
    // ... other sections
  }
};
```

2. Update type definitions:

```typescript
export type LanguageCode = 'en' | 'zh' | 'es';
```

3. Update language switcher in `language-switcher.tsx`:

```tsx
<DropdownMenuItem onClick={() => setLanguage('es')}>
  Español
</DropdownMenuItem>
```

## Current Chinese Translations

### Navigation (导航)
- Dashboard → 仪表盘
- Automations → 自动化
- Scan → 扫描
- Reports → 报告
- Settings → 设置
- Logs → 日志

### Spool Management (料盘管理)
- Add Spool → 添加料卷
- View Existing Spools → 查看现有料卷
- Initial Weight → 初始重量
- Spool Weight → 料盘重量
- Location → 位置
- Lot Number → 批号
- Comment → 备注
- And 40+ more translations...

## Testing

1. **Language Persistence**:
   - Switch language
   - Refresh page
   - Language should remain the same

2. **View Spools Dialog**:
   - Click "Add Spool" button
   - Click "View Existing Spools"
   - Search and filter should work in both languages

3. **i18n Coverage**:
   - Test all dialog labels in both languages
   - Verify no untranslated strings appear

## File Structure

```
app/src/
├── components/
│   ├── add-spool-dialog.tsx (updated with i18n)
│   ├── view-spools-dialog.tsx (new)
│   └── language-switcher.tsx (new)
├── lib/
│   └── i18n/
│       ├── translations.ts (new)
│       ├── i18n-context.ts (new)
│       └── i18n-provider.tsx (new)
└── app/
    └── layout.tsx (needs i18n provider wrapper)
```

## Browser Support

- All modern browsers (Chrome, Firefox, Safari, Edge)
- Uses localStorage for persistence
- Responsive design works on mobile

## Performance

- Translation lookups are O(1) - instant
- Language switching has no re-render delay
- All translations loaded upfront (small bundle size)
- No external i18n libraries required

## Future Enhancements

- Add more languages (Spanish, German, French, etc.)
- RTL language support (Arabic, Hebrew)
- Auto-detect browser language
- Pluralization support
- Date/number formatting based on locale
