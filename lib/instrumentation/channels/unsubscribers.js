/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

function fromAsyncEnd(agent) {
  return function asyncEnd(message) {
    // Handle asyncEnd message
  }
}

function fromAsyncStart() {
  return function asyncStart(message) {
    // Handle asyncStart message
  }
}

function fromStart() {
  return function start(message) {
    // Handle start message
  }
}

function fromEnd() {
  return function end(message) {
    // Handle end message
  }
}

function fromError() {
  return function error(message) {
    // Handle error message
  }
}

module.exports = {
  fromAsyncEnd,
  fromAsyncStart,
  fromStart,
  fromEnd,
  fromError
}
