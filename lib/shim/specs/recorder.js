/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const WrapSpec = require('./wrap')

/* eslint-disable jsdoc/require-property-description */
/**
 * @typedef {object} RecorderSpecParams
 * @mixes SegmentSpecParams
 * @property {SpecAfterFunction} [after]
 * @property {number|CallbackBindFunction} [callback]
 * @property {boolean} [callbackRequired]
 * @property {boolean} [promise]
 * @property {number|CallbackBindFunction} [rowCallback]
 * @property {boolean|string} [stream]
 */

/**
 * A callback invoked after an instrumented function has completed its work.
 * The instrumented function must have been invoked synchronously.
 *
 * @typedef {Function} SpecAfterFunction
 * @param {Object} params params to function
 * @param {object} params.shim The shim used to instrument the external library.
 * @param {Function} params.fn The function/method from the external library being
 * instrumented.
 * @param {string} params.name The name of the current function.
 * @param {Error|null} [params.error] If the instrumented function threw an error, this
 * will be that error. In the case of a callback this will be omitted.
 * @param {Array} [params.args] arguments passed to a callback function getting instrumented.
 * @param {*} [params.result] The result returned by the instrumented function. In the case of a wrapped
 * callback, the data needed is in `params.args`.
 * @param {TraceSegment} params.segment The segment used while instrumenting the
 * function.
 */

/**
 * A specialized case of {@link SegmentSpec}. A `RecorderSpec` is typically
 * used with {@link Shim.record}. It defines the parameters of segment creation
 * and segment lifetime.
 */
class RecorderSpec extends WrapSpec {
  /**
   * @type {SpecAfterFunction}
   */
  after

  /**
   * If a number, then the number indicates the position in the instrumented
   * function's arguments list that represents the callback function. Otherwise,
   * it should be the function to used in conjunction with the instrumented
   * function.
   *
   * @example Using a number
   * const spec = new RecorderSpec({ callback: -1 })
   * // elsewhere
   * const cb = Array.from(arguments).at(spec.callback)
   *
   * @example Using a function
   * const spec = new RecorderSpec({ callback: () => {
   *   console.log('hello')
   * })
   * // elsewhere
   * instrumentedFunction('foo', spec.callback)
   *
   * @type {number|CallbackBindFunction}
   */
  callback

  /**
   * When `true`, a recorded method must be called with a callback for a segment
   * to be created. Does not apply if a custom callback method has been
   * assigned via {@link callback}.
   *
   * @type {boolean}
   */
  callbackRequired

  /**
   * Indicates if the instrumented function is expected to return a promise.
   * When `true`, the segment recording will be extended until the promise
   * has settled.
   *
   * @type {boolean|null}
   */
  promise

  /**
   * Like {@link callback}, this identifies a callback function in the
   * instrumented function's arguments list. The difference is that the default
   * behavior for row callbacks is to only create one segment for all calls to
   * the callback. This is mostly useful for functions which will be called
   * repeatedly, such as once for each item in a result set.
   *
   * @type {number|CallbackBindFunction}
   */
  rowCallback

  /**
   * Indicates if the instrumented function is expected to return a stream.
   * When `true`, the segment recording will be extended until the `end` event
   * of the stream. If the value is a string, it is assumed to be the name of
   * an event to measure; a segment will be created to record emissions of the
   * named event.
   *
   * @type {boolean|string|null}
   */
  stream

  /* eslint-disable jsdoc/require-param-description */
  /**
   * @param {RecorderSpecParams} params
   */
  constructor(params) {
    super(params)

    this.after = params.after ?? null
    this.callback = params.callback ?? null
    this.callbackRequired = params.callbackRequired ?? null
    this.promise = params.promise ?? null
    this.rowCallback = params.rowCallback ?? null
    this.stream = params.stream ?? null
  }
}

module.exports = RecorderSpec
