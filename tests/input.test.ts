import { test } from 'vitest';
import type { View, WheelInput } from '../src/view-types.ts';
import type { Vec3 } from '../src/types.ts';
import assert from 'node:assert/strict';
import { Box3, Vector3, PerspectiveCamera, OrthographicCamera } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CabinetPreview } from '../src/renderer.ts';
import { projectPoint, gridCellAt } from '../src/view-camera.ts';
import { design } from '../src/core.ts';

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-7, `${a} ≈ ${b}`);
function previewFor(view: View | 'top') {
  // Exercise the real camera/OrbitControls methods without a DOM or GPU.
  type CameraHarness = Pick<
    CabinetPreview,
    | 'view'
    | 'plateMode'
    | 'tool'
    | 'cameras'
    | 'activeCamera'
    | 'orbits'
    | 'controls'
    | 'zoom'
    | 'handleWheel'
    | 'setZoom'
    | 'frameCamera'
    | 'reset'
  > & { canvas: { clientWidth: number; clientHeight: number }; bounds: Box3 };
  // Only the camera-facing portion is initialized; the browser suite exercises
  // the complete WebGL constructor. No DOM element is attached to OrbitControls.
  const preview = Object.create(CabinetPreview.prototype) as CameraHarness;
  Object.assign(preview, {
    canvas: { clientWidth: 1200, clientHeight: 760 },
    view: view === 'top' ? 'plate' : view,
    plateMode: view === 'top' ? 'top' : 'isometric',
    tool: 'draw',
    bounds: new Box3(new Vector3(0, 0, 0), new Vector3(585, 330, 330)),
    cameras: {
      cabinet: new PerspectiveCamera(36),
      plate: new PerspectiveCamera(36),
      front: new OrthographicCamera(),
      top: new OrthographicCamera(),
    },
    orbits: new Map(),
    render() {},
  } satisfies Pick<
    CameraHarness,
    'canvas' | 'view' | 'plateMode' | 'tool' | 'bounds' | 'cameras' | 'orbits'
  > &
    Pick<CabinetPreview, 'render'>);
  for (const [key, camera] of Object.entries(preview.cameras)) {
    camera.up.set(0, key === 'top' ? 1 : 0, key === 'top' ? 0 : 1);
    const controls = new OrbitControls(camera, null);
    controls.enableDamping = false;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enabled = false;
    preview.orbits.set(camera, controls);
  }
  preview.frameCamera();
  return preview;
}
const wheel = (extra: Partial<WheelInput> = {}): WheelInput => ({
  deltaX: 0,
  deltaY: 0,
  deltaMode: 0,
  ctrlKey: false,
  ...extra,
});

test('two-finger sliding orbits around a fixed target without translating it or changing zoom', () => {
  for (const view of ['3d', 'plate'] as const) {
    const preview = previewFor(view),
      camera = preview.activeCamera,
      controls = preview.controls;
    const target = controls.target.clone(),
      rotation = camera.quaternion.clone(),
      distance = camera.position.distanceTo(target),
      zoom = preview.zoom;
    preview.handleWheel(wheel({ deltaX: 72, deltaY: -38 }));
    camera.updateMatrixWorld(true);
    near(controls.target.distanceTo(target), 0);
    near(camera.position.distanceTo(target), distance);
    near(preview.zoom, zoom);
    assert.ok(Math.abs(camera.quaternion.dot(rotation)) < 0.999, 'the camera angle must change');
  }
});
test('fast scrolling still rotates rather than zooms; line/page units match equivalent pixel gestures', () => {
  const preview = previewFor('3d'),
    target = preview.controls.target.clone(),
    rotation = preview.activeCamera.quaternion.clone();
  preview.handleWheel(wheel({ deltaY: 240 }));
  near(preview.zoom, 1);
  near(preview.controls.target.distanceTo(target), 0);
  assert.ok(Math.abs(preview.activeCamera.quaternion.dot(rotation)) < 0.999);
  for (const [event, pixels] of [
    [wheel({ deltaX: 0.75, deltaY: 1.5, deltaMode: 1 }), wheel({ deltaX: 12, deltaY: 24 })],
    [wheel({ deltaX: 0.1, deltaY: 0.1, deltaMode: 2 }), wheel({ deltaX: 120, deltaY: 76 })],
  ]) {
    const a = previewFor('3d'),
      b = previewFor('3d');
    a.handleWheel(event);
    b.handleWheel(pixels);
    near(Math.abs(a.activeCamera.quaternion.dot(b.activeCamera.quaternion)), 1);
    near(a.activeCamera.position.distanceTo(b.activeCamera.position), 0);
  }
});
test('pinch/Ctrl+wheel changes scale without introducing a pan in perspective and orthographic views', () => {
  for (const view of ['3d', 'front', 'plate', 'top'] as const) {
    const preview = previewFor(view),
      target = preview.controls.target.clone(),
      rotation = preview.activeCamera.quaternion.clone();
    preview.handleWheel(wheel({ ctrlKey: true, deltaX: 70, deltaY: -Math.log(1.25) * 100 }));
    near(preview.zoom, 1.25);
    near(preview.controls.target.distanceTo(target), 0);
    near(Math.abs(preview.activeCamera.quaternion.dot(rotation)), 1);
    preview.handleWheel(wheel({ ctrlKey: true, deltaY: Math.log(1.25) * 100 }));
    near(preview.zoom, 1);
  }
});
test('selection/reframing and window resize retain orbit direction and zoom; reset centers the view', () => {
  for (const view of ['3d', 'front', 'plate', 'top'] as const) {
    const preview = previewFor(view);
    preview.handleWheel(wheel({ deltaX: 85, deltaY: 50 }));
    preview.setZoom(1.3);
    const rotation = preview.activeCamera.quaternion.clone();
    preview.bounds.min.y = -180;
    preview.canvas.clientWidth = 900;
    preview.canvas.clientHeight = 600;
    preview.frameCamera();
    near(preview.zoom, 1.3);
    near(Math.abs(preview.activeCamera.quaternion.dot(rotation)), 1);
    near(preview.controls.target.distanceTo(preview.bounds.getCenter(new Vector3())), 0);
    preview.reset();
    near(preview.zoom, 1);
    near(preview.controls.target.distanceTo(preview.bounds.getCenter(new Vector3())), 0);
  }
});
test('drawing picks the correct cell after orbiting and pinching the editor camera', () => {
  const { cfg, grid } = design({ width: 585, height: 330, depth: 330 });
  for (const view of ['3d', 'front'] as const) {
    const preview = previewFor(view);
    preview.handleWheel(wheel({ deltaX: -125, deltaY: 65 }));
    preview.setZoom(1.4);
    preview.activeCamera.updateMatrixWorld(true);
    const point: Vec3 = [
      cfg.edge + 3.5 * grid.unitWidth,
      cfg.edge - 0.8,
      cfg.height - cfg.edge - 2.5 * grid.unitHeight,
    ];
    const [x, y] = projectPoint(preview.activeCamera, point, 1200, 760);
    assert.deepEqual(gridCellAt(preview.activeCamera, x, y, 1200, 760, cfg, grid), {
      col: 3,
      row: 2,
    });
  }
});
