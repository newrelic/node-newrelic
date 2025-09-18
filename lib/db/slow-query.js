/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const obfuscate = require('../util/sql/obfuscate')
const crypto = require('crypto')
const path = require('path')
const NR_ROOT = path.resolve(__dirname, '..')

/**
 *
 * @param root0
 * @param root0.segment
 * @param root0.transaction
 * @param root0.type
 * @param root0.query
 * @param root0.trace
 */
function SlowQuery({ segment, transaction, type, query, trace }) {
  this.obfuscated = obfuscate(query, type)
  this.normalized = this.obfuscated.replace(/\?\s*,\s*|\s*/g, '')
  this.id = normalizedHash(this.normalized)
  this.segment = segment
  this.query = query
  this.metric = segment.name
  this.trace = formatTrace(trace)
  this.transaction = transaction
  this.duration = segment.getDurationInMillis()
}

/**
 *
 * @param value
 */
function normalizedHash(value) {
  // We leverage the last 15 hex digits which will fit in a signed long
  // eslint-disable-next-line sonarjs/hashing
  return parseInt(crypto.createHash('sha1').update(value).digest('hex').slice(-15), 16)
}

/**
 *
 * @param trace
 */
function formatTrace(trace) {
  // remove error message and instrumentation frames from stack trace
  return trace ? trace.split('\n').slice(1).filter(notNR).join('\n') : ''
}

/**
 *
 * @param frame
 */
function notNR(frame) {
  return frame.indexOf(NR_ROOT) === -1
}

module.exports = SlowQuery
