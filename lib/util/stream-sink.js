/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const EventEmitter = require('events').EventEmitter
const util = require('util')

/**
 * Pipe a readable stream into this sink that fulfills the Writable Stream
 * contract and the callback will be fired when the stream has been completely
 * read.
 *
 * @param callback
 */
function StreamSink(callback) {
  EventEmitter.call(this)

  this.callback = callback
  this.sink = ''
  this.writable = true

  const sink = this
  this.on('error', function handleError(error) {
    sink.writable = false
    callback(error)
  })
}
util.inherits(StreamSink, EventEmitter)

StreamSink.prototype.write = function write(string) {
  if (!this.writable) {
    this.emit('error', new Error('Sink no longer writable!'))
    return false
  }

  // Explicitly copy buffer contents so we are sure to release references to
  // the TLS slab buffer region.
  this.sink += string.toString()

  return true
}

StreamSink.prototype.end = function end() {
  this.writable = false

  this.callback(null, this.sink)
}

StreamSink.prototype.destroy = function destroy() {
  this.emit('close')
  this.writable = false

  delete this.sink
}

module.exports = StreamSink
