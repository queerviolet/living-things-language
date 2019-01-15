const Unmatched = {}
/**
 * 
 * @param {{ viewBox, paths: {id: string, d: string, style: any}[] }[]} seq 
 * @param {{ viewBox, paths: { [id: string]: {id: string, d: string, style: any} } }} frame 
 */
export default (anim, frame) => {
  // console.log('---', frame.id, '---')
  const incoming = Object.assign({}, frame.paths)

  const frames = Object.values(anim.frames || [])

  const lastFrame = frames[frames.length - 1]
  const lastTracks = lastFrame ? lastFrame.paths : []

  // Map all existing paths to an incoming path
  const nextTracks = lastTracks.map(
    path => {
      if (!path) return Unmatched
      const match = incoming[path.id]
      // console.log('matching', path.id, 'to', match && match.id)
      if (!match) return Unmatched
      delete incoming[path.id]
      return match
    }
  )

  // Incoming only has unmatched paths now.
  const unmatchedIncoming = Object.values(incoming)

  const paths =
    nextTracks
    // Find all nextTracks that are unmatched
    // and match them to incoming tracks, sequentially
    .map(
      track => track !== Unmatched
        ? track
        : unmatchedIncoming.shift() || null
    )
    // And then attach any remaining unmatched incoming tracks
    .concat(unmatchedIncoming)

  // paths.forEach((p, i) => {
    // console.log(`track ${i}:`, p && p.id)
  // })
  const numTracks = Math.max(anim.numTracks || 0, paths.length)
  return {
    numTracks,
    viewBox: frame.viewBox,
    frames: Object.assign({},
      anim.frames,
      {
        [frame.id]: Object.assign({},
          frame,
          {paths}
        )
      }
    )
  }
}
