import { test, expect } from './fixtures'
import { addUppercase, assertTouchDrag } from '../touch-drag'

test.use({ hasTouch: true, viewport: { width: 412, height: 839 } })

test('touch-drag an Uppercase Step on a phone', async ({ page }, testInfo) => {
  await addUppercase(page)
  await page.screenshot({ path: testInfo.outputPath('01-before-touch-drag.png') })
  await assertTouchDrag(page, testInfo)
  await page.screenshot({ path: testInfo.outputPath('02-after-touch-drag.png') })
  await expect(page.getByRole('group', { name: 'Step 1: Uppercase' })).toBeVisible()
})
