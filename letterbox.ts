type Size = {width: number, height: number}
type Position = {top: number, left: number, bottom: number, right: number}
type Box = Position & Size

// aspect = width / height
// width = aspect * height
// height = width / aspect
export default (aspect: number, container: Size): Box => {
  const containerAspect = container.width / container.height
  if (containerAspect > aspect) {
    // Container is flatter than content, lock to container
    // height and letterbox on left and right
    const width = aspect * container.height
    const left = (container.width - width) / 2
    const height = container.height
    const top = 0
    return {
      width,
      height,
      top,
      left,
      bottom: container.height - (top + height),
      right: container.width - (left + width),
    }
  }
  // Container is taller than content, lock to container
  // width and letterbox on top and bottom
  const height = container.width / aspect
  const top = (container.height - height) / 2
  const width = container.width
  const left = 0
  return {
    width,
    height,
    top,
    left,
    bottom: container.height - (top + height),
    right: container.width - (left + width),
  }
}