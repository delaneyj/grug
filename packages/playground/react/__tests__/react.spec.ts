import { editFile, untilUpdated, isBuild } from '../../testUtils'

test('should render', async () => {
  expect(await page.textContent('h1')).toMatch('Hello grug + React')
})

test('should update', async () => {
  expect(await page.textContent('button')).toMatch('count is: 0')
  await page.click('button')
  expect(await page.textContent('button')).toMatch('count is: 1')
})

test('should hmr', async () => {
  editFile('App.jsx', (code) => code.replace('grug + React', 'Updated'))
  await untilUpdated(() => page.textContent('h1'), 'Hello Updated')
  // preserve state
  expect(await page.textContent('button')).toMatch('count is: 1')
})
