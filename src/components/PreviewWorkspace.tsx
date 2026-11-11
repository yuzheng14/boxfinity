import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { EditorState, RunEditorAction } from '../editor.ts';
import { errorDetails } from '../editor.ts';
import type { GridCell, GridShape } from '../types.ts';
import type { View, Tool, Viewport, UpdateViewport } from '../view-types.ts';
import { useEffect, useRef, useState } from 'react';
import { CabinetPreview } from '../renderer.ts';
import { rectangleBetween, placementError } from '../layout.ts';
import { display } from '../core.ts';
import { Icon } from './Icons.tsx';

interface PreviewWorkspaceProps {
  editor: EditorState; brush: GridShape; viewport: Viewport; updateViewport: UpdateViewport;
  setView: (view: View) => void; setTool: (tool: Tool) => void; run: RunEditorAction;
  onDownload: (index: number) => void; resetRevision: number;
}
interface Gesture { start: GridCell; end: GridCell; x: number; y: number; moved: boolean; existing: number | null }


export function PreviewWorkspace({ editor, brush, viewport, updateViewport, setView, setTool, run, onDownload, resetRevision }: PreviewWorkspaceProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null), overlayRef = useRef<SVGSVGElement | null>(null), stageRef = useRef<HTMLDivElement | null>(null), previewRef = useRef<CabinetPreview | null>(null), gestureRef = useRef<Gesture | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const { result, selected, error, past, future } = editor, { cfg, grid } = result;
  const plateIndex = Math.max(0, Math.min(viewport.plateIndex, result.plates.length - 1));
  const { view, tool, pull, plateMode } = viewport, isPlate = view === 'plate';
  const current = useRef({ editor, brush, viewport, updateViewport, run });
  current.current = { editor, brush, viewport, updateViewport, run };

  useEffect(() => {
    const canvas = canvasRef.current, overlay = overlayRef.current, stage = stageRef.current;
    if (!canvas || !overlay || !stage) return;
    let preview: CabinetPreview;
    try {
      preview = new CabinetPreview(canvas, overlay);
      previewRef.current = preview;
    } catch (failure) { setPreviewError(errorDetails(failure).message); return; }
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (!event.ctrlKey && (event.deltaX || event.deltaY)) {
        if (preview.view === 'front') {
          preview.setView('3d'); current.current.updateViewport({ view: '3d' });
        } else if (preview.view === 'plate' && preview.plateMode === 'top') {
          preview.setPlateView('isometric'); current.current.updateViewport({ plateMode: 'isometric' });
        }
      }
      preview.handleWheel(event);
    };
    // React wheel handlers are passive; own this one listener so page scrolling is suppressed.
    stage.addEventListener('wheel', wheel, { passive: false });
    return () => {
      stage.removeEventListener('wheel', wheel);
      gestureRef.current = null; previewRef.current = null;
      preview.dispose();
    };
  }, []);
  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    Object.assign(preview, { view, tool, pull, selected, plateIndex, plateMode });
    preview.update(result);
  }, [result, selected, view, tool, pull, plateIndex, plateMode]);
  useEffect(() => {
    if (!resetRevision) return;
    previewRef.current?.reset(); updateViewport({ plateMode: 'isometric' });
  }, [resetRevision]);
  useEffect(() => {
    if (isPlate && !result.printable) updateViewport({ view: '3d' });
  }, [isPlate, result.printable]);

  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const preview = previewRef.current;
    if (!preview || error || event.button !== 0 || (event.target instanceof Element && event.target.closest('button')) || isPlate || tool === 'orbit') return;
    const cell = preview.cellAt(event.clientX, event.clientY);
    if (!cell) return;
    const existing = editor.document.placements.find((box) => cell.col >= box.col && cell.col < box.col + box.cols && cell.row >= box.row && cell.row < box.row + box.rows);
    gestureRef.current = { start: cell, end: cell, x: event.clientX, y: event.clientY, moved: false, existing: existing?.id ?? null };
    if (!existing) {
      const rect = { ...cell, ...brush };
      preview.ghost = { ...rect, invalid: !!placementError(rect, editor.document.placements, result.grid) }; preview.renderOverlay();
    }
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.classList.add('dragging');
  }
  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current, preview = previewRef.current;
    if (!gesture || !preview) return;
    if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 5) gesture.moved = true;
    const end = preview.cellAt(event.clientX, event.clientY, true);
    if (!end) return;
    gesture.end = end;
    if (gesture.moved) {
      const rect = rectangleBetween(gesture.start, end);
      preview.ghost = { ...rect, invalid: !!placementError(rect, editor.document.placements, result.grid) }; preview.renderOverlay();
    }
  }
  function finishGesture(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current, preview = previewRef.current;
    if (!gesture || !preview) return;
    gestureRef.current = null; event.currentTarget.classList.remove('dragging'); preview.ghost = null;
    if (event.type !== 'pointercancel') {
      if (!gesture.moved && gesture.existing !== null) run({ type: 'select', id: gesture.existing });
      else run({ type: 'place', rect: gesture.moved ? rectangleBetween(gesture.start, gesture.end) : { ...gesture.start, ...brush } });
    }
    preview.renderOverlay();
  }
  function gridKeyDown(event: ReactKeyboardEvent<SVGSVGElement>) {
    if (event.key === 'Escape') { gestureRef.current = null; stageRef.current?.classList.remove('dragging'); if (previewRef.current) { previewRef.current.ghost = null; previewRef.current.renderOverlay(); } }
    if (error || !['Enter', ' '].includes(event.key)) return;
    const cell = event.target instanceof Element ? event.target.closest<SVGElement>('[data-col]') : null;
    if (!cell) return;
    event.preventDefault(); run({ type: 'place', rect: { col: Number(cell.dataset.col), row: Number(cell.dataset.row), ...brush } });
  }
  const plate = result.plates[plateIndex];
  const status = error ? '参数无效，请调整后继续' : result.issues.length ? `${result.issues.length} 个零件超出打印范围` : result.boxes.length ? `${result.parts.length} 个零件 · ${result.plates.length} 盘${result.warnings.length ? ` · ${result.warnings.length} 个零件有提醒` : ''}` : '拖选网格开始设计';
  const hint = isPlate || tool === 'orbit' ? '双指滑动旋转 · 捏合缩放' : '拖选绘制 · 双指旋转 · 捏合缩放 · Delete 删除';
  return <section className={`preview-workspace${isPlate ? ' is-plate' : ''}`} aria-label="柜体三维预览与网格编辑">
    <div className="viewport-toolbar">
      <div className="tool-group" role="group" aria-label="编辑工具" hidden={isPlate}>{([['draw', '绘制盒子', 'draw'], ['orbit', '旋转视角', 'orbit']] as const).map(([value, label, icon]) => <button key={value} className={`tool-button${tool === value ? ' active' : ''}`} data-tool={value} aria-pressed={tool === value} onClick={() => setTool(value)}><Icon name={icon} /><span>{label}</span></button>)}</div>
      <span className="toolbar-separator" hidden={isPlate} />
      <div className="history-tools" hidden={isPlate}>{([['undo', '撤销', past], ['redo', '重做', future]] as const).map(([type, label, history]) => <button key={type} id={`${type}-button`} className="icon-button" aria-label={label} title={label} disabled={!history.length} onClick={() => run({ type })}><Icon name={type} /></button>)}</div>
      <div className="view-group" role="group" aria-label="预览视图">{([['front', '正面', 'front'], ['3d', '3D', 'box'], ['plate', '打印盘', 'printer']] as const).map(([value, label, icon]) => <button key={value} className={`view-button${view === value ? ' active' : ''}`} data-view={value} aria-pressed={view === value} disabled={value === 'plate' && (!result.printable || !!error)} onClick={() => setView(value)}><Icon name={icon} />{label}</button>)}</div>
    </div>
    <div id="design-error" className="error-banner" role="alert" hidden={!error}>{error?.message}</div>
    <div ref={stageRef} id="stage" className={`stage ${tool}-tool${isPlate ? ' plate-view' : ''}`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={finishGesture} onPointerCancel={finishGesture}>
      <canvas ref={canvasRef} id="preview" aria-label={isPlate ? '打印盘立体模型，拖动旋转、双指旋转、捏合缩放' : '柜子三维模型，使用上方工具切换绘制或旋转'} />
      <svg ref={overlayRef} id="grid-overlay" className={`grid-overlay${isPlate ? ' plate-overlay' : ''}`} aria-label={isPlate ? '打印盘零件与尺寸' : '柜子正面网格'} onKeyDown={gridKeyDown} />
      <div className="viewport-caption"><span id="cabinet-caption">{isPlate ? `${display(cfg.bedWidth)} × ${display(cfg.bedDepth)} mm` : `${display(cfg.width)} × ${display(cfg.height)} × ${display(cfg.depth)} mm`}</span><span id="view-caption">{isPlate ? '与 3MF 导出方向一致' : '柜内 · 宽 × 高 × 深'}</span></div>
      <button id="pull-button" className="pull-button" aria-pressed={pull} disabled={selected === null} hidden={isPlate} onClick={() => updateViewport({ pull: !pull })}><Icon name="pull" />抽出选中盒子</button>
      <div id="plate-camera" className="plate-camera" role="group" aria-label="打印盘视角" hidden={!isPlate}>{([['isometric', '立体'], ['top', '俯视']] as const).map(([mode, label]) => <button key={mode} data-plate-view={mode} aria-pressed={plateMode === mode} onClick={() => updateViewport({ plateMode: mode })}>{label}</button>)}</div>
      <div id="empty-hint" className="empty-hint" hidden={result.boxes.length > 0 || isPlate}>在网格上拖选区域，创建第一只盒子</div>
      <div id="preview-error" className="preview-error" role="alert" hidden={!previewError}>{previewError}</div>
      <div className="viewport-controls">
        <button id="zoom-out" className="icon-button" aria-label="缩小" onClick={() => { const p = previewRef.current; if (p) p.setZoom(p.zoom / 1.15); }}><Icon name="minus" /></button>
        <button id="view-reset" className="icon-button" aria-label="重置视角" onClick={() => { previewRef.current?.reset(); updateViewport({ plateMode: 'isometric' }); }}><Icon name="reset" /></button>
        <button id="zoom-in" className="icon-button" aria-label="放大" onClick={() => { const p = previewRef.current; if (p) p.setZoom(p.zoom * 1.15); }}><Icon name="plus" /></button>
      </div>
      <span id="tool-hint" className="tool-hint">{hint}</span>
    </div>
    <div id="plate-navigation" className="plate-navigation" hidden={!isPlate}>
      <button id="previous-plate" className="text-button" aria-label="上一盘" disabled={plateIndex <= 0} onClick={() => updateViewport({ plateIndex: plateIndex - 1 })}>←</button>
      <span id="plate-counter">{plate ? `${plateIndex + 1} / ${result.plates.length} 盘 · ${plate.items.length} 个零件` : '尚无打印盘'}</span>
      <button id="next-plate" className="text-button" aria-label="下一盘" disabled={plateIndex >= result.plates.length - 1} onClick={() => updateViewport({ plateIndex: plateIndex + 1 })}>→</button>
      <button id="download-plate" className="text-button" disabled={!!error} onClick={() => onDownload(plateIndex)}>下载此盘 3MF</button>
    </div>
    <footer className="statusbar" aria-live="polite"><span id="grid-status">{grid.cols} 列 × {grid.rows} 行 · 单元 {display(grid.unitWidth)} × {display(grid.unitHeight)} mm</span><span id="layout-status">{result.boxes.length} 只盒子 · {display(result.coverage, 0)}% 已规划</span><span id="print-status" className={error || result.issues.length ? 'has-issues' : result.warnings.length ? 'has-warnings' : ''}>{status}</span></footer>
  </section>;
}
