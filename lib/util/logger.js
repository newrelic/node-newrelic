'use strict'

var stringify = require('json-stringify-safe')
var util = require('util')
var os = require('os')

module.exports = Logger

var LEVELS = {
  'trace': 10,
  'debug': 20,
  'info': 30,
  'warn': 40,
  'error': 50,
  'fatal': 60
}

var json_replace = /([^%]|^)((?:%%)*)%j/g

function Logger(options, extra) {
  if(!(this instanceof Logger)) {
    return new Logger(options, extra)
  }
  this.name = options.name
  this._level = this.coerce(options.level)
  this.hostname = options.hostname || os.hostname()
  this.extra = extra || {}
  this.stream = options.stream
  this.state = {
    queue: '',
    queued: false
  }
}

Object.keys(LEVELS).forEach(function(_level) {
  Logger.prototype[_level] = function checkLevel(extra) {
    var level = this.coerce(LEVELS[_level])

    if(level < this._level) {
      return
    }

    var has_extra = typeof extra === 'object'
    var args = Array.prototype.slice.call(arguments, has_extra ? 1 : 0)
    this.write(level, args, has_extra ? extra : null)
  }
})

Logger.prototype.coerce = function coerce(value) {
  if (!isNaN(parseInt(value, 10)) && isFinite(value)) {
    // value is numeric
    if (value < 10) value = 10
    if (value > 60) value = 60

    return value
  }

  return LEVELS[value] || 10
}

Logger.prototype.child = function child(extra) {
  var child = Object.create(this)
  child.extra = util._extend({}, this.extra)
  child.extra = util._extend(child.extra, extra)

  return child
}

Logger.prototype.level = function(level) {
  return this._level = this.coerce(level)
}

Logger.prototype.write = function write(level, args, extra) {
  for(var i = 0, l = args.length; i < l; ++i) {
    if(typeof args[i] === 'function') {
      args[i] = args[i].valueOf()
    } else if(typeof args[i] === 'object') {
      args[i] = stringify(args[i])
    }
  }

  // for performance reasons we do not support %j since we are already
  // converting objects to strings
  /*if(typeof args[0] === 'string') {
    args[0] = args[0].replace(json_replace, '$1$2%s')
  }*/

  var entry = new Entry(this, level, util.format.apply(util, args))

  util._extend(entry, this.extra)
  util._extend(entry, extra)

  this.queueLine(stringify(entry))
}

Logger.prototype.queueLine = function queueLine(line) {
  this.state.queue += line + '\n'

  if(!this.state.queued) {
    this.writeQueuedData()
  }
}

Logger.prototype.writeQueuedData = function writeQueuedData() {
  var logger = this
  var chunk = logger.state.queue

  logger.state.queue = ''
  logger.state.queued = !logger.stream.write(chunk)

  if(!logger.state.queued) {
    return
  }

  logger.stream.once('drain', function() {
    if(logger.state.queue) {
      logger.writeQueuedData()
    } else {
      logger.state.queued = false
    }
  })
}

function Entry(logger, level, msg) {
  this.v = 0
  this.level = level
  this.name = logger.name
  this.hostname = logger.hostname
  this.pid = process.pid
  this.time = new Date().toISOString()
  this.msg = msg
}
