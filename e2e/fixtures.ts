import { test as base, expect } from '@playwright/test';
import type { Page, Download } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Playwright gives each test its own browser context and storage. Never attach
// to a user's running browser or reuse another worktree's preview server.
export const test = base.extend<{ app: Page }>({
  app: async ({ page }, runTest) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto('./');
    await expect(page.locator('#grid-overlay').getByRole('button').first()).toBeVisible();
    await expect(page.locator('#preview-error')).toBeHidden();
    await runTest(page);
    expect(errors, 'uncaught runtime or browser console errors').toEqual([]);
  },
});
export { expect };

export async function dragRectangle(page: Page, from: [number, number], to = from) {
  await page.getByRole('button', { name: '正面', exact: true }).click();
  const center = async ([col, row]: [number, number]) => {
    const rect = await page
      .getByRole('button', { name: `第${col}列，第${row}行`, exact: true })
      .boundingBox();
    assert.ok(rect, 'grid cell must be visible');
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  };
  const start = await center(from),
    end = await center(to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
}

export async function setNumber(page: Page, name: string, value: string) {
  const input = page.getByRole('spinbutton', { name, exact: true });
  await input.fill(value);
  await input.press('Tab');
}

export async function downloadBytes(download: Download): Promise<Uint8Array> {
  expect(await download.failure()).toBeNull();
  const path = await download.path();
  assert.ok(path, 'download must have a local file');
  return new Uint8Array(await readFile(path));
}
