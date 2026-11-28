import { test, expect, dragRectangle, setNumber, downloadBytes } from './fixtures.ts';
import { readJSON, record, records } from '../tests/helpers/artifacts.ts';

test('production subpath loads and WebGL draws a real cabinet', async ({ app: page }) => {
  await expect(page).toHaveTitle(/Boxfinity/);
  await expect(page.locator('#empty-hint')).toBeVisible();
  await expect(page.getByRole('button', { name: '导出 3MF', exact: true })).toBeDisabled();
  await expect
    .poll(() =>
      page.locator('#preview').evaluate((element) => {
        if (!(element instanceof HTMLCanvasElement)) return false;
        const gl = element.getContext('webgl2');
        if (!gl) return false;
        const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
        gl.readPixels(
          0,
          0,
          gl.drawingBufferWidth,
          gl.drawingBufferHeight,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixels,
        );
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) return true;
        return false;
      }),
    )
    .toBe(true);
});

test('dragging, undo/redo and grid presets preserve the expected layout', async ({ app: page }) => {
  await dragRectangle(page, [2, 2], [3, 4]);
  await expect(page.locator('#box-count')).toHaveText('1');
  await expect(page.getByRole('button', { name: '选择盒子 1，2乘3', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.locator('#box-count')).toHaveText('0');
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await expect(page.locator('#box-count')).toHaveText('1');
  await page.getByRole('button', { name: /细分预设/ }).click();
  await expect(page.locator('#box-count')).toHaveText('0');
  await expect(page.getByRole('spinbutton', { name: '网格列数', exact: true })).toHaveValue('11');
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: '网格列数', exact: true })).toHaveValue('9');
  await expect(page.getByRole('button', { name: '选择盒子 1，2乘3', exact: true })).toBeVisible();
});

test('invalid dimensions leave the last valid preview and stored layout recoverable', async ({
  app: page,
}) => {
  await dragRectangle(page, [1, 1]);
  await setNumber(page, '宽度', '');
  await expect(page.locator('#design-error')).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: '宽度', exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(page.locator('#cabinet-caption')).toHaveText('600 × 420 × 180 mm');
  await expect(page.getByRole('button', { name: '导出 3MF', exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('spinbutton', { name: '宽度', exact: true })).toHaveValue('600');
  await expect(page.locator('#box-count')).toHaveText('1');
  await expect(page.locator('#design-error')).toBeHidden();
  await setNumber(page, '宽度', '610');
  await expect(page.locator('#cabinet-caption')).toHaveText('610 × 420 × 180 mm');
  await expect(page.locator('#box-count')).toHaveText('1');
});

test('printer preset axes update together and manual dimensions become custom', async ({
  app: page,
}) => {
  const printer = page.getByRole('combobox', { name: '打印机预设', exact: true });
  await printer.selectOption('snapmaker-u1');
  for (const axis of ['X', 'Y', 'Z']) {
    await expect(page.getByRole('spinbutton', { name: axis, exact: true })).toHaveValue('270');
  }
  await setNumber(page, 'X', '271.5');
  await expect(printer).toHaveValue('');
  await expect(page.getByRole('spinbutton', { name: 'Y', exact: true })).toHaveValue('270');
  await expect(page.getByRole('spinbutton', { name: 'Z', exact: true })).toHaveValue('270');
  await page.reload();
  await expect(printer).toHaveValue('');
  await expect(page.getByRole('spinbutton', { name: 'X', exact: true })).toHaveValue('271.5');
});

test('saved JSON imports and refreshes with the same layout and printer identity', async ({
  app: page,
}) => {
  await page
    .getByRole('combobox', { name: '打印机预设', exact: true })
    .selectOption('snapmaker-u1');
  await page.getByRole('button', { name: '示例布局', exact: true }).click();
  await expect(page.locator('#box-count')).toHaveText('6');
  const saved = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存方案', exact: true }).click();
  const download = await saved;
  expect(download.suggestedFilename()).toBe('boxfinity-cabinet-design.json');
  const bytes = await downloadBytes(download),
    document = readJSON(bytes);
  expect(document.app).toBe('boxfinity');
  expect(document.version).toBe(2);
  expect(document.printerPresetId).toBe('snapmaker-u1');
  expect(records(document.placements)).toHaveLength(6);
  expect(record(document.settings).cols).toBe(9);
  await setNumber(page, '网格列数', '10');
  await expect(page.locator('#box-count')).toHaveText('0');
  await page.locator('#import-file').setInputFiles({
    name: 'design.json',
    mimeType: 'application/json',
    buffer: Buffer.from(bytes),
  });
  await expect(page.locator('#box-count')).toHaveText('6');
  await expect(page.getByRole('spinbutton', { name: '网格列数', exact: true })).toHaveValue('9');
  await expect(page.getByRole('combobox', { name: '打印机预设', exact: true })).toHaveValue(
    'snapmaker-u1',
  );
  await page.reload();
  await expect(page.locator('#box-count')).toHaveText('6');
  await expect(page.getByRole('combobox', { name: '打印机预设', exact: true })).toHaveValue(
    'snapmaker-u1',
  );
  const restoredDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存方案', exact: true }).click();
  expect(readJSON(await downloadBytes(await restoredDownload))).toEqual(document);
  await page.locator('#import-file').setInputFiles({
    name: 'old.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"app":"boxfinity","version":1}'),
  });
  await expect(page.locator('#toast')).toContainText('新版');
  await expect(page.locator('#box-count')).toHaveText('6');
});

test('wheel rotates from front/top views and Ctrl+wheel zooms without changing the view', async ({
  app: page,
}) => {
  await page.getByRole('button', { name: '正面', exact: true }).click();
  const cell = page.getByRole('button', { name: '第1列，第1行', exact: true });
  const before = await cell.getAttribute('points');
  const stage = await page.locator('#stage').boundingBox();
  expect(stage).not.toBeNull();
  if (!stage) throw new Error('stage must be visible');
  await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2);
  await page.mouse.wheel(65, 40);
  await expect(page.getByRole('button', { name: '3D', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect.poll(() => cell.getAttribute('points')).not.toBe(before);
  const initialWidth = (await cell.boundingBox())?.width;
  if (!initialWidth) throw new Error('projected cell must have a width');
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -25);
  await page.keyboard.up('Control');
  await expect
    .poll(async () => (await cell.boundingBox())?.width ?? 0)
    .toBeGreaterThan(initialWidth * 1.1);
  await expect(page.getByRole('button', { name: '3D', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '示例布局', exact: true }).click();
  await page.getByRole('button', { name: '打印盘', exact: true }).click();
  await page.getByRole('button', { name: '俯视', exact: true }).click();
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -15);
  await page.keyboard.up('Control');
  await expect(page.getByRole('button', { name: '俯视', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.mouse.wheel(30, 20);
  await expect(page.getByRole('button', { name: '立体', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
