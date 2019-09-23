'use strict'

const obfuscate = require('../util/sql/obfuscate')
const crypto = require('crypto')
const path = require('path')
const NR_ROOT = path.resolve(__dirname, '..')

function SlowQuery(segment, type, query, trace) {
  this.obfuscated = obfuscate(query, type)
  this.normalized = this.obfuscated.replace(/\?\s*,\s*|\s*/g, '')
  this.id = normalizedHash(this.normalized)
  this.segment = segment
  this.query = query
  this.metric = segment.name
  this.trace = formatTrace(trace)
  this.duration = segment.getDurationInMillis()
}

function normalizedHash(value) {
  // We leverage the last 16 hex digits of which would mostly fit in a long and
  // rely on parseInt to drop bits that do not fit in a JS number
  return parseInt(crypto.createHash('sha1').update(value).digest('hex').slice(-16), 16)
}

function formatTrace(trace) {
  // remove error message and instrumentation frames from stack trace
  return trace ? trace.split('\n').slice(1).filter(notNR).join('\n') : ''
}

function notNR(frame) {
  return frame.indexOf(NR_ROOT) === -1
}

module.exports = SlowQuery
