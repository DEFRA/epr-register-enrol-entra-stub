export function buildNavigation(request) {
  return [
    {
      text: 'Login',
      href: request?.url,
      current: request?.path === '/authorize'
    }
  ]
}
