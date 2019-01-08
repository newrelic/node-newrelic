'use strict'

var stringify = require('json-stringify-safe')
var util = require('util')
var Readable = require('readable-stream')
var os = require('os')

module.exports = Logger

const LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60
}

// The maximum string length in V8 was somewhere around 256M characters for a
// long time. Note that is characters, not bytes. This limit was upped to around
// 1G characters sometime during Node 8's lifetime (before 8.3.0 I believe).
// Using 128M characters as limit to keep the logger well away from the limit
// and not balloon host machine's memory.
const MAX_LOG_BUFFER = 1024 * 1024 * 128 // 128M characters

util.inherits(Logger, Readable)

function Logger(options, extra) {
  if (!(this instanceof Logger)) {
    return new Logger(options, extra)
  }

  Readable.call(this)
  var passedInLevel = this.coerce(options.level)
  this.options = {
    _level: passedInLevel,
    enabled: options.enabled === undefined ? true : options.enabled
  }
  this._nestedLog = false
  this.name = options.name
  this.hostname = options.hostname || os.hostname()
  this.extra = extra || Object.create(null)
  this.buffer = ''
  this.reading = false
  if (options.stream) {
    this.pipe(options.stream)
  }
}
Logger.MAX_LOG_BUFFER = MAX_LOG_BUFFER

Logger.prototype.coerce = function coerce(value) {
  if (!isNaN(parseInt(value, 10)) && isFinite(value)) {
    // value is numeric
    if (value < 10) value = 10
    if (value > 60) value = 60

    return value
  }
  return LEVELS[value] || 50
}

var loggingFunctions = Object.create(null)

Object.keys(LEVELS).forEach(function buildLevel(_level) {
  var level = Logger.prototype.coerce(LEVELS[_level])

  function log(extra) {
    if (!this.options.enabled) return false
    if (level < this.options._level) return false

    var has_extra = typeof extra === 'object'
    var args = Array.prototype.slice.call(arguments, has_extra ? 1 : 0)
    return this.write(level, args, has_extra ? extra : null)
  }

  loggingFunctions[_level] = function checkLevel() {
    log.apply(this, arguments)
  }

  var seenMessages = Object.create(null)
  loggingFunctions[_level + 'Once'] = function logOnce(key) {
    if (typeof key !== 'string') {
      this.debug('Attempted to key on a non-string in ' + _level + 'Once: ' + key)
      return
    }

    if (!this.options.enabled) return false
    if (level < this.options._level) return false

    if (seenMessages[key] !== true) {
      var args = Array.prototype.slice.call(arguments, 1)
      var writeSuccessful = log.apply(this, args)

      if (writeSuccessful) {
        seenMessages[key] = true
      }
    }
  }

  var seenPerInterval = Object.create(null)
  loggingFunctions[_level + 'OncePer'] = function logOncePer(key, interval) {
    if (typeof key !== 'string') {
      this.debug('Attempted to key on a non-string in ' + _level + 'Once: ' + key)
      return
    }

    if (!this.options.enabled) return false
    if (level < this.options._level) return false

    if (seenPerInterval[key] !== true) {
      var args = Array.prototype.slice.call(arguments, 2)
      var writeSuccessful = log.apply(this, args)

      if (writeSuccessful) {
        seenPerInterval[key] = true

        var clearSeen = setTimeout(function clearKey() {
          delete seenPerInterval[key]
        }, interval)

        clearSeen.unref()
      }
    }
  }

  loggingFunctions[_level + 'Enabled'] = function levelEnabled() {
    return level >= this.options._level
  }
})

Object.assign(Logger.prototype, loggingFunctions)

Logger.prototype.child = function child(extra) {
  var childLogger = Object.create(loggingFunctions)

  childLogger.extra = Object.assign(Object.create(null), this.extra, extra)

  var parent = this
  childLogger.options = parent.options

  childLogger.write = function write(level, args, _extra) {
    _extra = getPropertiesToLog(_extra)
    _extra = Object.assign(Object.create(null), this.extra, _extra)

    return parent.write(level, args, _extra)
  }

  childLogger.setEnabled = Logger.prototype.setEnabled
  childLogger.child = Logger.prototype.child

  return childLogger
}

Logger.prototype.level = function level(lvl) {
  this.options._level = this.coerce(lvl)
}

Logger.prototype.setEnabled = function setEnabled(enabled) {
  if (typeof enabled === 'boolean') {
    this.options.enabled = enabled
  }
}

Logger.prototype._read = function _read() {
  if (this.buffer.length !== 0) {
    this.reading = this.push(this.buffer)
    this.buffer = ''
  } else {
    this.reading = true
  }
}

/**
 * For performance reasons we do not support %j because we will have
 * already converted the objects to strings.
 * Returns a boolean representing the status of the write
 * (success/failure)
 */
Logger.prototype.write = function write(level, args, extra) {
  if (this._nestedLog) {
    // This log is downstream of another log call and should be ignored
    return
  }
  this._nestedLog = true
  for (var i = 0, l = args.length; i < l; ++i) {
    if (typeof args[i] === 'function') {
      args[i] = args[i].valueOf()
    } else if (typeof args[i] === 'object') {
      try {
        args[i] = stringify(args[i])
      } catch (err) { // eslint-disable-line no-unused-vars
        this.debug('Failed to stringfy object for log')
        args[i] = '[UNPARSABLE OBJECT]'
      }
    }
  }

  var entry = new Entry(this, level, util.format.apply(util, args))

  Object.assign(entry, this.extra, getPropertiesToLog(extra))

  var data = ''
  try {
    data = stringify(entry) + '\n'
  } catch (err) { // eslint-disable-line no-unused-vars
    this.debug('Unabled to stringify log message')
  }

  if (this.reading) {
    this.reading = this.push(data)
  } else if (this.buffer.length + data.length < MAX_LOG_BUFFER) {
    this.buffer += data
  } else if (process.emitWarning) {
    process.emitWarning(
      'Dropping log message, buffer would overflow.',
      'NewRelicWarning',
      'NRWARN001'
    )
  }
  this._nestedLog = false
  return true
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

function getPropertiesToLog(extra) {
  var obj = Object.assign(Object.create(null), extra)
  // Error properties (message, stack) are not enumerable, so getting them directly
  if (extra instanceof Error) {
    var names = Object.getOwnPropertyNames(extra)
    if (names) {
      for (var i = 0; i < names.length; i++) {
        obj[names[i]] = extra[names[i]]
      }
    }
  }
  return obj
}
