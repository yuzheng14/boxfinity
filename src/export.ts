import type { Part, Plate, DesignResult, PrintPlacement, PrintOption } from './types.ts';
import { partMesh } from './geometry.ts';
import { zip } from './zip.ts';
import { display } from './core.ts';
import { printTransform, availablePrintVolume, preferredPrintVolume } from './printing.ts';

type ModelItem = PrintPlacement & {
  part: Part;
  orientation?: Pick<PrintOption, 'axes' | 'needsSupport'>;
  usesReservedMargin?: boolean;
};

const escapes: Record<string, string> = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;',
  "'": '&apos;',
};
const xml = (value: unknown) => String(value).replace(/[<>&"']/g, (c) => escapes[c]);
const num = (n: number) => Number(n.toFixed(6));
export function modelXML(items: ModelItem[], title = 'Boxfinity') {
  const resources = items
    .map(({ part, orientation, usesReservedMargin }, index) => {
      const mesh = partMesh(part);
      return `<object id="${index + 1}" type="model" name="${xml(part.label + (orientation?.needsSupport ? '（侧放，检查支撑）' : '') + (usesReservedMargin ? '（占用建议边距）' : ''))}"><mesh><vertices>${mesh.vertices.map(([x, y, z]) => `<vertex x="${num(x)}" y="${num(y)}" z="${num(z)}"/>`).join('')}</vertices><triangles>${mesh.triangles.map(([a, b, c]) => `<triangle v1="${a}" v2="${b}" v3="${c}"/>`).join('')}</triangles></mesh></object>`;
    })
    .join('');
  const build = items
    .map(
      (item, index) =>
        `<item objectid="${index + 1}" transform="${printTransform(item.part, item).map(num).join(' ')}"/>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="zh-CN" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Title">${xml(title)}</metadata><metadata name="Application">Boxfinity</metadata><resources>${resources}</resources><build>${build}</build></model>`;
}
export function plate3MF(plate: Plate) {
  return zip([
    {
      name: '[Content_Types].xml',
      data: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>',
    },
    {
      name: '_rels/.rels',
      data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>',
    },
    { name: '3D/3dmodel.model', data: modelXML(plate.items, `Boxfinity · Plate ${plate.id}`) },
  ]);
}
export function printBundle(result: DesignResult) {
  if (!result.printable)
    throw new Error(
      result.issues.length ? '方案包含超出打印范围的零件，请先调整布局' : '请先在网格中绘制盒子',
    );
  const manifest = {
    generator: 'Boxfinity',
    version: 2,
    units: 'mm',
    gridAxes: 'columns = cabinet width, rows = cabinet height, row 0 = top',
    settings: result.cfg,
    grid: result.grid,
    boxes: result.boxes,
    availablePrintXYZ: availablePrintVolume(result.cfg),
    preferredPrintXYZ: preferredPrintVolume(result.cfg),
    plates: result.plates.map((plate) => ({
      file: `plate-${String(plate.id).padStart(2, '0')}.3mf`,
      parts: plate.items.map(({ part }) => part.id),
      placements: plate.items.map((item) => ({
        partId: item.part.id,
        x: item.x,
        y: item.y,
        axes: item.orientation.axes,
        printXYZ: item.orientation.dimensions,
        checkSupports: item.orientation.needsSupport,
        checkClearance: item.usesReservedMargin,
        edgeClearances: item.edgeClearances,
      })),
    })),
  };
  return zip([
    ...result.plates.map((plate) => ({
      name: `plate-${String(plate.id).padStart(2, '0')}.3mf`,
      data: plate3MF(plate),
    })),
    { name: 'assembly.json', data: JSON.stringify(manifest, null, 2) },
    {
      name: 'README.txt',
      data: `Boxfinity 柜内抽拉收纳\n\n柜内净尺寸（宽×高×深）：${result.cfg.width} × ${result.cfg.height} × ${result.cfg.depth} mm\n单元：${display(result.grid.unitWidth)} × ${display(result.grid.unitHeight)} mm\n${result.boxes.length} 只盒子 + ${result.boxes.length} 个开放框套\n\n每盘 3MF 已应用实际打印方向。优先盒子底面朝下、框套开口朝上；仅在原方向放不下时侧放。\n本方案有 ${result.supportParts.length} 个侧放零件，请在切片软件中逐个检查支撑。\n有 ${result.marginParts.length} 个零件占用建议边距；已保证网格在打印机最大范围内，实际留边见 assembly.json 的 edgeClearances。检查支撑、裙边等额外占位是否越界。不要将“尺寸可容纳”视为“无需支撑”。\n装配位置按 assembly.json，框套开口最终朝向柜门。\n网格以柜子正面为准，行从上往下，列从左往右，详见 assembly.json。\n抽拉配合间隙每侧 ${result.cfg.fit} mm；框套之间 ${result.cfg.jointGap} mm；柜边 ${result.cfg.edge} mm。\n模型尚无防倾倒连接、抽出限位或导轨，框套需要在柜内可靠固定。先试打一组确认尺寸与承重，再批量打印。\n3MF 为通用几何模型，不含耗材配置或 G-code。导入切片软件后选择实际打印机和材料。\n`,
    },
  ]);
}
