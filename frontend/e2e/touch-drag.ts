import { expect, type Page, type TestInfo } from '@playwright/test'

export async function addUppercase(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Not run yet')
  await page.getByRole('region', { name: 'Add Step' }).getByRole('button', { name: 'Uppercase' }).click()
  const step = page.getByRole('group', { name: 'Step 1: Uppercase' })
  await expect(step).toBeFocused()
  await expect(step.getByRole('heading')).toBeVisible()
  // Reveal focuses only after framing; wait for consecutive stable rendered frames too.
  await step.evaluate(async (element) => {
    let previous = ''
    let stable = 0
    while (stable < 3) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const rect = element.getBoundingClientRect()
      const current = JSON.stringify([rect.x, rect.y, rect.width, rect.height])
      stable = current === previous ? stable + 1 : 0
      previous = current
    }
  })
}

export async function assertTouchDrag(page: Page, testInfo: TestInfo) {
  const step = page.getByRole('group', { name: 'Step 1: Uppercase' })
  const measure = () => step.evaluate((element) => {
    const node = new DOMMatrix(getComputedStyle(element).transform)
    const viewport = element.closest('.vue-flow__viewport')
    if (!viewport) throw new Error('Step has no rendered canvas viewport')
    const view = new DOMMatrix(getComputedStyle(viewport).transform)
    return { x: node.e, y: node.f, viewX: view.e, viewY: view.f, zoom: view.a }
  })
  const before = await measure()
  const bounds = await step.getByRole('heading').boundingBox()
  if (!bounds) throw new Error('Step heading has no bounds')
  const x = bounds.x + bounds.width / 2
  const y = bounds.y + bounds.height / 2
  const screen = page.viewportSize()
  if (!screen || x + 60 >= screen.width - 15 || y + 100 >= screen.height - 15) {
    throw new Error('Touch gesture would leave the visible viewport')
  }
  const session = await page.context().newCDPSession(page)
  try {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] })
    for (let move = 1; move <= 20; move++) {
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove', touchPoints: [{ x: x + 60 * move / 20, y: y + 100 * move / 20, id: 1 }],
      })
    }
  } finally {
    try {
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    } finally {
      await session.detach()
    }
  }
  try {
    await expect.poll(async () => {
      const after = await measure()
      return { x: (after.x - before.x) * before.zoom > 35, y: (after.y - before.y) * before.zoom > 65 }
    }, { message: 'Touch must move the Step substantially in both axes' }).toEqual({ x: true, y: true })
    const after = await measure()
    expect(Math.abs(after.viewX - before.viewX)).toBeLessThan(1)
    expect(Math.abs(after.viewY - before.viewY)).toBeLessThan(1)
    expect(after.zoom).toBe(before.zoom)
    await expect(step).toBeVisible()
  } finally {
    const after = await measure()
    const measurement = { before, after, deltaX: after.x - before.x, deltaY: after.y - before.y }
    console.log('Touch drag measurement:', JSON.stringify(measurement))
    await testInfo.attach('touch-drag-coordinates', { body: JSON.stringify(measurement, null, 2), contentType: 'application/json' })
  }
}
