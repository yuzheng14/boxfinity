import { useMemo } from 'react';
import { display, recommendGrids } from '../core.mjs';
import { preferredPrintVolume } from '../printing.mjs';
import { MeasurementHelp } from './MeasurementHelp.jsx';
import { Icon } from './Icons.jsx';

const cabinetFields = [
  ['width', '宽度', 'W', 80, 3000], ['height', '高度', 'H', 80, 3000], ['depth', '深度', 'D', 40, 1000],
];
const printerFields = [['bedWidth', 'X', null, 50, 1500], ['bedDepth', 'Y', null, 50, 1500], ['bedHeight', 'Z', null, 50, 1500]];
const structureFields = [
  ['frameWall', '框套壁厚', 'mm', 1.2, 8], ['wall', '盒子壁厚', 'mm', .8, 5], ['base', '盒子底厚', 'mm', .8, 5],
  ['fit', '抽拉间隙 / 侧', 'mm', .2, 2], ['edge', '柜边间隙', 'mm', .5, 10],
  ['jointGap', '框套间隙', 'mm', .2, 2], ['radius', '盒子圆角', 'mm', 2, 12],
];
function NumberField({ field, draft, error, onChange, onApply }) {
  const [name, label, unit, min, max, step = .1] = field;
  return <label>{label}<div className="input-shell">
    <input name={name} type="number" min={min} max={max} step={step} value={draft[name]} required
      aria-invalid={error?.field === name || undefined}
      onChange={(event) => onChange(name, event.target.value)} onBlur={onApply} />
    {unit && <span>{unit}</span>}
  </div></label>;
}
export function Parameters({ editor, draft, changeField, applyNow, run, sidebarRef, scrollRef }) {
  const { result, error } = editor, { cfg, grid } = result;
  const candidates = useMemo(() => recommendGrids(cfg), [cfg]);
  const field = (entry) => <NumberField key={entry[0]} field={entry} draft={draft} error={error} onChange={changeField} onApply={applyNow} />;
  return <form id="settings-form" noValidate onSubmit={(event) => { event.preventDefault(); applyNow(); }}>
    <section className="parameter-section">
      <h2><MeasurementHelp sidebarRef={sidebarRef} scrollRef={scrollRef} /><span>mm</span></h2>
      <div className="fields three">{cabinetFields.map(field)}</div>
    </section>
    <section className="parameter-section">
      <h2>最大打印范围 <span>mm</span></h2>
      <div className="fields three">{printerFields.map(field)}</div>
      <details id="printer-extra" className={`printer-extra${cfg.margin > 0 ? ' has-margin' : ''}`}>
        <summary>额外边距<span id="margin-summary">{display(cfg.margin)} mm</span><Icon name="plus" /></summary>
        <div className="printer-margin"><label htmlFor="platform-margin">每侧 XY 留边</label><div className="input-shell">
          <input id="platform-margin" name="margin" type="number" min="0" max="20" step="0.1" value={draft.margin}
            aria-describedby="margin-description" aria-invalid={error?.field === 'margin' || undefined}
            onChange={(event) => changeField('margin', event.target.value)} onBlur={applyNow} /><span>mm</span>
        </div></div>
        <p id="margin-description" className="margin-description">0 表示使用完整可打印范围。需要给裙边、底边扩展等额外占位留空时，可增加每侧 X / Y 边距；模型尺寸和 Z 高度不变。<br />这是建议留边：零件占用时会提醒，仍可导出。</p>
        <p id="print-volume" className="print-volume" aria-live="polite" hidden={cfg.margin === 0}>留边目标 XYZ：{preferredPrintVolume(cfg).map((n) => display(n, 2)).join(' × ')} mm</p>
      </details>
    </section>
    <section className="parameter-section">
      <h2>选择单元</h2>
      <div className="fields two custom-grid">{[['cols', '网格列数', '列', 1, 24, 1], ['rows', '网格行数', '行', 1, 24, 1]].map(field)}</div>
      <div className="grid-presets"><span id="preset-label">预设</span><div id="grid-candidates" className="grid-candidates" role="group" aria-labelledby="preset-label">
        {candidates.map((option) => {
          const active = option.cols === cfg.cols && option.rows === cfg.rows;
          return <button key={option.id} type="button" className={`grid-option${active ? ' active' : ''}`} disabled={!!error} aria-pressed={active}
            aria-label={`${option.name}预设，${option.cols}列${option.rows}行`} title={`${option.cols} 列 × ${option.rows} 行`}
            onClick={() => run({ type: 'preset', cols: option.cols, rows: option.rows })}>{option.name}</button>;
        })}
      </div></div>
      <p id="no-candidates" className="field-note" hidden={candidates.length > 0}>暂无同时满足盒子与框套打印范围的预设，请调整尺寸或打印范围。</p>
      <div className="unit-dimensions"><div><span>单元格尺寸</span><small>宽 × 高 · mm</small></div><output id="cell-size" aria-label="当前单元格宽乘高，毫米" aria-live="polite">{error ? '—' : `${display(grid.unitWidth)} × ${display(grid.unitHeight)}`}</output></div>
    </section>
    <details className="parameter-section structure-settings">
      <summary>结构与间隙<Icon name="plus" /></summary>
      <div className="fields two">{structureFields.map(field)}</div>
    </details>
    <button className="sr-only" type="submit">更新参数</button>
  </form>;
}
