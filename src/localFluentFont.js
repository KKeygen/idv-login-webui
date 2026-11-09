// Use the exact native glyphs only when the user already has this Windows font.
// No font download, extraction, redistribution, telemetry or network request.
let ready
export function loadLocalFluentFont() {
  if (!ready) ready = (async () => {
    if (typeof FontFace === 'undefined' || !globalThis.document?.fonts) return false
    try {
      const font = await new FontFace('LocalWinUIFluentIcons', 'local("Segoe Fluent Icons")').load()
      document.fonts.add(font)
      return true
    } catch { return false }
  })()
  return ready
}
