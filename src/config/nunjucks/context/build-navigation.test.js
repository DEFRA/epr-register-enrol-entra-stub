import { buildNavigation } from './build-navigation.js'

function mockRequest(options) {
  return { ...options }
}

describe('#buildNavigation', () => {
  test('Should provide expected navigation details', () => {
    expect(
      buildNavigation(
        mockRequest({
          url: 'http://localhost:3010/authorize',
          path: '/non-existent-path'
        })
      )
    ).toEqual([
      {
        current: false,
        text: 'Login',
        href: 'http://localhost:3010/authorize'
      }
    ])
  })

  test('Should provide expected highlighted navigation details', () => {
    expect(
      buildNavigation(
        mockRequest({
          url: 'http://localhost:3010/authorize',
          path: '/authorize'
        })
      )
    ).toEqual([
      {
        current: true,
        text: 'Login',
        href: 'http://localhost:3010/authorize'
      }
    ])
  })
})
