import { test, expect } from './fixtures'

test('Shift+drag swaps two Steps with a live highlight and announces it', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Input text' }).fill('a')
  const palette = page.getByRole('region', { name: 'Add Step' })
  for (const name of ['Append', 'Lowercase', 'Uppercase']) {
    await palette.getByRole('button', { name, exact: true }).click()
  }
  await page.getByRole('button', { name: 'Fit View' }).click()
  const centre = async (name: string) => {
    const box = await page.getByRole('group', { name, exact: true }).getByRole('heading').boundingBox()
    if (!box) throw new Error(`${name} has no bounds`)
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }
  const from = await centre('Step 1: Append')
  const to = await centre('Step 3: Uppercase')
  await page.screenshot({ path: testInfo.outputPath('01-before.png') })
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 10 })
  await expect(page.getByText('Hold Shift and drop on another Step to swap them')).toBeVisible()
  await expect(page.getByText(/Swap with Step/)).toHaveCount(0)
  await page.keyboard.down('Shift')
  await expect(page.getByText('Swap with Step 1')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('02-highlight.png') })
  await page.mouse.up()
  await page.keyboard.up('Shift')
  await expect(page.locator('#chain-announcement')).toHaveText('Swapped Append and Uppercase. Append is now Step 3.')
  await expect(page.locator('.vue-flow__node-step h2')).toHaveText(['1Step 1: Uppercase', '2Step 2: Lowercase', '3Step 3: Append'])
  await expect(page.getByRole('group', { name: 'Step 3: Append', exact: true })).toBeFocused()
  await page.screenshot({ path: testInfo.outputPath('03-swapped.png') })
})
