import type { ChangeEvent } from 'react';
import type { DesignResult, GridShape, Plate } from './types.ts';
import type { View, Tool, Viewport } from './view-types.ts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { design } from './core.ts';
import { plate3MF, printBundle } from './export.ts';
import { readSavedDocument, serializeDocument, errorDetails } from './editor.ts';
import { download } from './download.ts';
import { useEditor } from './use-editor.ts';
import { Icons, Icon } from './components/Icons.tsx';
import { Parameters } from './components/Parameters.tsx';
import { DrawingControls, BoxList } from './components/BoxList.tsx';
import { PreviewWorkspace } from './components/PreviewWorkspace.tsx';
import { ExportDialog, HelpDialog } from './components/Dialogs.tsx';

export default function App() {
  const { editor, draft, changeField, applyNow, run } = useEditor();
  const sidebarRef = useRef<HTMLElement | null>(null), scrollRef = useRef<HTMLDivElement | null>(null), importRef = useRef<HTMLInputElement | null>(null), toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [brush, setBrush] = useState<GridShape>({ cols: 1, rows: 1 });
  const [viewport, setViewport] = useState<Viewport>({ view: '3d', tool: 'draw', pull: true, plateIndex: 0, plateMode: 'isometric' });
  const [resetRevision, setResetRevision] = useState(0);
  const [exportResult, setExportResult] = useState<DesignResult | null>(null), [helpOpen, setHelpOpen] = useState(false), [toast, setToast] = useState<string | null>(null);
  const updateViewport = useCallback((patch: Partial<Viewport>) => setViewport((previous) => ({ ...previous, ...patch })), []);
  const notify = useCallback((message: string) => {
    clearTimeout(toastTimer.current); setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => { if (editor.notice) notify(editor.notice.message); }, [editor.notice, notify]);
  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if ((target instanceof Element && (target.matches('input,textarea,select') || (target instanceof HTMLElement && target.isContentEditable))) || helpOpen || exportResult) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault(); run({ type: event.shiftKey ? 'redo' : 'undo' });
      } else if (['Delete', 'Backspace'].includes(event.key) && editor.selected !== null) {
        event.preventDefault(); run({ type: 'delete' });
      }
    };
    document.addEventListener('keydown', keyDown);
    return () => document.removeEventListener('keydown', keyDown);
  }, [run, editor.selected, helpOpen, exportResult]);

  function setView(view: View) {
    setViewport((previous) => ({ ...previous, view, tool: view === 'front' && previous.tool === 'orbit' ? 'draw' : previous.tool }));
  }
  function setTool(tool: Tool) {
    setViewport((previous) => ({ ...previous, tool, view: previous.view === 'plate' || (tool === 'orbit' && previous.view === 'front') ? '3d' : previous.view }));
  }
  function chooseBrush(next: GridShape) { setBrush(next); setTool('draw'); }
  function downloadPlate(plate: Plate | undefined) {
    if (!plate) return;
    download(plate3MF(plate), `boxfinity-cabinet-plate-${String(plate.id).padStart(2, '0')}.3mf`, 'model/3mf');
    notify(`第 ${plate.id} 盘 3MF 已下载`);
  }
  function openExport(selectedOnly = false) {
    const result = applyNow();
    if (!result) return;
    if (selectedOnly) {
      const rect = result.placements.find((item) => item.id === editor.selected);
      if (!rect) return;
      const selectedResult = design(result.cfg, [rect]);
      if (selectedResult.printable) setExportResult(selectedResult);
    } else if (result.printable) setExportResult(result);
  }
  function saveDesign() {
    const result = applyNow();
    if (!result) return;
    download(serializeDocument({ settings: result.cfg, placements: result.placements }), 'boxfinity-cabinet-design.json', 'application/json');
    notify('柜体方案已保存');
  }
  async function importDesign(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget, file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 1_000_000) throw new Error('方案文件超过 1 MB');
      run({ type: 'load', document: readSavedDocument(JSON.parse(await file.text())) });
    } catch (error) { notify(`导入失败：${errorDetails(error).message}`); }
    input.value = '';
  }
  return <>
    <Icons />
    <header className="app-header">
      <a href="./" className="brand" aria-label="Boxfinity 首页"><Icon name="box" /><span>boxfinity<span className="brand-dot">.</span></span></a>
      <span className="project-title">柜内抽拉收纳</span>
      <div className="header-actions">
        <button id="help-button" className="icon-button" aria-label="使用指南" onClick={() => setHelpOpen(true)}><Icon name="info" /></button>
        <button id="import-button" className="button subtle" onClick={() => importRef.current?.click()}>导入</button>
        <button id="save-button" className="button secondary" disabled={!!editor.error} onClick={saveDesign}>保存方案</button>
        <button id="export-button" className="button primary" disabled={!editor.result.printable || !!editor.error} onClick={() => openExport()}><Icon name="download" />导出 3MF</button>
      </div>
    </header>
    <main className="workspace">
      <aside ref={sidebarRef} className="sidebar" aria-label="设计参数">
        <div ref={scrollRef} className="sidebar-scroll">
          <Parameters editor={editor} draft={draft} changeField={changeField} applyNow={applyNow} run={run} sidebarRef={sidebarRef} scrollRef={scrollRef} />
          <DrawingControls brush={brush} onBrush={chooseBrush} disabled={!!editor.error} run={run} />
          <BoxList editor={editor} run={run} onExport={() => openExport(true)} />
        </div>
        <div className="sidebar-footer"><span>本地原型</span><button id="reset-button" className="text-button" onClick={() => { run({ type: 'reset' }); setResetRevision((value) => value + 1); }}>恢复默认</button></div>
      </aside>
      <PreviewWorkspace editor={editor} brush={brush} viewport={viewport} updateViewport={updateViewport} setView={setView} setTool={setTool} run={run} resetRevision={resetRevision}
        onDownload={(index) => { const result = applyNow(); if (result?.printable) downloadPlate(result.plates[index]); }} />
    </main>
    <input ref={importRef} id="import-file" type="file" accept=".json,application/json" hidden onChange={importDesign} />
    <ExportDialog result={exportResult} onClose={() => setExportResult(null)} onPlate={downloadPlate} onBundle={(result) => {
      download(printBundle(result), `boxfinity-cabinet-${result.cfg.width}x${result.cfg.height}.zip`, 'application/zip');
      notify('盒子、框套与装配清单已下载');
    }} />
    <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    <div id="toast" className="toast" role="status" hidden={!toast}>{toast}</div>
  </>;
}
