import { test, expect } from './fixtures'

test('the toolbar offers one Add Step button per Transformation from the backend', async ({
  page,
}, testInfo) => {
  await page.goto('/')

  const palette = page.getByRole('region', { name: 'Add Step' })
  await expect(palette.getByRole('button')).toHaveText(['Replace', 'Append', 'Prepend', 'Uppercase', 'Lowercase'])

  // Keyboard users reach the first button, and hear its description.
  const uppercase = palette.getByRole('button', { name: 'Uppercase' })
  await uppercase.focus()
  await expect(uppercase).toBeFocused()
  await expect(uppercase).toHaveAccessibleDescription('Converts the text to upper case.')
  await page.screenshot({ path: testInfo.outputPath('01-desktop-toolbar.png') })

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(palette.getByRole('button')).toHaveText(['Replace', 'Append', 'Prepend', 'Uppercase', 'Lowercase'])
  await page.screenshot({ path: testInfo.outputPath('02-phone-toolbar.png') })
})
