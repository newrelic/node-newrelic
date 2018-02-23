'use strict'

var arrayUtil = require('../util/arrays')
var logger = require('../logger.js').child({component: 'name-state'})
var NAMES = require('../metrics/names')

// TODO: Figure out a way to phase out legacy transaction names.
var LEGACY_NAMING = {
  Custom: true,

  Connect: true,
  Director: true,
  Expressjs: true,
  Hapi: true,
  Nodejs: true,
  Restify: true
}


/**
 * Manages transaction names using a stack of paths.
 *
 * @constructor
 */
function NameState(prefix, verb, delimiter, path) {
  this.reset()
  this.setName(prefix, verb, delimiter, path)
  this._frozen = false
}

NameState.prototype.setName = function setName(prefix, verb, delimiter, path) {
  if (this._frozen) {
    return
  }

  this.setPrefix(prefix)
  this.verb = verb && verb.toUpperCase()
  this.delimiter = delimiter
  this.pathStack = path ? [{path: path, params: null}] : []
  this._pathCache = null
  this.markedPath = []
  logger.trace('setName called on name state, path stack now %j', this.pathStack)
}

NameState.prototype.markPath = function markPath() {
  this.markedPath = this.pathStack.slice()
}

/**
 * Sets the metric prefix (i.e. Expressjs).
 */
NameState.prototype.setPrefix = function setPrefix(prefix) {
  if (this._frozen) {
    return
  }

  if (prefix === null) {
    this.prefix = null
    return
  }
  this.prefix = (prefix[prefix.length - 1] === '/') ?
    prefix.substring(0, prefix.length - 1) : prefix
}

/**
 * Sets the HTTP verb (i.e. GET/POST/PUT)
 */
NameState.prototype.setVerb = function setVerb(verb) {
  if (!this._frozen) {
    this.verb = verb && verb.toUpperCase()
  }
}

/**
 * Sets the delimiter character used to separate the http verb from the path.
 */
NameState.prototype.setDelimiter = function setDelimiter(delimiter) {
  if (!this._frozen) {
    this.delimiter = delimiter
  }
}

NameState.prototype.isEmpty = function isEmpty() {
  return this.pathStack.length === 0 && this.markedPath.length === 0
}

/**
 * Pushes a new path element onto the naming stack.
 */
NameState.prototype.appendPath = function appendPath(path, params) {
  if (!this._frozen && path != null) {
    var strPath = path instanceof RegExp ? path.source : String(path)
    this.pathStack.push({path: strPath, params: params || null})

    if (path !== '') {
      this._pathCache = null
    }
    logger.trace('Appended %s to path stack', strPath)
  }
}

/**
 * Pushes a new path element onto the naming stack if the stack is
 * empty.
 */
NameState.prototype.appendPathIfEmpty = function appendPathIfEmpty(path, params) {
  if (!this._frozen && this.isEmpty()) {
    return this.appendPath(path, params || null)
  }
}

/**
 * Pops the last element off the name stack.
 *
 * If `path` is provided, the stack is popped back to the first element matching
 * `path`. If no element matches, the stack is left unchanged.
 *
 * @param {string} [path] - Optional. A path piece to pop back to.
 */
NameState.prototype.popPath = function popPath(path) {
  if (this._frozen || this.pathStack.length === 0) {
    return
  }

  this._pathCache = null
  var pops = 0
  if (path != null) {
    var idx = arrayUtil.findLastIndex(this.pathStack, function pathMatch(a) {
      return a.path === path
    })
    if (idx !== -1) {
      pops = this.pathStack.length - idx
      this.pathStack.splice(idx)
    }
  } else {
    pops = 1
    this.pathStack.pop()
  }
  logger.trace('Popped %j from path, %d removed', path, pops)
}

NameState.prototype.getPath = function getPath() {
  var ps = !this.pathStack.length ? this.markedPath : this.pathStack
  var psLength = ps.length
  if (this._pathCache) {
    return this._pathCache
  } else if (psLength === 0) {
    return null // nameState initialized but never set
  }

  var path = '/'
  for (var i = 0; i < psLength; ++i) {
    var a = ps[i].path
    if (a && a !== '/') {
      if (a[0] !== '/' && path[path.length - 1] !== '/') {
        path += '/'
      } else if (a[0] === '/' && path[path.length - 1] === '/') {
        a = a.substr(1)
      }
      path += a
    }
  }

  return this._pathCache = path
}

NameState.prototype.getNameNotFound = function getNameNotFound() {
  var name = _getName(this, '(not found)')
  if (LEGACY_NAMING.hasOwnProperty(this.prefix)) {
    return name
  }
  return NAMES.WEB.FRAMEWORK_PREFIX + '/' + name
}

NameState.prototype.getName = function getName() {
  var path = this.getPath()
  if (path === null) {
    return null
  }

  return _getName(this, path)
}

NameState.prototype.getFullName = function getFullName() {
  var name = this.getName()
  if (LEGACY_NAMING.hasOwnProperty(this.prefix)) {
    return name
  }
  return NAMES.WEB.FRAMEWORK_PREFIX + '/' + name
}

NameState.prototype.forEachParams = function forEachParams(fn, ctx) {
  this.pathStack.forEach(function forEachPathStack(a) {
    if (a.params) {
      fn.call(ctx, a.params)
    }
  })
}

/**
 * Locks the name state, preventing future changes from taking effect.
 */
NameState.prototype.freeze = function freeze() {
  this._frozen = true
}

NameState.prototype.reset = function reset() {
  if (this._frozen) {
    return
  }

  logger.trace('Reset called on name state, path stack was %j', this.pathStack)
  this.prefix = null
  this.verb = null
  this.delimiter = null
  this.pathStack = []
  this._pathCache = null
}

function _getName(nameState, path) {
  var verb = nameState.verb ? '/' + nameState.verb : ''
  return (nameState.prefix || '') + verb + (nameState.delimiter || '') + path
}

module.exports = NameState
