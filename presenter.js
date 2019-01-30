import marked from 'marked'
import resources from './resources'
import script from './script.json'

class BuildNote {
  static update(note) {
    const e = new BuildNote(findOrCreateById('div', note.id))
    e.update(note)
  }

  constructor(element) {
    this.element = element
    element.className = 'build'
    if (!Object.getOwnPropertyDescriptor(element, 'time'))
      Object.defineProperty(element, 'time', {
        set: time =>
          this.timer.textContent = time && tformat(time)
      })
  }

  get title() {
    return findOrCreateByClass('h1', 'title', this.element)
  }

  get timeEstimate() {
    return findOrCreateByClass('h2', 'time-estimate', this.element)
  }

  get content() {
    return findOrCreateByClass('div', 'note', this.element)
  }

  get timer() {
    return findOrCreateByClass('div', 'timer', this.element)
  }

  update({md, order, id, url, wordCount}) {
    const { element } = this
    this.id = id
    element.id = id
    this.title.textContent = url
    this.timeEstimate.textContent = `${tformat(wordCount * WORD_MS)} — ${wordCount} words`
    this.content.innerHTML = marked(md)
    element.style.order = order
  }
}

const findOrCreateById = (tag, id, container=document.getElementById('script')) => {
  let e = document.getElementById(id)
  if (e) return e
  container.appendChild(e = document.createElement(tag))
  return e
}

const findOrCreateByClass = (tag, className, container) => {
  let e = container.getElementsByClassName(className)[0]
  if (e) return e
  e = document.createElement(tag)
  e.className = className
  container.appendChild(e)
  return e
}

const minutes = m => sec(m * 60)
const sec = s => s * 1000

const WORDS_PER_MIN = 110
const WORD_MS = minutes(1) / WORDS_PER_MIN

const BUILDS = {}
const updateNotes = (notes=script) => {
  const container = document.getElementById('script')  
  container && (container.innerHTML = '')
  let totalWords = 0
  notes.forEach(note => {
    const md = (note.markdown || '').replace(/\n +/g, '\n')
    const wordCount = md.split(/[\s\n]+/g).filter(Boolean).length
    const timeEstimate = wordCount * WORDS_PER_MIN
    Object.assign(note, {md, wordCount, timeEstimate})
    totalWords += wordCount
    BuildNote.update(note)
    BUILDS[note.id] = note
  })
  console.log('Total words:', totalWords, 'words')  
  console.log('Estimated total time:', tformat(totalWords * WORD_MS))
}
window.BUILDS = BUILDS

const updateScroll = (id=localStorage.currentBuild) => {
  const e = document.getElementById(id)
  if (!e) return
  process.nextTick(() => e.scrollIntoView({block: 'start', behavior: 'smooth'}))
  const current = document.querySelector('.build.current')
  current && current.classList.remove('current')
  e.classList.add('current')
}

const init = () => {
  updateNotes()
  Object.entries(localStorage)
    .forEach(([key, newValue]) => update({key, newValue}))
}

function onKey({code}) {
  switch (code) {
    case 'ArrowRight':
    case 'PageDown':
      const { next } = BUILDS[localStorage.currentBuild]
      if (next) {
        localStorage.currentBuild = next
        update({key: 'currentBuild', newValue: next})
      }
      return
    
    case 'ArrowLeft':
    case 'PageUp':
      const { prev } = BUILDS[localStorage.currentBuild]
      if (prev) {
        localStorage.currentBuild = prev
        update({key: 'currentBuild', newValue: prev})
      }
      return
  }
}

function update({key, newValue}) {
  switch (key) {
  case 'currentBuild':
    return updateScroll(newValue)
  }

  if (key.startsWith('time:')) {
    const e = document.getElementById(key.substr(5))
    if (e) e.time = newValue
  }
}

function setup() {
  init()
  addEventListener('storage', update)
  addEventListener('keydown', onKey)
  addEventListener('click', onClick)
  __timer.addEventListener('click', onClickTimer)
  __timer.addEventListener('dblclick', resetTimer)

  onDispose(() => {
    removeEventListener('DOMContentLoaded', init)
    removeEventListener('storage', update)
    removeEventListener('keydown', onKey)
    removeEventListener('click', onClick)
    __timer.removeEventListener('click', onClickTimer)
    __timer.removeEventListener('dblclick', resetTimer)
  })
}

function onClick(e) {
  const build = e.target.closest('.build')
  if (!build) return
  localStorage.currentBuild = build.id
  update({key: 'currentBuild', newValue: build.id})
}

let raf = null
function onClickTimer() {
  if (raf) {
    cancelAnimationFrame(raf)
    __timer.classList.remove('running')
    raf = null
    return
  }
  lastTick = null
  raf = requestAnimationFrame(tick)
}

let lastTick = null
function tick(ts) {
  raf = requestAnimationFrame(tick)
  __timer.classList.add('running')
  if (!lastTick) return lastTick = ts
  const delta = ts - lastTick
  lastTick = ts
  const elapsed = (+localStorage.totalTime || 0) + delta  
  localStorage.totalTime = elapsed
  __timer_display.textContent = tformat(elapsed)
  const buildKey = `time:${localStorage.currentBuild}`
  const buildTime = +localStorage[buildKey] || 0
  localStorage[buildKey] = buildTime + delta
  update({key: buildKey, newValue: buildTime})
  update({key: 'totalTime', newValue: elapsed})
}

const {floor} = Math
const tformat = ms => {
  const sec = +ms / 1000
  const min = sec / 60
  return `${zpad(floor(min))}:${zpad(floor(sec % 60))}`
}

const zpad = (x, count=2) => {
  const str = '' + x
  if (str.length < count) return new Array(count - str.length).fill(0).join('') + str
  return str
}

const resetTimer = () => {
  localStorage.removeItem('totalTime')
  update({key: 'totalTime'})
  __timer_display.textContent = ''
  Object.keys(localStorage)
    .filter(k => k.startsWith('time:'))
    .forEach(key => {
      localStorage.removeItem(key)
      update({key})
    })
}

global.resetTimer = resetTimer

function onDispose(run) {
  module.hot && module.hot.dispose(run)
}

setup()