import { useId } from 'react';
import { drawerMesh, frameMesh } from '../geometry.ts';
import type { MeshData, Vec3 } from '../types.ts';
import type { StructureKey } from './StructureHelp.tsx';

type Point = readonly [number, number];
interface Model {
  mesh: MeshData;
  offset?: Vec3;
  highlight?: 'front' | 'wall' | 'base';
}
const project = ([x, y, z]: Vec3): Point => [32 + 0.95 * x + 0.55 * y, 156 - 0.35 * y - 0.95 * z];
const points = (vertices: readonly Point[]) => vertices.map((p) => p.join(',')).join(' ');
const polygon = (vertices: Vec3[]) => points(vertices.map(project));
const viewDirection: Vec3 = [0.55, -0.95, 0.35];
const dot = (a: Vec3, b: Vec3) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);

// These fixed, exaggerated examples reuse the printable meshes. Only the SVG
// projection is illustrative; no editor settings or printable dimensions change.
function sleeve(width = 132, height = 90, depth = 90): MeshData {
  const mesh = frameMesh({
    id: 'help-frame',
    boxId: 0,
    type: 'frame',
    label: '',
    width,
    depth: height,
    height: depth,
    wall: 10,
  });
  return {
    vertices: mesh.vertices.map(([x, y, z]) => [x, z, y]),
    triangles: mesh.triangles.map(([a, b, c]) => [a, c, b]),
  };
}
const frame = sleeve();
const drawer = drawerMesh({
  id: 'help-drawer',
  boxId: 0,
  type: 'drawer',
  label: '',
  width: 132,
  depth: 90,
  height: 70,
  wall: 8,
  base: 10,
  radius: 16,
});
const fittedDrawer = drawerMesh({
  id: 'help-fit',
  boxId: 0,
  type: 'drawer',
  label: '',
  width: 100,
  depth: 84,
  height: 58,
  wall: 8,
  base: 10,
  radius: 12,
});

function MeshSketch({ models }: { models: Model[] }) {
  const faces = models
    .flatMap(({ mesh, offset = [0, 0, 0], highlight }, modelIndex) => {
      const vertices = mesh.vertices.map((v): Vec3 => [
        v[0] + offset[0],
        v[1] + offset[1],
        v[2] + offset[2],
      ]);
      const triangles = mesh.triangles.map((indices, index) => {
        const [a, b, c] = indices.map((i) => vertices[i]);
        const u = b.map((n, i) => n - a[i]),
          v = c.map((n, i) => n - a[i]);
        const normal: Vec3 = [
          u[1] * v[2] - u[2] * v[1],
          u[2] * v[0] - u[0] * v[2],
          u[0] * v[1] - u[1] * v[0],
        ];
        const length = Math.hypot(...normal);
        const unit = normal.map((n) => (length ? n / length : 0)) as Vec3;
        const visible = dot(unit, viewDirection) > 1e-6;
        const highlighted =
          (highlight === 'front' && indices.every((i) => Math.abs(mesh.vertices[i][1]) < 1e-6)) ||
          (highlight === 'wall' && Math.abs(unit[2]) < 0.5) ||
          (highlight === 'base' && indices.every((i) => mesh.vertices[i][2] === 10));
        const tone = highlighted
          ? 'highlight'
          : unit[2] > 0.5
            ? 'top'
            : unit[1] < -0.5
              ? 'front'
              : 'side';
        return {
          key: `${modelIndex}-${index}`,
          indices,
          vertices: [a, b, c],
          unit,
          visible,
          tone,
          outlines: [] as [Vec3, Vec3][],
          depth: [a, b, c].reduce((sum, p) => sum - dot(p, viewDirection), 0) / 3,
        };
      });
      const edges = new Map<string, { a: number; b: number; faces: typeof triangles }>();
      for (const face of triangles) {
        face.indices.forEach((a, i) => {
          const b = face.indices[(i + 1) % 3],
            key = [Math.min(a, b), Math.max(a, b)].join('-');
          const edge = edges.get(key) ?? { a, b, faces: [] };
          edge.faces.push(face);
          edges.set(key, edge);
        });
      }
      for (const edge of edges.values()) {
        // Keep silhouettes and creases, without exposing triangulation or smooth facets.
        if (
          edge.faces.some((f) => f.visible) &&
          (edge.faces.length === 1 ||
            edge.faces.some((f) => !f.visible) ||
            dot(edge.faces[0].unit, edge.faces[1].unit) < 0.85)
        ) {
          for (const face of edge.faces)
            if (face.visible) face.outlines.push([vertices[edge.a], vertices[edge.b]]);
        }
      }
      return triangles.filter((face) => face.visible);
    })
    .sort((a, b) => b.depth - a.depth);
  return (
    <g className="structure-mesh">
      {faces.map((face) => (
        <g key={face.key}>
          <polygon points={polygon(face.vertices)} className={`diagram-${face.tone}`} />
          {face.outlines.map((edge, index) => (
            <polyline key={index} points={polygon(edge)} className="diagram-outline" />
          ))}
        </g>
      ))}
    </g>
  );
}

function Dimension({ a, b, arrow }: { a: Vec3; b: Vec3; arrow: string }) {
  return (
    <polyline
      className="diagram-dimension"
      points={polygon([a, b])}
      markerStart={`url(#${arrow})`}
      markerEnd={`url(#${arrow})`}
    />
  );
}
function Callout({
  line,
  x,
  y,
  children,
  centered = false,
}: {
  line: Point[];
  x: number;
  y: number;
  children: string;
  centered?: boolean;
}) {
  return (
    <g className="diagram-callout">
      <polyline points={points(line)} />
      <text x={x} y={y} textAnchor={centered ? 'middle' : undefined}>
        {children}
      </text>
    </g>
  );
}

export function StructureDiagram({ name }: { name: StructureKey }) {
  const arrow = useId();
  const descriptions: Record<StructureKey, string> = {
    frameWall: '开放框套的立体图，标出前沿围壁的厚度。',
    wall: '开口盒子的立体图，高亮四周侧壁，并标出内外壁之间的厚度。',
    base: '开口盒子的立体图，高亮前沿底部截面，标出盒底厚度。',
    fit: '盒子装入开放框套的立体图，标出盒子外壁与框套内壁之间的单侧间隙。',
    edge: '框套放入柜内的立体图，标出柜内壁与布局网格边界之间的单端预留量。',
    jointGap: '两个相邻开放框套的立体图，标出两侧外壁之间的总缝宽。',
    radius: '开口盒子的立体图，高亮外角圆弧，从圆心到外圆弧标出半径 R。',
  };
  return (
    <svg
      className="measurement-diagram structure-diagram"
      viewBox="0 0 280 190"
      role="img"
      aria-label={descriptions[name]}
    >
      <defs>
        <marker
          id={arrow}
          viewBox="0 0 8 8"
          refX="4"
          refY="4"
          markerWidth="3.5"
          markerHeight="3.5"
          orient="auto-start-reverse"
        >
          <path d="M7 4 1 1v6Z" />
        </marker>
      </defs>
      {name === 'frameWall' && (
        <>
          <MeshSketch models={[{ mesh: frame, highlight: 'front' }]} />
          <Dimension a={[0, 0, 45]} b={[10, 0, 45]} arrow={arrow} />
          <Callout
            line={[
              [37, 113],
              [16, 113],
              [16, 34],
            ]}
            x={14}
            y={24}
          >
            围壁厚度
          </Callout>
        </>
      )}
      {name === 'wall' && (
        <>
          <MeshSketch models={[{ mesh: drawer, highlight: 'wall' }]} />
          <Dimension a={[124, 45, 70]} b={[132, 45, 70]} arrow={arrow} />
          <Callout
            line={[
              [178, 74],
              [213, 43],
              [235, 43],
            ]}
            x={221}
            y={33}
          >
            壁厚
          </Callout>
        </>
      )}
      {name === 'base' && (
        <>
          <MeshSketch models={[{ mesh: drawer, highlight: 'base' }]} />
          <polygon
            className="diagram-section"
            points={polygon([
              [16, 0, 0],
              [116, 0, 0],
              [116, 0, 10],
              [16, 0, 10],
            ])}
          />
          <Dimension a={[100, 0, 0]} b={[100, 0, 10]} arrow={arrow} />
          <Callout
            line={[
              [127, 151],
              [160, 176],
              [186, 176],
            ]}
            x={192}
            y={180}
          >
            底厚
          </Callout>
        </>
      )}
      {name === 'fit' && (
        <>
          <MeshSketch models={[{ mesh: frame }, { mesh: fittedDrawer, offset: [16, -28, 16] }]} />
          <polygon
            className="diagram-gap"
            points={polygon([
              [116, 0, 16],
              [122, 0, 16],
              [122, 0, 74],
              [116, 0, 74],
            ])}
          />
          <Dimension a={[116, 0, 44]} b={[122, 0, 44]} arrow={arrow} />
          <Callout
            line={[
              [145, 114],
              [190, 130],
              [200, 130],
            ]}
            x={206}
            y={134}
          >
            单侧间隙
          </Callout>
        </>
      )}
      {name === 'edge' && (
        <>
          <g className="diagram-cabinet">
            <polygon
              points={polygon([
                [0, 0, 0],
                [0, 105, 0],
                [164, 105, 0],
                [164, 0, 0],
              ])}
            />
            <polygon
              points={polygon([
                [0, 105, 0],
                [164, 105, 0],
                [164, 105, 116],
                [0, 105, 116],
              ])}
            />
            <polygon
              points={polygon([
                [0, 0, 0],
                [0, 105, 0],
                [0, 105, 116],
                [0, 0, 116],
              ])}
            />
          </g>
          <MeshSketch models={[{ mesh: sleeve(132, 84, 89), offset: [16, 0, 16] }]} />
          <polyline
            className="diagram-cabinet-edge"
            points={polygon([
              [164, 0, 0],
              [164, 0, 116],
              [0, 0, 116],
            ])}
          />
          <polygon
            className="diagram-gap"
            points={polygon([
              [0, 0, 16],
              [16, 0, 16],
              [16, 0, 100],
              [0, 0, 100],
            ])}
          />
          <Dimension a={[0, 0, 55]} b={[16, 0, 55]} arrow={arrow} />
          <Callout
            line={[
              [40, 104],
              [16, 104],
              [16, 34],
            ]}
            x={14}
            y={24}
          >
            每端预留
          </Callout>
        </>
      )}
      {name === 'jointGap' && (
        <>
          <MeshSketch
            models={[
              { mesh: sleeve(86, 90, 75) },
              { mesh: sleeve(86, 90, 75), offset: [102, 0, 0] },
            ]}
          />
          <polygon
            className="diagram-gap"
            points={polygon([
              [86, 0, 0],
              [102, 0, 0],
              [102, 0, 90],
              [86, 0, 90],
            ])}
          />
          <Dimension a={[86, 0, 45]} b={[102, 0, 45]} arrow={arrow} />
          <Callout
            line={[
              [121, 113],
              [121, 30],
            ]}
            x={132}
            y={20}
            centered
          >
            相邻框套总缝宽
          </Callout>
        </>
      )}
      {name === 'radius' && (
        <>
          <MeshSketch models={[{ mesh: drawer }]} />
          <polyline
            className="diagram-radius"
            points={polygon(
              Array.from({ length: 17 }, (_, i): Vec3 => {
                const angle = -Math.PI / 2 + (i * Math.PI) / 32;
                return [116 + 16 * Math.cos(angle), 16 + 16 * Math.sin(angle), 70];
              }),
            )}
          />
          <circle
            className="diagram-center"
            cx={project([116, 16, 70])[0]}
            cy={project([116, 16, 70])[1]}
            r="2"
          />
          <Dimension a={[116, 16, 70]} b={[132, 16, 70]} arrow={arrow} />
          <Callout
            line={[
              [166, 84],
              [215, 108],
              [225, 108],
            ]}
            x={231}
            y={112}
          >
            R
          </Callout>
        </>
      )}
      <text className="diagram-scale" x="268" y="186" textAnchor="end">
        非实际比例
      </text>
    </svg>
  );
}
