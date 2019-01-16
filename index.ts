// @ts-ignore
import script from './script.json'

import { TimelineMax, TweenLite } from 'gsap/TweenMax'
import MorphSVG from './gsap/MorphSVGPlugin'
import toSequence from './to-sequence.js';
console.log('Loaded', MorphSVG)

declare const svg: SVGSVGElement

const tl = new TimelineMax
;(window as any).tl = tl

function buildTimeline() {
  const { numTracks, frames } = script.reduce(toSequence, {})
  const layers = Array.from({ length: numTracks }, (_, i) => pathWithId(`layer_${i}`))
 
  script.forEach(build => {
    const frame = frames[build.id]
    const paths = frame ? frame.paths : []
    const tweens = Array.from({ length: numTracks }, (_, i) => {
        const tween = new TweenLite.to(
          layers[i], 1,
          paths[i] && paths[i].tween ? paths[i].tween : CIRCLE)
        return tween
      })
    tl.addLabel(`build-in:${build.id}`)
    tl.add(tweens)
    tl.addLabel(build.id)
    
    if (build.data.html) {
      const el = document.createElement('div')
      el.className = 'slide'
      el.innerHTML = build.data.html
      build.element = el
      document.body.appendChild(el)
    }

    build.willExit = () =>
      build.element && build.element.classList.remove('active')    

    build.willEnter = () => {
      const frame = frames[build.id]
      const paths = frame ? frame.paths : []
      let i = paths.length; while (i --> 0) {
        layers[i].setAttribute('class', (paths[i] && paths[i].class) ? paths[i].class : '')
        layers[i].dataset.name = paths[i] && paths[i].id
      }
      document.body.className = `${build.class} ${build.data.class || ' '}`      
      build.element && build.element.classList.add('active')
    }
  })
  tl.pause()
}

const CIRCLE = {
  morphSVG: `M 1920,1080 L1920,1079 L1921,1079 L1921,1081 Z`,
  fill: 'rgba(255, 255, 255, 0)',
  stroke: 'rgba(255, 255, 255, 0)',
}

function pathWithId(id: string) {
  const p = document.getElementById(id)
  if (p) return p
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.id = id
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
    script.forEach(b => b.id !== id && b.willExit())
    builds[id].willEnter()
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

buildTimeline()
animateFloaties()
setupNavigation()

function onDispose(run) {
  ;(module as any).hot && (module as any).hot.dispose(run)
}