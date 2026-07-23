'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Nav } from '@/components/nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { AddPrinterDialog } from '@/components/add-printer-dialog';
import type { AlertConfig, ActiveAlert, AvailableGroup } from '@/lib/alerts';
import { useI18n } from '@/lib/i18n';

interface FilterField {
  key: string;
  name: string;
  values: string[];
  builtIn: boolean;
}

interface AdminCredentials {
  username: string;
  hasPassword: boolean;
}

interface KValuePreset {
  nickname: string;
  value: number;
}

interface Settings {
  embeddedMode: boolean;
  addonMode?: boolean;
  homeassistant: {
    url: string;
    connected: boolean;
    adminCredentials?: AdminCredentials | null;
    error?: string;
  } | null;
  spoolman: { url: string; connected: boolean } | null;
  neverAutoClearTray?: boolean;
  webhookConfigured?: boolean;
  kValuePresets?: KValuePreset[];
}

interface ConfigEntry {
  entry_id: string;
  domain: string;
  title: string;
  state: string;
}

interface VirtualPrinterSlot {
  id: string;
  number: number;
}

interface VirtualPrinter {
  id: string;
  name: string;
  slots: VirtualPrinterSlot[];
}

function SettingsContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [haUrl, setHaUrl] = useState('');
  const [spoolmanUrl, setSpoolmanUrl] = useState('');
  const [saving, setSaving] = useState<'ha' | 'spoolman' | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Printer states
  const [printers, setPrinters] = useState<ConfigEntry[]>([]);
  const [hiddenPrinters, setHiddenPrinters] = useState<ConfigEntry[]>([]);
  const [addPrinterOpen, setAddPrinterOpen] = useState(false);
  const [removingPrinter, setRemovingPrinter] = useState<string | null>(null);
  const [readdingPrinter, setReaddingPrinter] = useState<string | null>(null);

  // Admin credentials state (embedded mode)
  // Password is no longer returned on load; it is fetched on demand via the reveal endpoint.
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [revealingPassword, setRevealingPassword] = useState(false);

  // Reconnect form state (embedded mode, broken connection)
  const [reconnectUsername, setReconnectUsername] = useState('admin');
  const [reconnectPassword, setReconnectPassword] = useState('');
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectError, setReconnectError] = useState('');

  // Filter configuration states
  const [filterFields, setFilterFields] = useState<FilterField[]>([]);
  const [enabledFilters, setEnabledFilters] = useState<string[]>([]);
  const [savingFilters, setSavingFilters] = useState(false);

  // Dashboard display settings
  const [showSpoolLocation, setShowSpoolLocation] = useState(false);

  // Sync behavior settings
  const [neverAutoClearTray, setNeverAutoClearTray] = useState(false);
  const [syncSpoolmanLocation, setSyncSpoolmanLocation] = useState(false);
  const [kValuePresets, setKValuePresets] = useState<KValuePreset[]>([]);
  const [newKValueNickname, setNewKValueNickname] = useState('');
  const [newKValue, setNewKValue] = useState('');
  const [savingKValues, setSavingKValues] = useState(false);

  // QR base URL state
  const [qrBaseUrl, setQrBaseUrl] = useState('');
  const [savingQrUrl, setSavingQrUrl] = useState(false);

  // Alert configuration states
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    enabled: false,
    thresholdType: 'percentage',
    thresholdValue: 10,
    groupingStrategy: 'material',
  });
  const [activeAlerts, setActiveAlerts] = useState<ActiveAlert[]>([]);
  const [availableGroups, setAvailableGroups] = useState<AvailableGroup[]>([]);
  const [savingAlerts, setSavingAlerts] = useState(false);

  // Virtual printers states
  const [virtualPrinters, setVirtualPrinters] = useState<VirtualPrinter[]>([]);
  const [newVpName, setNewVpName] = useState('');
  const [newVpSlotCount, setNewVpSlotCount] = useState(1);
  const [existingLocations, setExistingLocations] = useState<string[]>([]);
  const [creatingVp, setCreatingVp] = useState(false);
  const [mutatingVp, setMutatingVp] = useState<string | null>(null);
  const [editingVpName, setEditingVpName] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchSettings();
    fetchVirtualPrinters();
    fetchExistingLocations();

    // Handle OAuth callback messages
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'ha_connected') {
      toast.success(t('settings.haConnected'));
      window.history.replaceState({}, '', '/settings');
    } else if (error) {
      const errorMessages: Record<string, string> = {
        missing_params: 'OAuth callback missing parameters',
        invalid_state: 'Invalid OAuth state - please try again',
        token_exchange_failed: 'Failed to exchange authorization code',
        oauth_failed: 'OAuth authentication failed',
      };
      toast.error(errorMessages[error] || t('settings.authFailed'));
      window.history.replaceState({}, '', '/settings');
    }
  }, [searchParams]);

  // Fetch printers when HA is connected, and poll to stay in sync
  // with changes made directly in HA (e.g. printer added/removed in ha-bambulab)
  useEffect(() => {
    if (settings?.homeassistant?.connected) {
      fetchPrinters();
      const interval = setInterval(fetchPrinters, 10000);
      return () => clearInterval(interval);
    }
  }, [settings?.homeassistant?.connected]);

  // Fetch filter fields and alert config when Spoolman is connected
  useEffect(() => {
    if (settings?.spoolman) {
      fetchFilterFields();
      fetchAlertConfig();
    }
  }, [settings?.spoolman]);

  // Auto-refresh settings when in embedded mode and waiting for HA
  useEffect(() => {
    if (settings?.embeddedMode && !settings?.homeassistant && !loading) {
      const interval = setInterval(() => {
        fetchSettings();
      }, 3000); // Poll every 3 seconds
      return () => clearInterval(interval);
    }
  }, [settings?.embeddedMode, settings?.homeassistant, loading]);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setSettings(data);

      if (data.homeassistant) {
        setHaUrl(data.homeassistant.url);
      }
      if (data.spoolman) {
        setSpoolmanUrl(data.spoolman.url);
      }
      if (data.qrBaseUrl !== undefined) {
        setQrBaseUrl(data.qrBaseUrl);
      }
      if (data.showSpoolLocation !== undefined) {
        setShowSpoolLocation(data.showSpoolLocation);
      }
      if (data.neverAutoClearTray !== undefined) {
        setNeverAutoClearTray(data.neverAutoClearTray);
      }
      if (data.syncSpoolmanLocation !== undefined) {
        setSyncSpoolmanLocation(data.syncSpoolmanLocation);
      }
      if (Array.isArray(data.kValuePresets)) {
        setKValuePresets(data.kValuePresets);
      }
    } catch {
      toast.error(t('settings.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const fetchPrinters = async () => {
    try {
      const res = await fetch('/api/printers/setup');
      if (res.ok) {
        const data = await res.json();
        setPrinters(data.entries || []);
        setHiddenPrinters(data.hiddenEntries || []);
      }
    } catch {
      // Silently fail - HA might not be connected yet
    }
  };

  const removePrinter = async (entryId: string) => {
    setRemovingPrinter(entryId);
    try {
      const res = await fetch('/api/printers/setup', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId }),
      });

      if (!res.ok) {
        throw new Error('Failed to remove printer');
      }

      toast.success(t('settings.printerRemoved'));
      fetchPrinters();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settings.printerRemoveFailed'));
    } finally {
      setRemovingPrinter(null);
    }
  };

  const readdPrinter = async (entryId: string) => {
    setReaddingPrinter(entryId);
    try {
      const res = await fetch('/api/printers/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unhide', entryId }),
      });

      if (!res.ok) {
        throw new Error('Failed to re-add printer');
      }

      toast.success(t('settings.printerReAdded'));
      fetchPrinters();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settings.printerReAddFailed'));
    } finally {
      setReaddingPrinter(null);
    }
  };

  const connectHomeAssistant = async () => {
    if (!haUrl) {
      toast.error(t('settings.enterHaUrl'));
      return;
    }

    setConnecting(true);
    try {
      const res = await fetch(`/api/auth/ha?ha_url=${encodeURIComponent(haUrl)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start authentication');
      }

      window.location.href = data.authUrl;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settings.haConnectFailed'));
      setConnecting(false);
    }
  };

  const disconnectHomeAssistant = async () => {
    setSaving('ha');
    try {
      const res = await fetch('/api/settings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'homeassistant' }),
      });

      if (!res.ok) {
        throw new Error('Failed to disconnect');
      }

      toast.success(t('settings.haDisconnected'));
      setSettings(prev => prev ? { ...prev, homeassistant: null } : null);
      setHaUrl('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settings.disconnectFailed'));
    } finally {
      setSaving(null);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch {
      toast.error(t('settings.copyFailed'));
    }
  };

  const revealPassword = async () => {
    setRevealingPassword(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'reveal_ha_password' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to reveal password');
      }
      const data = await res.json();
      setRevealedPassword(data.password ?? '');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settings.revealFailed'));
    } finally {
      setRevealingPassword(false);
    }
  };

  const reconnectHomeAssistant = async () => {
    if (!reconnectPassword) {
      toast.error(t('settings.enterHaPassword'));
      return;
    }

    setReconnecting(true);
    setReconnectError('');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'reconnect_ha',
          username: reconnectUsername,
          password: reconnectPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reconnect');
      }

      toast.success(t('settings.reconnected'));
      setReconnectPassword('');
      setReconnectError('');
      fetchSettings();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reconnect';
      setReconnectError(message);
      toast.error(message);
    } finally {
      setReconnecting(false);
    }
  };

  const saveSpoolmanSettings = async () => {
    setSaving('spoolman');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'spoolman',
          url: spoolmanUrl,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      toast.success(t('settings.spoolmanConnected'));
      fetchSettings();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settings.spoolmanConnectFailed'));
    } finally {
      setSaving(null);
    }
  };

  const fetchFilterFields = async () => {
    try {
      const res = await fetch('/api/spools/extra-fields');
      if (res.ok) {
        const data = await res.json();
        setFilterFields(data.fields || []);
        setEnabledFilters(data.filterConfig || []);
      }
    } catch {
      // Silently fail - Spoolman might not be connected yet
    }
  };

  const saveFilterConfig = async (newConfig: string[]) => {
    setSavingFilters(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'filter_config',
          config: newConfig,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save filter configuration');
      }

      setEnabledFilters(newConfig);
      toast.success(t('settings.filtersSaved'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settings.filtersSaveFailed'));
    } finally {
      setSavingFilters(false);
    }
  };

  const saveKValuePresets = async (presets: KValuePreset[]) => {
    setSavingKValues(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'k_value_presets', presets }),
      });
      if (!res.ok) throw new Error('保存 K 值设置失败');
      setKValuePresets(presets);
      toast.success(t('settings.kValuesSaved'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settings.kValuesSaveFailed'));
    } finally {
      setSavingKValues(false);
    }
  };

  const addKValuePreset = () => {
    const nickname = newKValueNickname.trim();
    const value = Number(newKValue);
    if (!nickname || !Number.isFinite(value)) {
      toast.error(t('settings.kValueInvalid'));
      return;
    }
    if (kValuePresets.some((preset) => preset.nickname === nickname)) {
      toast.error(t('settings.kNicknameExists'));
      return;
    }
    void saveKValuePresets([...kValuePresets, { nickname, value }]);
    setNewKValueNickname('');
    setNewKValue('');
  };

  const toggleFilter = (fieldKey: string) => {
    const newConfig = enabledFilters.includes(fieldKey)
      ? enabledFilters.filter((k) => k !== fieldKey)
      : [...enabledFilters, fieldKey];
    saveFilterConfig(newConfig);
  };

  const fetchAlertConfig = async () => {
    try {
      const res = await fetch('/api/alerts');
      if (res.ok) {
        const data = await res.json();
        if (data.config) setAlertConfig(data.config);
        if (data.alerts) setActiveAlerts(data.alerts);
        if (data.availableGroups) setAvailableGroups(data.availableGroups);
      }
    } catch {
      // Silently fail
    }
  };

  const fetchAvailableGroups = async (strategy: string) => {
    try {
      const res = await fetch(`/api/alerts?strategy=${encodeURIComponent(strategy)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.availableGroups) setAvailableGroups(data.availableGroups);
      }
    } catch {
      // Silently fail
    }
  };

  const saveAlertSettings = async () => {
    setSavingAlerts(true);
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertConfig),
      });

      if (!res.ok) {
        throw new Error('Failed to save alert settings');
      }

      const data = await res.json();
      if (data.alerts) setActiveAlerts(data.alerts);
      toast.success(t('settings.alertsSaved'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settings.alertsSaveFailed'));
    } finally {
      setSavingAlerts(false);
    }
  };

  const fetchVirtualPrinters = async () => {
    try {
      const res = await fetch('/api/virtual-printers');
      if (res.ok) {
        const data = await res.json();
        setVirtualPrinters(data.virtualPrinters || []);
      }
    } catch {
      // Silently fail
    }
  };

  const fetchExistingLocations = async () => {
    try {
      const res = await fetch('/api/spoolman/locations');
      if (res.ok) {
        const data = await res.json();
        setExistingLocations(Array.isArray(data.locations) ? data.locations : []);
      }
    } catch {
      // Silently fail — suggestions are optional
    }
  };

  const createVirtualPrinter = async () => {
    const name = newVpName.trim();
    if (!name) {
      toast.error(t('settings.nameRequired'));
      return;
    }

    setCreatingVp(true);
    try {
      const res = await fetch('/api/virtual-printers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slotCount: newVpSlotCount }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create virtual printer');
      }

      toast.success(t('settings.virtualPrinterCreated'));
      setNewVpName('');
      setNewVpSlotCount(1);
      fetchVirtualPrinters();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settings.virtualPrinterCreateFailed'));
    } finally {
      setCreatingVp(false);
    }
  };

  const patchVirtualPrinter = async (
    id: string,
    changes: { name?: string; action?: 'addSlot' | 'removeSlot'; slotNumber?: number },
    successMessage: string,
  ) => {
    setMutatingVp(id);
    try {
      const res = await fetch('/api/virtual-printers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...changes }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update virtual printer');
      }

      toast.success(successMessage);
      fetchVirtualPrinters();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settings.virtualPrinterUpdateFailed'));
    } finally {
      setMutatingVp(null);
    }
  };

  const renameVirtualPrinter = (vp: VirtualPrinter) => {
    const name = (editingVpName[vp.id] ?? vp.name).trim();
    if (!name) {
      toast.error(t('settings.nameEmpty'));
      return;
    }
    if (name === vp.name) return;
    patchVirtualPrinter(vp.id, { name }, 'Virtual printer renamed');
  };

  const addVirtualPrinterSlot = (vp: VirtualPrinter) => {
    if (vp.slots.length >= 16) {
      toast.error(t('settings.maxSlots'));
      return;
    }
    patchVirtualPrinter(vp.id, { action: 'addSlot' }, 'Slot added');
  };

  const removeVirtualPrinterSlot = (vp: VirtualPrinter, slotNumber: number) => {
    patchVirtualPrinter(vp.id, { action: 'removeSlot', slotNumber }, 'Slot removed');
  };

  const deleteVirtualPrinter = async (vp: VirtualPrinter) => {
    if (!window.confirm(`Delete "${vp.name}"? Any spool assignments to its slots will be cleared.`)) {
      return;
    }
    setMutatingVp(vp.id);
    try {
      const res = await fetch('/api/virtual-printers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: vp.id }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete virtual printer');
      }

      toast.success(t('settings.virtualPrinterDeleted'));
      fetchVirtualPrinters();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settings.virtualPrinterDeleteFailed'));
    } finally {
      setMutatingVp(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Nav />
        <main className="w-full max-w-2xl mx-auto py-6 px-3 sm:px-4 md:px-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="w-full max-w-2xl mx-auto py-6 px-3 sm:px-4 md:px-6">
        <h1 className="text-xl sm:text-2xl font-bold mb-6">{t('settings.title')}</h1>

        <div className="space-y-6">
          {/* Home Assistant Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${
                  settings?.homeassistant?.connected ? 'bg-green-500'
                    : settings?.homeassistant?.error ? 'bg-orange-500'
                    : 'bg-gray-300'
                }`} />
                <CardTitle>{t('settings.ha')}</CardTitle>
                {settings?.embeddedMode && (
                  <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                    {t('settings.embedded')}
                  </span>
                )}
                {settings?.addonMode && (
                  <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded">
                    {t('settings.addon')}
                  </span>
                )}
              </div>
              <CardDescription>
                {settings?.addonMode
                  ? t('settings.addonDesc')
                  : settings?.embeddedMode
                    ? t('settings.embeddedDesc')
                    : t('settings.haDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings?.addonMode ? (
                // Add-on mode - HA connection is automatic via Supervisor
                <div className="space-y-4">
                  {settings?.homeassistant ? (
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium text-green-600 dark:text-green-400">{t('settings.connectedSupervisor')}</p>
                        <p className="text-sm text-muted-foreground">
                          {t('settings.addonRunning')}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <p className="font-medium text-yellow-700 dark:text-yellow-400">{t('settings.connecting')}</p>
                      <p className="text-sm text-yellow-600 dark:text-yellow-500 mt-1">
                        {t('settings.establishingSupervisor')}
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t('settings.hacsRequired')}
                  </p>
                </div>
              ) : settings?.embeddedMode ? (
                // Embedded mode - show status and admin credentials
                <div className="space-y-4">
                  {settings?.homeassistant?.connected ? (
                    // State 1: Connected
                    <>
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <p className="font-medium text-green-600 dark:text-green-400">{t('settings.connected')}</p>
                          <p className="text-sm text-muted-foreground">{settings.homeassistant.url}</p>
                        </div>
                      </div>

                      {/* Admin Credentials Section */}
                      {settings.homeassistant.adminCredentials ? (
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-3">
                          <div>
                            <p className="font-medium text-blue-700 dark:text-blue-300">{t('settings.login')}</p>
                            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                              {t('settings.loginUse')}{' '}
                              <a
                                href="http://localhost:8123"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline hover:no-underline"
                              >
                                localhost:8123
                              </a>
                            </p>
                          </div>

                          <div className="grid gap-2">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                              <span className="text-sm text-muted-foreground">{t('settings.username')}:</span>
                              <div className="flex items-center gap-2">
                                <code className="px-2 py-1 bg-background rounded text-sm truncate max-w-[150px] sm:max-w-none">
                                  {settings.homeassistant.adminCredentials.username}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 shrink-0"
                                  onClick={() => copyToClipboard(settings.homeassistant!.adminCredentials!.username, 'Username')}
                                >
                                  {t('settings.copy')}
                                </Button>
                              </div>
                            </div>
                            {settings.homeassistant.adminCredentials.hasPassword ? (
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                                <span className="text-sm text-muted-foreground">{t('settings.password')}:</span>
                                <div className="flex items-center gap-2">
                                  <code className="px-2 py-1 bg-background rounded text-sm font-mono truncate max-w-[150px] sm:max-w-none">
                                    {revealedPassword !== null ? revealedPassword : '••••••••••••'}
                                  </code>
                                  {revealedPassword !== null ? (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 shrink-0"
                                        onClick={() => setRevealedPassword(null)}
                                      >
                                        {t('settings.hide')}
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 shrink-0"
                                        onClick={() => copyToClipboard(revealedPassword, 'Password')}
                                      >
                                        {t('settings.copy')}
                                      </Button>
                                    </>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 shrink-0"
                                      onClick={revealPassword}
                                      disabled={revealingPassword}
                                    >
                                      {revealingPassword ? t('settings.revealing') : t('settings.revealPassword')}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                                <span className="text-sm text-muted-foreground">{t('settings.password')}:</span>
                                <span className="text-sm text-muted-foreground italic">
                                  {t('settings.noPassword')}
                                </span>
                              </div>
                            )}
                          </div>

                          <p className="text-xs text-muted-foreground pt-2 border-t border-blue-200 dark:border-blue-800">
                            {t('settings.passwordChanged')}
                          </p>
                        </div>
                      ) : (
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <p className="font-medium text-blue-700 dark:text-blue-300">{t('settings.login')}</p>
                          <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                            {t('settings.noCredentials')}{' '}
                            <a
                              href="http://localhost:8123"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:no-underline"
                            >
                              localhost:8123
                            </a>
                            {' '}using the credentials you set up.
                          </p>
                        </div>
                      )}
                    </>
                  ) : settings?.homeassistant?.error ? (
                    // State 3: Connection broken (token invalid, password may have changed)
                    <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg space-y-3">
                      <div>
                        <p className="font-medium text-orange-700 dark:text-orange-400">{t('settings.connectionLost')}</p>
                        <p className="text-sm text-orange-600 dark:text-orange-500 mt-1">
                          {t('settings.tokenInvalid')}
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label htmlFor="reconnect-username">{t('settings.username')}</Label>
                          <Input
                            id="reconnect-username"
                            value={reconnectUsername}
                            onChange={(e) => setReconnectUsername(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="reconnect-password">{t('settings.password')}</Label>
                          <Input
                            id="reconnect-password"
                            type="password"
                            value={reconnectPassword}
                            onChange={(e) => setReconnectPassword(e.target.value)}
                            placeholder={t('settings.enterPassword')}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') reconnectHomeAssistant();
                            }}
                          />
                        </div>
                        {reconnectError && (
                          <p className="text-sm text-red-600 dark:text-red-400">{reconnectError}</p>
                        )}
                        <Button
                          onClick={reconnectHomeAssistant}
                          disabled={reconnecting || !reconnectPassword}
                        >
                          {reconnecting ? t('settings.reconnecting') : t('settings.reconnect')}
                        </Button>
                      </div>
                    </div>
                  ) : !settings?.homeassistant ? (
                    // State 2: HA still starting up (no connection yet)
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <p className="font-medium text-yellow-700 dark:text-yellow-400">{t('settings.connecting')}</p>
                      <p className="text-sm text-yellow-600 dark:text-yellow-500 mt-1">
                        {t('settings.starting')}
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600" />
                        <Button variant="outline" size="sm" onClick={fetchSettings}>
                          {t('settings.refreshStatus')}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {t('settings.embeddedInfo')}
                  </p>
                </div>
              ) : settings?.homeassistant ? (
                // External mode - connected
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">{t('settings.connected')}</p>
                    <p className="text-sm text-muted-foreground">{settings.homeassistant.url}</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={disconnectHomeAssistant}
                    disabled={saving === 'ha'}
                  >
                    {saving === 'ha' ? t('settings.disconnecting') : t('settings.disconnect')}
                  </Button>
                </div>
              ) : (
                // External mode - not connected
                <>
                  <div className="space-y-2">
                    <Label htmlFor="ha-url">{t('settings.haUrl')}</Label>
                    <Input
                      id="ha-url"
                      placeholder="http://homeassistant.local:8123"
                      value={haUrl}
                      onChange={(e) => setHaUrl(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter your Home Assistant URL, then click Connect to authorize.
                    </p>
                  </div>
                    <Button
                    onClick={connectHomeAssistant}
                    disabled={connecting || !haUrl}
                  >
                      {connecting ? t('settings.connecting') : t('settings.haConnect')}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* Bambu Lab Printers */}
          {settings?.homeassistant?.connected && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{t('settings.printers')}</CardTitle>
                    <CardDescription>
                      {t('settings.printersDesc')}
                    </CardDescription>
                  </div>
                  <Button onClick={() => setAddPrinterOpen(true)}>
                    {t('settings.addPrinter')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {printers.length === 0 && hiddenPrinters.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground">
                      <p>{t('settings.noPrinters')}</p>
                      <p className="text-sm mt-1">{t('settings.addPrinterPrompt')}</p>
                    </div>
                  )}
                  {printers.map((printer) => (
                    <div
                      key={printer.entry_id}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{printer.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {printer.state === 'loaded' ? (
                            <span className="text-green-600 dark:text-green-400">{t('settings.connected')}</span>
                          ) : (
                            <span className="text-yellow-600 dark:text-yellow-400">{printer.state}</span>
                          )}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removePrinter(printer.entry_id)}
                        disabled={removingPrinter === printer.entry_id}
                      >
                        {removingPrinter === printer.entry_id ? t('settings.removing') : t('settings.remove')}
                      </Button>
                    </div>
                  ))}
                  {hiddenPrinters.length > 0 && (
                    <div className={printers.length > 0 ? 'pt-2 border-t' : ''}>
                      <p className="text-xs text-muted-foreground mb-2">
                        {t('settings.removedFromSync')}
                      </p>
                      {hiddenPrinters.map((printer) => (
                        <div
                          key={printer.entry_id}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-dashed"
                        >
                          <div>
                            <p className="font-medium text-muted-foreground">{printer.title}</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => readdPrinter(printer.entry_id)}
                            disabled={readdingPrinter === printer.entry_id}
                          >
                            {readdingPrinter === printer.entry_id ? t('settings.adding') : t('settings.reAdd')}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {settings?.webhookConfigured && (
                    <p className="text-xs text-muted-foreground pt-2 border-t">
                      {t('settings.webhookEnabled')}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {settings?.homeassistant?.connected && <Separator />}

          {/* Virtual Printers */}
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.virtualPrinters')}</CardTitle>
              <CardDescription>
                {t('settings.virtualPrintersDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {virtualPrinters.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <p>{t('settings.noVirtualPrinters')}</p>
                    <p className="text-sm mt-1">{t('settings.createVirtualPrompt')}</p>
                  </div>
                )}

                {virtualPrinters.map((vp) => (
                  <div key={vp.id} className="p-3 bg-muted rounded-lg space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        value={editingVpName[vp.id] ?? vp.name}
                        onChange={(e) =>
                          setEditingVpName((prev) => ({ ...prev, [vp.id]: e.target.value }))
                        }
                        onBlur={() => renameVirtualPrinter(vp)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        }}
                        disabled={mutatingVp === vp.id}
                        className="font-medium bg-background"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => deleteVirtualPrinter(vp)}
                        disabled={mutatingVp === vp.id}
                      >
                        {t('settings.delete')}
                      </Button>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {vp.slots.length} {t('settings.slots')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {vp.slots.map((slot) => (
                          <span
                            key={slot.id}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-background rounded text-sm"
                          >
                            {t('settings.tray')} {slot.number}
                            <button
                              type="button"
                              aria-label={`${t('settings.removeTray')} ${slot.number}`}
                              className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                              onClick={() => removeVirtualPrinterSlot(vp, slot.number)}
                              disabled={mutatingVp === vp.id}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7"
                          onClick={() => addVirtualPrinterSlot(vp)}
                          disabled={mutatingVp === vp.id || vp.slots.length >= 16}
                        >
                          + {t('settings.addSlot')}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Create new virtual printer */}
                <div className="pt-3 border-t space-y-3">
                  <p className="text-sm font-medium">{t('settings.addVirtualPrinter')}</p>
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="new-vp-name">{t('settings.name')}</Label>
                      <Input
                        id="new-vp-name"
                        placeholder="e.g., Dry Box A"
                        value={newVpName}
                        onChange={(e) => setNewVpName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') createVirtualPrinter();
                        }}
                        list="existing-spoolman-locations"
                      />
                      {existingLocations.length > 0 && (
                        <datalist id="existing-spoolman-locations">
                          {existingLocations.map((loc) => (
                            <option key={loc} value={loc} />
                          ))}
                        </datalist>
                      )}
                      {existingLocations.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {t('settings.locationTip')}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="new-vp-slots">{t('settings.slotsCount')}</Label>
                      <Input
                        id="new-vp-slots"
                        type="number"
                        min={1}
                        max={16}
                        value={newVpSlotCount}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          setNewVpSlotCount(Number.isNaN(n) ? 1 : Math.min(16, Math.max(1, n)));
                        }}
                        className="w-24"
                      />
                    </div>
                    <Button
                      onClick={createVirtualPrinter}
                      disabled={creatingVp || !newVpName.trim()}
                    >
                      {creatingVp ? t('settings.creating') : t('settings.create')}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Spoolman Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${settings?.spoolman ? 'bg-green-500' : 'bg-gray-300'}`} />
                <CardTitle>{t('settings.spoolman')}</CardTitle>
              </div>
              <CardDescription>
                {t('settings.spoolmanDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="spoolman-url">{t('settings.spoolmanUrl')}</Label>
                <Input
                  id="spoolman-url"
                  placeholder="http://localhost:7912"
                  value={spoolmanUrl}
                  onChange={(e) => setSpoolmanUrl(e.target.value)}
                />
              </div>
              <Button
                onClick={saveSpoolmanSettings}
                disabled={saving === 'spoolman' || !spoolmanUrl}
              >
                {saving === 'spoolman' ? t('settings.connecting') : t('settings.spoolmanConnect')}
              </Button>
            </CardContent>
          </Card>

          {/* Dashboard Display Settings */}
          {settings?.spoolman && (
            <>
              <Separator />
              <Card>
                <CardHeader>
                  <CardTitle>{t('settings.kPresets')}</CardTitle>
                  <CardDescription>{t('settings.kPresetsDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {kValuePresets.map((preset, index) => (
                    <div key={`${preset.nickname}-${index}`} className="flex items-center gap-2">
                      <Input
                        value={preset.nickname}
                        aria-label={t('settings.kNickname')}
                        onChange={(e) => {
                          const next = [...kValuePresets];
                          next[index] = { ...preset, nickname: e.target.value };
                          setKValuePresets(next);
                        }}
                        onBlur={() => void saveKValuePresets(kValuePresets)}
                      />
                      <Input
                        type="number"
                        step="0.0001"
                        value={preset.value}
                        aria-label={t('settings.kValue')}
                        onChange={(e) => {
                          const next = [...kValuePresets];
                          next[index] = { ...preset, value: Number(e.target.value) };
                          setKValuePresets(next);
                        }}
                        onBlur={() => void saveKValuePresets(kValuePresets)}
                        className="w-32"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={savingKValues}
                        onClick={() => void saveKValuePresets(kValuePresets.filter((_, itemIndex) => itemIndex !== index))}
                      >
                        {t('settings.deletePreset')}
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 border-t pt-3">
                    <Input
                      placeholder={t('settings.nicknamePlaceholder')}
                      value={newKValueNickname}
                      onChange={(e) => setNewKValueNickname(e.target.value)}
                    />
                    <Input
                      type="number"
                      step="0.0001"
                      placeholder={t('settings.kValue')}
                      value={newKValue}
                      onChange={(e) => setNewKValue(e.target.value)}
                      className="w-32"
                    />
                    <Button type="button" onClick={addKValuePreset} disabled={savingKValues}>
                      {t('settings.add')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <Separator />
              <Card>
                <CardHeader>
                  <CardTitle>{t('settings.dashboardDisplay')}</CardTitle>
                  <CardDescription>
                    {t('settings.dashboardDisplayDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="show-spool-location"
                      checked={showSpoolLocation}
                      onCheckedChange={async (checked) => {
                        const enabled = checked === true;
                        setShowSpoolLocation(enabled);
                        try {
                          const res = await fetch('/api/settings', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ type: 'show_spool_location', enabled }),
                          });
                          if (!res.ok) throw new Error();
                          toast.success(enabled ? t('settings.locationEnabled') : t('settings.locationHidden'));
                        } catch {
                          setShowSpoolLocation(!enabled);
                          toast.error(t('settings.saveError'));
                        }
                      }}
                    />
                    <div>
                      <Label htmlFor="show-spool-location" className="text-sm font-medium cursor-pointer">
                        {t('settings.showLocation')}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t('settings.showLocationDesc')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="never-auto-clear-tray"
                      checked={neverAutoClearTray}
                      onCheckedChange={async (checked) => {
                        const enabled = checked === true;
                        setNeverAutoClearTray(enabled);
                        try {
                          const res = await fetch('/api/settings', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ type: 'never_auto_clear_tray', enabled }),
                          });
                          if (!res.ok) throw new Error();
                          toast.success(enabled ? t('settings.neverClearOn') : t('settings.neverClearOff'));
                        } catch {
                          setNeverAutoClearTray(!enabled);
                          toast.error(t('settings.saveError'));
                        }
                      }}
                    />
                    <div>
                      <Label htmlFor="never-auto-clear-tray" className="text-sm font-medium cursor-pointer">
                        {t('settings.neverClear')}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t('settings.neverClearDesc')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="sync-spoolman-location"
                      checked={syncSpoolmanLocation}
                      onCheckedChange={async (checked) => {
                        const enabled = checked === true;
                        setSyncSpoolmanLocation(enabled);
                        try {
                          const res = await fetch('/api/settings', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ type: 'sync_spoolman_location', enabled }),
                          });
                          if (!res.ok) throw new Error();
                          toast.success(enabled ? t('settings.syncLocationOn') : t('settings.syncLocationOff'));
                        } catch {
                          setSyncSpoolmanLocation(!enabled);
                          toast.error(t('settings.saveError'));
                        }
                      }}
                    />
                    <div>
                      <Label htmlFor="sync-spoolman-location" className="text-sm font-medium cursor-pointer">
                        {t('settings.syncLocation')}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t('settings.syncLocationDesc')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Spool Filter Configuration */}
          {settings?.spoolman && (
            <>
              <Separator />
              <Card>
                <CardHeader>
                  <CardTitle>{t('settings.filterConfig')}</CardTitle>
                  <CardDescription>
                    {t('settings.filterConfigDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filterFields.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t('settings.loadingFilters')}
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {/* Built-in fields */}
                      <div>
                        <h4 className="text-sm font-medium mb-2 text-muted-foreground">{t('settings.builtInFields')}</h4>
                        <div className="space-y-3">
                          {filterFields.filter(f => f.builtIn).map((field) => (
                            <div key={field.key} className="flex items-center space-x-3">
                              <Checkbox
                                id={`filter-${field.key}`}
                                checked={enabledFilters.includes(field.key)}
                                onCheckedChange={() => toggleFilter(field.key)}
                                disabled={savingFilters}
                              />
                              <div className="flex-1">
                                <Label
                                  htmlFor={`filter-${field.key}`}
                                  className="text-sm font-medium cursor-pointer"
                                >
                                  {field.name}
                                </Label>
                                {field.values.length > 0 ? (
                                  <p className="text-xs text-muted-foreground">
                                    {field.values.length} {t('settings.values')}: {field.values.slice(0, 3).join(', ')}{field.values.length > 3 ? '...' : ''}
                                  </p>
                                ) : (
                                  <p className="text-xs text-muted-foreground italic">
                                    {t('settings.noValues')}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Extra fields (if any) */}
                      {filterFields.some(f => !f.builtIn) && (
                        <div>
                          <h4 className="text-sm font-medium mb-2 text-muted-foreground">{t('settings.customFields')}</h4>
                          <div className="space-y-3">
                            {filterFields.filter(f => !f.builtIn).map((field) => (
                              <div key={field.key} className="flex items-center space-x-3">
                                <Checkbox
                                  id={`filter-${field.key}`}
                                  checked={enabledFilters.includes(field.key)}
                                  onCheckedChange={() => toggleFilter(field.key)}
                                  disabled={savingFilters}
                                />
                                <div className="flex-1">
                                  <Label
                                    htmlFor={`filter-${field.key}`}
                                    className="text-sm font-medium cursor-pointer"
                                  >
                                    {field.name}
                                  </Label>
                                  {field.values.length > 0 ? (
                                    <p className="text-xs text-muted-foreground">
                                      {field.values.length} {t('settings.values')}: {field.values.slice(0, 3).join(', ')}{field.values.length > 3 ? '...' : ''}
                                    </p>
                                  ) : (
                                    <p className="text-xs text-muted-foreground italic">
                                      {t('settings.noValues')}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {enabledFilters.length === 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {t('settings.noFilters')}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* Low Filament Alerts */}
          {settings?.spoolman && (
            <>
              <Separator />
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CardTitle>{t('settings.alerts')}</CardTitle>
                    {activeAlerts.length > 0 && (
                      <Badge variant="destructive">{activeAlerts.length}</Badge>
                    )}
                  </div>
                  <CardDescription>
                    {t('settings.alertsDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="alerts-enabled"
                      checked={alertConfig.enabled}
                      onCheckedChange={(checked) =>
                        setAlertConfig(prev => ({ ...prev, enabled: Boolean(checked) }))
                      }
                    />
                    <Label htmlFor="alerts-enabled" className="cursor-pointer">
                      {t('settings.enableAlerts')}
                    </Label>
                  </div>

                  {alertConfig.enabled && (
                    <div className="space-y-4 pl-6">
                      {/* Threshold type */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{t('settings.thresholdType')}</Label>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="threshold-percentage"
                              name="thresholdType"
                              value="percentage"
                              checked={alertConfig.thresholdType === 'percentage'}
                              onChange={() => setAlertConfig(prev => ({ ...prev, thresholdType: 'percentage' }))}
                              className="h-4 w-4"
                            />
                            <Label htmlFor="threshold-percentage" className="cursor-pointer text-sm">
                              {t('settings.percentageRemaining')}
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="threshold-grams"
                              name="thresholdType"
                              value="grams"
                              checked={alertConfig.thresholdType === 'grams'}
                              onChange={() => setAlertConfig(prev => ({ ...prev, thresholdType: 'grams' }))}
                              className="h-4 w-4"
                            />
                            <Label htmlFor="threshold-grams" className="cursor-pointer text-sm">
                              {t('settings.absoluteWeight')}
                            </Label>
                          </div>
                        </div>
                      </div>

                      {/* Threshold value */}
                      <div className="space-y-2">
                        <Label htmlFor="threshold-value" className="text-sm font-medium">
                          {t('settings.alertBelow')} {alertConfig.thresholdType === 'percentage' ? '(%)' : '(grams)'}
                        </Label>
                        <Input
                          id="threshold-value"
                          type="number"
                          min="0"
                          max={alertConfig.thresholdType === 'percentage' ? 100 : undefined}
                          value={alertConfig.thresholdValue}
                          onChange={(e) =>
                            setAlertConfig(prev => ({ ...prev, thresholdValue: Number(e.target.value) }))
                          }
                          className="w-32"
                        />
                      </div>

                      {/* Grouping strategy */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{t('settings.groupBy')}</Label>
                        <div className="space-y-2">
                          <div className="flex items-start space-x-2">
                            <input
                              type="radio"
                              id="group-material"
                              name="groupingStrategy"
                              value="material"
                              checked={alertConfig.groupingStrategy === 'material'}
                              onChange={() => {
                                setAlertConfig(prev => ({ ...prev, groupingStrategy: 'material', monitoredGroups: undefined }));
                                fetchAvailableGroups('material');
                              }}
                              className="h-4 w-4 mt-0.5"
                            />
                            <div>
                              <Label htmlFor="group-material" className="cursor-pointer text-sm">
                                {t('settings.material')}
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                {t('settings.materialDesc')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start space-x-2">
                            <input
                              type="radio"
                              id="group-material-color"
                              name="groupingStrategy"
                              value="material_name"
                              checked={alertConfig.groupingStrategy === 'material_name'}
                              onChange={() => {
                                setAlertConfig(prev => ({ ...prev, groupingStrategy: 'material_name', monitoredGroups: undefined }));
                                fetchAvailableGroups('material_name');
                              }}
                              className="h-4 w-4 mt-0.5"
                            />
                            <div>
                              <Label htmlFor="group-material-color" className="cursor-pointer text-sm">
                                {t('settings.materialName')}
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                {t('settings.materialNameDesc')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start space-x-2">
                            <input
                              type="radio"
                              id="group-material-vendor-name"
                              name="groupingStrategy"
                              value="material_name_vendor"
                              checked={alertConfig.groupingStrategy === 'material_name_vendor'}
                              onChange={() => {
                                setAlertConfig(prev => ({ ...prev, groupingStrategy: 'material_name_vendor', monitoredGroups: undefined }));
                                fetchAvailableGroups('material_name_vendor');
                              }}
                              className="h-4 w-4 mt-0.5"
                            />
                            <div>
                              <Label htmlFor="group-material-vendor-name" className="cursor-pointer text-sm">
                                {t('settings.materialNameVendor')}
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                {t('settings.materialNameVendorDesc')}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Monitored groups */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{t('settings.monitor')}</Label>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="monitor-all"
                              name="monitorMode"
                              checked={alertConfig.monitoredGroups === undefined}
                              onChange={() => setAlertConfig(prev => ({ ...prev, monitoredGroups: undefined }))}
                              className="h-4 w-4"
                            />
                            <Label htmlFor="monitor-all" className="cursor-pointer text-sm">
                              {t('settings.allGroups')}
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="monitor-selected"
                              name="monitorMode"
                              checked={alertConfig.monitoredGroups !== undefined}
                              onChange={() => setAlertConfig(prev => ({ ...prev, monitoredGroups: [] }))}
                              className="h-4 w-4"
                            />
                            <Label htmlFor="monitor-selected" className="cursor-pointer text-sm">
                              {t('settings.selectedGroups')}
                            </Label>
                          </div>
                        </div>

                        {alertConfig.monitoredGroups !== undefined && (
                          <div className="ml-6 space-y-2 pt-1">
                            {availableGroups.length === 0 ? (
                              <p className="text-xs text-muted-foreground italic">{t('settings.noGroups')}</p>
                            ) : (
                              availableGroups.map((group) => (
                                <div key={group.groupKey} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`group-${group.groupKey}`}
                                    checked={alertConfig.monitoredGroups?.includes(group.groupKey) ?? false}
                                    onCheckedChange={(checked) => {
                                      setAlertConfig(prev => {
                                        const current = prev.monitoredGroups || [];
                                        const updated = checked
                                          ? [...current, group.groupKey]
                                          : current.filter(k => k !== group.groupKey);
                                        return { ...prev, monitoredGroups: updated };
                                      });
                                    }}
                                  />
                                  <div className="flex items-center gap-2">
                                    {(alertConfig.groupingStrategy === 'material_name' || alertConfig.groupingStrategy === 'material_name_vendor') && group.color_hex && (
                                      <span
                                        className="inline-block w-3 h-3 rounded-full border border-border shrink-0"
                                        style={{ backgroundColor: `#${group.color_hex.replace('#', '')}` }}
                                      />
                                    )}
                                    <Label
                                      htmlFor={`group-${group.groupKey}`}
                                      className="cursor-pointer text-sm"
                                    >
                                      {group.groupLabel}
                                    </Label>
                                    <span className="text-xs text-muted-foreground">
                                      ({group.spoolCount} {t('spools.title').toLowerCase()})
                                    </span>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      <Button
                        onClick={saveAlertSettings}
                        disabled={savingAlerts}
                      >
                        {savingAlerts ? t('settings.saving') : t('settings.alertSave')}
                      </Button>
                    </div>
                  )}

                  {!alertConfig.enabled && (
                    <Button
                      onClick={saveAlertSettings}
                      disabled={savingAlerts}
                      variant="outline"
                      size="sm"
                    >
                      {savingAlerts ? t('settings.saving') : t('settings.save')}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* QR Code Base URL */}
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.qrCodeUrl')}</CardTitle>
              <CardDescription>
                {t('settings.qrDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="qrBaseUrl">{t('settings.baseUrl')}</Label>
                <div className="flex gap-2">
                  <Input
                    id="qrBaseUrl"
                    value={qrBaseUrl}
                    onChange={(e) => setQrBaseUrl(e.target.value)}
                    placeholder="e.g., http://192.168.1.100:3000"
                  />
                  <Button
                    onClick={async () => {
                      setSavingQrUrl(true);
                      try {
                        const res = await fetch('/api/settings', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ type: 'qr_base_url', url: qrBaseUrl }),
                        });
                        if (!res.ok) throw new Error();
                        toast.success(qrBaseUrl.trim() ? t('settings.qrSaved') : t('settings.qrCleared'));
                      } catch {
                        toast.error(t('settings.qrSaveFailed'));
                      } finally {
                        setSavingQrUrl(false);
                      }
                    }}
                    disabled={savingQrUrl}
                  >
                    {savingQrUrl ? t('settings.saving') : t('settings.save')}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('settings.qrProxyDesc')}
                </p>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Add Printer Dialog */}
        <AddPrinterDialog
          open={addPrinterOpen}
          onOpenChange={setAddPrinterOpen}
          onSuccess={fetchPrinters}
        />
      </main>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background">
        <Nav />
        <main className="w-full max-w-2xl mx-auto py-6 px-3 sm:px-4 md:px-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </main>
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
