import type {
  Settings,
  Dimensions,
  Vec3,
  PrintAxes,
  Violation,
  PrintOption,
  PrintFit,
  Part,
  PrintPlacement,
} from './types.ts';

// Canonical mesh axes and print axes can differ. These six axis-aligned poses
// cover every assignment of the part's three dimensions to printer X/Y/Z.
export const PRINT_ORIENTATIONS = Object.freeze([
  [0, 1, 2],
  [1, 0, 2],
  [0, 2, 1],
  [2, 0, 1],
  [1, 2, 0],
  [2, 1, 0],
] as const satisfies readonly PrintAxes[]);
const EPS = 1e-6;
const names = ['X', 'Y', 'Z'] as const;
const fmt = (n: number) => Number(n.toFixed(2)).toString();
// Machine dimensions are hard limits. The requested XY clearance is a
// preference: exceeding it requires a warning, never an out-of-bed placement.
export const availablePrintVolume = (cfg: Settings): Vec3 => [
  cfg.bedWidth,
  cfg.bedDepth,
  cfg.bedHeight,
];
export const preferredPrintVolume = (cfg: Settings): Vec3 => [
  cfg.bedWidth - 2 * cfg.margin,
  cfg.bedDepth - 2 * cfg.margin,
  cfg.bedHeight,
];
const sizeOf = (part: Dimensions): Vec3 => [part.width, part.depth, part.height];
export const dimensionsFor = (part: Dimensions, axes: PrintAxes): Vec3 =>
  axes.map((axis) => sizeOf(part)[axis]) as Vec3;
const within = (size: Vec3, limits: Vec3) => size.every((n, i) => n <= limits[i] + EPS);
const violationsFor = (dimensions: Vec3, limits: Vec3): Violation[] =>
  dimensions.flatMap((required, axis) =>
    required > limits[axis] + EPS
      ? [
          {
            axis: names[axis],
            required,
            available: limits[axis],
            excess: required - limits[axis],
          },
        ]
      : [],
  );
export function partFits(part: Dimensions, cfg: Settings) {
  return PRINT_ORIENTATIONS.some((axes) =>
    within(dimensionsFor(part, axes), availablePrintVolume(cfg)),
  );
}
export function printOptions(part: Dimensions, cfg: Settings): PrintOption[] {
  const available = availablePrintVolume(cfg),
    preferred = preferredPrintVolume(cfg);
  return PRINT_ORIENTATIONS.map((axes, index) => {
    const dimensions = dimensionsFor(part, axes),
      violations = violationsFor(dimensions, available),
      marginViolations = violationsFor(dimensions, preferred);
    return {
      axes,
      dimensions,
      width: dimensions[0],
      depth: dimensions[1],
      height: dimensions[2],
      fits: violations.length === 0,
      fitsWithMargin: marginViolations.length === 0,
      needsSupport: axes[2] !== 2,
      violations,
      marginViolations,
      index,
      overflow: violations.reduce((sum, v) => sum + v.excess, 0),
      marginOverflow: marginViolations.reduce((sum, v) => sum + v.excess, 0),
    };
  });
}
export function printFit(part: Dimensions, cfg: Settings): PrintFit {
  const options = printOptions(part, cfg),
    fitting = options.filter((option) => option.fits),
    pool = fitting.length ? fitting : options;
  pool.sort((a, b) =>
    fitting.length
      ? Number(a.needsSupport) - Number(b.needsSupport) ||
        Number(b.fitsWithMargin) - Number(a.fitsWithMargin) ||
        a.marginOverflow - b.marginOverflow ||
        a.width * a.depth - b.width * b.depth ||
        a.index - b.index
      : a.overflow - b.overflow ||
        Number(a.needsSupport) - Number(b.needsSupport) ||
        a.index - b.index,
  );
  const best = pool[0],
    upright = options
      .filter((option) => !option.needsSupport)
      .sort((a, b) => a.overflow - b.overflow || a.index - b.index)[0];
  return {
    ...best,
    available: availablePrintVolume(cfg),
    preferred: preferredPrintVolume(cfg),
    uprightViolations: upright.violations,
    usesReservedMargin: best.fits && !best.fitsWithMargin,
  };
}
export function fitMessage(part: Part, cfg: Settings, fit = printFit(part, cfg)) {
  if (fit.fits)
    return fit.needsSupport
      ? '侧放，需检查支撑'
      : part.type === 'frame'
        ? '框套开口朝上'
        : '盒子底面朝下';
  const reasons = fit.violations
    .map(
      (v) => `${v.axis} 需 ${fmt(v.required)}，最大 ${fmt(v.available)}，超出 ${fmt(v.excess)} mm`,
    )
    .join('；');
  return `${part.label}：${reasons}`;
}
export function orientationWarning(part: Part, cfg: Settings, fit = printFit(part, cfg)) {
  if (!fit.fits || !fit.needsSupport) return null;
  const original = part.type === 'frame' ? '开口朝上' : '底面朝下';
  const violations = fit.uprightViolations
    .map(
      (v) =>
        `${v.axis} 需 ${fmt(v.required)}，超过最大 ${fmt(v.available)}（多 ${fmt(v.excess)} mm）`,
    )
    .join('；');
  return `${part.label}：${original}时，${violations}。换方向可放下，可能需要支撑。`;
}
export function marginWarning(part: Part, cfg: Settings, fit = printFit(part, cfg)) {
  if (!fit.fits || !fit.usesReservedMargin) return null;
  const clearances = fit.edgeClearances ?? {
    left: (cfg.bedWidth - fit.width) / 2,
    right: (cfg.bedWidth - fit.width) / 2,
    front: (cfg.bedDepth - fit.depth) / 2,
    back: (cfg.bedDepth - fit.depth) / 2,
  };
  const gaps: [string, number][] = [
    ['X', Math.min(clearances.left, clearances.right)],
    ['Y', Math.min(clearances.front, clearances.back)],
  ];
  const details = gaps
    .filter(([, gap]) => gap < cfg.margin - EPS)
    .map(([axis, gap]) => `${axis} 侧最小留边 ${fmt(gap)} mm`)
    .join('，');
  return `${part.label}：可放入最大打印范围；${details}，小于建议的 ${fmt(cfg.margin)} mm。切片时检查支撑、裙边等额外占位。`;
}
function isOdd(axes: PrintAxes) {
  let inversions = 0;
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) if (axes[i] > axes[j]) inversions++;
  return inversions % 2 === 1;
}
export function itemAxes(item: PrintPlacement): PrintAxes {
  return item.orientation?.axes ?? (item.rotated ? [1, 0, 2] : [0, 1, 2]);
}
// Odd permutations flip the new X axis. This gives a proper rotation (det +1),
// then translates the mesh's minimum XYZ to zero; no mirroring or negative Z.
export function orientPoint(part: Dimensions, point: Vec3, axes: PrintAxes): Vec3 {
  const result = axes.map((axis) => point[axis]) as Vec3;
  if (isOdd(axes)) result[0] = sizeOf(part)[axes[0]] - result[0];
  return result;
}
export function pointOnPlate(part: Dimensions, point: Vec3, item: PrintPlacement): Vec3 {
  const p = orientPoint(part, point, itemAxes(item));
  return [p[0] + item.x, p[1] + item.y, p[2]];
}
export function printTransform(part: Dimensions, item: PrintPlacement) {
  const axes = itemAxes(item),
    matrix = Array(9).fill(0),
    odd = isOdd(axes);
  axes.forEach(
    (oldAxis, newAxis) => (matrix[oldAxis * 3 + newAxis] = newAxis === 0 && odd ? -1 : 1),
  );
  return [...matrix, item.x + (odd ? sizeOf(part)[axes[0]] : 0), item.y, 0];
}
