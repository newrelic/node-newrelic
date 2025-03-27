/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Represents the trace state from a New Relic tracestate list member.
 *
 * @property {number} version TraceContext spec version used.
 * @property {number} parentType The type of component that produced the state.
 * @property {string} accountId New Relic account ID.
 * @property {string} appId ID of the application that generated the header.
 * @property {string} spanId Unique identifier for the span.
 * @property {string} transactionId Unique identifier for the transaction.
 * @property {number} sampled Indicates if the receiving agent should sample.
 * Not sample = 0, sampled = 1.
 * @property {number} priority Floating point of the priority the agent should
 * use.
 * @property {number} timestamp When the payload was created, milliseconds
 * since epoch.
 * @property {boolean} isValid Indicates if all values are valid, or if any
 * single value is invalid.
 * @property {string} invalidReason When any property has been found to be
 * invalid, this will have a string describing when property was invalid.
 */
class TracestateIntrinsics {
  #version
  #parentType
  #priority
  #sampled
  #timestamp

  accountId
  appId
  spanId
  transactionId

  #isValid = undefined
  invalidReason

  static NR_TRACESTATE_VERSION = 0

  /**
   * Set of allowed transaction types.
   *
   * @type {string[]}
   */
  static PARENT_TYPES = ['App', 'Browser', 'Mobile']

  get version() { return this.#version }
  set version(value) {
    this.#version = parseInt(value, 10)
  }

  get parentType() { return this.#parentType }
  set parentType(value) {
    const typeIdx = parseInt(value, 10)
    this.#parentType = TracestateIntrinsics.PARENT_TYPES[typeIdx]
  }

  get priority() { return this.#priority }
  set priority(value) {
    this.#priority = value == null ? null : parseFloat(value)
  }

  get sampled() { return this.#sampled }
  set sampled(value) {
    this.#sampled = value == null ? null : parseInt(value, 10)
  }

  get timestamp() { return this.#timestamp }
  set timestamp(value) {
    this.#timestamp = parseInt(value, 10)
  }

  get isValid() {
    if (this.#isValid === undefined) {
      this.validate()
    }
    return this.#isValid
  }

  /**
   * Ensures that each intrinsic value is valid and updates `isValid`
   * accordingly. If any intrinsic is not valid, the whole set is invalid.
   */
  validate() {
    // Functions that return true when the field is invalid
    const isNull = (v) => v == null
    const intrinsicInvalidations = {
      version: isNaN, // required, int
      parentType: isNull, // required, str
      accountId: isNull, // required, str
      appId: isNull, // required, str
      sampled: (v) => (v == null ? false : isNaN(v)), // not required, int
      priority: (v) => (v == null ? false : isNaN(v)), // not required, float
      timestamp: isNaN // required, int
    }
    for (const [key, validator] of Object.entries(intrinsicInvalidations)) {
      if (validator && validator(this[key]) === true) {
        this.#isValid = false
        this.invalidReason = `${key} failed validation test`
        return
      }
    }
    this.#isValid = true
  }
}

module.exports = TracestateIntrinsics
