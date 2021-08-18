/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

function FakeConnection() {
  this.writable = true
}

FakeConnection.prototype.on = function on(event, callback) {
  if (event === 'connect') {
    return callback()
  }
  if (event === 'data') {
    this.on_data = callback
    return callback
  }
}

FakeConnection.prototype.setNoDelay = function setNoDelay(bagel) {
  if (bagel !== false) {
    this.bagel = true
  }
}

FakeConnection.prototype.setTimeout = function setTimeout(timeout) {
  this.timeout = timeout
}

FakeConnection.prototype.setKeepAlive = function setKeepAlive(keepAlive) {
  this.keepAlive = keepAlive
}

FakeConnection.prototype.write = function write() {}

module.exports = FakeConnection
