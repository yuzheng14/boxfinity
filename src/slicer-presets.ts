import type { Settings } from './types.ts';
import { printerPreset, matchesPrinterVolume } from './printers.ts';

interface SlicerPreset {
  model: string;
  printer: string;
  process: string;
  filament: string;
  nozzleCount: number;
}

// Names reference profiles installed by Bambu Studio; no vendor scripts are bundled.
// https://github.com/bambulab/BambuStudio/tree/master/resources/profiles/BBL
function bambu(model: string, tag: string, filamentTag = tag, nozzleCount = 1): SlicerPreset {
  return {
    model: `Bambu Lab ${model}`,
    printer: `Bambu Lab ${model} 0.4 nozzle`,
    process: `0.20mm Standard @BBL ${tag}`,
    filament: filamentTag ? `Generic PETG @BBL ${filamentTag}` : 'Generic PETG',
    nozzleCount,
  };
}
const x1c = bambu('X1 Carbon', 'X1C', '');
const h2c = bambu('H2C', 'H2C', 'H2C 0.4 nozzle', 2);
const x2d = bambu('X2D', 'X2D', 'X2D 0.4 nozzle', 2);
const BAMBU_PRESETS: Readonly<Record<string, SlicerPreset>> = {
  'bambu-a1-mini': bambu('A1 mini', 'A1M'),
  'bambu-a1': bambu('A1', 'A1'),
  'bambu-p1p': bambu('P1P', 'P1P'),
  'bambu-p1s': bambu('P1S', 'X1C', ''),
  'bambu-p2s': bambu('P2S', 'P2S'),
  'bambu-x1c': x1c,
  'bambu-x2d-main': x2d,
  'bambu-x2d-auxiliary': x2d,
  'bambu-x2d-dual': x2d,
  'bambu-h2s': bambu('H2S', 'H2S'),
  'bambu-h2d-single': bambu('H2D', 'H2D', 'H2D', 2),
  'bambu-h2c-left': h2c,
  'bambu-h2c-right': h2c,
  'bambu-h3c': bambu('H3C', 'H3C'),
};

export function projectPreset(cfg: Settings, printerPresetId?: string) {
  const candidate = printerPreset(printerPresetId);
  const selected = candidate && matchesPrinterVolume(cfg, candidate.volume) ? candidate : undefined;
  const mapped = selected ? BAMBU_PRESETS[selected.id] : undefined;
  return { ...(mapped ?? x1c), fallback: !mapped, selected };
}

export function projectPresetNote(cfg: Settings, printerPresetId?: string) {
  const preset = projectPreset(cfg, printerPresetId);
  return preset.fallback
    ? `兼容兜底：${preset.model} · 0.4 mm / 0.2 mm 层高 / Generic PETG。保留当前 XYZ，导入后请切换实际机型、喷嘴与耗材。`
    : `${preset.model} · 0.4 mm / 0.2 mm 层高 / Generic PETG。切片前核对喷嘴、耗材与打印模式。`;
}
