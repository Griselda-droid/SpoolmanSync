'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Nav } from '@/components/nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';

interface PrinterRegistration {
  prefix: string;
  name: string;
  trayIds: string[];
}

interface AutomationData {
  trayCount: number;
  printerCount: number;
  automationsYaml: string;
  configurationYaml: string;
  printerRegistrations: PrinterRegistration[];
}

interface RegisteredAutomation {
  id: string;
  haAutomationId: string;
  trayId: string;
  printerId: string;
  createdAt: string;
}

export default function AutomationsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [automationData, setAutomationData] = useState<AutomationData | null>(null);
  const [registeredAutomations, setRegisteredAutomations] = useState<RegisteredAutomation[]>([]);
  const [haConnected, setHaConnected] = useState(false);
  const [embeddedMode, setEmbeddedMode] = useState(false);
  const [addonMode, setAddonMode] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [copiedAutomations, setCopiedAutomations] = useState(false);
  const [printerCount, setPrinterCount] = useState<number | null>(null);
  const [checkingPrinters, setCheckingPrinters] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    fetchRegistered();
    // Initialize webhook URL with a sensible default
    // Replace 0.0.0.0 with localhost as a starting point
    const origin = window.location.origin.replace('0.0.0.0', 'localhost');
    setWebhookUrl(origin);
  }, []);

  // Check for printers when HA is connected in embedded or addon mode
  useEffect(() => {
    if ((embeddedMode || addonMode) && haConnected && printerCount === null) {
      checkForPrinters();
    }
  }, [embeddedMode, addonMode, haConnected, printerCount]);

  const checkForPrinters = async () => {
    setCheckingPrinters(true);
    try {
      const res = await fetch('/api/printers');
      const data = await res.json();
      setPrinterCount(data.printers?.length || 0);
    } catch (err) {
      console.error('Failed to check printers:', err);
      setPrinterCount(0);
    } finally {
      setCheckingPrinters(false);
    }
  };

  const fetchRegistered = async () => {
    try {
      const res = await fetch('/api/automations');
      const data = await res.json();
      setRegisteredAutomations(data.automations || []);
      setHaConnected(data.haConnected);
      setEmbeddedMode(data.embeddedMode || false);
      setAddonMode(data.addonMode || false);
      setConfigured(data.configured || false);
    } catch (err) {
      console.error('Failed to fetch automations:', err);
    }
  };

  // Auto-configure for embedded mode
  const autoConfigure = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'auto-configure',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to configure automations');
      }

      setConfigured(true);
      fetchRegistered();

      if (data.needsRestart) {
        setShowRestartModal(true);
      } else {
        toast.success(data.message || `Configured ${data.trayCount} trays successfully`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to configure');
    } finally {
      setLoading(false);
    }
  };

  const restartHA = async () => {
    setRestarting(true);
    try {
      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restart-ha' }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to restart Home Assistant');
      }

      setShowRestartModal(false);
      toast.success(t('automations.restartMessage'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('automations.restartTitle'));
    } finally {
      setRestarting(false);
    }
  };

  // Generate config for manual mode
  const generateConfig = async () => {
    if (!webhookUrl.trim()) {
      toast.error(t('automations.spoolmanSync'));
      return;
    }
    setLoading(true);
    try {
      // Append /api/webhook to the base URL
      const baseUrl = webhookUrl.trim().replace(/\/+$/, ''); // Remove trailing slashes
      const fullWebhookUrl = `${baseUrl}/api/webhook`;

      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'discover',
          webhookUrl: fullWebhookUrl,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to generate config');
      }

      const data = await res.json();
      setAutomationData(data);
      toast.success(`${t('automations.traysMonitored')} ${data.trayCount}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('automations.generate'));
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'config' | 'automations') => {
    try {
      // Try using the Clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for non-secure contexts (like HTTP)
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      if (type === 'config') {
        setCopiedConfig(true);
        setTimeout(() => setCopiedConfig(false), 2000);
      } else {
        setCopiedAutomations(true);
        setTimeout(() => setCopiedAutomations(false), 2000);
      }
      toast.success(type === 'config' ? 'configuration.yaml copied to clipboard' : 'automations.yaml copied to clipboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settings.copyFailed'));
    }
  };

  const registerAutomations = async () => {
    if (!automationData) return;

    setLoading(true);
    try {
      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          printerRegistrations: automationData.printerRegistrations,
        }),
      });

      if (!res.ok) throw new Error('Failed to register automations');

      toast.success(t('automations.configured'));
      fetchRegistered();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('automations.configureNow'));
    } finally {
      setLoading(false);
    }
  };

  // Embedded/Addon mode UI - simplified auto-configure
  if (embeddedMode || addonMode) {
    return (
      <div className="min-h-screen bg-background">
        <Nav />
        <main className="w-full max-w-4xl mx-auto py-6 px-3 sm:px-4 md:px-6">
          <h1 className="text-xl sm:text-2xl font-bold mb-6">{t('automations.title')}</h1>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {t('automations.spoolTracking')}
                  <Badge variant="secondary">{addonMode ? t('automations.addonMode') : t('automations.embeddedMode')}</Badge>
                </CardTitle>
                <CardDescription>
                  {t('automations.trackingDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className={`h-3 w-3 rounded-full ${haConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span>{t('automations.haConnected')} {haConnected ? t('automations.connectedState') : t('automations.waitingState')}</span>
                </div>

                {configured ? (
                  <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="font-medium">{t('automations.automationsConfigured')}</span>
                    </div>
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      {t('automations.activeTracking')}
                    </p>
                  </div>
                ) : printerCount === 0 ? (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 mb-2">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="font-medium">{t('automations.noPrinterFound')}</span>
                    </div>
                    <p className="text-sm text-amber-600 dark:text-amber-400 mb-3">
                      {t('automations.needPrinter')}
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => router.push('/settings')}
                    >
                      {t('automations.goToSettings')}
                    </Button>
                  </div>
                ) : checkingPrinters ? (
                  <div className="p-4 bg-muted rounded-lg flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                    <span className="text-sm text-muted-foreground">{t('automations.checking')}</span>
                  </div>
                ) : (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                      {t('automations.autoConfigureDesc')}
                    </p>
                    <ul className="list-disc list-inside text-sm text-blue-600 dark:text-blue-400 space-y-1 mb-4">
                      <li>{t('automations.bullet1')}</li>
                      <li>{t('automations.bullet2')}</li>
                      <li>{t('automations.bullet3')}</li>
                    </ul>
                    <Button
                      onClick={autoConfigure}
                      disabled={loading || !haConnected || printerCount === 0}
                      size="lg"
                    >
                      {loading ? t('automations.generating') : t('automations.configure')}
                    </Button>
                  </div>
                )}

                {configured && (
                  <div className="pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={autoConfigure}
                      disabled={loading}
                    >
                      {loading ? t('automations.reconfiguring') : t('automations.reconfigure')}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      {t('automations.reconfigureHint')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Registered Automations */}
            {registeredAutomations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('automations.configuredTracking')}</CardTitle>
                  <CardDescription>{t('automations.monitored')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {registeredAutomations.map((auto) => (
                      <div
                        key={auto.id}
                        className="flex items-center justify-between p-3 bg-muted rounded"
                      >
                        <div>
                          <div className="font-medium">{auto.printerId}</div>
                          <div className="text-sm text-muted-foreground">
                            {auto.trayId.split(',').length} {t('automations.traysMonitored')}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(auto.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Restart Required Modal */}
          <Dialog open={showRestartModal} onOpenChange={setShowRestartModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('automations.restartRequired')}</DialogTitle>
                <DialogDescription>{t('automations.restartDesc')}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  onClick={restartHA}
                  disabled={restarting}
                  className="flex-1"
                >
                  {restarting ? t('automations.generating') : t('automations.restartNow')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowRestartModal(false)}
                  disabled={restarting}
                  className="flex-1"
                >
                  {t('automations.restartLater')}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('automations.restartLaterHint')}
              </p>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    );
  }

  // External/Manual mode UI - shows YAML config
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="w-full max-w-4xl mx-auto py-6 px-3 sm:px-4 md:px-6">
        <h1 className="text-xl sm:text-2xl font-bold mb-6">{t('automations.setupTitle')}</h1>

        <div className="space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t('automations.cardTitle')}</CardTitle>
              <CardDescription>{t('automations.cardDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className={`h-3 w-3 rounded-full ${haConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span>{t('automations.haConnected')} {haConnected ? t('automations.connected') : t('automations.notConfigured')}</span>
              </div>

              {registeredAutomations.length > 0 && (
                <div className="flex items-center gap-4">
                  <Badge variant="secondary">{registeredAutomations.length} {t('automations.configuredTracking')}</Badge>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="webhookUrl" className="text-sm font-medium">
                  {t('automations.spoolmanSync')}
                </label>
                <input
                  id="webhookUrl"
                  type="text"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="http://192.168.1.100:3000"
                  className="w-full px-3 py-2 border rounded-md bg-background text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {t('automations.urlHelp')}
                  {webhookUrl.includes('localhost') && (
                    <span className="text-amber-600 dark:text-amber-400 block mt-1">
                      Note: &quot;localhost&quot; only works if Home Assistant is on the same machine.
                      Use your machine&apos;s IP address (e.g., 192.168.x.x) if HA is elsewhere.
                    </span>
                  )}
                </p>
              </div>

              <Button onClick={generateConfig} disabled={loading || !haConnected || !webhookUrl.trim()}>
                {loading ? t('automations.generating') : t('automations.generate')}
              </Button>
            </CardContent>
          </Card>

          {/* Generated Config */}
          {automationData && (
            <>
              {/* Configuration.yaml Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>configuration.yaml</span>
                    <Badge>{automationData.printerCount} printers</Badge>
                  </CardTitle>
                  <CardDescription>
                    Add this to your Home Assistant <code>configuration.yaml</code> file
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-xs max-h-96">
                      {automationData.configurationYaml}
                    </pre>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(automationData.configurationYaml, 'config')}
                    >
                      {copiedConfig ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Automations.yaml Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>automations.yaml</span>
                    <Badge>{automationData.trayCount} trays</Badge>
                  </CardTitle>
                  <CardDescription>
                    Add this to your Home Assistant <code>automations.yaml</code> file
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-xs max-h-96">
                      {automationData.automationsYaml}
                    </pre>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(automationData.automationsYaml, 'automations')}
                    >
                      {copiedAutomations ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Setup Instructions */}
              <Card>
                <CardHeader>
                  <CardTitle>Setup Instructions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>Copy the <strong>configuration.yaml</strong> content above and add it to your Home Assistant <code>configuration.yaml</code> file</li>
                    <li>Copy the <strong>automations.yaml</strong> content above and add it to your Home Assistant <code>automations.yaml</code> file</li>
                    <li>Restart Home Assistant or reload automations</li>
                    <li>Click &quot;Mark as Configured&quot; below</li>
                  </ol>

                  <Button onClick={registerAutomations} disabled={loading}>
                    Mark as Configured
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

          {/* Registered Automations */}
          {registeredAutomations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Registered Automations</CardTitle>
                <CardDescription>
                  These printers and trays are being monitored
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {registeredAutomations.map((auto) => (
                    <div
                      key={auto.id}
                      className="flex items-center justify-between p-3 bg-muted rounded"
                    >
                      <div>
                        <div className="font-medium">{auto.printerId}</div>
                        <div className="text-sm text-muted-foreground">
                          {auto.trayId.split(',').length} tray(s) monitored
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(auto.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
