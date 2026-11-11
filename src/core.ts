import type { Settings, SettingKey, Grid, Placement, CabinetBox, FramePart, DrawerPart, GridRecommendation, Part, DesignedPart, Plate, PrintOption, DesignWarning, DesignResult } from './types.ts';
import { validatePlacements } from './layout.ts';
import { partMesh, meshVolume } from './geometry.ts';
import { partFits, printFit, printOptions, fitMessage, orientationWarning, marginWarning } from './printing.ts';

export { partFits } from './printing.ts';
export const DEFAULTS: Readonly<Settings> = Object.freeze({
  width: 600, height: 420, depth: 180,
  bedWidth: 220, bedDepth: 220, bedHeight: 250,
  cols: 9, rows: 6,
  wall: 1.6, base: 1.6, frameWall: 2.4, fit: .5, edge: 1.5, jointGap: .4, radius: 4, margin: 0,
});
export class DesignError extends Error {
  field?: SettingKey;
  constructor(message: string, field?: SettingKey) { super(message); this.name = 'DesignError'; this.field = field; }
}
export const display = (n: number, digits = 1) => Number(n.toFixed(digits)).toString();
const floor = (n: number) => Math.floor((n + 1e-9) * 1e5) / 1e5;
const limits: Record<SettingKey, [number, number, string]> = {
  width: [80, 3000, '柜内宽度'], height: [80, 3000, '柜内高度'], depth: [40, 1000, '柜内深度'],
  bedWidth: [50, 1500, '打印宽度'], bedDepth: [50, 1500, '打印深度'], bedHeight: [50, 1500, '打印高度'],
  cols: [1, 24, '网格列数'], rows: [1, 24, '网格行数'],
  wall: [.8, 5, '盒子壁厚'], base: [.8, 5, '盒子底厚'], frameWall: [1.2, 8, '框套壁厚'],
  fit: [.2, 2, '抽拉间隙'], edge: [.5, 10, '柜边间隙'], jointGap: [.2, 2, '框套间隙'], radius: [2, 12, '盒子圆角'], margin: [0, 20, '打印边距'],
};
export function settings(input: unknown = {}): Settings {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new DesignError('方案参数必须为对象');
  const source = input as Record<string, unknown>, cfg = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS) as SettingKey[]) {
    const value = Object.hasOwn(source, key) ? source[key] : DEFAULTS[key];
    const [min, max, label] = limits[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new DesignError(`${label}需在 ${min}–${max} 之间`, key);
    cfg[key] = value;
  }
  if (!Number.isInteger(cfg.cols) || !Number.isInteger(cfg.rows)) throw new DesignError('网格行列数必须为整数', 'cols');
  if (cfg.radius < cfg.wall + .2) throw new DesignError(`圆角需至少为 ${display(cfg.wall + .2)} mm`, 'radius');
  const grid = measureGrid(cfg);
  if (Math.min(grid.unitWidth, grid.unitHeight) - cfg.jointGap - 2 * cfg.frameWall - 2 * cfg.fit <= 2 * cfg.wall + 8) throw new DesignError('单元过小，请减少网格行列数或减小结构壁厚', 'cols');
  return cfg;
}
export function measureGrid(cfg: Settings): Grid {
  return { cols: cfg.cols, rows: cfg.rows, unitWidth: (cfg.width - 2 * cfg.edge) / cfg.cols,
    unitHeight: (cfg.height - 2 * cfg.edge) / cfg.rows, depth: cfg.depth - 2 * cfg.edge };
}
export function makeBox(rect: Placement, cfg: Settings, grid = measureGrid(cfg)): CabinetBox {
  const fw = floor(rect.cols * grid.unitWidth - cfg.jointGap), fh = floor(rect.rows * grid.unitHeight - cfg.jointGap);
  const frame: FramePart = { id: `frame-${rect.id}`, boxId: rect.id, type: 'frame', label: `框套 ${rect.id}`, width: fw, depth: fh, height: grid.depth, wall: cfg.frameWall };
  const width = floor(fw - 2 * (cfg.frameWall + cfg.fit)), height = floor(fh - 2 * (cfg.frameWall + cfg.fit));
  const drawer: DrawerPart = { id: `drawer-${rect.id}`, boxId: rect.id, type: 'drawer', label: `盒子 ${rect.id}`,
    width, depth: floor(grid.depth - cfg.fit), height, wall: cfg.wall, base: cfg.base,
    radius: Math.min(cfg.radius, Math.min(width, grid.depth - cfg.fit) / 2 - .1) };
  const x = cfg.edge + rect.col * grid.unitWidth + cfg.jointGap / 2;
  const z = cfg.edge + (cfg.rows - rect.row - rect.rows) * grid.unitHeight + cfg.jointGap / 2;
  return { ...rect, x, z, frame, drawer, printable: partFits(frame, cfg) && partFits(drawer, cfg) };
}

// Return three genuinely different cell sizes, fitting at least a 1×1 drawer
// and its sleeve. Cabinet width/height define the front grid; depth stays fixed.
export function recommendGrids(input: unknown = {}): GridRecommendation[] {
  const cfg = settings(input), chosen: GridRecommendation[] = [], names = ['细分', '均衡', '大格'];
  for (const [index, target] of [54, 68, 88].entries()) {
    const possibilities: GridRecommendation[] = [];
    for (let cols = 1; cols <= 24; cols++) for (let rows = 1; rows <= 24; rows++) {
      const candidate = { ...cfg, cols, rows }, grid = measureGrid(candidate);
      if (Math.min(grid.unitWidth, grid.unitHeight) < 28 || Math.max(grid.unitWidth, grid.unitHeight) > 160) continue;
      if (Math.min(grid.unitWidth, grid.unitHeight) - cfg.jointGap - 2 * cfg.frameWall - 2 * cfg.fit <= 2 * cfg.wall + 8) continue;
      const box = makeBox({ id: 1, col: 0, row: 0, cols: 1, rows: 1 }, candidate, grid);
      if (!box.printable) continue;
      const score = Math.abs(Math.log(grid.unitWidth / target)) + Math.abs(Math.log(grid.unitHeight / target)) + .65 * Math.abs(Math.log(grid.unitWidth / grid.unitHeight));
      possibilities.push({ ...grid, id: `${cols}x${rows}`, name: names[index], score });
    }
    possibilities.sort((a, b) => a.score - b.score);
    const next = possibilities.find((option) => !chosen.some((item) => item.id === option.id));
    if (next) chosen.push(next);
  }
  return chosen;
}

// Keep requested clearance whenever possible. A part that only fits inside
// the machine maximum gets a dedicated, minimally relaxed plate if needed.
// Placement and all residual rectangles always stay inside physical XY bounds.
interface FreeRectangle { x: number; y: number; width: number; depth: number }
interface PackingPlate<T extends Part> extends Plate<T> { free: FreeRectangle[] }
interface PackingChoice<T extends Part> {
  plate: PackingPlate<T>; free: FreeRectangle; index: number; orientation: PrintOption;
  width: number; depth: number; score: number;
}
export function packPlates<T extends Part>(parts: T[],cfg: Settings): Plate<T>[] {
  const plates: PackingPlate<T>[]=[],spacing=5;
  const jobs=parts.map((part)=>{
    const options=printOptions(part,cfg).filter((option)=>option.fits);
    if(!options.length)throw new DesignError(fitMessage(part,cfg));
    const upright=options.filter((option)=>!option.needsSupport),contactPoses=upright.length?upright:options;
    const fullMargin=contactPoses.filter((option)=>option.fitsWithMargin),poses=fullMargin.length?fullMargin:contactPoses;
    return {part,poses,keepMargin:fullMargin.length>0,area:Math.min(...poses.map((pose)=>pose.width*pose.depth))};
  }).sort((a,b)=>b.area-a.area||a.part.id.localeCompare(b.part.id));
  for(const {part,poses,keepMargin} of jobs){
    let best: PackingChoice<T> | null=null;
    const search=(plate: PackingPlate<T>): PackingChoice<T> | null => {
      let choice: PackingChoice<T> | null=null;
      plate.free.forEach((original,index)=>{
        const x=keepMargin?Math.max(original.x,cfg.margin):original.x;
        const y=keepMargin?Math.max(original.y,cfg.margin):original.y;
        const right=keepMargin?Math.min(original.x+original.width,cfg.bedWidth-cfg.margin):original.x+original.width;
        const back=keepMargin?Math.min(original.y+original.depth,cfg.bedDepth-cfg.margin):original.y+original.depth;
        const free={x,y,width:right-x,depth:back-y};
        for(const orientation of poses){
          const {width,depth}=orientation;
          if(width>free.width+1e-6||depth>free.depth+1e-6)continue;
          const score=free.width*free.depth-width*depth;
          if(!choice||score<choice.score)choice={plate,free,index,orientation,width,depth,score};
        }
      });
      return choice;
    };
    for(const plate of plates){
      const choice=search(plate);
      if(choice&&(!best||choice.score<best.score))best=choice;
    }
    if(!best){
      const seed=[...poses].sort((a,b)=>a.marginOverflow-b.marginOverflow||a.width*a.depth-b.width*b.depth||a.index-b.index)[0];
      const mx=keepMargin?cfg.margin:Math.min(cfg.margin,(cfg.bedWidth-seed.width)/2);
      const my=keepMargin?cfg.margin:Math.min(cfg.margin,(cfg.bedDepth-seed.depth)/2);
      const plate: PackingPlate<T>={id:plates.length+1,items:[],free:[{x:mx,y:my,width:cfg.bedWidth-2*mx,depth:cfg.bedDepth-2*my}]};
      plates.push(plate);best=search(plate);
    }
    if(!best)throw new DesignError('无法在最大打印范围内排放零件');
    const {plate,free,index,orientation,width,depth}=best;
    const edgeClearances={left:free.x,right:cfg.bedWidth-free.x-width,front:free.y,back:cfg.bedDepth-free.y-depth};
    const usesReservedMargin=Object.values(edgeClearances).some((gap)=>gap<cfg.margin-1e-6);
    plate.items.push({part,x:free.x,y:free.y,orientation,width,depth,edgeClearances,usesReservedMargin});
    plate.free.splice(index,1);
    const remainingW=free.width-width-spacing,remainingD=free.depth-depth-spacing;
    if(remainingW>1e-6)plate.free.push({x:free.x+width+spacing,y:free.y,width:remainingW,depth});
    if(remainingD>1e-6)plate.free.push({x:free.x,y:free.y+depth+spacing,width:free.width,depth:remainingD});
  }
  return plates.map(({free,...plate})=>plate);
}
export function design(input: unknown = {}, placements: unknown = []): DesignResult {
  const cfg = settings(input), grid = measureGrid(cfg);
  const cleanLayout = validatePlacements(placements, grid);
  const boxes = cleanLayout.map((rect) => {
    const box = makeBox(rect, cfg, grid);
    return { ...box, frame: Object.assign(box.frame, { print: printFit(box.frame, cfg) }),
      drawer: Object.assign(box.drawer, { print: printFit(box.drawer, cfg) }) };
  });
  const parts = boxes.flatMap<DesignedPart>((box) => [box.frame, box.drawer]);
  const plates=packPlates(parts.filter((part)=>partFits(part,cfg)),cfg);
  for(const plate of plates)for(const item of plate.items)item.part.print={...item.part.print,...item.orientation,edgeClearances:item.edgeClearances,usesReservedMargin:item.usesReservedMargin};
  const issues=parts.filter((part)=>!part.print.fits).map((part)=>({partId:part.id,boxId:part.boxId,violations:part.print.violations,message:fitMessage(part,cfg,part.print)}));
  const supportParts=parts.filter((part)=>part.print.fits&&part.print.needsSupport);
  const marginParts=parts.filter((part)=>part.print.fits&&part.print.usesReservedMargin);
  const warnings: DesignWarning[]=parts.flatMap((part)=>{
    const orientation=orientationWarning(part,cfg,part.print),margin=marginWarning(part,cfg,part.print);
    const messages=[orientation,margin].filter(Boolean);
    return messages.length?[{partId:part.id,boxId:part.boxId,severity:'warning',needsSupport:!!orientation,usesReservedMargin:!!margin,message:messages.join('\n')}]:[];
  });
  const volumeCache = new Map<string, number>();
  let volume = 0;
  for (const part of parts) {
    const key = `${part.type}:${part.width}:${part.depth}:${part.height}`;
    const partVolume = volumeCache.get(key) ?? meshVolume(partMesh(part));
    volumeCache.set(key, partVolume);
    volume += partVolume;
  }
  const occupied = boxes.reduce((sum, box) => sum + box.cols * box.rows, 0);
  return { cfg, grid, placements: cleanLayout, boxes, parts, plates, issues, warnings, supportParts, marginParts, occupied,
    coverage: occupied / (grid.cols * grid.rows) * 100, materialGrams: volume / 1000 * 1.24,
    printable: boxes.length > 0 && issues.length === 0 };
}
