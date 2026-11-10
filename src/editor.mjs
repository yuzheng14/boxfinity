import { DEFAULTS, design, settings } from './core.mjs';
import { addPlacement, fillEmpty, exampleLayout } from './layout.mjs';

export const STORAGE_KEY = 'boxfinity.cabinet.v2';
export const settingsDraft = (cfg) => Object.fromEntries(Object.entries(cfg).map(([key, value]) => [key, String(value)]));
const documentOf = (result) => ({ settings: result.cfg, placements: result.placements });

export function readSavedDocument(value) {
  if (value?.app !== 'boxfinity' || value.version !== 2 || !value.settings || !Array.isArray(value.placements)) {
    throw new Error('请选择新版柜内收纳方案 JSON');
  }
  return documentOf(design(value.settings, value.placements));
}
export function serializeDocument(document) {
  return JSON.stringify({ app: 'boxfinity', version: 2, ...document }, null, 2);
}
export function applyDraft(document, values) {
  const cfg = settings(Object.fromEntries(Object.keys(DEFAULTS).map((key) => [key, values[key] === '' ? NaN : Number(values[key])])));
  const changedGrid = cfg.cols !== document.settings.cols || cfg.rows !== document.settings.rows;
  return design(cfg, changedGrid ? [] : document.placements);
}
export function createEditor(document = { settings: { ...DEFAULTS }, placements: [] }) {
  const result = design(document.settings, document.placements);
  return { document: documentOf(result), result, selected: null, past: [], future: [], error: null, notice: null, draft: settingsDraft(result.cfg) };
}
function commit(state, next, { selected = state.selected, syncForm = false, message } = {}) {
  const result = design(next.settings, next.placements), document = documentOf(result);
  const changed = JSON.stringify(document) !== JSON.stringify(state.document);
  return {
    ...state, document: changed ? document : state.document, result: changed ? result : state.result,
    selected: result.boxes.some((box) => box.id === selected) ? selected : null,
    past: changed ? [...state.past.slice(-49), state.document] : state.past,
    future: changed ? [] : state.future, error: null,
    notice: message ? { message } : null, draft: syncForm ? settingsDraft(document.settings) : state.draft,
  };
}
export function editorReducer(state, action) {
  if (action.type === 'edit-field') return { ...state, draft: action.values };
  if (action.type === 'apply-settings') state = { ...state, draft: action.values };
  try {
    if (action.type === 'invalid') return { ...state, error: { message: action.error.message, field: action.error.field }, notice: null };
    if (action.type === 'select') return { ...state, selected: action.id, notice: null };
    if (action.type === 'undo' || action.type === 'redo') {
      const backwards = action.type === 'undo', source = backwards ? state.past : state.future;
      if (!source.length) return state;
      const document = source.at(-1), result = design(document.settings, document.placements);
      return {
        ...state, document, result, error: null, notice: null,
        selected: result.boxes.some((box) => box.id === state.selected) ? state.selected : null,
        past: backwards ? source.slice(0, -1) : [...state.past, state.document],
        future: backwards ? [...state.future, state.document] : source.slice(0, -1),
        draft: settingsDraft(document.settings),
      };
    }
    if (action.type === 'apply-settings') {
      const result = applyDraft(state.document, action.values);
      const changedGrid = result.cfg.cols !== state.document.settings.cols || result.cfg.rows !== state.document.settings.rows;
      return commit(state, documentOf(result), { message: changedGrid ? '网格已更换，原布局可撤销恢复' : null });
    }
    if (action.type === 'load') return commit(state, action.document, { selected: null, syncForm: true, message: '柜体方案已导入' });
    if (action.type === 'reset') return commit(state, { settings: { ...DEFAULTS }, placements: [] }, { selected: null, syncForm: true, message: '已恢复默认，原方案可撤销' });
    if (state.error) return state;
    if (action.type === 'preset') {
      if (state.document.settings.cols === action.cols && state.document.settings.rows === action.rows) return state;
      return commit(state, { settings: { ...state.document.settings, cols: action.cols, rows: action.rows }, placements: [] }, { syncForm: true, message: '已应用预设行列，可在网格中绘制盒子；原布局可撤销' });
    }
    if (action.type === 'place') {
      const placements = addPlacement(state.document.placements, action.rect, state.result.grid), selected = placements.at(-1).id;
      const next = commit(state, { ...state.document, placements }, { selected });
      if (!next.result.printable) next.notice = { message: '盒子已添加，红色零件超出打印范围，可缩小选区或调整打印范围' };
      return next;
    }
    if (action.type === 'delete') return commit(state, { ...state.document, placements: state.document.placements.filter((box) => box.id !== state.selected) }, { selected: null });
    if (action.type === 'clear') return commit(state, { ...state.document, placements: [] }, { message: '布局已清空，可撤销恢复' });
    if (action.type === 'fill') return commit(state, { ...state.document, placements: fillEmpty(state.document.placements, state.result.grid) });
    if (action.type === 'example') {
      const placements = exampleLayout(state.result.grid);
      return commit(state, { ...state.document, placements }, { selected: placements[0]?.id ?? null, message: '示例已载入，可继续绘制；原布局可撤销' });
    }
    return state;
  } catch (error) {
    // Invalid placements are transient; invalid parameters remain visible until corrected.
    return action.type === 'place'
      ? { ...state, notice: { message: error.message } }
      : { ...state, error: { message: error.message, field: error.field }, notice: null };
  }
}
