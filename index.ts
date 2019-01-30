// @ts-ignore
import script from './script.json'
localStorage.buildNotes = notesFrom(script)

import { TimelineMax, TweenLite } from 'gsap/TweenMax'
import AttrPlugin from 'gsap/AttrPlugin'
import MorphSVG from './gsap/MorphSVGPlugin'
import toSequence from './to-sequence.js'
console.log('Loaded', MorphSVG, AttrPlugin)


import resources from './resources'

declare const svg: SVGSVGElement

const tl = new TimelineMax
;(window as any).tl = tl
;(window as any).resources = resources
;(window as any).builds = script

function createElements() {
  for (const b of script) {
    const {class: className='', html, htmlFunc, img, video, zIndex=0, startAt=0} = b.data
    if (!html && !htmlFunc && !img && !video && !className) continue
    const el = document.createElement('div')
    el.id = b.class
    el.className = `slide ${className}`
    b.element = el
    el.style.zIndex = zIndex

    if (html) el.innerHTML = html
    if (htmlFunc) el.innerHTML += eval(htmlFunc)(b, resources)
    
    if (img)
      el.style.backgroundImage = `url(${resources[img]})`  

    if (video) {
      const vid = document.createElement('video')
      vid.src = resources[video]
      vid.volume = 0
      el.prepend(vid)
      b.didEnter = () => {
        vid.currentTime = startAt
        vid.play()
      }
    }
  }
  onDispose(() => script.forEach(b =>
    b.element &&
    b.element.parentNode &&
    b.element.parentNode.removeChild(b.element)))
}

function buildTimeline() {
  const { numTracks, frames } = script.reduce(toSequence, {})
  ;(window as any).frames = frames
  const layers = Array.from({ length: numTracks }, (_, i) => layerForTrack(i))
 
  let lastBuildWithFramesId = null
  script.forEach(build => {
    const frame = frames[build.id]
    const paths = frame.paths    
    if (!paths.find(Boolean) && build.id.startsWith(lastBuildWithFramesId)) {
      tl.addLabel(`build-in:${build.id}`)
      tl.addLabel(build.id)
    } else {
      const tweens = Array.from({ length: numTracks }, (_, i) => {
          const tween = new TweenLite.to(
            layers[i], build.data.tweenDuration || 1,
            paths[i] && paths[i].tween ? paths[i].tween : CIRCLE)
          return tween
        })
      tl.addLabel(`build-in:${build.id}`)
      tl.addCallback(() => {
        console.log('build in', build.id)
        const sorted = [...layers].sort(
          (a, b) => {
            const za = (a && paths[a.index]) ? paths[a.index].zIndex : 0
            const zb = (b && paths[b.index]) ? paths[b.index].zIndex : 0
            return za - zb
          }
        )
        sorted.forEach(layer =>
          layer && layer.parentElement.appendChild(layer))
      })
      tl.add(tweens)
      tl.addLabel(build.id)
      lastBuildWithFramesId = build.id
    }
    
    build.didEnter = compose(build.didEnter, () => {
      const frame = frames[build.id]
      const paths = frame ? frame.paths : []
      let i = paths.length; while (i --> 0) {
        layers[i].setAttribute('class', (paths[i] && paths[i].class) ? paths[i].class : '')
        layers[i].dataset.name = paths[i] && paths[i].id
      }
    })

    setBuildState(build, 'inactive')
  })
  tl.pause()
}

type BuildState = 'active' | 'staged' | 'was-active' | 'inactive'
const STATES: BuildState[] = ['active', 'staged', 'was-active', 'inactive']

const setBuildState = (build, state: BuildState) => {
  if (!build) return
  const { element } = build
  setBuildClass(element, state)
  build.state = state
  switch (state) {
    case 'active':
      document.body.className = `${build.class} ${build.data.bg || ''}`
      return build.didEnter && build.didEnter()
    case 'staged':
      return build.willEnter && build.willEnter()
    case 'was-active':
      return build.didExit && build.didExit()
    case 'inactive':
      return build.didSleep && build.didSleep()
  }
}

const setBuildClass = (element: HTMLElement, state: BuildState) => {
  if (!element) return
  STATES.forEach(state => element.classList.remove(state))
  element.classList.add(state)
  if (state === 'inactive') {
    element.parentNode && element.parentNode.removeChild(element)
  } else {
    element.parentNode || document.body.appendChild(element)
  }
}

const compose = (...funcs: Function[]) => (...args) => {
  for (const f of funcs.filter(Boolean)) {
    args = [f.apply(null, args)]
  }
  return args[0]
}

const CIRCLE = {
  morphSVG: `M 1920,1080 L1920,1079 L1921,1079 L1921,1081 Z`,
  fill: '#000000',
  stroke: '#000000',
  opacity: 0,
  'fill-opacity': 0,
  'stroke-opacity': 0,
  'stroke-width': 1,
}

interface IndexedLayer extends SVGPathElement {
  index?: number
}

const isIndexedLayer =
  (e: any): e is IndexedLayer =>
    e instanceof SVGPathElement

function layerForTrack(i: number): IndexedLayer {
  const id = `layer_${i}`
  const p = document.getElementById(id)
  if (isIndexedLayer(p)) return p
  const path: IndexedLayer = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.id = id
  path.index = i
  path.dataset.index = String(i)
  svg.appendChild(path)
  Object.keys(CIRCLE).forEach(k =>
    k !== 'morphSVG' && path.setAttribute(k, CIRCLE[k]))
  path.setAttribute('d', CIRCLE.morphSVG)
  return path
}

function animateFloaties() {
  const floater = (name='float1', yBias=-1) => () => {
    // const rotation = (Math.PI / 10) * Math.random() - (Math.PI / 5)
    const x = 30 * Math.random(), y = yBias * 30 * Math.random()
    yBias = -yBias
    // document.body.style.setProperty(`--${name}-rotation`, String(rotation))
    document.body.style.setProperty(`--${name}-x`, String(x))
    document.body.style.setProperty(`--${name}-y`, String(y))
  }
  floater('float1')()
  floater('float2', 1)()
  const i0 = setInterval(floater('float1'), 3000)
  const i1 = setInterval(floater('float2', 1), 3000)
  onDispose(() => {
    clearInterval(i0)
    clearInterval(i1)
  })
}

function setupNavigation() {
  const builds = script.reduce((byId, build) => {
    byId[build.id] = build
    return byId
  }, {})

  const current = () => decodeURIComponent(location.hash.slice(1))
  
  let currentBuildIndex = -Infinity
  let currentTween = null
  addEventListener('hashchange', onHashChange)
  addEventListener('keydown', onKeyDown)
  addEventListener('storage', onStorage)
  onHashChange()

  onDispose(() => {
    removeEventListener('hashchange', onHashChange)
    removeEventListener('keydown', onKeyDown)
    removeEventListener('storage', onStorage)
  })

  function onHashChange() {
    const id = current()
    if (!builds[id]) {
      location.hash = script[0].id
      return
    }
    const nextBuildIndex = builds[id].index
    const delta = nextBuildIndex - currentBuildIndex
    script.forEach(b => {
      if (!id.startsWith(b.id)) {
        switch (b.state) {
        case 'was-active':
          setBuildState(b, 'inactive')
          break
        case 'active':
          setBuildState(b, 'was-active')
          break
        case 'staged':
          setBuildState(b, 'inactive')
          break
        }
      } else {
        setBuildState(b, 'active')
      }
    })
    setBuildState(builds[builds[id].next], 'staged')
    if (Math.abs(delta) > 1) {
      if (currentTween) currentTween.kill()
      currentTween =
        (delta > 1
          ? tl.tweenFromTo(`build-in:${id}`, id)
          : tl.tweenFromTo(id, `build-in:${script[nextBuildIndex + 1].id}`))
        .eventCallback('onComplete', () => {
          currentBuildIndex = nextBuildIndex
          currentTween = null
        })
    } else {      
      currentTween = tl.tweenTo(id)
        .eventCallback('onComplete', () => {
          currentBuildIndex = nextBuildIndex
          currentTween = null
        })
    }
  }

  function onStorage() {
    location.hash = localStorage.currentBuild
  }

  function onKeyDown(e) {
    const build = builds[current()]
    switch (e.key) {
    case 'ArrowRight':
    case 'ArrowDown':
    case 'PageDown':
      if (!build.next) {
        console.log('already at end of presentation')
        return
      }
      location.hash = build.next
      localStorage.currentBuild = build.next
      break

    case 'ArrowLeft':
    case 'ArrowUp':
    case 'PageUp':
      if (!build.prev) {
        console.log('already at start of presentation')
        return
      }
      location.hash = build.prev
      localStorage.currentBuild = build.prev
      break
    }
  }
}

import letterbox from './letterbox'
function setupWindowSize() {
  function onResize() {
    const box =
      letterbox(16 / 9, {width: innerWidth, height: innerHeight})
    Object.keys(box).forEach(k => 
      document.body.style.setProperty(`--letterbox-${k}`, px(box[k]))
    )
  }
  window.addEventListener('resize', onResize)
  onResize()
  onDispose(() => window.removeEventListener('resize', onResize))
}

const px = (px: number) => `${px}px`

setupWindowSize()
createElements()
buildTimeline()
animateFloaties()
setupNavigation()

function notesFrom(script: any) {
  return JSON.stringify(
    script.map((build, order) => ({
      id: build.id,
      url: build.url,
      markdown: build.markdown,
      order,
    }))
  )
}

function onDispose(run) {
  ;(module as any).hot && (module as any).hot.dispose(run)
}