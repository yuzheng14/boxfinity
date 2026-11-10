import { useEffect, useRef } from 'react';
import { Icon } from './Icons.jsx';

function Dialog({ id, open, onClose, title, titleId, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  useEffect(() => () => { if (ref.current?.open) ref.current.close(); }, []);
  return <dialog ref={ref} id={id} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClose={onClose} onClick={(event) => {
      if (event.target !== ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
    <div className="dialog-heading"><h2 id={titleId}>{title}</h2><button className="icon-button" aria-label="关闭" onClick={onClose}><Icon name="close" /></button></div>
    {children}
  </dialog>;
}
export function ExportDialog({ result, onClose, onPlate, onBundle }) {
  const notices = [];
  if (result?.supportParts.length) notices.push(`${result.supportParts.length} 个零件需换方向，可能需要支撑`);
  if (result?.marginParts.length) notices.push(`${result.marginParts.length} 个零件占用建议边距`);
  const note = notices.length ? `${notices.join('；')}。模型均在最大打印范围内，切片时检查支撑、裙边等额外占位。` : '已保持建议留边，优先盒子底面朝下、框套开口朝上。导入切片软件后选择实际打印机与耗材。';
  return <Dialog id="export-dialog" open={!!result} onClose={onClose} title="导出打印文件" titleId="export-title">
    {result && <>
      <p id="export-summary">{result.boxes.length} 只盒子 + {result.boxes.length} 个开放框套，共 {result.plates.length} 盘。</p>
      <div id="export-plates" className="export-plates">{result.plates.map((plate) => <div className="export-row" key={plate.id}>
        <div>打印盘 {String(plate.id).padStart(2, '0')}<small>{plate.items.map(({ part, orientation, usesReservedMargin }) => part.label + (orientation.needsSupport ? '（换方向，可能需支撑）' : '') + (usesReservedMargin ? '（留边提醒）' : '')).join('、')}</small></div>
        <button className="text-button" onClick={() => onPlate(plate)}>下载 3MF</button>
      </div>)}</div>
      <p id="export-orientation-note" className={`export-note${result.warnings.length ? ' pose-warning' : ''}`}>{note}</p>
      <button id="bundle-button" className="button primary bundle-button" onClick={() => onBundle(result)}><Icon name="download" />下载整套 ZIP</button>
    </>}
  </Dialog>;
}
export function HelpDialog({ open, onClose }) {
  return <Dialog id="help-dialog" open={open} onClose={onClose} title="柜内抽拉收纳" titleId="help-title">
    <ol className="help-steps">
      <li>填写柜内净宽、高、深和打印机范围。</li>
      <li>选择单元尺寸，生成柜子正面网格。更换网格会清空当前布局，可撤销。</li>
      <li>拖选矩形创建盒子。3×2 表示横跨 3 列、纵跨 2 行；空白格可以保留。</li>
      <li>切换 3D、正面和打印盘，选择盒子查看抽出效果。黄色表示换方向或留边提醒，可继续导出；红色表示超过打印机最大范围，任何轴向摆放都放不下。</li>
      <li>每只盒子配一个独立开放框套；导出包含两者的 3MF 和装配清单。</li>
    </ol>
    <p className="export-note">框套需要在柜内可靠固定。当前无导轨、抽出限位或框套连接件，承重和配合尚需试打验证。此版本只支持矩形组合。</p>
  </Dialog>;
}
