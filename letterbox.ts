type Size = {width: number, height: number}
type Position = {top: number, left: number}
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
    return {
      width,
      height: container.height,
      top: 0,
      left: (container.width - width) / 2,
    }
  }
  // Container is taller than content, lock to container
  // width and letterbox on top and bottom
  const height = container.width / aspect
  return {
    width: container.width,
    height,
    top: (container.height - height) / 2,
    left: 0,
  }
}