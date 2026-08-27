/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const defaultLogger = require('#agentlib/logger.js').child({
  component: 'DistributedTracePayload'
})

const DT_VERSION_MAJOR = 0
const DT_VERSION_MINOR = 1
/**
 * Required payload data object keys. The spec requires that the `id` key
 * be present, but our historical implementation does not. So it is omitted
 * here for compatibility.
 *
 * @type {string[]}
 */
const REQUIRED_DT_KEYS = ['ty', 'ac', 'ap', 'tr', 'ti']

/**
 * Represents the actual data object for a New Relic distributed trace payload.
 */
class PayloadData {
  #accountId
  #appId
  #guid
  #priority
  #sampled
  #timestamp
  #traceId
  #transactionId
  #trustKey
  #type

  constructor(input) {
    if (Object.prototype.toString.call(input) === '[object PayloadData]') {
      return input
    }

    for (const k of REQUIRED_DT_KEYS) {
      if (Object.hasOwn(input, k) === false) {
        throw Error(`Missing required data key: ${k}.`)
      }
    }

    this.#accountId = input.ac
    this.#appId = input.ap
    this.#guid = input.id
    this.#priority = input.pr
    this.#sampled = input.sa
    this.#timestamp = input.ti
    this.#traceId = input.tr
    this.#transactionId = input.tx
    this.#trustKey = input.tk
    this.#type = input.ty
  }

  get [Symbol.toStringTag]() { return 'PayloadData' }

  set ac(val) { this.#accountId = val }
  get ac() { return this.#accountId }
  get accountId() { return this.#accountId }

  set ap(val) { this.#appId = val }
  get ap() { return this.#appId }
  get appId() { return this.#appId }

  set id(val) { this.#guid = val }
  get id() { return this.#guid }
  get guid() { return this.#guid }

  set pr(val) { this.#priority = val }
  get pr() { return this.#priority }
  get priority() { return this.#priority }

  set sa(val) { this.#sampled = val }
  get sa() { return this.#sampled }
  get sampled() { return this.#sampled }

  set ti(val) { this.#timestamp = val }
  get ti() { return this.#timestamp }
  get timestamp() { return this.#timestamp }

  set tr(val) { this.#traceId = val }
  get tr() { return this.#traceId }
  get traceId() { return this.#traceId }

  set tx(val) { this.#transactionId = val }
  get tx() { return this.#transactionId }
  get transactionId() { return this.#transactionId }

  set tk(val) { this.#trustKey = val }
  get tk() { return this.#trustKey }
  get trustKey() { return this.#trustKey }

  set ty(val) { this.#type = val }
  get ty() { return this.#type }
  get type() { return this.#type }

  toJSON() {
    return {
      ty: this.#type,
      ac: this.#accountId,
      ap: this.#appId,
      id: this.#guid,
      tr: this.#traceId,
      tk: this.#trustKey,
      pr: this.#priority,
      sa: this.#sampled,
      ti: this.#timestamp,
      tx: this.#transactionId
    }
  }
}

/**
 * Implements the baseline structure of the New Relic distributed trace
 * payload.
 *
 * Errors are bubbled up. Surfacing supportability metrics and logs should
 * be done at the location payloads are handled.
 *
 * @see https://source.datanerd.us/agents/agent-specs/blob/8dac5c5/distributed_tracing/New-Relic-Payload.md
 */
class Payload {
  static CURRENT_MAJOR = DT_VERSION_MAJOR
  static CURRENT_MINOR = DT_VERSION_MINOR

  #logger

  #major = DT_VERSION_MAJOR
  #minor = DT_VERSION_MINOR

  #data

  constructor({ input, logger = defaultLogger } = {}) {
    this.#logger = logger

    if (!input) {
      this.#logger.trace('Payload requires at least a string input.')
      throw Error('Missing payload input.')
    }

    if (typeof input === 'string') {
      this.#fromString(input)
    } else {
      this.#fromObject(input)
    }
  }

  get [Symbol.toStringTag]() { return 'Payload' }

  get version() {
    return [this.#major, this.#minor]
  }

  get major() {
    return this.#major
  }

  get minor() {
    return this.#minor
  }

  get data() {
    return this.#data
  }

  #fromString(payload) {
    const leadingChar = payload.charAt(0)
    if (leadingChar !== '{' && leadingChar !== '[') {
      payload = Buffer.from(payload, 'base64').toString('utf-8')
    }

    this.#fromObject(JSON.parse(payload))
  }

  #fromObject(payload) {
    if (Array.isArray(payload.v) === false || payload.v.length !== 2) {
      throw Error('Missing or invalid version (v) key.')
    }
    if (typeof payload.v[0] !== 'number' || typeof payload.v[1] !== 'number') {
      throw Error('Version fields must be numbers.')
    }
    this.#major = payload.v[0]
    this.#minor = payload.v[1]

    if (Object.hasOwn(payload, 'd') === false || typeof payload.d !== 'object') {
      throw Error('Missing or invalid data (d) key.')
    }
    this.#data = new PayloadData(payload.d)
  }

  toJSON() {
    return {
      v: this.version,
      d: this.data
    }
  }
}

module.exports = { Payload, PayloadData }
