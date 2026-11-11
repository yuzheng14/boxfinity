import type { Settings, SettingsDraft } from './types.ts';

export type PrinterVolume = Pick<Settings, 'bedWidth' | 'bedDepth' | 'bedHeight'>;
interface PrinterPreset {
  id: string; model: string; volume: PrinterVolume;
}
interface PrinterBrand { name: string; presets: readonly PrinterPreset[] }
const preset = (id: string, model: string, x: number, y: number, z: number): PrinterPreset => ({
  id, model, volume: { bedWidth: x, bedDepth: y, bedHeight: z },
});

// Nominal printable XYZ in mm, checked against official specifications.
// Sources and mode restrictions: docs/printer-presets.md.
// A single part must fit one nozzle's range, not the union of both nozzles.
export const PRINTER_BRANDS: readonly PrinterBrand[] = [
  { name: '拓竹 Bambu Lab', presets: [
    preset('bambu-a1-mini', 'A1 mini', 180, 180, 180),
    preset('bambu-a1', 'A1', 256, 256, 256),
    preset('bambu-p1p', 'P1P', 256, 256, 256),
    preset('bambu-p1s', 'P1S', 256, 256, 256),
    preset('bambu-p2s', 'P2S', 256, 256, 256),
    preset('bambu-x1c', 'X1 Carbon', 256, 256, 256),
    preset('bambu-x2d-main', 'X2D · 主喷嘴', 256, 256, 260),
    preset('bambu-x2d-auxiliary', 'X2D · 辅助喷嘴', 235.5, 256, 256),
    preset('bambu-x2d-dual', 'X2D · 双喷嘴', 235.5, 256, 256),
    preset('bambu-h2s', 'H2S', 340, 320, 340),
    preset('bambu-h2d-single', 'H2D · 单喷嘴', 325, 320, 325),
    preset('bambu-h2c-left', 'H2C · 左喷嘴', 325, 320, 325),
    preset('bambu-h2c-right', 'H2C · 右喷嘴', 305, 320, 325),
    preset('bambu-h3c', 'H3C', 330, 320, 325),
  ] },
  { name: '创想三维 Creality', presets: [
    preset('creality-k1', 'K1', 220, 220, 250),
    preset('creality-k1c', 'K1C', 220, 220, 250),
    preset('creality-k1-max', 'K1 Max', 300, 300, 300),
    preset('creality-k2', 'K2', 260, 260, 260),
    preset('creality-k2-pro', 'K2 Pro', 300, 300, 300),
    preset('creality-k2-plus', 'K2 Plus', 350, 350, 350),
    preset('creality-ender-3-v3', 'Ender-3 V3', 220, 220, 250),
    preset('creality-ender-3-v3-plus', 'Ender-3 V3 Plus', 300, 300, 330),
  ] },
  { name: '闪铸 Flashforge', presets: [
    preset('flashforge-ad5x', 'AD5X', 220, 220, 220),
    preset('flashforge-ad5m', '冒险家 5M', 220, 220, 220),
    preset('flashforge-ad5m-pro', '冒险家 5M Pro', 220, 220, 220),
    preset('flashforge-ad4', '冒险家 4', 220, 200, 250),
  ] },
  { name: '快造 Snapmaker', presets: [
    preset('snapmaker-u1', 'U1', 270, 270, 270),
    preset('snapmaker-artisan-right', 'Artisan · 右喷嘴', 400, 400, 400),
    preset('snapmaker-artisan-dual', 'Artisan · 双喷嘴', 350, 400, 400),
  ] },
];
export const PRINTER_PRESETS = PRINTER_BRANDS.flatMap((brand) => brand.presets);
export const printerPreset = (id: unknown) => PRINTER_PRESETS.find((entry) => entry.id === id);
export function matchesPrinterVolume(values: PrinterVolume | SettingsDraft, volume: PrinterVolume) {
  return (Object.keys(volume) as (keyof PrinterVolume)[]).every((key) =>
    values[key] !== '' && Number(values[key]) === volume[key]);
}
