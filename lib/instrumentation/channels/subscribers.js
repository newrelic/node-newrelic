/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

function toAsyncEnd(agent) {
  return function asyncEnd(message) {
    const ctx = agent.tracer.getContext()
    ctx?.segment?.end()
  }
}

function toAsyncStart() {
  return function asyncStart(message) {
    // Handle asyncStart message
  }
}

function toStart() {
  return function start(message) {
    // Handle start message
  }
}

function toEnd() {
  return function end(message) {
    // Handle end message
  }
}

function toError() {
  return function error(message) {
    // Handle error message
  }
}

module.exports = {
  toAsyncEnd,
  toAsyncStart,
  toStart,
  toEnd,
  toError
}
