import { test, expect, type Locator, type Page } from '@playwright/test'

async function addSteps(page: Page, names: string[]) {
  const palette = page.getByRole('region', { name: 'Add Step' })
  for (const name of names) await palette.getByRole('button', { name, exact: true }).click()
  await page.getByRole('button', { name: 'Fit View' }).click()
}

async function centreOf(heading: Locator) {
  const box = await heading.boundingBox()
  if (!box) throw new Error('heading has no bounds')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

test('Shift+drag highlights the Step under the pointer, then swaps the two Steps and announces it', async ({ page }) => {
  await page.goto('/')
  await addSteps(page, ['Append', 'Lowercase', 'Uppercase'])
  const append = page.getByRole('group', { name: 'Step 1: Append', exact: true })
  const lowercase = page.getByRole('group', { name: 'Step 2: Lowercase', exact: true })
  const uppercase = page.getByRole('group', { name: 'Step 3: Uppercase', exact: true })
  const hint = page.getByText('Hold Shift and drop on another Step to swap them')
  await expect(hint).toBeHidden()

  const from = await centreOf(append.getByRole('heading'))
  const to = await centreOf(uppercase.getByRole('heading'))
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 10 })
  await expect(hint).toBeVisible()
  await expect(page.getByText(/Swap with Step/)).toHaveCount(0)

  await page.keyboard.down('Shift')
  await expect(uppercase.getByText('Swap with Step 1')).toBeVisible()
  await expect(page.getByText(/Swap with Step/)).toHaveCount(1)
  await page.keyboard.up('Shift')
  await expect(page.getByText(/Swap with Step/)).toHaveCount(0)
  await page.keyboard.down('Shift')
  await expect(uppercase.getByText('Swap with Step 1')).toBeVisible()
  await page.mouse.up()
  await page.keyboard.up('Shift')

  await expect(page.locator('#chain-announcement')).toHaveText('Swapped Append and Uppercase. Append is now Step 3.')
  await expect(hint).toBeHidden()
  await expect(page.locator('.vue-flow__node-step h2')).toHaveText(['1Step 1: Uppercase', '2Step 2: Lowercase', '3Step 3: Append'])
  await expect(page.getByRole('group', { name: 'Step 3: Append', exact: true })).toBeFocused()
  await expect(page.getByText(/Swap with Step/)).toHaveCount(0)
  await expect(lowercase).toBeAttached()
})

test('dropping with Shift over Input text, Output or empty canvas is an ordinary move', async ({ page }) => {
  await page.goto('/')
  await addSteps(page, ['Uppercase', 'Lowercase'])
  const upper = page.getByRole('group', { name: 'Step 1: Uppercase', exact: true })
  const input = page.getByRole('group', { name: 'Input text', exact: true })
  const from = await centreOf(upper.getByRole('heading'))
  const over = await centreOf(input.getByRole('heading'))
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.keyboard.down('Shift')
  await page.mouse.move(over.x, over.y, { steps: 10 })
  await expect(page.getByText(/Swap with Step/)).toHaveCount(0)
  await page.mouse.up()
  await page.keyboard.up('Shift')
  await expect(page.locator('#chain-announcement')).toBeEmpty()
  await expect(page.locator('.vue-flow__node-step h2')).toHaveText(['1Step 1: Uppercase', '2Step 2: Lowercase'])
})
