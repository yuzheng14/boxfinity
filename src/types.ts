// Shared contracts between the editor, geometry, preview and 3MF export.
export interface Settings {
  width: number; height: number; depth: number;
  bedWidth: number; bedDepth: number; bedHeight: number;
  cols: number; rows: number;
  wall: number; base: number; frameWall: number; fit: number;
  edge: number; jointGap: number; radius: number; margin: number;
}
export type SettingKey = keyof Settings;
export type SettingsDraft = { [Key in SettingKey]: string };
export interface GridCell { col: number; row: number }
export interface GridShape { cols: number; rows: number }
export interface GridRectangle extends GridCell, GridShape {}
export interface Placement extends GridRectangle { id: number }
export interface Grid extends GridShape { unitWidth: number; unitHeight: number; depth: number }
export interface GridRecommendation extends Grid { id: string; name: string; score: number }
export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type Axis = 0 | 1 | 2;
export type PrintAxes = readonly [Axis, Axis, Axis];
export interface Dimensions { width: number; depth: number; height: number }
export interface Violation { axis: 'X' | 'Y' | 'Z'; required: number; available: number; excess: number }
export interface EdgeClearances { left: number; right: number; front: number; back: number }
export interface PrintOption extends Dimensions {
  axes: PrintAxes; dimensions: Vec3; fits: boolean; fitsWithMargin: boolean; needsSupport: boolean;
  violations: Violation[]; marginViolations: Violation[]; index: number; overflow: number; marginOverflow: number;
}
export interface PrintFit extends PrintOption {
  available: Vec3; preferred: Vec3; uprightViolations: Violation[];
  usesReservedMargin: boolean; edgeClearances?: EdgeClearances;
}
interface PartBase extends Dimensions {
  id: string; boxId: number; label: string; wall: number; print?: PrintFit;
}
export interface FramePart extends PartBase { type: 'frame' }
export interface DrawerPart extends PartBase { type: 'drawer'; base: number; radius: number }
export type Part = FramePart | DrawerPart;
export type DesignedPart = Part & { print: PrintFit };
export interface CabinetBox extends Placement {
  x: number; z: number; frame: FramePart; drawer: DrawerPart; printable: boolean;
}
export interface DesignedBox extends CabinetBox {
  frame: FramePart & { print: PrintFit }; drawer: DrawerPart & { print: PrintFit };
}
// Legacy rotated placements remain supported by the mesh transform API.
export interface PrintPlacement { x: number; y: number; orientation?: { axes: PrintAxes }; rotated?: boolean }
export interface PlateItem<T extends Part = Part> extends PrintPlacement {
  part: T; orientation: PrintOption; width: number; depth: number;
  edgeClearances: EdgeClearances; usesReservedMargin: boolean;
}
export interface Plate<T extends Part = Part> { id: number; items: PlateItem<T>[] }
export interface DesignIssue { partId: string; boxId: number; violations: Violation[]; message: string; severity?: 'error' }
export interface DesignWarning {
  partId: string; boxId: number; message: string; severity: 'warning'; needsSupport: boolean; usesReservedMargin: boolean;
}
export interface DesignResult {
  cfg: Settings; grid: Grid; placements: Placement[]; boxes: DesignedBox[]; parts: DesignedPart[];
  plates: Plate<DesignedPart>[]; issues: DesignIssue[]; warnings: DesignWarning[];
  supportParts: DesignedPart[]; marginParts: DesignedPart[]; occupied: number;
  coverage: number; materialGrams: number; printable: boolean;
}
export interface DesignDocument { settings: Settings; placements: Placement[] }
export interface MeshData { vertices: Vec3[]; triangles: [number, number, number][] }
