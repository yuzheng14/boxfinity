import type { SettingKey } from './types.ts';
import type { EditorAction, EditorNotice } from './editor.ts';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  createEditor,
  editorReducer,
  applyDraft,
  readSavedDocument,
  serializeDocument,
  STORAGE_KEY,
} from './editor.ts';

function initialEditor() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (saved) return createEditor(readSavedDocument(saved));
  } catch {
    /* Storage may be unavailable or contain an incompatible draft. */
  }
  return createEditor();
}
export function useEditor() {
  const [editor, dispatch] = useReducer(editorReducer, undefined, initialEditor);
  const draft = editor.draft;
  const notify = useCallback((message: string) => dispatch({ type: 'notify', message }), []);
  const dismissNotice = useCallback(
    (notice: EditorNotice) => dispatch({ type: 'dismiss-notice', notice }),
    [],
  );
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, serializeDocument(editor.document));
    } catch {
      /* Storage is optional. */
    }
  }, [editor.document]);
  useEffect(() => () => clearTimeout(pending.current), []);
  function changeField(name: SettingKey, value: string) {
    const next = { ...draft, [name]: value };
    dispatch({ type: 'edit-field', values: next });
    clearTimeout(pending.current);
    pending.current = setTimeout(() => dispatch({ type: 'apply-settings', values: next }), 250);
  }
  function applyNow() {
    clearTimeout(pending.current);
    try {
      const result = applyDraft(editor.document, draft);
      dispatch({ type: 'apply-settings', values: draft });
      return result;
    } catch (error) {
      dispatch({ type: 'invalid', error });
      return null;
    }
  }
  function run(action: EditorAction) {
    clearTimeout(pending.current);
    if (
      ['undo', 'redo', 'reset', 'load', 'select', 'printer-preset'].includes(action.type) ||
      applyNow()
    )
      dispatch(action);
  }
  return { editor, draft, changeField, applyNow, run, notify, dismissNotice };
}

export type EditorControls = ReturnType<typeof useEditor>;
