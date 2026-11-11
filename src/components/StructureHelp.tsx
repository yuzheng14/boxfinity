import { HelpTooltip } from './HelpTooltip.tsx';
import type { HelpContext } from './HelpTooltip.tsx';
import { StructureDiagram } from './StructureDiagram.tsx';

const explanations = {
  frameWall: {
    title: '框套壁厚',
    description: '框套四面围壁的厚度。框套包在盒子外，前后贯通，供盒子抽拉。',
    effect: '加厚会缩小盒子的可用宽、高，框套外尺寸不变。',
  },
  wall: {
    title: '盒子壁厚',
    description: '盒子前后、左右四面侧壁的厚度，不包含盒底。',
    effect: '加厚会减少内部收纳空间，盒子外尺寸不变；圆角半径需至少比壁厚大 0.2 mm。',
  },
  base: {
    title: '盒子底厚',
    description: '从盒底下表面到内部底面的厚度。',
    effect: '加厚会减少内部可用高度，盒子外高度不变。',
  },
  fit: {
    title: '抽拉间隙 / 侧',
    description: '盒子外壁与框套内壁之间的单侧间隙，为抽拉留出余量。',
    effect: '宽、高各扣除 2 倍间隙，盒子深度另缩短 1 倍。增大后盒子更小、配合更松。',
  },
  edge: {
    title: '柜边间隙',
    description: '柜内可用空间边界与布局网格之间的预留量，宽、高、深两端各留一份。',
    effect: '设为 1.5 mm 时，参与布局的宽、高、深各减少 3 mm。外圈框套还会再退让半份框套间隙。',
  },
  jointGap: {
    title: '框套间隙',
    description: '相邻框套外壁之间的总缝宽，横向、纵向都适用。',
    effect: '每个框套在网格边界内各退让一半。加大后框套和盒子一起变小，网格尺寸不变。',
  },
  radius: {
    title: '盒子圆角',
    description: '盒子从上方看，四个外角的圆弧半径 R。',
    effect: '内圆角半径为 R − 壁厚；R 至少比壁厚大 0.2 mm。小盒子会按实际宽、深限制最大半径。',
  },
} as const;
export type StructureKey = keyof typeof explanations;

export function StructureHelp({ name, ...context }: HelpContext & { name: StructureKey }) {
  const { title, description, effect } = explanations[name];
  return <HelpTooltip id={`structure-help-${name}`} label={title} className="structure-help" {...context}>
    <strong>{title}</strong>
    <div className="help-description">{description}</div>
    <StructureDiagram name={name} />
    <p>{effect}</p>
  </HelpTooltip>;
}
