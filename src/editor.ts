import type {
  Settings,
  SettingKey,
  SettingsDraft,
  DesignResult,
  DesignDocument,
  GridRectangle,
} from './types.ts';
import { DEFAULTS, design, settings, DesignError } from './core.ts';
import { addPlacement, fillEmpty, exampleLayout } from './layout.ts';
import { printerPreset, matchesPrinterVolume } from './printers.ts';

export interface EditorError {
  message: string;
  field?: SettingKey;
}
export interface EditorNotice {
  message: string;
}
export interface EditorState {
  document: DesignDocument;
  result: DesignResult;
  selected: number | null;
  past: DesignDocument[];
  future: DesignDocument[];
  error: EditorError | null;
  notice: EditorNotice | null;
  draft: SettingsDraft;
}
export type EditorAction =
  | { type: 'edit-field' | 'apply-settings'; values: SettingsDraft }
  | { type: 'invalid'; error: unknown }
  | { type: 'notify'; message: string }
  | { type: 'dismiss-notice'; notice: EditorNotice }
  | { type: 'select'; id: number | null }
  | { type: 'undo' | 'redo' | 'reset' | 'delete' | 'clear' | 'fill' | 'example' }
  | { type: 'load'; document: DesignDocument }
  | { type: 'preset'; cols: number; rows: number }
  | { type: 'printer-preset'; id: string }
  | { type: 'place'; rect: GridRectangle };
export type RunEditorAction = (action: EditorAction) => void;
export function errorDetails(error: unknown): EditorError {
  return {
    message: error instanceof Error ? error.message : String(error),
    field: error instanceof DesignError ? error.field : undefined,
  };
}

export const STORAGE_KEY = 'boxfinity.cabinet.v2';
export const settingsDraft = (cfg: Settings): SettingsDraft =>
  Object.fromEntries(
    Object.entries(cfg).map(([key, value]) => [key, String(value)]),
  ) as SettingsDraft;
export function documentFromResult(
  result: DesignResult,
  printerPresetId?: unknown,
): DesignDocument {
  const preset = printerPreset(printerPresetId);
  return {
    settings: result.cfg,
    placements: result.placements,
    ...(preset && matchesPrinterVolume(result.cfg, preset.volume)
      ? { printerPresetId: preset.id }
      : {}),
  };
}

export function readSavedDocument(value: unknown) {
  if (
    !value ||
    typeof value !== 'object' ||
    !('app' in value) ||
    value.app !== 'boxfinity' ||
    !('version' in value) ||
    value.version !== 2 ||
    !('settings' in value) ||
    !value.settings ||
    !('placements' in value) ||
    !Array.isArray(value.placements)
  ) {
    throw new Error('请选择新版柜内收纳方案 JSON');
  }
  return documentFromResult(
    design(value.settings, value.placements),
    'printerPresetId' in value ? value.printerPresetId : undefined,
  );
}
export function serializeDocument(document: DesignDocument) {
  return JSON.stringify({ app: 'boxfinity', version: 2, ...document }, null, 2);
}
export function applyDraft(document: DesignDocument, values: SettingsDraft) {
  const cfg = settings(
    Object.fromEntries(
      (Object.keys(DEFAULTS) as SettingKey[]).map((key) => [
        key,
        values[key] === '' ? NaN : Number(values[key]),
      ]),
    ),
  );
  const changedGrid = cfg.cols !== document.settings.cols || cfg.rows !== document.settings.rows;
  return design(cfg, changedGrid ? [] : document.placements);
}
export function createEditor(
  document: DesignDocument = { settings: { ...DEFAULTS }, placements: [] },
): EditorState {
  const result = design(document.settings, document.placements);
  return {
    document: documentFromResult(result, document.printerPresetId),
    result,
    selected: null,
    past: [],
    future: [],
    error: null,
    notice: null,
    draft: settingsDraft(result.cfg),
  };
}
function commit(
  state: EditorState,
  next: DesignDocument,
  {
    selected = state.selected,
    syncForm = false,
    message,
  }: { selected?: number | null; syncForm?: boolean; message?: string | null } = {},
): EditorState {
  const result = design(next.settings, next.placements),
    document = documentFromResult(result, next.printerPresetId);
  const changed = JSON.stringify(document) !== JSON.stringify(state.document);
  return {
    ...state,
    document: changed ? document : state.document,
    result: changed ? result : state.result,
    selected: result.boxes.some((box) => box.id === selected) ? selected : null,
    past: changed ? [...state.past.slice(-49), state.document] : state.past,
    future: changed ? [] : state.future,
    error: null,
    notice: message ? { message } : state.notice,
    draft: syncForm ? settingsDraft(document.settings) : state.draft,
  };
}
export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  if (action.type === 'notify') return { ...state, notice: { message: action.message } };
  if (action.type === 'dismiss-notice')
    return state.notice === action.notice ? { ...state, notice: null } : state;
  if (action.type === 'edit-field') return { ...state, draft: action.values };
  if (action.type === 'apply-settings') state = { ...state, draft: action.values };
  try {
    if (action.type === 'invalid')
      return { ...state, error: errorDetails(action.error), notice: state.notice };
    if (action.type === 'select') return { ...state, selected: action.id };
    if (action.type === 'undo' || action.type === 'redo') {
      const backwards = action.type === 'undo',
        source = backwards ? state.past : state.future;
      if (!source.length) return state;
      const document = source[source.length - 1],
        result = design(document.settings, document.placements);
      return {
        ...state,
        document,
        result,
        error: null,
        selected: result.boxes.some((box) => box.id === state.selected) ? state.selected : null,
        past: backwards ? source.slice(0, -1) : [...state.past, state.document],
        future: backwards ? [...state.future, state.document] : source.slice(0, -1),
        draft: settingsDraft(document.settings),
      };
    }
    if (action.type === 'apply-settings') {
      const result = applyDraft(state.document, action.values);
      const changedGrid =
        result.cfg.cols !== state.document.settings.cols ||
        result.cfg.rows !== state.document.settings.rows;
      return commit(state, documentFromResult(result, state.document.printerPresetId), {
        message: changedGrid ? '网格已更换，原布局可撤销恢复' : null,
      });
    }
    if (action.type === 'load')
      return commit(state, action.document, {
        selected: null,
        syncForm: true,
        message: '柜体方案已导入',
      });
    if (action.type === 'reset')
      return commit(
        state,
        { settings: { ...DEFAULTS }, placements: [] },
        { selected: null, syncForm: true, message: '已恢复默认，原方案可撤销' },
      );
    if (action.type === 'printer-preset') {
      const preset = printerPreset(action.id);
      if (action.id && !preset) return state;
      // Patch all printer axes before validation so a preset can repair invalid XYZ.
      const values = preset
        ? {
            ...state.draft,
            ...Object.fromEntries(
              Object.entries(preset.volume).map(([key, value]) => [key, String(value)]),
            ),
          }
        : state.draft;
      const result = applyDraft(state.document, values);
      const changedGrid =
        result.cfg.cols !== state.document.settings.cols ||
        result.cfg.rows !== state.document.settings.rows;
      return commit(state, documentFromResult(result, preset?.id), {
        syncForm: true,
        message: changedGrid ? '网格已更换，原布局可撤销恢复' : null,
      });
    }
    if (state.error) return state;
    if (action.type === 'preset') {
      if (
        state.document.settings.cols === action.cols &&
        state.document.settings.rows === action.rows
      )
        return state;
      return commit(
        state,
        {
          ...state.document,
          settings: { ...state.document.settings, cols: action.cols, rows: action.rows },
          placements: [],
        },
        { syncForm: true, message: '已应用预设行列，可在网格中绘制盒子；原布局可撤销' },
      );
    }
    if (action.type === 'place') {
      const placements = addPlacement(state.document.placements, action.rect, state.result.grid),
        selected = placements[placements.length - 1].id;
      const next = commit(state, { ...state.document, placements }, { selected });
      if (!next.result.printable)
        next.notice = { message: '盒子已添加，红色零件超出打印范围，可缩小选区或调整打印范围' };
      return next;
    }
    if (action.type === 'delete')
      return commit(
        state,
        {
          ...state.document,
          placements: state.document.placements.filter((box) => box.id !== state.selected),
        },
        { selected: null },
      );
    if (action.type === 'clear')
      return commit(
        state,
        { ...state.document, placements: [] },
        { message: '布局已清空，可撤销恢复' },
      );
    if (action.type === 'fill')
      return commit(state, {
        ...state.document,
        placements: fillEmpty(state.document.placements, state.result.grid),
      });
    if (action.type === 'example') {
      const placements = exampleLayout(state.result.grid);
      return commit(
        state,
        { ...state.document, placements },
        { selected: placements[0]?.id ?? null, message: '示例已载入，可继续绘制；原布局可撤销' },
      );
    }
    return state;
  } catch (error) {
    // Invalid placements are transient; invalid parameters remain visible until corrected.
    return action.type === 'place'
      ? { ...state, notice: { message: errorDetails(error).message } }
      : { ...state, error: errorDetails(error), notice: state.notice };
  }
}
