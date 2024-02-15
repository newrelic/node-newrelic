/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Spec = require('./spec')

/**
 * A function that will be invoked in the context of the current segment.
 * Instrumentations that need to perform operations during the invocation of
 * a method that has been instrumented can provide an `InContextCallback`
 * function to accomplish their needs. The callback is invoked in the same
 * async context as the instrumented function, i.e. concurrent to the execution
 * of the instrumented function, and within the same segment.
 *
 * @typedef {Function} InContextCallback
 * @param {TraceSegment} segment The current segment.
 */

/* eslint-disable jsdoc/require-property-description */
/**
 * @typedef {object} SegmentSpecParams
 * @property {InContextCallback} [inContext]
 * @property {boolean} [internal]
 * @property {string} [name]
 * @property {boolean} [opaque]
 * @property {Object<string, *>} [parameters]
 * @property {TraceSegment} [parent]
 * @property {MetricFunction} [recorder]
 */

/**
 * Baseline spec implementation. Can be utilized anywhere a generic spec will
 * satisfy the requirements. Some shims require more specialized specs that
 * this one does not satisfy.
 */
class SegmentSpec extends Spec {
  /**
   * @type {InContextCallback}
   */
  inContext

  /**
   * Marks the segment as the boundary point into an instrumented library. If
   * set to `true`, and the parent segment is _also_ marked as `internal: true`
   * by the same shim, then we will not record this inner activity.
   *
   * This is useful when instrumenting a library which implements high-order
   * methods which simply call other public method, and you only want to
   * record the method directly called by the user while still instrumenting
   * all endpoints.
   *
   * @type {boolean}
   */
  internal

  /**
   * A name for the segment that can be recognized by users.
   *
   * @type {string}
   */
  name

  /**
   * Indicates if child segments should be recorded or not. When `true`, child
   * segments will not be created and traces will omit the details descended
   * from an opaque segment.
   *
   * @type {boolean}
   */
  opaque

  /**
   * A key-value hash of attributes that a shim can utilize.
   *
   * @type {Object<string, *>}
   */
  parameters

  /**
   * The parent segment, if any. Should be set to the currently active
   * segment by default.
   *
   * @type {TraceSegment}
   */
  parent

  /**
   * A metric recorder for the segment. This field is intended to be used by
   * shim implementations. It is not intended that an instrumentation will
   * ever need to specify its own metric recorder.
   *
   * @type {MetricFunction}
   */
  recorder

  /**
   * @param {SegmentSpecParams} params Spec properties to set.
   */
  constructor(params) {
    super()
    this.inContext = params.inContext ?? null
    this.internal = params.internal ?? false
    this.name = params.name ?? null
    this.opaque = params.opaque ?? false
    this.parameters = params.parameters ?? null
    this.parent = params.parent ?? null
    this.recorder = params.recorder ?? null
  }
}

module.exports = SegmentSpec
