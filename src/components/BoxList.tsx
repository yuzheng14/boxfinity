import type { DesignedPart, Part } from '../types.ts';
import type { EditorState, RunEditorAction } from '../editor.ts';
import { display } from '../core.ts';
import { Icon } from './Icons.tsx';

function PrintDimensions({ part, type }: { part: DesignedPart; type: Part['type'] }) {
  const pose = part.print, direction = pose.needsSupport ? '侧放，可能需支撑' : type === 'frame' ? '开口朝上' : '底面朝下';
  return <dd id={`${type}-print-dimensions`} className="print-pose">打印 XYZ：{pose.dimensions.map((n) => display(n, 2)).join(' × ')} mm{'\n'}{direction}</dd>;
}
export function BoxList({ editor, run, onExport }: { editor: EditorState; run: RunEditorAction; onExport: () => void }) {
  const { result, selected, error } = editor;
  const box = result.boxes.find((item) => item.id === selected);
  const notices = box ? [...result.issues, ...result.warnings].filter((issue) => issue.boxId === selected) : [];
  return <section className="parameter-section box-section">
    <h2>盒子 <span id="box-count">{result.boxes.length}</span></h2>
    <div id="box-list" className="box-list">
      {!result.boxes.length && <p className="field-note">在右侧网格中拖选一个区域。</p>}
      {result.boxes.map((item) => {
        const warnings = result.warnings.filter((notice) => notice.boxId === item.id);
        const label = !item.printable ? '超出最大范围' : warnings.some((notice) => notice.needsSupport) ? '可换向打印' : warnings.length ? '留边提醒' : '盒子 + 框套';
        return <button key={item.id} className={`box-item${item.id === selected ? ' active' : ''}${item.printable ? '' : ' oversize'}${warnings.length ? ' has-warning' : ''}`}
          aria-label={`选择盒子 ${item.id}，${item.cols}乘${item.rows}`} aria-pressed={item.id === selected}
          title={[...result.issues, ...warnings].filter((notice) => notice.boxId === item.id).map((notice) => notice.message).join('；')}
          onClick={() => run({ type: 'select', id: item.id })}>
          <span className="box-index">{String(item.id).padStart(2, '0')}</span><span className="box-span">{item.cols} × {item.rows}</span><span className="box-state">{label}</span>
        </button>;
      })}
    </div>
    {box && <div id="selection-details" className="selection-details">
      <div className="selection-heading"><strong id="selection-title">盒子 {String(box.id).padStart(2, '0')} · {box.cols} × {box.rows}</strong><button id="delete-button" className="icon-button" aria-label="删除选中盒子" disabled={!!error} onClick={() => run({ type: 'delete' })}><Icon name="trash" /></button></div>
      <dl><div><dt>盒子 · 宽 × 高 × 深</dt><dd id="drawer-dimensions">{[box.drawer.width, box.drawer.height, box.drawer.depth].map((n) => display(n)).join(' × ')} mm</dd><PrintDimensions part={box.drawer} type="drawer" /></div>
        <div><dt>框套 · 宽 × 高 × 深</dt><dd id="frame-dimensions">{[box.frame.width, box.frame.depth, box.frame.height].map((n) => display(n)).join(' × ')} mm</dd><PrintDimensions part={box.frame} type="frame" /></div></dl>
      {!!notices.length && <div id="selection-warning" className="selection-warning" role="status">{notices.map((notice, index) => <p key={index} className={notice.severity === 'warning' ? 'pose-warning' : 'pose-error'}>{notice.message}</p>)}</div>}
      <button id="export-selection" className="button secondary" disabled={!box.printable || !!error} onClick={onExport}>导出这一组</button>
    </div>}
  </section>;
}
