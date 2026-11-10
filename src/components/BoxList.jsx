import { display } from '../core.mjs';
import { Icon } from './Icons.jsx';

export function DrawingControls({ brush, onBrush, disabled, run }) {
  return <section className="parameter-section drawing-section">
    <h2>绘制盒子 <span>横向 × 纵向</span></h2>
    <div className="brush-sizes" role="group" aria-label="点击绘制尺寸">{[[1, 1], [1, 2], [2, 1], [3, 2]].map(([cols, rows]) => {
      const active = cols === brush.cols && rows === brush.rows;
      return <button key={`${cols},${rows}`} data-brush={`${cols},${rows}`} className={active ? 'active' : ''} aria-pressed={active} onClick={() => onBrush({ cols, rows })}>{cols} × {rows}</button>;
    })}</div>
    <p className="field-note">拖选可画任意矩形；单击按所选尺寸放置。</p>
    <div className="layout-actions">{[['fill', '填满空格'], ['example', '示例布局'], ['clear', '清空']].map(([type, label]) => <button key={type} id={`${type}-button`} className="text-button" disabled={disabled} onClick={() => run({ type })}>{label}</button>)}</div>
  </section>;
}
function PrintDimensions({ part, type }) {
  const pose = part.print, direction = pose.needsSupport ? '侧放，可能需支撑' : type === 'frame' ? '开口朝上' : '底面朝下';
  return <dd id={`${type}-print-dimensions`} className="print-pose">打印 XYZ：{pose.dimensions.map((n) => display(n, 2)).join(' × ')} mm{'\n'}{direction}</dd>;
}
export function BoxList({ editor, run, onExport }) {
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
