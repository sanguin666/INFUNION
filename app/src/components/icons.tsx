import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { colors } from '../theme/theme';

type IconProps = {
  size?: number;
  color?: string;
};

// The INFUNION mark: a heart split into two colors that meet at the center in
// an S. Fixed brand colors — not tinted via `color` like the other icons.
// `haloColor`, when set, traces a thin outline just outside the heart's own
// silhouette — for placing the mark on a background that's the same color
// as one of its halves (the corail header), where it would otherwise blend
// into the background on that side.
export function LogoMark({ size = 40, haloColor }: { size?: number; haloColor?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {haloColor && (
        <Path
          d="M50 84 C22 62 9 42 9 27 C9 13 20 5 32 5 C43 5 49 13 50 20 C51 13 57 5 68 5 C80 5 91 13 91 27 C91 42 78 62 50 84 Z"
          fill="none"
          stroke={haloColor}
          strokeWidth={6}
        />
      )}
      <Path
        d="M50 20 C49 13 43 5 32 5 C20 5 9 13 9 27 C9 42 22 62 50 84 C66 69 66 52 50 52 C34 52 34 35 50 20 Z"
        fill="#E1663F"
      />
      <Path
        d="M50 20 C51 13 57 5 68 5 C80 5 91 13 91 27 C91 42 78 62 50 84 C66 69 66 52 50 52 C34 52 34 35 50 20 Z"
        fill="#E0A458"
      />
      <Path
        d="M50 20 C34 35 34 52 50 52 C66 52 66 69 50 84"
        fill="none"
        stroke="#F7F1E7"
        strokeWidth={5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function BackChevronIcon({ size = 20, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 5l-7 7 7 7"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ChevronRightIcon({ size = 20, color = colors.textMuted }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 5l7 7-7 7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function BellIcon({ size = 20, color = colors.text, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={filled ? color : 'none'}
      />
      <Path
        d="M13.73 21a2 2 0 0 1-3.46 0"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CheckIcon({ size = 20, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 13l4 4L19 7"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function HomeIcon({ size = 20, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Points at the place name in the hub banner to show it opens the place
// switcher rather than being a plain label.
export function ChevronDownIcon({ size = 20, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 9l6 6 6-6"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CalendarIcon({ size = 24, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={4} width={18} height={18} rx={2} stroke={color} strokeWidth={2} />
      <Line x1={16} y1={2} x2={16} y2={6} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={8} y1={2} x2={8} y2={6} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={3} y1={10} x2={21} y2={10} stroke={color} strokeWidth={2} />
    </Svg>
  );
}

export function HeartIcon({ size = 24, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8Z" />
    </Svg>
  );
}

export function CandleIcon({ size = 24, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2c1.2 1.8 2.2 3 2.2 4.3a2.2 2.2 0 0 1-4.4 0C9.8 5 10.8 3.8 12 2Z"
        fill={color}
      />
      <Rect x={9} y={9} width={6} height={12} rx={1} stroke={color} strokeWidth={2} />
    </Svg>
  );
}

export function MicIcon({ size = 24, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z"
        stroke={color}
        strokeWidth={2}
      />
      <Path
        d="M19 10v2a7 7 0 0 1-14 0v-2"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Line x1={12} y1={19} x2={12} y2={23} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={8} y1={23} x2={16} y2={23} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function PlusIcon({ size = 20, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={12} y1={5} x2={12} y2={19} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <Line x1={5} y1={12} x2={19} y2={12} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

// Decorative mark used on POI hero banners — a simple roof/place glyph.
// Not tied to any single POI type; kept generic on purpose.
export function PlaceGlyphIcon({ size = 64, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Path
        d="M17 33 L32 19 L47 33"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M22 31 V47 H42 V31"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line x1={32} y1={37} x2={32} y2={47} stroke={color} strokeWidth={4} strokeLinecap="round" />
    </Svg>
  );
}

export function CloseIcon({ size = 20, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 6 6 18M6 6l12 12"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function QrIcon({ size = 26, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Rect x={6} y={6} width={28} height={28} rx={6} stroke={color} strokeWidth={7} />
      <Rect x={16} y={16} width={8} height={8} rx={2} fill={color} />
      <Rect x={66} y={6} width={28} height={28} rx={6} stroke={color} strokeWidth={7} />
      <Rect x={76} y={16} width={8} height={8} rx={2} fill={color} />
      <Rect x={6} y={66} width={28} height={28} rx={6} stroke={color} strokeWidth={7} />
      <Rect x={16} y={76} width={8} height={8} rx={2} fill={color} />
      <Rect x={66} y={66} width={10} height={10} rx={2} fill={color} />
      <Rect x={82} y={66} width={10} height={10} rx={2} fill={color} />
      <Rect x={66} y={82} width={10} height={10} rx={2} fill={color} />
      <Rect x={46} y={46} width={10} height={10} rx={2} fill={color} />
      <Rect x={46} y={6} width={10} height={10} rx={2} fill={color} />
      <Rect x={6} y={46} width={10} height={10} rx={2} fill={color} />
    </Svg>
  );
}

export function MegaphoneIcon({ size = 24, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 10v4a1 1 0 0 0 1 1h2l4 4V5L6 9H4a1 1 0 0 0-1 1Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M17 8a5 5 0 0 1 0 8"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M20 5a9 9 0 0 1 0 14"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PlayIcon({ size = 24, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={2} />
      <Path d="M10 8.5v7l6-3.5-6-3.5Z" fill={color} stroke={color} strokeWidth={1.2} strokeLinejoin="round" />
    </Svg>
  );
}

export function ChatBubbleIcon({ size = 24, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4H5a2 2 0 0 1-2-2V5Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line x1={7} y1={8} x2={17} y2={8} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Line x1={7} y1={12} x2={13} y2={12} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export function PinIcon({ size = 24, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22s7-7.58 7-12.5A7 7 0 0 0 5 9.5C5 14.42 12 22 12 22Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={9.5} r={2.5} stroke={color} strokeWidth={2} />
    </Svg>
  );
}

// Three dots: the near-universal "there is more behind this" mark, kept
// as filled circles so it stays legible at the tab bar's icon size.
export function MoreDotsIcon({ size = 24, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={5} cy={12} r={2} fill={color} />
      <Circle cx={12} cy={12} r={2} fill={color} />
      <Circle cx={19} cy={12} r={2} fill={color} />
    </Svg>
  );
}

// The stand-in for somebody who has neither a picture nor a name yet —
// head and shoulders, drawn rather than photographic so it never reads as
// a real person's face.
export function PersonIcon({ size = 24, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={3.6} stroke={color} strokeWidth={2} />
      <Path
        d="M4.5 20c0-4 3.4-6.2 7.5-6.2s7.5 2.2 7.5 6.2"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// Sits on the profile picture to say the picture is the thing you press
// to change it.
export function CameraIcon({ size = 24, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 8.5A2 2 0 015 6.5h1.8l1.3-2h7.8l1.3 2H19a2 2 0 012 2V18a2 2 0 01-2 2H5a2 2 0 01-2-2z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={13} r={3.6} stroke={color} strokeWidth={2} />
    </Svg>
  );
}

export function ExitIcon({ size = 24, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Three walls and an open side: a doorway being stepped out of. */}
      <Path
        d="M14 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h8"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 12h9m0 0-3.2-3.2M21 12l-3.2 3.2"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function GlobeIcon({ size = 24, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      {/* An equator and a meridian: enough to read as a globe at 26pt,
          where anything more detailed turns to mush. */}
      <Path d="M3 12h18" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path
        d="M12 3c2.6 2.4 4 5.4 4 9s-1.4 6.6-4 9c-2.6-2.4-4-5.4-4-9s1.4-6.6 4-9Z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Light / dark mode: a circle half filled.
export function ContrastIcon({ size = 24, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Path d="M12 3a9 9 0 0 1 0 18Z" fill={color} />
    </Svg>
  );
}

// Requests to the office: a clipboard with a form on it.
export function ClipboardIcon({ size = 24, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={5} y={4} width={14} height={18} rx={2} stroke={color} strokeWidth={2} />
      <Rect x={9} y={2} width={6} height={4} rx={1} stroke={color} strokeWidth={2} fill={colors.surface} />
      <Line x1={8.5} y1={11} x2={15.5} y2={11} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={8.5} y1={15} x2={13.5} y2={15} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

// Mass intentions: a chalice with the host above it.
export function ChaliceIcon({ size = 24, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={4} r={2.2} stroke={color} strokeWidth={1.8} />
      <Path d="M6 8.5h12c0 4-2.7 6.5-6 6.5s-6-2.5-6-6.5Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Line x1={12} y1={15} x2={12} y2={20} stroke={color} strokeWidth={2} />
      <Line x1={8} y1={21} x2={16} y2={21} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

// Lectures du jour: an open book.
export function BookIcon({ size = 24, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 6.5C10 5 7 4.5 3 5v13c4-.5 7 0 9 1.5 2-1.5 5-2 9-1.5V5c-4-.5-7 0-9 1.5Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Line x1={12} y1={6.5} x2={12} y2={19.5} stroke={color} strokeWidth={2} />
    </Svg>
  );
}

// Messages: an envelope, apart from the community's speech bubble.
export function EnvelopeIcon({ size = 24, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={5} width={18} height={14} rx={2} stroke={color} strokeWidth={2} />
      <Path d="m3.5 6.5 8.5 6.5 8.5-6.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PaperclipIcon({ size = 24, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.5 11.5 12.3 19.7a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// A paper still to hand in, or one handed in (with `done`).
export function DocumentIcon({ size = 24, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M14 2v6h6" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}

// Save to the phone: an arrow down onto a line.
export function DownloadIcon({ size = 24, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3v12M6 10l6 6 6-6M4 21h16" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function AlertIcon({ size = 24, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3 2 21h20Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Line x1={12} y1={10} x2={12} y2={14} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={12} cy={17.5} r={1.2} fill={color} />
    </Svg>
  );
}
