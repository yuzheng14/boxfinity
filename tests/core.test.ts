import { test } from 'vitest';
import type { MeshData } from '../src/types.ts';
import { readZip, entry, readJSON, array, records } from './helpers/artifacts.ts';
import assert from 'node:assert/strict';
import { design, settings, recommendGrids, partFits } from '../src/core.ts';
import {
  rectangleBetween,
  placementError,
  addPlacement,
  fillEmpty,
  exampleLayout,
} from '../src/layout.ts';
import { partMesh, meshVolume } from '../src/geometry.ts';
import { modelXML, plate3MF, printBundle } from '../src/export.ts';
import { crc32 } from '../src/zip.ts';
const near = (a: number, b: number, tolerance = 1e-3) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} ≈ ${b}`);
const shapes = [
  { id: 1, col: 0, row: 0, cols: 1, rows: 1 },
  { id: 2, col: 1, row: 0, cols: 1, rows: 2 },
  { id: 3, col: 2, row: 0, cols: 2, rows: 1 },
  { id: 4, col: 4, row: 0, cols: 3, rows: 2 },
];
const sample = () => design({}, shapes);
function assertManifold(mesh: MeshData) {
  const edges = new Map<string, number[]>();
  for (const triangle of mesh.triangles) {
    const [a, b, c] = triangle.map((index) => mesh.vertices[index]);
    const ab = b.map((n, i) => n - a[i]),
      ac = c.map((n, i) => n - a[i]);
    const cross = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    assert.ok(Math.hypot(...cross) > 1e-8, 'non-degenerate triangles');
    for (let i = 0; i < 3; i++) {
      const x = triangle[i],
        y = triangle[(i + 1) % 3],
        key = [Math.min(x, y), Math.max(x, y)].join(':');
      const orientations = edges.get(key) || [];
      orientations.push(x < y ? 1 : -1);
      edges.set(key, orientations);
    }
  }
  for (const orientations of edges.values()) {
    assert.equal(orientations.length, 2, 'exactly two faces share an edge');
    assert.equal(
      orientations[0] + orientations[1],
      0,
      'adjacent faces have opposite edge directions',
    );
  }
  assert.ok(meshVolume(mesh) > 0, 'outward winding');
}
test('cabinet grid spans WIDTH and HEIGHT; depth is independent', () => {
  const r = design();
  near(r.grid.unitWidth * r.grid.cols + 2 * r.cfg.edge, r.cfg.width);
  near(r.grid.unitHeight * r.grid.rows + 2 * r.cfg.edge, r.cfg.height);
  const deeper = design({ depth: 190 });
  near(deeper.grid.unitWidth, r.grid.unitWidth);
  near(deeper.grid.unitHeight, r.grid.unitHeight);
  assert.equal(r.boxes.length, 0);
  assert.equal(r.printable, false);
});
test('recommendations offer distinct cell sizes with printable 1x1 drawers and frames', () => {
  const choices = recommendGrids();
  assert.equal(choices.length, 3);
  assert.equal(new Set(choices.map((c) => c.id)).size, 3);
  for (const choice of choices) {
    const r = design({ cols: choice.cols, rows: choice.rows }, [
      { id: 1, col: 0, row: 0, cols: 1, rows: 1 },
    ]);
    assert.ok(r.printable);
  }
  assert.deepEqual(
    recommendGrids({ depth: 170 }).map((c) => c.id),
    choices.map((c) => c.id),
  );
  assert.deepEqual(recommendGrids({ depth: 500 }), []);
});
test('1x1, 1x2, 2x1 and 3x2 produce genuinely different drawer and frame geometry', () => {
  const r = sample();
  assert.equal(r.boxes.length, 4);
  assert.equal(r.parts.length, 8);
  assert.equal(r.issues.length, 0);
  const [one, tall, wide, large] = r.boxes;
  near(tall.frame.width, one.frame.width);
  near(tall.frame.depth + r.cfg.jointGap, (one.frame.depth + r.cfg.jointGap) * 2);
  near(wide.frame.width + r.cfg.jointGap, (one.frame.width + r.cfg.jointGap) * 2);
  near(large.frame.width + r.cfg.jointGap, (one.frame.width + r.cfg.jointGap) * 3);
  near(large.frame.depth + r.cfg.jointGap, (one.frame.depth + r.cfg.jointGap) * 2);
});
test('drawer fits inside its own sleeve, with clearances on every side', () => {
  const r = sample();
  for (const box of r.boxes) {
    near(box.frame.width - box.drawer.width, 2 * (r.cfg.frameWall + r.cfg.fit));
    near(box.frame.depth - box.drawer.height, 2 * (r.cfg.frameWall + r.cfg.fit));
    near(box.frame.height - box.drawer.depth, r.cfg.fit);
    assert.ok(box.x >= r.cfg.edge);
    assert.ok(box.z >= r.cfg.edge);
    assert.ok(box.x + box.frame.width <= r.cfg.width - r.cfg.edge + 1e-4);
    assert.ok(box.z + box.frame.depth <= r.cfg.height - r.cfg.edge + 1e-4);
  }
});
test('reverse drag normalizes a rectangular front-view selection', () => {
  assert.deepEqual(rectangleBetween({ col: 4, row: 3 }, { col: 2, row: 2 }), {
    col: 2,
    row: 2,
    cols: 3,
    rows: 2,
  });
});
test('overlaps, bounds, fractional cells and duplicate IDs are rejected', () => {
  const grid = design().grid;
  const overlap = placementError({ col: 0, row: 0, cols: 2, rows: 1 }, shapes, grid);
  assert.ok(overlap);
  assert.match(overlap, /重叠/);
  assert.throws(() => design({}, [{ id: 1, col: 8, row: 0, cols: 2, rows: 1 }]), /网格/);
  assert.throws(() => design({}, [{ id: 1, col: 0.5, row: 0, cols: 1, rows: 1 }]), /网格/);
  assert.throws(() => design({}, [shapes[0], { ...shapes[1], id: 1 }]), /编号/);
  assert.throws(() => addPlacement(shapes, shapes[0], grid), /重叠/);
});
test('filling empty cells preserves hand-drawn larger boxes without overlap', () => {
  const initial = sample(),
    filled = fillEmpty(shapes, initial.grid),
    r = design({}, filled);
  assert.deepEqual(filled.slice(0, shapes.length), shapes);
  assert.equal(r.occupied, r.grid.cols * r.grid.rows);
  assert.equal(r.coverage, 100);
});
test('mixed-size plate packing includes every part once and reserves separation', () => {
  const r = design({}, fillEmpty(exampleLayout(design().grid), design().grid)),
    ids = [];
  for (const plate of r.plates)
    for (const a of plate.items) {
      ids.push(a.part.id);
      assert.ok(partFits(a.part, r.cfg));
      assert.ok(a.x >= r.cfg.margin && a.y >= r.cfg.margin);
      assert.ok(a.x + a.width <= r.cfg.bedWidth - r.cfg.margin + 1e-4);
      assert.ok(a.y + a.depth <= r.cfg.bedDepth - r.cfg.margin + 1e-4);
      for (const b of plate.items)
        if (a !== b)
          assert.ok(
            a.x + a.width + 4.999 <= b.x ||
              b.x + b.width + 4.999 <= a.x ||
              a.y + a.depth + 4.999 <= b.y ||
              b.y + b.depth + 4.999 <= a.y,
          );
    }
  assert.equal(ids.length, r.parts.length);
  assert.equal(new Set(ids).size, ids.length);
});
test('oversize hand-drawn shapes remain in layout and block complete export', () => {
  const r = design({}, [{ id: 1, col: 0, row: 0, cols: 9, rows: 6 }]);
  assert.equal(r.boxes.length, 1);
  assert.ok(r.issues.length);
  assert.equal(r.printable, false);
  assert.throws(() => printBundle(r), /打印范围/);
  assert.throws(() => printBundle(design()), /绘制/);
});
test('drawer and sleeve meshes are closed manifolds with correct print bounds', () => {
  for (const cfg of [
    {},
    { width: 420, height: 360, depth: 140, cols: 8, rows: 7, wall: 2, radius: 3 },
    { width: 120, height: 100, depth: 50, cols: 3, rows: 3 },
  ]) {
    const r = design(cfg, [{ id: 1, col: 0, row: 0, cols: 1, rows: 1 }]);
    for (const part of r.parts) {
      const mesh = partMesh(part);
      assertManifold(mesh);
      for (const [axis, dimension] of [
        [0, part.width],
        [1, part.depth],
        [2, part.height],
      ] as const) {
        near(Math.min(...mesh.vertices.map((v) => v[axis])), 0);
        near(Math.max(...mesh.vertices.map((v) => v[axis])), dimension);
      }
    }
  }
});
test('drawer has a physical U-shaped finger recess in the front wall', () => {
  const part = sample().boxes[0].drawer,
    mesh = partMesh(part);
  const recess = mesh.vertices.filter(
    ([x, y, z]) =>
      Math.abs(y) < 1e-6 &&
      Math.abs(x - part.width / 2) < 1e-4 &&
      z > part.base &&
      z < part.height - 3,
  );
  assert.ok(recess.length > 0);
});
test('open sleeve volume matches its four walls, without a back or roof overhang', () => {
  const part = sample().boxes[3].frame,
    expected =
      (part.width * part.depth - (part.width - 2 * part.wall) * (part.depth - 2 * part.wall)) *
      part.height;
  near(meshVolume(partMesh(part)), expected, 1e-4);
});
test('3MF contains the actual mixed drawer and frame meshes in millimetres', () => {
  const r = sample(),
    plate = r.plates[0],
    files = readZip(plate3MF(plate)),
    text = new TextDecoder().decode(entry(files, '3D/3dmodel.model'));
  assert.equal(files.size, 3);
  assert.match(text, /unit="millimeter"/);
  assert.match(text, /<vertex /);
  assert.match(text, /<triangle /);
  assert.equal((text.match(/<object /g) || []).length, plate.items.length);
  assert.equal((text.match(/<item /g) || []).length, plate.items.length);
  assert.match(
    new TextDecoder().decode(entry(files, '_rels/.rels')),
    /Target="\/3D\/3dmodel.model"/,
  );
});
test('rotated 3MF transform preserves print-space bounds', () => {
  const part = sample().parts[0],
    text = modelXML([{ part, x: 3, y: 4, rotated: true }]);
  const match = text.match(/transform="([^"]+)"/);
  assert.ok(match);
  const values = match[1].split(' ').map(Number);
  const points = partMesh(part).vertices.map(([x, y, z]) => [
    x * values[0] + y * values[3] + z * values[6] + values[9],
    x * values[1] + y * values[4] + z * values[7] + values[10],
  ]);
  near(Math.min(...points.map((p) => p[0])), 3);
  near(Math.max(...points.map((p) => p[0])), 3 + part.depth);
  near(Math.min(...points.map((p) => p[1])), 4);
  near(Math.max(...points.map((p) => p[1])), 4 + part.width);
});
test('print kit includes every drawer and frame and a versioned front-grid assembly map', () => {
  const r = sample(),
    files = readZip(printBundle(r)),
    manifest = readJSON(entry(files, 'assembly.json'));
  assert.equal(manifest.version, 2);
  assert.equal(records(manifest.boxes).length, 4);
  assert.equal(typeof manifest.gridAxes, 'string');
  assert.match(String(manifest.gridAxes), /cabinet height/);
  const plates = records(manifest.plates);
  assert.equal(plates.flatMap((plate) => array(plate.parts)).length, 8);
  for (const plate of plates) {
    assert.ok(typeof plate.file === 'string');
    readZip(entry(files, plate.file));
  }
});
test('invalid parameters fail before producing geometry', () => {
  for (const input of [null, [], true, 'bad']) assert.throws(() => settings(input), /对象/);
  for (const cfg of [
    { width: NaN },
    { height: Infinity },
    { cols: 1.5 },
    { rows: 25 },
    { radius: 2, wall: 3 },
    { width: 80, height: 80, cols: 24, rows: 24 },
  ])
    assert.throws(() => settings(cfg));
});
test('ZIP CRC32 agrees with the standard check vector', () =>
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926));
