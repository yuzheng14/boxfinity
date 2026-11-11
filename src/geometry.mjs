// Meshes share vertices and use outward winding. Dimensions use print coordinates.
export function drawerMesh(part, segments = 8) {
  const { width: w, depth: d, height: h, wall: t, base: b, radius: r } = part;
  const notch = Math.max(0, Math.min(14, w * .16, (w - 2 * r) / 2 - 1, h * .27));
  const contour = (inset, radius) => {
    const points = [];
    const corners = [[w - inset - radius, d - inset - radius], [inset + radius, d - inset - radius], [inset + radius, inset + radius], [w - inset - radius, inset + radius]];
    corners.forEach(([cx, cy], corner) => {
      for (let i = 0; i <= segments; i++) {
        const angle = (corner * 90 + i * 90 / segments) * Math.PI / 180;
        points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle), h]);
      }
      // Front edge, y = 0. The same sampled U-shaped finger recess is used
      // on the outside and inside so the front wall remains a closed shell.
      if (corner === 2 && notch >= 3) {
        for (let i = 0; i <= 16; i++) {
          const angle = Math.PI - i * Math.PI / 16;
          points.push([w / 2 + notch * Math.cos(angle), inset, h - notch * Math.sin(angle)]);
        }
      }
    });
    return points;
  };
  const outer = contour(0, r), inner = contour(t, r - t), n = outer.length;
  const vertices = [
    ...outer.map(([x, y]) => [x, y, 0]),
    ...outer,
    ...inner,
    ...inner.map(([x, y]) => [x, y, b]),
    [w / 2, d / 2, 0], [w / 2, d / 2, b],
  ];
  const triangles = [];
  const quad = (a, b, c, d) => triangles.push([a, b, c], [a, c, d]);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    quad(i, j, j + n, i + n);
    quad(i + n, j + n, j + 2 * n, i + 2 * n);
    quad(i + 2 * n, j + 2 * n, j + 3 * n, i + 3 * n);
    triangles.push([4 * n, j, i], [4 * n + 1, i + 3 * n, j + 3 * n]);
  }
  return { vertices, triangles };
}

// A four-sided, open-front/open-back sleeve. Print with its opening facing up:
// print X/Y = cabinet width/height; print Z = cabinet depth. No roof bridging.
export function frameMesh(part) {
  const { width: w, depth: d, height: h, wall: t } = part;
  const outer = [[0, 0], [w, 0], [w, d], [0, d]];
  const inner = [[t, t], [w - t, t], [w - t, d - t], [t, d - t]];
  const vertices = [
    ...outer.map(([x, y]) => [x, y, 0]), ...outer.map(([x, y]) => [x, y, h]),
    ...inner.map(([x, y]) => [x, y, h]), ...inner.map(([x, y]) => [x, y, 0]),
  ];
  const triangles = [];
  const quad = (a, b, c, d) => triangles.push([a, b, c], [a, c, d]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quad(i, j, j + 4, i + 4);
    quad(i + 4, j + 4, j + 8, i + 8);
    quad(i + 8, j + 8, j + 12, i + 12);
    quad(i + 12, j + 12, j, i);
  }
  return { vertices, triangles };
}
export const partMesh = (part) => part.type === 'frame' ? frameMesh(part) : drawerMesh(part);
export function meshVolume(mesh) {
  let volume = 0;
  for (const [i, j, k] of mesh.triangles) {
    const a = mesh.vertices[i], b = mesh.vertices[j], c = mesh.vertices[k];
    volume += a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  return volume / 6;
}
