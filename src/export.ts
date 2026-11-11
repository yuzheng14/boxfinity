import type { Part, Plate, DesignResult, PrintPlacement, PrintOption } from './types.ts';
import { partMesh } from './geometry.ts';
import { zip } from './zip.ts';
import { display } from './core.ts';
import { printTransform, availablePrintVolume, preferredPrintVolume } from './printing.ts';

export const MAX_PROJECT_PLATES = 36;

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
const partLabel = ({ part, orientation, usesReservedMargin }: ModelItem) =>
  part.label +
  (orientation?.needsSupport ? '（侧放，检查支撑）' : '') +
  (usesReservedMargin ? '（占用建议边距）' : '');
export function modelXML(
  items: ModelItem[],
  title = 'Boxfinity',
  metadata: Record<string, string> = {},
) {
  const resources = items
    .map((item, index) => {
      const mesh = partMesh(item.part);
      return `<object id="${index + 1}" type="model" name="${xml(partLabel(item))}"><mesh><vertices>${mesh.vertices.map(([x, y, z]) => `<vertex x="${num(x)}" y="${num(y)}" z="${num(z)}"/>`).join('')}</vertices><triangles>${mesh.triangles.map(([a, b, c]) => `<triangle v1="${a}" v2="${b}" v3="${c}"/>`).join('')}</triangles></mesh></object>`;
    })
    .join('');
  const build = items
    .map(
      (item, index) =>
        `<item objectid="${index + 1}" transform="${printTransform(item.part, item).map(num).join(' ')}"/>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="zh-CN" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021"><metadata name="Title">${xml(title)}</metadata><metadata name="Application">${xml(metadata.Application ?? 'Boxfinity')}</metadata>${Object.entries(
    metadata,
  )
    .filter(([name]) => name !== 'Application')
    .map(([name, value]) => `<metadata name="${xml(name)}">${xml(value)}</metadata>`)
    .join('')}<resources>${resources}</resources><build>${build}</build></model>`;
}
function modelPackage(model: string, extra: { name: string; data: string }[] = []) {
  return zip([
    {
      name: '[Content_Types].xml',
      data: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="config" ContentType="application/xml"/><Default Extension="json" ContentType="application/json"/></Types>',
    },
    {
      name: '_rels/.rels',
      data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>',
    },
    { name: '3D/3dmodel.model', data: model },
    ...extra,
  ]);
}
export function plate3MF(plate: Plate) {
  return modelPackage(modelXML(plate.items, `Boxfinity · Plate ${plate.id}`));
}
function requirePrintable(result: DesignResult) {
  if (!result.printable)
    throw new Error(
      result.issues.length ? '方案包含超出打印范围的零件，请先调整布局' : '请先在网格中绘制盒子',
    );
}
function assemblyManifest(result: DesignResult) {
  return {
    generator: 'Boxfinity',
    version: 2,
    ...(result.plates.length <= MAX_PROJECT_PLATES ? { projectFile: 'boxfinity.3mf' } : {}),
    units: 'mm',
    gridAxes: 'columns = cabinet width, rows = cabinet height, row 0 = top',
    settings: result.cfg,
    grid: result.grid,
    boxes: result.boxes,
    availablePrintXYZ: availablePrintVolume(result.cfg),
    preferredPrintXYZ: preferredPrintVolume(result.cfg),
    plates: result.plates.map((plate) => ({
      id: plate.id,
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
}
// Bambu Studio / OrcaSlicer use a square plate grid with 20% spacing.
// Only project-space translations change; each plate keeps its preview coordinates.
// https://github.com/bambulab/BambuStudio/blob/master/src/slic3r/GUI/PartPlate.cpp
export function project3MF(result: DesignResult) {
  requirePrintable(result);
  if (result.plates.length > MAX_PROJECT_PLATES)
    throw new Error(`多盘项目最多支持 ${MAX_PROJECT_PLATES} 盘，请下载 ZIP 或单盘文件`);
  const columns = Math.ceil(Math.sqrt(result.plates.length));
  const items = result.plates.flatMap((plate, index) => {
    const x = (index % columns) * result.cfg.bedWidth * 1.2;
    const y = -Math.floor(index / columns) * result.cfg.bedDepth * 1.2;
    return plate.items.map((item) => ({ ...item, x: item.x + x, y: item.y + y }));
  });
  let objectId = 0;
  const plates = result.plates
    .map((plate, index) => {
      const instances = plate.items
        .map(() => {
          const id = ++objectId;
          return `<model_instance><metadata key="object_id" value="${id}"/><metadata key="instance_id" value="0"/><metadata key="identify_id" value="${id}"/></model_instance>`;
        })
        .join('');
      return `<plate><metadata key="plater_id" value="${index + 1}"/><metadata key="plater_name" value="打印盘 ${String(plate.id).padStart(2, '0')}"/><metadata key="locked" value="false"/>${instances}</plate>`;
    })
    .join('');
  const objects = items
    .map(
      (item, index) =>
        `<object id="${index + 1}"><metadata key="name" value="${xml(partLabel(item))}"/><part id="${index + 1}" subtype="normal_part"><metadata key="name" value="${xml(partLabel(item))}"/></part></object>`,
    )
    .join('');
  return modelPackage(
    // The importer only reads project dimensions when Application has this prefix.
    // The build metadata identifies the actual generator without pinning a printer preset.
    modelXML(items, 'Boxfinity · All plates', {
      Application: 'BambuStudio-02.00.00.00+Boxfinity',
      'BambuStudio:3mfVersion': '1',
      Designer: 'Boxfinity',
    }),
    [
      {
        name: 'Metadata/model_settings.config',
        data: `<?xml version="1.0" encoding="UTF-8"?><config>${objects}${plates}</config>`,
      },
      {
        name: 'Metadata/project_settings.config',
        data: JSON.stringify({
          printable_area: [
            '0x0',
            `${result.cfg.bedWidth}x0`,
            `${result.cfg.bedWidth}x${result.cfg.bedDepth}`,
            `0x${result.cfg.bedDepth}`,
          ],
          printable_height: String(result.cfg.bedHeight),
          // Required by the slicer's project loader; users select their actual presets before slicing.
          printer_settings_id: 'Boxfinity',
          print_settings_id: '',
          filament_settings_id: [''],
          nozzle_diameter: ['0.4'],
        }),
      },
      { name: 'Metadata/assembly.json', data: JSON.stringify(assemblyManifest(result), null, 2) },
    ],
  );
}
export function printBundle(result: DesignResult) {
  requirePrintable(result);
  const manifest = assemblyManifest(result);
  return zip([
    ...(result.plates.length <= MAX_PROJECT_PLATES
      ? [{ name: 'boxfinity.3mf', data: project3MF(result) }]
      : []),
    ...result.plates.map((plate) => ({
      name: `plate-${String(plate.id).padStart(2, '0')}.3mf`,
      data: plate3MF(plate),
    })),
    { name: 'assembly.json', data: JSON.stringify(manifest, null, 2) },
    {
      name: 'README.txt',
      data: `Boxfinity 柜内抽拉收纳\n\n柜内净尺寸（宽×高×深）：${result.cfg.width} × ${result.cfg.height} × ${result.cfg.depth} mm\n单元：${display(result.grid.unitWidth)} × ${display(result.grid.unitHeight)} mm\n${result.boxes.length} 只盒子 + ${result.boxes.length} 个开放框套\n\n${result.plates.length <= MAX_PROJECT_PLATES ? 'boxfinity.3mf 包含全部打印盘，可在 Bambu Studio / OrcaSlicer 中作为项目打开。项目使用通用 0.4 mm 喷嘴占位，切片前请选择实际打印机、喷嘴与耗材。' : `方案超过 ${MAX_PROJECT_PLATES} 盘，ZIP 仅包含单盘 3MF。`}其他切片软件可使用单盘 plate-XX.3mf；多盘归属并非所有切片软件都支持。\n每盘 3MF 已应用实际打印方向。优先盒子底面朝下、框套开口朝上；仅在原方向放不下时侧放。\n本方案有 ${result.supportParts.length} 个侧放零件，请在切片软件中逐个检查支撑。\n有 ${result.marginParts.length} 个零件占用建议边距；已保证网格在打印机最大范围内，实际留边见 assembly.json 的 edgeClearances。检查支撑、裙边等额外占位是否越界。不要将“尺寸可容纳”视为“无需支撑”。\n装配位置按 assembly.json，框套开口最终朝向柜门。\n网格以柜子正面为准，行从上往下，列从左往右，详见 assembly.json。\n抽拉配合间隙每侧 ${result.cfg.fit} mm；框套之间 ${result.cfg.jointGap} mm；柜边 ${result.cfg.edge} mm。\n模型尚无防倾倒连接、抽出限位或导轨，框套需要在柜内可靠固定。先试打一组确认尺寸与承重，再批量打印。\n整套 3MF 包含几何、排盘及打印范围，未配置实际机型、耗材或 G-code。导入切片软件后选择实际打印机和材料。\n`,
    },
  ]);
}
