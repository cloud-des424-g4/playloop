import sky from '../../assets/backgrounds/sky.webp';
import stormClouds from '../../assets/themes/storm-clouds.png';
import lightningGlow from '../../assets/themes/lightning-glow.svg';

// Server default (game.model.js); "Reset to PlayLoop default" goes back to it.
export const DEFAULT_THEME = {
  backgroundPreset: 'sky',
  backgroundImageUrl: null,
  accentColor: '#FF5A1F',
  controlsCardColor: '#FFFFFF',
};

// Quoted: Vite inlines small images as data URIs, which are not valid in an unquoted url().
const cssUrl = (url) => `url("${url}")`;
const CLOUDS = (url) => `${cssUrl(url)} center top / cover no-repeat`;

// Figma "Page options" (265:590). Storm is the game page frame (167:980): the storm photo, its
// tint gradient and the lightning glow. Overcast is the same photo lightened, Night a gradient.
export const BACKGROUNDS = [
  { preset: 'sky', label: 'Sky · default', dark: false, background: `#cdebff ${CLOUDS(sky)}` },
  {
    preset: 'storm',
    label: 'Storm',
    dark: true,
    background: [
      `${cssUrl(lightningGlow)} left 40% top -260px / 1300px 900px no-repeat`,
      'linear-gradient(rgb(11 16 32 / 45%), rgb(26 34 54 / 22%) 45%, rgb(11 16 32 / 55%))',
      `#0b1020 ${CLOUDS(stormClouds)}`,
    ].join(', '),
  },
  {
    preset: 'overcast',
    label: 'Overcast',
    dark: false,
    background: `linear-gradient(rgb(226 230 238 / 55%), rgb(226 230 238 / 35%)), #9aa3b2 ${CLOUDS(stormClouds)}`,
  },
  { preset: 'night', label: 'Night', dark: true, background: 'linear-gradient(#191923, #0536b5)' },
];

// Swatches from Figma "Page accent" and "Controls card".
export const ACCENT_SWATCHES = [
  '#FB541B',
  '#074CFC',
  '#38B6FF',
  '#9B7BFF',
  '#FF5C8A',
  '#8CD43F',
  '#FFC21A',
];
export const CONTROLS_SWATCHES = ['#FFFFFF', '#E3DAFF', '#CDEBFF', '#DFF4C7', '#FFEDB5', '#FFD3DF'];

export const HEX = /^#[0-9A-Fa-f]{6}$/;

const DARK_TEXT = '#191923';
const LIGHT_TEXT = '#ffffff';
// What the glass panels sit on, roughly, for working out readable text.
const PAGE_BASE = { dark: '#141a2a', light: '#dfe9f5' };

function rgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]) {
  const [R, G, B] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

// Dark or light text, whichever reads better on the colour.
export function readableText(color) {
  const lum = luminance(color);
  return contrast(lum, luminance(rgb(DARK_TEXT))) >= contrast(lum, 1) ? DARK_TEXT : LIGHT_TEXT;
}

const mix = (a, b, weight) => a.map((v, i) => Math.round(v * weight + b[i] * (1 - weight)));

export function backgroundOf(theme) {
  if (theme.backgroundImageUrl) {
    return {
      dark: true,
      background: `linear-gradient(rgb(11 16 32 / 45%), rgb(11 16 32 / 45%)), #0b1020 ${CLOUDS(theme.backgroundImageUrl)}`,
    };
  }
  return BACKGROUNDS.find((b) => b.preset === theme.backgroundPreset) ?? BACKGROUNDS[0];
}

// Shell style for a game's theme: the background plus --theme-* variables that game and review
// pages read. "Text colors adjust automatically so everything stays readable" (Figma).
export function themeLook(rawTheme) {
  const theme = { ...DEFAULT_THEME, ...rawTheme };
  const { dark, background } = backgroundOf(theme);
  const accent = HEX.test(theme.accentColor) ? theme.accentColor : DEFAULT_THEME.accentColor;
  const controls = HEX.test(theme.controlsCardColor)
    ? theme.controlsCardColor
    : DEFAULT_THEME.controlsCardColor;
  const controlsAlpha = dark ? 0.3 : 0.55;
  const controlsSeen = mix(
    rgb(controls),
    rgb(dark ? PAGE_BASE.dark : PAGE_BASE.light),
    controlsAlpha,
  );
  return {
    dark,
    style: {
      background,
      '--theme-accent': accent,
      '--theme-accent-soft': `color-mix(in srgb, ${accent} 16%, transparent)`,
      '--theme-accent-gradient': `linear-gradient(90deg, ${accent}, color-mix(in srgb, ${accent} 40%, white))`,
      '--theme-on-accent': readableText(mix(rgb(accent), [255, 255, 255], 0.8)),
      // Review-flow buttons: Figma's half-strength gradient on light pages, full strength on dark.
      '--theme-button': dark
        ? `linear-gradient(90deg, ${accent}, color-mix(in srgb, ${accent} 40%, white))`
        : `linear-gradient(90deg, color-mix(in srgb, ${accent} 50%, transparent), color-mix(in srgb, color-mix(in srgb, ${accent} 40%, white) 50%, transparent))`,
      '--theme-on-button': dark ? readableText(mix(rgb(accent), [255, 255, 255], 0.8)) : DARK_TEXT,
      '--theme-accent-text': dark
        ? `color-mix(in srgb, ${accent} 70%, white)`
        : `color-mix(in srgb, ${accent} 70%, black)`,
      '--theme-controls': `color-mix(in srgb, ${controls} ${controlsAlpha * 100}%, transparent)`,
      '--theme-on-controls': readableText(controlsSeen),
      '--theme-panel': dark ? 'rgb(14 20 36 / 40%)' : 'var(--playloop-surface-card)',
      '--theme-text': dark ? LIGHT_TEXT : 'var(--playloop-text-primary)',
      '--theme-text-body': dark ? 'rgb(255 255 255 / 80%)' : 'var(--playloop-text-body)',
      '--theme-text-caption': dark ? 'rgb(255 255 255 / 65%)' : 'var(--playloop-text-caption)',
      '--theme-platform': dark ? 'rgb(56 182 255 / 24%)' : 'rgb(205 235 255 / 85%)',
      // Review cards stay light glass; on dark backgrounds they get more opaque to stay readable.
      '--theme-card': dark ? 'rgb(255 255 255 / 78%)' : 'var(--playloop-surface-card)',
    },
  };
}
