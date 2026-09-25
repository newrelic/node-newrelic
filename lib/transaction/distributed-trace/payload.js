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
const REQUIRED_DT_KEYS = new Set([
  'ac',
  'ap',
  'ti',
  'tr',
  'ty'
])
const REQUIRED_FULL_KEYS = new Set([
  'accountId',
  'appId',
  'timestamp',
  'traceId',
  'type'
])

const KEY_MAP = {
  ac: { full: 'accountId', required: true },
  accountId: { full: 'accountId', required: true },

  ap: { full: 'appId', required: true },
  // The spec requires that `id` be present. But our historical implementation
  // does not. So we set it as not required for compatibility.
  id: { full: 'guid', required: false },
  pr: { full: 'priority', required: false },
  sa: { full: 'sampled', required: false },
  ti: { full: 'timestamp', required: true },
  tk: { full: 'trustKey', required: false },
  tr: { full: 'traceId', required: true },
  tx: { full: 'transactionId', required: false },
  ty: { full: 'type', required: true }
}

function isRemoteObject(objectKeys) {
  for (const key of REQUIRED_DT_KEYS) {
    if (objectKeys.has(key)) return true
  }
  return false
}

/**
 * Represents the actual data object for a New Relic distributed trace payload.
 *
 * @property {string} accountId New Relic account identifier.
 * @property {string} appId Identifier for the customer's application in the
 * monitoring data.
 * @property {string} guid Identifier to tie span events together.
 * @property {number} priority Weight for the likelihood the trace will be kept.
 * @property {boolean} sampled Indicates if the trace has been sampled or not.
 * @property {number} timestamp Milliseconds since epoch indicating when the
 * payload was created.
 * @property {string} traceId Identifier for the whole trace.
 * @property {string} transactionId Identifier for linking trace events
 * together.
 * @property {string} trustKey Key from the Connect service used to indicate
 * if the payload is trusted.
 * @property {string} type Indicates the type of application that generated
 * the payload.
 *
 * @see New Relic Payload spec document.
 */
class PayloadData {
  static TYPE_APP = 'App'
  static TYPE_BROWSER = 'Browser'
  static TYPE_MOBILE = 'Mobile'

  constructor(input) {
    if (Object.prototype.toString.call(input) === '[object PayloadData]') {
      return input
    }

    const inputKeys = new Set(Object.keys(input))

    if (isRemoteObject(inputKeys) !== true) {
      // This path should rarely be taken. This path covers the case where
      // the input object is using the fully written key names instead of the
      // byte saving key names. In other words, it should really only be hit
      // by tests.
      if (
        inputKeys.intersection(REQUIRED_FULL_KEYS).size !== REQUIRED_FULL_KEYS.size
      ) {
        const keys = Array.from(REQUIRED_FULL_KEYS.difference(inputKeys))
        throw Error(`Missing required data keys: ${keys}`)
      }
      Object.assign(this, input)
      return
    }

    // This is the primary path. In most cases, we will be processing an
    // object that was built from decoding an incoming New Relic header, i.e.
    // one with byte saving key names.
    if (
      inputKeys.intersection(REQUIRED_DT_KEYS).size !== REQUIRED_DT_KEYS.size
    ) {
      const keys = Array.from(REQUIRED_DT_KEYS.difference(inputKeys))
      throw Error(`Missing required data keys: ${keys}`)
    }
    for (const [key, value] of Object.entries(input)) {
      // We need to fall back to `key` as some tests purposefully inject
      // unknown keys. If we hit such an unknown key, we will crash if we do
      // not use the fallback.
      this[KEY_MAP[key]?.full ?? key] = value
    }
  }

  get [Symbol.toStringTag]() { return 'PayloadData' }

  toJSON() {
    return {
      ty: this.type,
      ac: this.accountId,
      ap: this.appId,
      id: this.guid,
      tr: this.traceId,
      tk: this.trustKey,
      pr: this.priority,
      sa: this.sampled,
      ti: this.timestamp,
      tx: this.transactionId
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
    this.#data = payload.d instanceof PayloadData
      ? payload.d
      : new PayloadData(payload.d)
  }

  toJSON() {
    return {
      v: this.version,
      d: this.data
    }
  }
}

module.exports = { Payload, PayloadData }
