// Rows are counted from the top of the cabinet; cols/rows mean horizontal/vertical span.
export function rectangleBetween(start, end) {
  return { col: Math.min(start.col, end.col), row: Math.min(start.row, end.row),
    cols: Math.abs(start.col - end.col) + 1, rows: Math.abs(start.row - end.row) + 1 };
}
export const overlaps = (a, b) => a.col < b.col + b.cols && b.col < a.col + a.cols && a.row < b.row + b.rows && b.row < a.row + a.rows;
export function placementError(rect, placements, grid, excludedId = null) {
  if (![rect.col, rect.row, rect.cols, rect.rows].every(Number.isInteger) || rect.col < 0 || rect.row < 0 || rect.cols < 1 || rect.rows < 1 || rect.col + rect.cols > grid.cols || rect.row + rect.rows > grid.rows) return '选区超出了网格';
  if (placements.some((box) => box.id !== excludedId && overlaps(rect, box))) return '选区与已有盒子重叠';
  return null;
}
export function addPlacement(placements, rect, grid) {
  const error = placementError(rect, placements, grid);
  if (error) throw new Error(error);
  return [...placements, { ...rect, id: Math.max(0, ...placements.map((box) => box.id)) + 1 }];
}
export function fillEmpty(placements, grid) {
  let next = placements.slice();
  for (let row = 0; row < grid.rows; row++) for (let col = 0; col < grid.cols; col++) {
    const rect = { col, row, cols: 1, rows: 1 };
    if (!placementError(rect, next, grid)) next = addPlacement(next, rect, grid);
  }
  return next;
}
export function exampleLayout(grid) {
  let result = [];
  for (const rect of [{ col: 0, row: 0, cols: 3, rows: 2 }, { col: 3, row: 0, cols: 2, rows: 1 }, { col: 5, row: 0, cols: 1, rows: 2 }, { col: 3, row: 1, cols: 2, rows: 2 }, { col: 0, row: 2, cols: 2, rows: 1 }, { col: 2, row: 2, cols: 1, rows: 2 }]) {
    if (!placementError(rect, result, grid)) result = addPlacement(result, rect, grid);
  }
  return result;
}
export function validatePlacements(placements, grid) {
  if (!Array.isArray(placements) || placements.length > grid.cols * grid.rows) throw new Error('盒子布局数据无效');
  const accepted = [], ids = new Set();
  for (const value of placements) {
    if (!value || !Number.isSafeInteger(value.id) || value.id < 1 || ids.has(value.id)) throw new Error('盒子编号无效或重复');
    const rect = { id: value.id, col: value.col, row: value.row, cols: value.cols, rows: value.rows };
    const error = placementError(rect, accepted, grid);
    if (error) throw new Error(error);
    accepted.push(rect); ids.add(rect.id);
  }
  return accepted;
}
