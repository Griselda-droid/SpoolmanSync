'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export type Language = 'zh' | 'en';

// Translation dictionary
const translations: Record<Language, Record<string, string>> = {
  zh: {
    // Nav
    'nav.dashboard': '仪表盘',
    'nav.scan': '扫描',
    'nav.reports': '报表',
    'nav.automations': '自动化',
    'nav.settings': '设置',
    'nav.logs': '日志',
    'nav.spools': '料盘列表',
    'nav.addSpool': '添加料盘',

    // Dashboard
    'dashboard.welcome': '欢迎使用 SpoolmanSync',
    'dashboard.connectPrompt': '连接您的 Home Assistant 和 Spoolman 以开始使用。',
    'dashboard.haNotConfigured': 'Home Assistant：未配置',
    'dashboard.spoolmanNotConfigured': 'Spoolman：未配置',
    'dashboard.configureSettings': '配置设置',

    // Spool List
    'spools.title': '料盘列表',
    'spools.search': '搜索料盘...',
    'spools.noSpools': '未找到料盘',
    'spools.filterAll': '全部',
    'spools.filterActive': '使用中',
    'spools.filterArchived': '已归档',
    'spools.sortNewest': '最新',
    'spools.sortOldest': '最旧',
    'spools.sortName': '名称',
    'spools.sortWeight': '剩余重量',
    'spools.remaining': '剩余',
    'spools.used': '已用',
    'spools.total': '总重',
    'spools.location': '位置',
    'spools.registered': '注册时间',
    'spools.lastUsed': '最后使用',
    'spools.loading': '加载中...',
    'spools.error': '加载失败',
    'spools.details': '详情',
    'spools.archive': '归档',
    'spools.unarchive': '取消归档',
    'spools.lotNumber': '批号',
    'spools.comment': '备注',

    // Reports
    'reports.title': '使用报表',
    'reports.totalUsage': '总用量',
    'reports.usageBySpool': '按料盘统计',
    'reports.usageOverTime': '用量趋势',

    // Scan
    'scan.title': '扫描',
    'scan.desc': '扫描 Spoolman 二维码或条形码以快速分配料盘。',
    'scan.noSpools': '未找到料盘，请先在 Spoolman 中添加。',
    'scan.writeNfc': '将料盘链接写入 NFC 标签，手机触碰即可快速分配到 AMS 槽位。',

    // Settings
    'settings.title': '设置',
    'settings.ha': 'Home Assistant',
    'settings.haDesc': '连接到您的 Home Assistant 实例以发现 Bambu Lab 打印机。',
    'settings.haUrl': 'Home Assistant URL',
    'settings.haConnect': '连接 Home Assistant',
    'settings.spoolman': 'Spoolman',
    'settings.spoolmanDesc': '连接到您的 Spoolman 实例以管理耗材料盘。',
    'settings.spoolmanUrl': 'Spoolman URL',
    'settings.spoolmanConnect': '连接',
    'settings.virtualPrinters': '虚拟打印机',
    'settings.virtualPrintersDesc': '定义存储位置（干燥箱、货架等），可分配料盘槽位。',
    'settings.qrCodeUrl': '二维码 / NFC URL',

    // Add Spool Dialog
    'addSpool.title': '添加料盘',
    'addSpool.selectDesc': '选择耗材类型以创建新料盘。',
    'addSpool.detailsDesc': '输入料盘详情。',
    'addSpool.searchFilament': '搜索耗材...',
    'addSpool.noFilaments': '未找到耗材',
    'addSpool.createFilament': '创建新耗材',
    'addSpool.cancel': '取消',
    'addSpool.back': '返回',
    'addSpool.change': '更换',
    'addSpool.creating': '创建中...',
    'addSpool.createSpool': '创建料盘',
    'addSpool.netWeight': '耗材净重',
    'addSpool.netWeightDesc': '耗材净重（克），不含料盘重量',
    'addSpool.spoolWeight': '料盘重量',
    'addSpool.spoolWeightDesc': '空料盘重量（克）',
    'addSpool.location': '存放位置',
    'addSpool.lotNumber': '批号',
    'addSpool.comment': '备注',

    // Create Filament Dialog
    'createFilament.title': '创建新耗材',
    'createFilament.desc': '在 Spoolman 中添加新的耗材类型。',
    'createFilament.name': '名称',
    'createFilament.material': '材料',
    'createFilament.vendor': '品牌',
    'createFilament.color': '颜色',
    'createFilament.density': '密度 (g/cm³)',
    'createFilament.diameter': '直径 (mm)',
    'createFilament.custom': '自定义：',
    'createFilament.create': '创建耗材',

    // Language
    'language': '语言',
    'language.zh': '中文',
    'language.en': 'English',
  },
  en: {
    // Nav
    'nav.dashboard': 'Dashboard',
    'nav.scan': 'Scan',
    'nav.reports': 'Reports',
    'nav.automations': 'Automations',
    'nav.settings': 'Settings',
    'nav.logs': 'Logs',
    'nav.spools': 'Spool List',
    'nav.addSpool': 'Add Spool',

    // Dashboard
    'dashboard.welcome': 'Welcome to SpoolmanSync',
    'dashboard.connectPrompt': 'Connect your Home Assistant and Spoolman to get started.',
    'dashboard.haNotConfigured': 'Home Assistant: Not configured',
    'dashboard.spoolmanNotConfigured': 'Spoolman: Not configured',
    'dashboard.configureSettings': 'Configure Settings',

    // Spool List
    'spools.title': 'Spool List',
    'spools.search': 'Search spools...',
    'spools.noSpools': 'No spools found',
    'spools.filterAll': 'All',
    'spools.filterActive': 'Active',
    'spools.filterArchived': 'Archived',
    'spools.sortNewest': 'Newest',
    'spools.sortOldest': 'Oldest',
    'spools.sortName': 'Name',
    'spools.sortWeight': 'Remaining',
    'spools.remaining': 'Remaining',
    'spools.used': 'Used',
    'spools.total': 'Total',
    'spools.location': 'Location',
    'spools.registered': 'Registered',
    'spools.lastUsed': 'Last Used',
    'spools.loading': 'Loading...',
    'spools.error': 'Failed to load',
    'spools.details': 'Details',
    'spools.archive': 'Archive',
    'spools.unarchive': 'Unarchive',
    'spools.lotNumber': 'Lot Number',
    'spools.comment': 'Comment',

    // Reports
    'reports.title': 'Usage Reports',
    'reports.totalUsage': 'Total Usage',
    'reports.usageBySpool': 'Usage by Spool',
    'reports.usageOverTime': 'Usage Over Time',

    // Settings
    'settings.title': 'Settings',
    'settings.ha': 'Home Assistant',
    'settings.haDesc': 'Connect to your Home Assistant instance to discover Bambu Lab printers.',
    'settings.haUrl': 'Home Assistant URL',
    'settings.haConnect': 'Connect with Home Assistant',
    'settings.spoolman': 'Spoolman',
    'settings.spoolmanDesc': 'Connect to your Spoolman instance to manage filament spools.',
    'settings.spoolmanUrl': 'Spoolman URL',
    'settings.spoolmanConnect': 'Connect',
    'settings.virtualPrinters': 'Virtual Printers',
    'settings.virtualPrintersDesc': 'Define storage locations such as dry boxes or shelves.',
    'settings.qrCodeUrl': 'QR Code / NFC URL',

    // Add Spool Dialog
    'addSpool.title': 'Add Spool',
    'addSpool.selectDesc': 'Choose a filament type to create a new spool.',
    'addSpool.detailsDesc': 'Enter spool details.',
    'addSpool.searchFilament': 'Search filaments...',
    'addSpool.noFilaments': 'No filaments found',
    'addSpool.createFilament': 'Create Filament',
    'addSpool.cancel': 'Cancel',
    'addSpool.back': 'Back',
    'addSpool.change': 'Change',
    'addSpool.creating': 'Creating...',
    'addSpool.createSpool': 'Create Spool',
    'addSpool.netWeight': 'Net Weight',
    'addSpool.netWeightDesc': 'Net filament weight in grams (spool excluded)',
    'addSpool.spoolWeight': 'Spool Weight',
    'addSpool.spoolWeightDesc': 'Empty spool weight in grams',
    'addSpool.location': 'Location',
    'addSpool.lotNumber': 'Lot Number',
    'addSpool.comment': 'Comment',

    // Create Filament Dialog
    'createFilament.title': 'Create Filament',
    'createFilament.desc': 'Add a new filament type to Spoolman.',
    'createFilament.name': 'Name',
    'createFilament.material': 'Material',
    'createFilament.vendor': 'Vendor',
    'createFilament.color': 'Color',
    'createFilament.density': 'Density (g/cm³)',
    'createFilament.diameter': 'Diameter (mm)',
    'createFilament.custom': 'Custom:',
    'createFilament.create': 'Create Filament',

    // Language
    'language': 'Language',
    'language.zh': '中文',
    'language.en': 'English',
  },
};

// Detect browser language
function detectLanguage(): Language {
  if (typeof window === 'undefined') return 'zh';
  const stored = localStorage.getItem('spoolmansync-lang') as Language | null;
  if (stored === 'zh' || stored === 'en') return stored;
  const browserLang = navigator.language.toLowerCase();
  return browserLang.startsWith('zh') ? 'zh' : 'en';
}

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'zh',
  setLang: () => {},
  t: (key: string) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('zh');

  useEffect(() => {
    setLangState(detectLanguage());
  }, []);

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('spoolmansync-lang', newLang);
  }, []);

  const t = useCallback(
    (key: string): string => {
      const dict = translations[lang];
      if (dict && dict[key]) return dict[key];
      const enDict = translations.en;
      if (enDict && enDict[key]) return enDict[key];
      return key;
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
