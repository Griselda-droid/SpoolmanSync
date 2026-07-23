'use client';

import { QRCodeSVG } from 'qrcode.react';
import type { Spool } from '@/lib/api/spoolman';
import type { ContentSettings, LayoutSettings } from '@/lib/label-sheet-config';

// Inline SVG data URI for the SpoolmanSync icon (black strokes on white background)
const ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="24" height="24" fill="white" stroke="none"/><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3"/><path d="M12 19v3"/><path d="M2 12h3"/><path d="M19 12h3"/></svg>';
const ICON_DATA_URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ICON_SVG)}`;

interface LabelCellProps {
  spool: Spool;
  url: string;
  widthMm: number;
  heightMm: number;
  content: ContentSettings;
  layout: LayoutSettings;
}

export function LabelCell({ spool, url, widthMm, heightMm, content, layout }: LabelCellProps) {
  const sz = content.labelTextSizeMm;

  const innerHeight = heightMm - layout.safeZoneTopMm - layout.safeZoneBottomMm;
  const innerWidth = widthMm - layout.safeZoneLeftMm - layout.safeZoneRightMm;

  // Base size follows the calculated label cell; the user scale adjusts it without overflow.
  const autoQrSize = Math.min(innerHeight, innerWidth * 0.4);
  const qrSize = content.qrMode !== 'none'
    ? Math.min(autoQrSize * (content.qrScalePercent / 100), innerHeight, innerWidth)
    : 0;

  const textWidth = content.qrMode !== 'none'
    ? innerWidth - qrSize - 1 // 1mm gap
    : innerWidth;

  const showAnyText = content.showLabel && (
    content.showVendor || content.showName || content.showMaterial ||
    content.showColor || content.showSpoolId
  );

  return (
    <div
      style={{
        width: `${widthMm}mm`,
        height: `${heightMm}mm`,
        padding: `${layout.safeZoneTopMm}mm ${layout.safeZoneRightMm}mm ${layout.safeZoneBottomMm}mm ${layout.safeZoneLeftMm}mm`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: content.qrMode !== 'none' && !showAnyText ? 'center' : 'flex-start',
        gap: content.qrMode !== 'none' && showAnyText ? '1mm' : '0',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* QR Code */}
      {content.qrMode !== 'none' && (
        <div
          style={{
            width: `${qrSize}mm`,
            height: `${qrSize}mm`,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <QRCodeSVG
            value={url}
            size={qrSize * 3.7795} // mm to px approximation for SVG rendering
            level="M"
            style={{ width: '100%', height: '100%' }}
            imageSettings={content.qrMode === 'icon' ? {
              src: ICON_DATA_URI,
              width: qrSize * 3.7795 * 0.2,
              height: qrSize * 3.7795 * 0.2,
              excavate: true,
            } : undefined}
          />
        </div>
      )}

      {/* Text */}
      {showAnyText && (
        <div
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: `${sz * 0.15}mm`,
            maxWidth: `${textWidth}mm`,
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
          }}
        >
          {content.showVendor && spool.filament.vendor?.name && (
            <div style={{
              fontSize: `${sz}mm`,
              fontWeight: 600,
              lineHeight: 1.2,
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
              color: '#000',
            }}>
              {spool.filament.vendor.name}
            </div>
          )}
          {content.showName && spool.filament.name && (
            <div style={{
              fontSize: `${sz * 0.85}mm`,
              lineHeight: 1.2,
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
              color: '#000',
            }}>
              {spool.filament.name}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5mm', minWidth: 0 }}>
            {content.showColor && (() => {
              const colors = spool.filament.multi_color_hexes
                ? spool.filament.multi_color_hexes.split(',')
                : null;
              if (colors && colors.length > 1) {
                const isLongitudinal = spool.filament.multi_color_direction === 'longitudinal';
                return (
                  <div style={{
                    width: `${sz}mm`,
                    height: `${sz}mm`,
                    borderRadius: '50%',
                    border: '0.2mm solid #000',
                    flexShrink: 0,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: isLongitudinal ? 'column' : 'row',
                  }}>
                    {colors.map((hex, i) => (
                      <div key={i} style={{ flex: 1, backgroundColor: `#${hex}` }} />
                    ))}
                  </div>
                );
              }
              return (
                <div style={{
                  width: `${sz}mm`,
                  height: `${sz}mm`,
                  borderRadius: '50%',
                  backgroundColor: `#${spool.filament.color_hex || 'cccccc'}`,
                  border: '0.2mm solid #000',
                  flexShrink: 0,
                }} />
              );
            })()}
            {content.showMaterial && (
              <div style={{
                fontSize: `${sz * 0.85}mm`,
                lineHeight: 1.2,
                minWidth: 0,
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
                color: '#000',
              }}>
                {spool.filament.material}
              </div>
            )}
          </div>
          {content.showSpoolId && (
            <div style={{
              fontSize: `${sz * 0.75}mm`,
              lineHeight: 1.2,
              color: '#333',
            }}>
              #{spool.id}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
