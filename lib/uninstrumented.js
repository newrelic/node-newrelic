'use strict'

var path = require('path')
var logger = require('./logger')
var NAMES = require('./metrics/names')
var INSTRUMENTATIONS = Object.keys(require('./instrumentations')())
var properties = require('./util/properties')


// TODO: This should iterate over the registered instrumentations in the shimmer.
//  As long as this file is executed after `bootstrapInstrumentation` is called
//  the shimmer should have a complete list of all instrumentation names we
//  hook into.


module.exports = {
  check: check,
  createMetrics: createMetrics
}


// Special case since we do some hackish stuff in lib/shimmer.js to make pg.js,
// and mysql2 work.
INSTRUMENTATIONS.push('pg.js', 'mysql2')

// Static variable holding list of un-instrumented modules for use in the future
var uninstrumented = []

// Log a helpful message about un-instrumented modules
function logUninstrumented() {
  if (uninstrumented.length > 0) {
    var message =
      'The newrelic module must be the first module required.\n' +
      'The following modules were required before newrelic and are not being ' +
      'instrumented:'

    uninstrumented.forEach(function buildMessage(module) {
      message += '\n\t' + module.name + ': ' + module.filename
    })

    logger.warn(message)
  }
}

// Create Supportability/Uninstrumented/<module> metrics
//
// @param metrics Agent metrics aggregator
function createMetrics(metrics) {
  if (uninstrumented.length > 0) {
    metrics.getOrCreateMetric(NAMES.SUPPORTABILITY.UNINSTRUMENTED).incrementCallCount()
  }

  uninstrumented.forEach(function addMetrics(module) {
    metrics.getOrCreateMetric(
      NAMES.SUPPORTABILITY.UNINSTRUMENTED + '/' + module.name
    ).incrementCallCount()
  })
}

// Determine module name from filename of module's main script
//
// Heuristic: take the first path name that isn't 'index.js' or 'lib'.
//
// @param filename Filename of module's main script
// @return Name of module
function moduleNameFromFilename(filename) {
  var name = path.basename(filename, '.js')
  var paths = path.dirname(filename).split(path.sep)

  const moduleIdx = paths.lastIndexOf('node_modules') + 1
  const moduleName = paths[moduleIdx]
  let main = name
  try {
    const pkg = require(paths.slice(0, moduleIdx + 1).join('/') + '/package.json')
    main = pkg.main || 'index.js'
  } catch (e) {}

  if (filename.indexOf(main.slice(2)) !== -1) {
    return moduleName
  }

  return null
}

// Check for any instrument-able modules that have already been loaded. This does
// not check core modules as we don't have access to the core module loader
// cache. But, users probably are missing instrumentation for other modules if
// they are missing instrumentation for core modules.
function check() {
  for (var filename in require.cache) {
    if (!properties.hasOwn(require.cache, filename)) {
      continue
    }
    var name = moduleNameFromFilename(filename)

    if (name && INSTRUMENTATIONS.indexOf(name) !== -1) {
      uninstrumented.push({name: name, filename: filename})
    }
  }

  logUninstrumented()
}
