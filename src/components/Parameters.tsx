import type { ReactNode, RefObject } from 'react';
import type { SettingKey } from '../types.ts';
import type { EditorError } from '../editor.ts';
import type { EditorControls } from '../use-editor.ts';
import { useMemo } from 'react';
import { display, recommendGrids } from '../core.ts';
import { preferredPrintVolume } from '../printing.ts';
import { PRINTER_BRANDS, printerPreset, matchesPrinterVolume } from '../printers.ts';
import { MeasurementHelp } from './MeasurementHelp.tsx';
import { StructureHelp } from './StructureHelp.tsx';
import type { StructureKey } from './StructureHelp.tsx';
import { Icon } from './Icons.tsx';

type Field<Key extends SettingKey = SettingKey> = readonly [
  Key,
  string,
  string | null,
  number,
  number,
  number?,
];
interface NumberFieldProps {
  help?: ReactNode;
  field: Field;
  draft: EditorControls['draft'];
  error: EditorError | null;
  onChange: EditorControls['changeField'];
  onApply: EditorControls['applyNow'];
}
interface ParametersProps extends Pick<
  EditorControls,
  'editor' | 'draft' | 'changeField' | 'applyNow' | 'run'
> {
  sidebarRef: RefObject<HTMLElement | null>;
  scrollRef: RefObject<HTMLDivElement | null>;
}
const gridFields: Field[] = [
  ['cols', '网格列数', '列', 1, 24, 1],
  ['rows', '网格行数', '行', 1, 24, 1],
];

const cabinetFields: Field[] = [
  ['width', '宽度', 'W', 80, 3000],
  ['height', '高度', 'H', 80, 3000],
  ['depth', '深度', 'D', 40, 1000],
];
const printerFields: Field[] = [
  ['bedWidth', 'X', null, 50, 1500],
  ['bedDepth', 'Y', null, 50, 1500],
  ['bedHeight', 'Z', null, 50, 1500],
];
const structureFields: Field<StructureKey>[] = [
  ['frameWall', '框套壁厚', 'mm', 1.2, 8],
  ['wall', '盒子壁厚', 'mm', 0.8, 5],
  ['base', '盒子底厚', 'mm', 0.8, 5],
  ['fit', '抽拉间隙 / 侧', 'mm', 0.2, 2],
  ['edge', '柜边间隙', 'mm', 0.5, 10],
  ['jointGap', '框套间隙', 'mm', 0.2, 2],
  ['radius', '盒子圆角', 'mm', 2, 12],
];
function NumberField({ field, help, draft, error, onChange, onApply }: NumberFieldProps) {
  const [name, label, unit, min, max, step = 0.1] = field;
  return (
    <div className="number-field">
      {help ?? <label htmlFor={`parameter-${name}`}>{label}</label>}
      <div className="input-shell">
        <input
          id={`parameter-${name}`}
          aria-label={label}
          name={name}
          type="number"
          min={min}
          max={max}
          step={step}
          value={draft[name]}
          required
          aria-invalid={error?.field === name || undefined}
          onChange={(event) => onChange(name, event.target.value)}
          onBlur={onApply}
        />
        {unit && <span>{unit}</span>}
      </div>
    </div>
  );
}
export function Parameters({
  editor,
  draft,
  changeField,
  applyNow,
  run,
  sidebarRef,
  scrollRef,
}: ParametersProps) {
  const { result, error } = editor,
    { cfg, grid } = result;
  const selectedPrinter = printerPreset(editor.document.printerPresetId);
  const printerId =
    selectedPrinter && matchesPrinterVolume(draft, selectedPrinter.volume)
      ? selectedPrinter.id
      : '';
  const candidates = useMemo(() => recommendGrids(cfg), [cfg]);
  const field = (entry: Field) => (
    <NumberField
      key={entry[0]}
      field={entry}
      draft={draft}
      error={error}
      onChange={changeField}
      onApply={applyNow}
    />
  );
  return (
    <form
      id="settings-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        applyNow();
      }}
    >
      <section className="parameter-section">
        <h2>
          <MeasurementHelp sidebarRef={sidebarRef} scrollRef={scrollRef} />
          <span>mm</span>
        </h2>
        <div className="fields three">{cabinetFields.map(field)}</div>
      </section>
      <section className="parameter-section">
        <h2>
          最大打印范围 <span>mm</span>
        </h2>
        <select
          className="printer-preset"
          aria-label="打印机预设"
          value={printerId}
          onChange={(event) => run({ type: 'printer-preset', id: event.target.value })}
        >
          <option value="">自定义尺寸</option>
          {PRINTER_BRANDS.map((brand) => (
            <optgroup key={brand.name} label={brand.name}>
              {brand.presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {brand.name.split(' ')[0]} {preset.model}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <div className="fields three">{printerFields.map(field)}</div>
        <details
          id="printer-extra"
          className={`printer-extra${cfg.margin > 0 ? ' has-margin' : ''}`}
        >
          <summary>
            额外边距<span id="margin-summary">{display(cfg.margin)} mm</span>
            <Icon name="plus" />
          </summary>
          <div className="printer-margin">
            <label htmlFor="platform-margin">每侧 XY 留边</label>
            <div className="input-shell">
              <input
                id="platform-margin"
                name="margin"
                type="number"
                min="0"
                max="20"
                step="0.1"
                value={draft.margin}
                aria-describedby="margin-description"
                aria-invalid={error?.field === 'margin' || undefined}
                onChange={(event) => changeField('margin', event.target.value)}
                onBlur={applyNow}
              />
              <span>mm</span>
            </div>
          </div>
          <p id="margin-description" className="margin-description">
            0 表示使用完整可打印范围。需要给裙边、底边扩展等额外占位留空时，可增加每侧 X / Y
            边距；模型尺寸和 Z 高度不变。
            <br />
            这是建议留边：零件占用时会提醒，仍可导出。
          </p>
          <p
            id="print-volume"
            className="print-volume"
            aria-live="polite"
            hidden={cfg.margin === 0}
          >
            留边目标 XYZ：
            {preferredPrintVolume(cfg)
              .map((n) => display(n, 2))
              .join(' × ')}{' '}
            mm
          </p>
        </details>
      </section>
      <section className="parameter-section">
        <h2>选择单元</h2>
        <div className="fields two custom-grid">{gridFields.map(field)}</div>
        <div className="unit-dimensions">
          <span>单元格尺寸</span>
          <output id="cell-size" aria-label="当前单元格宽乘高，毫米" aria-live="polite">
            {error ? (
              '—'
            ) : (
              <>
                {display(grid.unitWidth)} × {display(grid.unitHeight)}
                <span>mm</span>
              </>
            )}
          </output>
        </div>
        <div className="grid-presets" hidden={candidates.length === 0}>
          <span id="preset-label">预设</span>
          <div
            id="grid-candidates"
            className="grid-candidates"
            role="group"
            aria-labelledby="preset-label"
          >
            {candidates.map((option) => {
              const active = option.cols === cfg.cols && option.rows === cfg.rows;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`grid-option${active ? ' active' : ''}`}
                  disabled={!!error}
                  aria-pressed={active}
                  aria-label={`${option.name}预设，${option.cols}列${option.rows}行`}
                  title={`${option.cols} 列 × ${option.rows} 行`}
                  onClick={() => run({ type: 'preset', cols: option.cols, rows: option.rows })}
                >
                  {option.name}
                </button>
              );
            })}
          </div>
        </div>
        <p id="no-candidates" className="field-note" hidden={candidates.length > 0}>
          暂无适用预设，请调整尺寸或打印范围。
        </p>
      </section>
      <details className="parameter-section structure-settings">
        <summary>
          结构与间隙
          <Icon name="plus" />
        </summary>
        <div className="fields two">
          {structureFields.map((entry) => (
            <NumberField
              key={entry[0]}
              field={entry}
              draft={draft}
              error={error}
              onChange={changeField}
              onApply={applyNow}
              help={<StructureHelp name={entry[0]} sidebarRef={sidebarRef} scrollRef={scrollRef} />}
            />
          ))}
        </div>
      </details>
      <button className="sr-only" type="submit">
        更新参数
      </button>
    </form>
  );
}
