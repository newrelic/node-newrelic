'use strict'

var stringifySafe = require('json-stringify-safe')
var util = require('util')
var Readable = require('readable-stream')
var os = require('os')

var stringify = function(obj){
  try{
    return stringifySafe(obj)
  } catch(err) {
    return '[UNPARSABLE OBJECT]' 
  }
}

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

util.inherits(Logger, Readable)

function Logger(options, extra) {
  if(!(this instanceof Logger)) {
    return new Logger(options, extra)
  }

  Readable.call(this)
  this.name = options.name
  this._level = this.coerce(options.level)
  this.hostname = options.hostname || os.hostname()
  this.extra = extra || {}
  this.buffer = ''
  this.enabled = options.enabled === undefined ? true : options.enabled
  this.reading = false
  if(options.stream){
    this.pipe(options.stream)
  }
}
var loggingFunctions = {}

Object.keys(LEVELS).forEach(function(_level) {
  loggingFunctions[_level] = function checkLevel(extra) {
    var level = Logger.prototype.coerce(LEVELS[_level])

    var has_extra = typeof extra === 'object'
    var args = Array.prototype.slice.call(arguments, has_extra ? 1 : 0)
    this.write(level, args, has_extra ? extra : null)
  }
})

util._extend(Logger.prototype, loggingFunctions)

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
  var child = Object.create(loggingFunctions)

  child.extra = util._extend({}, this.extra)
  util._extend(child.extra, extra)

  var parent = this
  child.write = function(level, args, extra){

    extra = util._extend({}, extra) 
    var selfExtra = util._extend({}, this.extra)

    extra = util._extend(selfExtra, extra)
    return parent.write(level, args, extra)
  }

  child.child = Logger.prototype.child

  return child
}

Logger.prototype.level = function(level) {
  return this._level = this.coerce(level)
}

Logger.prototype._read = function(){
  if(this.buffer.length !== 0){
    this.reading = this.push(this.buffer)
    this.buffer = ''
  } else {
    this.reading = true
  }
}

Logger.prototype.write = function write(level, args, extra) {

  if (!this.enabled) return

  if (level < this._level) {
    return
  }

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

  if(this.reading){
    this.reading = this.push(stringify(entry) + '\n')
  } else {
    this.buffer += stringify(entry) + '\n'
  }
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
