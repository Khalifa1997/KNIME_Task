import { test, expect } from '@playwright/test'
import { addUppercase, assertTouchDrag } from './touch-drag'

test.use({ hasTouch: true })

test('touch-drag moves a Step without panning the canvas', async ({ page }, testInfo) => {
  await addUppercase(page)
  await assertTouchDrag(page, testInfo)
  await expect(page.getByRole('group', { name: 'Step 1: Uppercase' })).toBeVisible()
})
