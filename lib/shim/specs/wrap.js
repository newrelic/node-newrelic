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
 * @property {Function} [wrapper]
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
   * @type {Function}
   */
  wrapper

  /* eslint-disable jsdoc/require-param-description */
  /**
   * @param {WrapSpecParams} params
   */
  constructor(params) {
    super(params)

    this.matchArity = params.matchArity ?? false
    this.wrapper = params.wrapper
  }
}

module.exports = WrapSpec
