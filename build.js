const yaml = require('js-yaml')
const { promisify } = require('util')
const { readFile, writeFile } = require('fs')
const read = promisify(readFile)
    , write = promisify(writeFile)

async function main() {
  const script = yaml.safeLoad(await read('./index.yaml'))
  const output = await buildSvgLayers(linkBuilds(getBuilds(script)))
  await write('script.json', JSON.stringify(output, null, 2))
  await write('resources.js', extractResources(output))
}

const getBuilds = (script, path=[]) =>
  Object.keys(script)
    .filter(isCapitalized)
    .map(key => {
      const self = [...path, key.replace(/\s/g, '_').toLowerCase()]
      data = script[key]
      const first = {
        id: self.join('/'),
        url: self.join('/'),
        class: self.join('-'),
        markdown: data.note,
        data,
      }
      return [first, ...getBuilds(data, self)]
    })
    .reduce((all, one) => all.concat(one), [])

function extractResources(builds) {
  const entries = builds
    .reduce((all, b) => {
      const {img, video} = b.data
      if (!img && !video) return all
      const r = []
      img &&
        r.push({
          key: img,
          path: `./res/${img}`
        })
      video &&
      r.push({
        key: video,
        path: `./res/${video}`
      })
      return [...all, ...r]
    }, [])
  const imports = entries
    .map(({_key, path}, i) =>
      `import res${i} from ${JSON.stringify(path)}`
    ).join('\n')
  const exports = `export default {
    ${
      entries
        .map(({key, _value}, i) =>
          `${JSON.stringify(key)}: res${i}`
        )
        .join(',')
    }
  }`

  return [imports, exports].join('\n')
}

function linkBuilds(builds) {
  let i = builds.length; while (i --> 0) {
    const next = builds[i + 1]
    const prev = builds[i - 1]
    const self = builds[i]
    self.next = next && next.id
    self.prev = prev && prev.id
    self.index = i
  }
  return builds
}

const isCapitalized = ([first]) => first.toUpperCase() === first


///////// SVG Processing ////////

async function buildSvgLayers(builds) {
  await Promise.all(builds.map(async b => {
    if (!b.data.frame) return
    const xml = await parseXml(await read(`./art/${b.data.frame}.svg`, 'utf8'))
    b.paths = b.data.ungrouped
      ? layersFromUngrouped(xml, b.data.simplify)
      : layersFromGrouped(xml, b.data.simplify)
  }))
  return builds
}

const XmlReader = require('xml-reader')
const parseXml = src => new Promise(
  (resolve, reject) => {
    const r = XmlReader.create()
    r.on('error', reject)
    r.on('done', resolve)
    r.parse(src)
  }
)

const query = require('xml-query')
const simplify = require('simplify-path')
// const mesh = require('svg-mesh-3d')
// const triangulate = require('triangulate-contours')
// const reindex = require('mesh-reindex')
// const unindex = require('unindex-mesh')

const layersFromGrouped = (xml, thresholds=4) => {
  const layers = {}
  query(xml).find('g').each((g, zIndex) => {
    const path = query(g).find('path')
    if (!path) return
    const id = (g.attributes['vectornator:layerName'] || g.attributes.id).replace(/\s/g, '_')
    const threshold = +thresholds[id] || +thresholds || undefined
    const d = toSvgPath(convertToPolylines(path.attr('d'), threshold))
    layers[id] = {
      id,
      zIndex,
      class: path.attr('class'),
      // mesh: denormPts(reindex(unindex(mesh(path.attr('d'), { simplify: 10 })))),      
      tween: {
        morphSVG: d,
        fill: path.attr('fill'),
        stroke: path.attr('stroke'),
        'fill-opacity': path.attr('fill-opacity'),
        'stroke-width': path.attr('stroke-width'),
      }
    }
  })
  return layers
}

const layersFromUngrouped = (xml, thresholds=4) => {
  const layers = {}
  query(xml).find('path').each((path, zIndex) => {
    const id = path.attributes.id || zIndex
    const threshold = +thresholds[id] || +thresholds || undefined
    const d = toSvgPath(convertToPolylines(path.attributes.d, threshold))
    layers[id] = {
      id,
      zIndex,
      class: path.attributes.class,
      // mesh: denormPts(reindex(unindex(mesh(path.attributes.d'), { simplify: 10 })))),    
      tween: {
        morphSVG: d,
        fill: path.attributes.fill,
        stroke: path.attributes.stroke,
        'fill-opacity': path.attributes['fill-opacity'],
        'stroke-width': path.attributes['stroke-width'],
      }
    }
  })
  return layers
}


const toSvgPath = paths =>
  paths.map(points =>
    `M${points
      .map(p => p.join(' '))
      .join('L')}Z`)
    .join('')
const parsePath = require('parse-svg-path')
const contours = require('svg-path-contours')
const convertToPolylines = (d, threshold=4) =>
  contours(parsePath(d)).map(path => simplify(path, threshold))

if (module === require.main) main()
