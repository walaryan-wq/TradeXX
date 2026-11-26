/** Canvas-side copies of the design tokens in index.css (canvas can't read CSS vars cheaply). */
export const C = {
  bg: '#050A13',
  pos: '#00D6AE',
  pos2: '#39F0C5',
  neg: '#EF4B96',
  neg2: '#B42D75',
  blue: '#3D64DD',
  text: '#DCE8EF',
  text2: '#718796',
  border: '#173040',
};
export const posRGB = '0,214,174';
export const negRGB = '239,75,150';
export const neutralRGB = '113,135,150';
export const rgbFor = (v: number | null) => (v == null || v === 0 ? neutralRGB : v > 0 ? posRGB : negRGB);

/** Reveal timeline (seconds from intro start). */
export const REVEAL = {
  grid: [0, 0.5],
  traj: [0.5, 2.5],
  strip: [1.8, 3.0],
  conn: [2.6, 4.2],
  cards: [3.3, 5.5],
} as const;

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const ease = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
export const phase = (t: number, [a, b]: readonly [number, number]) => ease((t - a) / (b - a));
