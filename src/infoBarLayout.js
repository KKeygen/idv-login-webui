// InfoBarPanel.cpp uses vertical layout for a single item, overflow, or a tall item.
export function infoBarIsVertical(width, widths, heights, minHeight = 48) {
  const items = widths.map((value, index) => ({ width: value, height: heights[index] || 0, index })).filter(item => item.width > 0 && item.height > 0)
  const total = items.reduce((sum, item, index) => sum + item.width + (index ? item.index === 2 ? 16 : 12 : 0), 0)
  return items.length === 1 || total > width || items.some(item => item.height + (item.index === 2 ? 8 : 14) > minHeight)
}
