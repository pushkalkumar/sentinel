/** True when the browser can give us a WebGL context (WebGL2 preferred). Callers fall back to the SVG CampusMap otherwise. */
export function supportsWebGL(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    return false
  }
}
