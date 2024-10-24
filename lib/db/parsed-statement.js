/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

function ParsedStatement(type, operation, collection, raw) {
  this.type = type
  this.operation = operation
  this.collection = collection
  this.trace = null
  this.raw = ''

  if (typeof raw === 'string') {
    this.trace = new Error().stack
    this.raw = raw
  }
}

module.exports = ParsedStatement
