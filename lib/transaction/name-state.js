'use strict'
var logger = require('../logger.js').child({component: 'name-state'})

function NameState(prefix, verb, delimiter, path) {
  this.setName(prefix, verb, delimiter, path)
}

NameState.prototype.setName = function setName(prefix, verb, delimiter, path) {
  this.setPrefix(prefix)
  this.verb = verb
  this.delimiter = delimiter
  this.pathStack = path ? [path] : []
  logger.trace('setName called on name state, path stack now %j', this.pathStack)
}
NameState.prototype.setPrefix = function setPrefix(prefix) {
  if (prefix === null) {
    this.prefix = null
    return
  }
  this.prefix = (prefix[prefix.length - 1] === '/') ?
    prefix.substring(0, prefix.length - 1) : prefix
}
NameState.prototype.setVerb = function setVerb(verb) {
  this.verb = verb
}
NameState.prototype.setDelimiter = function setDelimiter(delimiter) {
  this.delimiter = delimiter
}
NameState.prototype.appendPath = function appendPath(path) {
  if (path) {
    var strPath = path instanceof RegExp ? path.source : String(path)
    this.pathStack.push(strPath)
    logger.trace('Appended %s to path stack', strPath)
  }
}

NameState.prototype.getName = function getName() {
  if (this.pathStack.length === 0) return null // nameState initialized but never set

  var path = this.pathStack.join('/').replace(/[/]{2,}/g, '/')
  if (path && path[0] !== '/') {
    path = '/' + path
  } // path now looks like /one/two/three

  var verb = this.verb ? '/' + this.verb : ''

  return (this.prefix || '') + verb + (this.delimiter || '') + path
}

NameState.prototype.reset = function reset() {
  logger.trace('Reset called on name state, path stack was %j', this.pathStack)
  this.prefix = null
  this.verb = null
  this.delimiter = null
  this.pathStack = []
}

module.exports = NameState
