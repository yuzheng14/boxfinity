import type { OrthographicCamera, PerspectiveCamera } from 'three';
import type { GridRectangle } from './types.ts';

export type View = 'front' | '3d' | 'plate';
export type Tool = 'draw' | 'orbit';
export type PlateMode = 'isometric' | 'top';
export interface Viewport { view: View; tool: Tool; pull: boolean; plateIndex: number; plateMode: PlateMode }
export type UpdateViewport = (patch: Partial<Viewport>) => void;
export type PreviewCamera = (PerspectiveCamera | OrthographicCamera) & {
  userData: { framed?: boolean; fitDistance?: number };
};
export type CameraKey = 'cabinet' | 'plate' | 'front' | 'top';
export type Ghost = GridRectangle & { invalid: boolean };
export interface WheelInput { deltaX: number; deltaY: number; deltaMode?: number; ctrlKey: boolean }
