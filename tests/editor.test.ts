import { test } from 'vitest';
import type { EditorState } from '../src/editor.ts';
import assert from 'node:assert/strict';
import { PRINTER_PRESETS, printerPreset } from '../src/printers.ts';
import { DEFAULTS, partFits } from '../src/core.ts';
import {
  applyDraft,
  createEditor,
  editorReducer,
  readSavedDocument,
  serializeDocument,
  settingsDraft,
} from '../src/editor.ts';

const place = (state: EditorState, rect = { col: 0, row: 0, cols: 3, rows: 2 }) =>
  editorReducer(state, { type: 'place', rect });

test('invalid input preserves the last valid document and its persisted layout until corrected', () => {
  const initial = place(createEditor()),
    saved = serializeDocument(initial.document);
  const values = { ...settingsDraft(initial.document.settings), width: '' };
  const invalid = editorReducer(initial, { type: 'apply-settings', values });
  assert.ok(invalid.error);
  assert.equal(invalid.error.field, 'width');
  assert.equal(invalid.draft.width, '');
  assert.equal(invalid.document, initial.document);
  assert.equal(invalid.result, initial.result);
  assert.equal(serializeDocument(invalid.document), saved);
  const corrected = editorReducer(invalid, {
    type: 'apply-settings',
    values: { ...values, width: '585' },
  });
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
  const applied = editorReducer(selected, {
    type: 'apply-settings',
    values: settingsDraft(selected.document.settings),
  });
  assert.equal(applied.past.length, initial.past.length);
  assert.equal(applied.document, initial.document);
  assert.equal(applied.result, initial.result);
});

test('existing version 2 drafts round-trip without changing part geometry or 3MF inputs', () => {
  const initial = place(
    createEditor({
      settings: {
        ...DEFAULTS,
        width: 585,
        height: 330,
        depth: 330,
        bedWidth: 330,
        bedDepth: 320,
        bedHeight: 325,
      },
      placements: [],
    }),
  );
  const restored = createEditor(readSavedDocument(JSON.parse(serializeDocument(initial.document))));
  assert.deepEqual(restored.document, initial.document);
  assert.deepEqual(restored.result.parts, initial.result.parts);
  assert.equal(restored.result.printable, true);
  assert.ok(restored.result.warnings.length > 0);
  assert.throws(
    () => readSavedDocument({ app: 'boxfinity', version: 1, settings: DEFAULTS, placements: [] }),
    /新版/,
  );
  assert.throws(() =>
    readSavedDocument({
      app: 'boxfinity',
      version: 2,
      settings: DEFAULTS,
      placements: [{ id: 1, col: 99, row: 0, cols: 1, rows: 1 }],
    }),
  );
});

test('grid changes are also applied before save/export, rather than exporting a stale layout', () => {
  const initial = place(createEditor());
  const result = applyDraft(initial.document, {
    ...settingsDraft(initial.document.settings),
    cols: '10',
  });
  assert.equal(result.cfg.cols, 10);
  assert.equal(result.placements.length, 0);
  assert.equal(result.printable, false);
  assert.throws(
    () => applyDraft(initial.document, { ...settingsDraft(initial.document.settings), width: '' }),
    /宽度/,
  );
});

test('overlapping placements and invalid imported documents leave the current design recoverable', () => {
  const initial = place(createEditor());
  const overlap = place(initial);
  assert.equal(overlap.document, initial.document);
  assert.equal(overlap.error, null);
  assert.ok(overlap.notice);
  assert.ok(overlap.notice.message);
  const reset = editorReducer(initial, { type: 'reset' });
  assert.equal(reset.document.placements.length, 0);
  assert.deepEqual(editorReducer(reset, { type: 'undo' }).document, initial.document);
  const loaded = editorReducer(reset, { type: 'load', document: initial.document });
  assert.deepEqual(loaded.document, initial.document);
  assert.equal(loaded.selected, null);
  assert.deepEqual(loaded.draft, settingsDraft(initial.document.settings));
});

const choosePrinter = (state: EditorState, id: string) =>
  editorReducer(state, { type: 'printer-preset', id });

test('printer presets update all axes together while preserving the cabinet, layout and margin', () => {
  const initial = place(createEditor({ settings: { ...DEFAULTS, margin: 3 }, placements: [] }));
  for (const preset of PRINTER_PRESETS) {
    const next = choosePrinter(initial, preset.id);
    assert.equal(next.error, null, preset.id);
    assert.deepEqual(next.document.settings, { ...initial.document.settings, ...preset.volume });
    assert.deepEqual(next.document.placements, initial.document.placements);
    assert.deepEqual(next.draft, settingsDraft(next.document.settings));
    assert.equal(next.document.printerPresetId, preset.id);
    assert.deepEqual(next.result.parts[0].print.available, [
      preset.volume.bedWidth,
      preset.volume.bedDepth,
      preset.volume.bedHeight,
    ]);
    assert.equal(next.past.length, initial.past.length + 1);
    assert.deepEqual(editorReducer(next, { type: 'undo' }).document, initial.document);
    assert.deepEqual(
      editorReducer(editorReducer(next, { type: 'undo' }), { type: 'redo' }).document,
      next.document,
    );
  }
});

test('printer identity survives equal-volume models, grid changes and version 2 persistence', () => {
  const initial = choosePrinter(createEditor(), 'bambu-a1');
  const next = choosePrinter(initial, 'bambu-p1s');
  assert.deepEqual(next.document.settings, initial.document.settings);
  assert.equal(next.document.printerPresetId, 'bambu-p1s');
  const restored = createEditor(readSavedDocument(JSON.parse(serializeDocument(next.document))));
  assert.deepEqual(restored.document, next.document);
  const grid = editorReducer(restored, { type: 'preset', cols: 11, rows: 8 });
  assert.equal(grid.document.printerPresetId, 'bambu-p1s');
  assert.equal(editorReducer(next, { type: 'undo' }).document.printerPresetId, 'bambu-a1');
});

test('editing an axis switches to custom and undo restores the selected printer', () => {
  const initial = choosePrinter(place(createEditor()), 'snapmaker-u1');
  const custom = editorReducer(initial, {
    type: 'apply-settings',
    values: { ...initial.draft, bedWidth: '271.5' },
  });
  assert.equal(custom.document.printerPresetId, undefined);
  assert.equal(custom.document.settings.bedWidth, 271.5);
  assert.deepEqual(custom.document.placements, initial.document.placements);
  assert.deepEqual(editorReducer(custom, { type: 'undo' }).document, initial.document);
  const explicit = choosePrinter(initial, '');
  assert.equal(explicit.document.printerPresetId, undefined);
  assert.deepEqual(explicit.document.settings, initial.document.settings);
});

test('choosing a printer repairs invalid printer inputs without committing unrelated invalid input', () => {
  const initial = place(createEditor());
  const invalidBed = editorReducer(initial, {
    type: 'apply-settings',
    values: { ...initial.draft, bedWidth: '' },
  });
  const repaired = choosePrinter(invalidBed, 'flashforge-ad5x');
  assert.equal(repaired.error, null);
  assert.equal(repaired.draft.bedWidth, '220');
  assert.equal(repaired.draft.bedHeight, '220');
  const invalidCabinet = editorReducer(initial, {
    type: 'apply-settings',
    values: { ...initial.draft, width: '' },
  });
  const rejected = choosePrinter(invalidCabinet, 'snapmaker-u1');
  assert.ok(rejected.error);
  assert.equal(rejected.error.field, 'width');
  assert.equal(rejected.document, initial.document);
  assert.equal(rejected.draft.width, '');
  assert.equal(choosePrinter(initial, 'unknown-printer'), initial);
});

test('old drafts keep their exact dimensions and stale preset metadata never overrides them', () => {
  const old = {
    app: 'boxfinity',
    version: 2,
    settings: {
      ...DEFAULTS,
      wall: 1.6,
      base: 1.6,
      frameWall: 2.4,
      bedWidth: 330,
      bedDepth: 320,
      bedHeight: 325,
    },
    placements: [],
  };
  for (const printerPresetId of [undefined, 'unknown', 'bambu-h2c-right', { id: 'snapmaker-u1' }]) {
    const restored = readSavedDocument({ ...old, printerPresetId });
    assert.deepEqual(restored.settings, old.settings);
    assert.equal(restored.printerPresetId, undefined);
  }
  assert.equal(new Set(PRINTER_PRESETS.map((preset) => preset.id)).size, PRINTER_PRESETS.length);
  const h2c = printerPreset('bambu-h2c-right');
  assert.ok(h2c);
  assert.deepEqual(h2c.volume, {
    bedWidth: 305,
    bedDepth: 320,
    bedHeight: 325,
  });
  const artisan = printerPreset('snapmaker-artisan-dual');
  assert.ok(artisan);
  assert.deepEqual(artisan.volume, {
    bedWidth: 350,
    bedDepth: 400,
    bedHeight: 400,
  });
});

test('X2D nozzle modes enforce fractional X and distinct Z limits while H3C uses its full volume', () => {
  const initial = createEditor();
  const main = choosePrinter(initial, 'bambu-x2d-main').document.settings;
  assert.equal(partFits({ width: 256, depth: 256, height: 260 }, main), true);
  for (const id of ['bambu-x2d-auxiliary', 'bambu-x2d-dual']) {
    const cfg = choosePrinter(initial, id).document.settings;
    assert.equal(partFits({ width: 235.5, depth: 256, height: 256 }, cfg), true);
    assert.equal(partFits({ width: 235.6, depth: 256, height: 256 }, cfg), false);
    assert.equal(partFits({ width: 235.5, depth: 256, height: 260 }, cfg), false);
  }
  const h3c = choosePrinter(initial, 'bambu-h3c').document.settings;
  assert.equal(partFits({ width: 330, depth: 320, height: 325 }, h3c), true);
  assert.equal(partFits({ width: 330.1, depth: 320, height: 325 }, h3c), false);
});

test('a stale toast timeout cannot dismiss a newer notice or alter design history', () => {
  const initial = place(createEditor()),
    saved = serializeDocument(initial.document);
  const first = editorReducer(initial, { type: 'notify', message: '方案已保存' });
  const selected = editorReducer(first, { type: 'select', id: null });
  assert.equal(selected.notice, first.notice);
  const second = editorReducer(selected, { type: 'notify', message: '文件已下载' });
  assert.ok(first.notice);
  assert.ok(second.notice);
  const stale = editorReducer(second, { type: 'dismiss-notice', notice: first.notice });
  assert.equal(stale, second);
  const dismissed = editorReducer(stale, { type: 'dismiss-notice', notice: second.notice });
  assert.equal(dismissed.notice, null);
  assert.equal(dismissed.document, initial.document);
  assert.equal(dismissed.result, initial.result);
  assert.equal(dismissed.past, initial.past);
  assert.equal(serializeDocument(dismissed.document), saved);
});
