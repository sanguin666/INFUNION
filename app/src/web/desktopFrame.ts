import { Platform, useWindowDimensions } from 'react-native';

/**
 * On a computer, the browser version of the app sits in a phone-wide
 * column in the middle of the screen instead of stretching buttons and
 * badges across 1,900 px (desktop review, 2 Nov 2026). Phones, and the
 * admin's narrow preview frame, are below the breakpoint and unchanged.
 */
export const DESKTOP_FRAME_WIDTH = 480;
const BREAKPOINT = 600;

const CSS = `
@media (min-width: ${BREAKPOINT}px) {
  html, body { background: #ECE8FC; }
  #root {
    max-width: ${DESKTOP_FRAME_WIDTH}px;
    margin: 0 auto;
    overflow: hidden;
    box-shadow: 0 0 0 1px rgba(29, 26, 45, 0.06), 0 12px 48px rgba(29, 26, 45, 0.12);
  }
  /* Modals and sheets are portals on <body>, outside #root: give them the
     same column. The transform makes their fixed-position layers measure
     against this box; pointer-events lets clicks through while a portal
     is mounted but closed (empty). */
  body > div:not(#root) {
    position: fixed;
    inset: 0;
    max-width: ${DESKTOP_FRAME_WIDTH}px;
    margin: 0 auto;
    transform: translateZ(0);
    pointer-events: none;
  }
  body > div:not(#root) > * { pointer-events: auto; }
}
`;

export function installDesktopFrame(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById('infunion-desktop-frame')) return;
  const style = document.createElement('style');
  style.id = 'infunion-desktop-frame';
  style.textContent = CSS;
  document.head.appendChild(style);
}

/** The window's size, but no wider than the column on a computer. */
export function useFrameDimensions() {
  const d = useWindowDimensions();
  if (Platform.OS !== 'web' || d.width < BREAKPOINT) return d;
  return { ...d, width: Math.min(d.width, DESKTOP_FRAME_WIDTH) };
}
