/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Spec = require('./spec')

/**
 * Pre/post constructor execution hook for wrapping classes.
 *
 * @typedef {function} ConstructorHookFunction
 * @param {Shim} shim
 *  The shim performing the wrapping/binding.
 * @param {Function} Base
 *  The class that was wrapped.
 * @param {string} name
 *  The name of the `Base` class.
 * @param {Array.<*>} args
 *  The arguments to the class constructor.
 * @see WrapSpec.pre
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
class WrapSpec extends Spec {
  /**
   * Indicates that the arity of the wrapper should match the arity of the
   * function being wrapped.
   *
   * @type {boolean}
   */
  matchArity

  /**
   * When wrapping a `class` based object, the `pre` function will be invoked
   * with the class's constructor arguments before the class constructor is
   * invoked. The `this` reference will be bound to `null`.
   *
   * @example
   * class Foo {
   *   constructor(a, b, c) {
   *     // do stuff
   *   }
   * }
   * const spec = new WrapSpec({
   *   pre: function (...args) {
   *     // args = [a, b, c]
   *   }
   * })
   * const wrappedClass = class Wrapper extends Foo {
   *   constructor() {
   *     spec.pre.apply(null, [...arguments])
   *   }
   * }
   *
   * @see https://github.com/newrelic/node-newrelic/blob/b92ebc0/lib/shim/shim.js#L2005-L2022
   * @type {ConstructorHookFunction|null}
   */
  pre

  /**
   * As with {@link pre}, this function will be applied subsequent to invoking
   * the wrapped class's constructor.
   *
   * @see pre
   * @type {ConstructorHookFunction|null}
   */
  post

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
   * @param {object|function} params
   * @param {boolean} [params.matchArity]
   * @param {function} [params.wrapper]
   */
  constructor(params) {
    super()

    this.matchArity = params.matchArity ?? false
    if (typeof params === 'function') {
      this.wrapper = params
    } else {
      this.wrapper = params.wrapper
    }
  }
}

module.exports = WrapSpec
