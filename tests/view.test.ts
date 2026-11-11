import { test } from 'vitest';
import type { PreviewCamera } from '../src/view-types.ts';
import type { Vec3, PlateItem } from '../src/types.ts';
import assert from 'node:assert/strict';
import { Box3, Vector3, PerspectiveCamera, OrthographicCamera } from 'three';
import {
  fitViewCamera,
  updateCameraClipping,
  projectPoint,
  gridCellAt,
  boxCorners,
} from '../src/view-camera.ts';
import { platePartGeometry } from '../src/view-geometry.ts';
import { design } from '../src/core.ts';
import { printOptions } from '../src/printing.ts';
import { modelXML } from '../src/export.ts';
const viewport = { width: 1200, height: 760 };
const bounds = new Box3(new Vector3(0, 0, 0), new Vector3(585, 330, 330));
const direction = new Vector3(0.55, -1, 0.48);
function perspective(
  box = bounds,
  width = viewport.width,
  height = viewport.height,
  eye = direction,
) {
  const camera = new PerspectiveCamera(36);
  camera.up.set(0, 0, 1);
  fitViewCamera(camera, box, width, height, { direction: eye });
  return camera;
}
const length = (camera: PreviewCamera, a: Vec3, b: Vec3) => {
  const p = projectPoint(camera, a, viewport.width, viewport.height),
    q = projectPoint(camera, b, viewport.width, viewport.height);
  return Math.hypot(q[0] - p[0], q[1] - p[1]);
};
test('cabinet perspective makes the front edge larger than the equal rear edge', () => {
  const camera = perspective();
  assert.ok(
    length(camera, [0, 0, 330], [585, 0, 330]) >
      length(camera, [0, 330, 330], [585, 330, 330]) * 1.1,
  );
});
test('camera framing keeps deep, tall, pulled-out and narrow-viewport designs inside the frustum', () => {
  for (const [min, max, width, height] of [
    [[0, 0, 0], [585, 330, 330], 1200, 760],
    [[0, -180, 0], [585, 330, 330], 450, 680],
    [[0, 0, 0], [160, 800, 600], 1100, 600],
    [[0, 0, 0], [1500, 80, 120], 1200, 500],
  ] satisfies [Vec3, Vec3, number, number][]) {
    const box = new Box3(new Vector3(...min), new Vector3(...max)),
      camera = perspective(box, width, height);
    for (const corner of boxCorners(box)) {
      const p = corner.project(camera);
      assert.ok(
        Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && p.z > -1 && p.z < 1,
        `corner must remain visible: ${p.toArray()}`,
      );
    }
  }
});
test('orbiting and zooming preserve enough depth precision to distinguish thin walls', () => {
  for (const max of [
    [585, 325, 330],
    [3000, 1000, 3000],
    [80, 40, 80],
  ] satisfies Vec3[]) {
    const box = new Box3(new Vector3(0, -max[1] / 2, -4), new Vector3(...max));
    const camera = perspective(box);
    const center = box.getCenter(new Vector3()),
      distance = camera.position.distanceTo(center);
    for (const zoom of [0.35, 0.5, 0.7, 1])
      for (const eye of [new Vector3(-1.2, -0.4, 0.3), direction, new Vector3(0, -1, 0.1)]) {
        camera.position.copy(center).addScaledVector(eye.clone().normalize(), distance / zoom);
        camera.lookAt(center);
        const position = camera.position.clone(),
          rotation = camera.quaternion.clone();
        updateCameraClipping(camera, box);
        assert.ok(camera.position.equals(position));
        assert.ok(camera.quaternion.equals(rotation));
        for (const corner of boxCorners(box)) {
          const depth = -corner.clone().applyMatrix4(camera.matrixWorldInverse).z;
          assert.ok(depth > camera.near && depth < camera.far, 'model must not be depth-clipped');
          // One step in a 24-bit perspective depth buffer, in millimetres.
          const step = (depth ** 2 * (1 / camera.near - 1 / camera.far)) / (2 ** 24 - 1);
          assert.ok(
            step < 0.02,
            `depth precision must resolve the minimum 0.2mm clearance: ${step}`,
          );
        }
      }
  }
});
test('clipping updates retain pulled drawers, cabinet boards and the print bed in every view', () => {
  const box = new Box3(new Vector3(0, -180, -4), new Vector3(585, 333, 330));
  for (const camera of [new PerspectiveCamera(36), new OrthographicCamera()])
    for (const eye of [direction, new Vector3(0, -1, 0), new Vector3(0, 0, 1)]) {
      camera.up.set(0, eye.z === 1 ? 1 : 0, eye.z === 1 ? 0 : 1);
      fitViewCamera(camera, box, viewport.width, viewport.height, { direction: eye });
      for (const corner of boxCorners(box)) {
        const point = corner.project(camera);
        assert.ok(point.z > -1 && point.z < 1, 'all geometry must remain between the clip planes');
      }
    }
});
test('zooming inside the model keeps valid clip planes and recovers when zooming back out', () => {
  const camera = perspective(),
    center = bounds.getCenter(new Vector3());
  camera.position.copy(center);
  camera.lookAt(center.clone().add(new Vector3(0, 1, 0)));
  updateCameraClipping(camera, bounds);
  assert.ok(camera.near > 0 && camera.far > camera.near);
  const forward = new Vector3(center.x, bounds.max.y, center.z).project(camera);
  assert.ok(forward.z > -1 && forward.z < 1);
  camera.position.copy(center).add(new Vector3(0, -3000, 0));
  camera.lookAt(center);
  updateCameraClipping(camera, bounds);
  assert.ok(camera.near > 2000, 'zooming back out must restore depth precision');
  for (const corner of boxCorners(bounds)) {
    const point = corner.project(camera);
    assert.ok(point.z > -1 && point.z < 1);
  }
});
test('front and top orthographic views preserve scale and orient the drawing axes correctly', () => {
  const camera = new OrthographicCamera();
  camera.up.set(0, 0, 1);
  fitViewCamera(camera, bounds, viewport.width, viewport.height, {
    direction: new Vector3(0, -1, 0),
  });
  assert.ok(
    Math.abs(
      length(camera, [0, 0, 330], [585, 0, 330]) - length(camera, [0, 330, 330], [585, 330, 330]),
    ) < 1e-8,
  );
  const origin = projectPoint(camera, [0, 0, 0], viewport.width, viewport.height);
  assert.ok(projectPoint(camera, [100, 0, 0], viewport.width, viewport.height)[0] > origin[0]);
  assert.ok(projectPoint(camera, [0, 0, 100], viewport.width, viewport.height)[1] < origin[1]);
  camera.up.set(0, 1, 0);
  fitViewCamera(camera, bounds, viewport.width, viewport.height, {
    direction: new Vector3(0, 0, 1),
  });
  assert.ok(
    Math.abs(length(camera, [0, 0, 0], [585, 0, 0]) - length(camera, [0, 0, 330], [585, 0, 330])) <
      1e-8,
  );
  assert.ok(
    projectPoint(camera, [0, 100, 0], viewport.width, viewport.height)[1] <
      projectPoint(camera, [0, 0, 0], viewport.width, viewport.height)[1],
  );
});
test('perspective and orthographic picking round-trip every cell after camera orbit', () => {
  const { cfg, grid } = design({ width: 585, height: 330, depth: 330 });
  const front = new OrthographicCamera();
  front.up.set(0, 0, 1);
  fitViewCamera(front, bounds, viewport.width, viewport.height, {
    direction: new Vector3(0, -1, 0),
  });
  const cameras = [
    front,
    ...[direction, new Vector3(-1, -1, 0.3), new Vector3(0.8, -0.35, 1.2)].map((eye) =>
      perspective(bounds, viewport.width, viewport.height, eye),
    ),
  ];
  for (const camera of cameras)
    for (let row = 0; row < grid.rows; row++)
      for (let col = 0; col < grid.cols; col++) {
        const point: Vec3 = [
          cfg.edge + (col + 0.5) * grid.unitWidth,
          cfg.edge - 0.8,
          cfg.height - cfg.edge - (row + 0.5) * grid.unitHeight,
        ];
        const [x, y] = projectPoint(camera, point, viewport.width, viewport.height);
        assert.deepEqual(gridCellAt(camera, x, y, viewport.width, viewport.height, cfg, grid), {
          col,
          row,
        });
      }
  const [x, y] = projectPoint(
    cameras[1],
    [-30, cfg.edge - 0.8, cfg.height - cfg.edge - grid.unitHeight * 0.5],
    viewport.width,
    viewport.height,
  );
  assert.equal(gridCellAt(cameras[1], x, y, viewport.width, viewport.height, cfg, grid), null);
  assert.deepEqual(gridCellAt(cameras[1], x, y, viewport.width, viewport.height, cfg, grid, true), {
    col: 0,
    row: 0,
  });
});
test('Three.js preview vertices agree with the serialized 3MF build transform for all six poses', () => {
  const result = design(
    { width: 585, height: 330, depth: 330, bedWidth: 330, bedDepth: 320, bedHeight: 325 },
    [{ id: 1, col: 0, row: 0, cols: 2, rows: 3 }],
  );
  for (const part of result.parts)
    for (const orientation of printOptions(part, result.cfg)) {
      const item: PlateItem = {
        part,
        x: 7,
        y: 11,
        orientation,
        width: orientation.width,
        depth: orientation.depth,
        edgeClearances: {
          left: 7,
          front: 11,
          right: result.cfg.bedWidth - 7 - orientation.width,
          back: result.cfg.bedDepth - 11 - orientation.depth,
        },
        usesReservedMargin: false,
      };
      const geometry = platePartGeometry(item),
        positions = geometry.getAttribute('position');
      const xml = modelXML([item]);
      const vertices = [...xml.matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"/g)].map((m) =>
        m.slice(1).map(Number),
      );
      const match = xml.match(/transform="([^"]+)"/);
      assert.ok(match);
      const m = match[1].split(' ').map(Number);
      assert.equal(positions.count, vertices.length);
      for (let i = 0; i < vertices.length; i++) {
        const [x, y, z] = vertices[i],
          expected = [
            x * m[0] + y * m[3] + z * m[6] + m[9],
            x * m[1] + y * m[4] + z * m[7] + m[10],
            x * m[2] + y * m[5] + z * m[8] + m[11],
          ];
        for (let axis = 0; axis < 3; axis++)
          assert.ok(Math.abs(positions.array[i * 3 + axis] - expected[axis]) < 1e-4);
      }
      geometry.dispose();
    }
});
