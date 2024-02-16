/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const SegmentSpec = require('./segment')

/* eslint-disable jsdoc/require-property-description */
/**
 * @typedef {object} WrapSpecParams
 * @mixes SegmentSpecParams
 * @property {boolean} [matchArity]
 * @property {function} [wrapper]
 */

/**
 * Provides configuration for wrapping functions.
 *
 * @example
 * function toWrap (a, b) {}
 * const wrapped = shim.wrap(toWrap, {
 *   matchArity: true,
 *   wrapper: function () {
 *     return function wrappedFn () {}
 *   }
 * })
 * assert.equal(toWrap.length, wrapped.length)
 */
class WrapSpec extends SegmentSpec {
  /**
   * Indicates that the arity of the wrapper should match the arity of the
   * function being wrapped.
   *
   * @type {boolean}
   */
  matchArity

  /**
   * A function that wraps another function.
   *
   * @type {function}
   */
  wrapper

  /* eslint-disable jsdoc/require-param-description */
  /**
   * The parameters may be a function; if so, that function is used as the
   * wrapper. Otherwise, the parameters must be an object with a `wrapper`
   * property set to the function that should be the wrapper.
   *
   * @param {WrapSpecParams|function} params
   */
  constructor(params) {
    super(params)

    this.matchArity = params.matchArity ?? false
    if (typeof params === 'function') {
      this.wrapper = params
    } else {
      this.wrapper = params.wrapper
    }
  }
}

module.exports = WrapSpec
