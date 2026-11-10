import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../src/core.mjs';
import { applyDraft, createEditor, editorReducer, readSavedDocument, serializeDocument, settingsDraft } from '../src/editor.mjs';

const place = (state, rect = { col: 0, row: 0, cols: 3, rows: 2 }) => editorReducer(state, { type: 'place', rect });

test('invalid input preserves the last valid document and its persisted layout until corrected', () => {
  const initial = place(createEditor()), saved = serializeDocument(initial.document);
  const values = { ...settingsDraft(initial.document.settings), width: '' };
  const invalid = editorReducer(initial, { type: 'apply-settings', values });
  assert.equal(invalid.error.field, 'width');
  assert.equal(invalid.draft.width, '');
  assert.equal(invalid.document, initial.document);
  assert.equal(invalid.result, initial.result);
  assert.equal(serializeDocument(invalid.document), saved);
  const corrected = editorReducer(invalid, { type: 'apply-settings', values: { ...values, width: '585' } });
  assert.equal(corrected.error, null);
  assert.equal(corrected.document.settings.width, 585);
  assert.deepEqual(corrected.document.placements, initial.document.placements);
});

test('preset changes clear the grid, and undo/redo restore both settings and placements', () => {
  const initial = place(createEditor());
  const preset = editorReducer(initial, { type: 'preset', cols: 11, rows: 8 });
  assert.equal(preset.document.placements.length, 0);
  assert.equal(preset.document.settings.cols, 11);
  const undo = editorReducer(preset, { type: 'undo' });
  assert.deepEqual(undo.document, initial.document);
  assert.equal(undo.draft.cols, '9');
  assert.equal(undo.draft.rows, '6');
  const redo = editorReducer(undo, { type: 'redo' });
  assert.deepEqual(redo.document, preset.document);
  const branch = place(editorReducer(redo, { type: 'undo' }), { col: 4, row: 0, cols: 1, rows: 1 });
  assert.equal(branch.future.length, 0);
  assert.equal(initial.document.placements.length, 1);
});

test('selection and duplicate blur submissions do not create history entries', () => {
  const initial = place(createEditor());
  const selected = editorReducer(initial, { type: 'select', id: null });
  const applied = editorReducer(selected, { type: 'apply-settings', values: settingsDraft(selected.document.settings) });
  assert.equal(applied.past.length, initial.past.length);
  assert.equal(applied.document, initial.document);
  assert.equal(applied.result, initial.result);
});

test('existing version 2 drafts round-trip without changing part geometry or 3MF inputs', () => {
  const initial = place(createEditor({ settings: { ...DEFAULTS, width: 585, height: 330, depth: 330, bedWidth: 330, bedDepth: 320, bedHeight: 325 }, placements: [] }));
  const restored = createEditor(readSavedDocument(JSON.parse(serializeDocument(initial.document))));
  assert.deepEqual(restored.document, initial.document);
  assert.deepEqual(restored.result.parts, initial.result.parts);
  assert.equal(restored.result.printable, true);
  assert.ok(restored.result.warnings.length > 0);
  assert.throws(() => readSavedDocument({ app: 'boxfinity', version: 1, settings: DEFAULTS, placements: [] }), /新版/);
  assert.throws(() => readSavedDocument({ app: 'boxfinity', version: 2, settings: DEFAULTS, placements: [{ id: 1, col: 99, row: 0, cols: 1, rows: 1 }] }));
});

test('grid changes are also applied before save/export, rather than exporting a stale layout', () => {
  const initial = place(createEditor());
  const result = applyDraft(initial.document, { ...settingsDraft(initial.document.settings), cols: '10' });
  assert.equal(result.cfg.cols, 10);
  assert.equal(result.placements.length, 0);
  assert.equal(result.printable, false);
  assert.throws(() => applyDraft(initial.document, { ...settingsDraft(initial.document.settings), width: '' }), /宽度/);
});

test('overlapping placements and invalid imported documents leave the current design recoverable', () => {
  const initial = place(createEditor());
  const overlap = place(initial);
  assert.equal(overlap.document, initial.document);
  assert.equal(overlap.error, null);
  assert.ok(overlap.notice.message);
  const reset = editorReducer(initial, { type: 'reset' });
  assert.equal(reset.document.placements.length, 0);
  assert.deepEqual(editorReducer(reset, { type: 'undo' }).document, initial.document);
  const loaded = editorReducer(reset, { type: 'load', document: initial.document });
  assert.deepEqual(loaded.document, initial.document);
  assert.equal(loaded.selected, null);
  assert.deepEqual(loaded.draft, settingsDraft(initial.document.settings));
});
