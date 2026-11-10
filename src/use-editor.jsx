import { useEffect, useReducer, useRef } from 'react';
import { createEditor, editorReducer, applyDraft, readSavedDocument, serializeDocument, STORAGE_KEY } from './editor.mjs';

function initialEditor() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) return createEditor(readSavedDocument(saved));
  } catch { /* Storage may be unavailable or contain an incompatible draft. */ }
  return createEditor();
}
export function useEditor() {
  const [editor, dispatch] = useReducer(editorReducer, undefined, initialEditor);
  const draft = editor.draft;
  const pending = useRef();
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, serializeDocument(editor.document)); } catch { /* Storage is optional. */ }
  }, [editor.document]);
  useEffect(() => () => clearTimeout(pending.current), []);
  function changeField(name, value) {
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
  function run(action) {
    clearTimeout(pending.current);
    if (['undo', 'redo', 'reset', 'load', 'select'].includes(action.type) || applyNow()) dispatch(action);
  }
  return { editor, draft, changeField, applyNow, run };
}
