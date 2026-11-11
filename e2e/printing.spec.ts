import { test, expect, dragRectangle, setNumber, downloadBytes } from './fixtures.ts';
import { readZip, entry, readJSON, array, record, records } from '../tests/helpers/artifacts.ts';

async function largeCabinet(page: import('@playwright/test').Page, depth = '330') {
  for (const [name, value] of [
    ['宽度', '585'],
    ['高度', '330'],
    ['深度', depth],
    ['X', '330'],
    ['Y', '320'],
    ['Z', '325'],
  ]) {
    await setNumber(page, name, value);
  }
}

test('warning-only layouts download real plate 3MF and a complete printable kit', async ({
  app: page,
}, testInfo) => {
  await largeCabinet(page);
  await dragRectangle(page, [1, 4], [1, 6]);
  await expect(page.locator('#box-count')).toHaveText('1');
  await expect(page.locator('#selection-warning')).toContainText(/Z 需 327/);
  await expect(page.getByRole('button', { name: '导出 3MF', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await testInfo.attach('warning-cabinet', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await page.getByRole('button', { name: '打印盘', exact: true }).click();
  await expect(page.locator('#plate-counter')).toContainText('2 个零件');
  const plateEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载此盘 3MF', exact: true }).click();
  const plateDownload = await plateEvent;
  expect(plateDownload.suggestedFilename()).toMatch(/plate-01\.3mf$/);
  const plateFiles = readZip(await downloadBytes(plateDownload));
  const xml = new TextDecoder().decode(entry(plateFiles, '3D/3dmodel.model'));
  expect(xml).toContain('unit="millimeter"');
  expect(xml.match(/<object /g)).toHaveLength(2);
  expect(xml).toContain('<triangle ');
  await testInfo.attach('print-plate', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByRole('button', { name: '导出 3MF', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '导出打印文件', exact: true })).toBeVisible();
  await expect(page.locator('#export-orientation-note')).toContainText('可能需要支撑');
  const bundleEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载整套 ZIP', exact: true }).click();
  const files = readZip(await downloadBytes(await bundleEvent));
  const manifest = readJSON(entry(files, 'assembly.json'));
  expect(records(manifest.boxes)).toHaveLength(1);
  expect(record(manifest.settings).depth).toBe(330);
  expect(manifest.availablePrintXYZ).toEqual([330, 320, 325]);
  const plates = records(manifest.plates);
  expect(plates.flatMap((plate) => array(plate.parts)).sort()).toEqual(['drawer-1', 'frame-1']);
  const placements = plates.flatMap((plate) => records(plate.placements));
  expect(placements.filter((part) => part.checkSupports)).toHaveLength(1);
  for (const part of placements) {
    const dims = array(part.printXYZ);
    expect(dims).toHaveLength(3);
    dims.forEach((dimension, axis) => {
      expect(typeof dimension).toBe('number');
      expect(Number(dimension)).toBeGreaterThan(0);
      expect(Number(dimension)).toBeLessThanOrEqual([330, 320, 325][axis]);
    });
  }
  for (const plate of plates) {
    expect(typeof plate.file).toBe('string');
    const nested = readZip(entry(files, String(plate.file)));
    expect(new TextDecoder().decode(entry(nested, '3D/3dmodel.model'))).toContain('<triangle ');
  }
  expect(new TextDecoder().decode(entry(files, 'README.txt'))).toContain('检查支撑');
});

test('truly oversized parts block export and become recoverable when dimensions fit', async ({
  app: page,
}) => {
  await largeCabinet(page, '400');
  await dragRectangle(page, [1, 1]);
  await expect(page.locator('#box-count')).toHaveText('1');
  await expect(page.locator('#print-status')).toContainText('超出打印');
  await expect(page.getByRole('button', { name: '导出 3MF', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '打印盘', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '导出这一组', exact: true })).toBeDisabled();
  await setNumber(page, '深度', '180');
  await expect(page.getByRole('button', { name: '导出 3MF', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '打印盘', exact: true })).toBeEnabled();
  await expect(page.locator('#box-count')).toHaveText('1');
});
