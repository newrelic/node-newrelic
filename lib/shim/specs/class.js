/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const WrapSpec = require('./wrap')

/* eslint-disable jsdoc/require-property-description */
/**
 * @typedef {object} ClassWrapSpecParams
 * @mixes WrapSpecParams
 * @property {boolean} [es6]
 * @property {Function} [pre]
 * @property {Function} [post]
 */

/**
 * Pre/post constructor execution hook for wrapping classes.
 *
 * @typedef {Function} ConstructorHookFunction
 * @param {Shim} shim
 *  The shim performing the wrapping/binding.
 * @param {Function} Base
 *  The class that was wrapped.
 * @param {string} name
 *  The name of the `Base` class.
 * @param {Array.<*>} args
 *  The arguments to the class constructor.
 * @see ClassWrapSpec.pre
 */

/**
 * Spec that provides configuration for wrapping classes (both `class` style
 * and traditional `function` style).
 */
class ClassWrapSpec extends WrapSpec {
  /**
   * When `true`, the class being wrapped is `class` style. Our es5 wrapper
   * depends on calling the constructor without `new`, so we have to
   * differentiate.
   *
   * @type {boolean}
   */
  es6

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
   * const spec = new ClassWrapSpec({
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
   * As with {@link ClassWrapSpec.pre}, this function will be applied subsequent
   * to invoking the wrapped class's constructor.
   *
   * @see pre
   * @type {ConstructorHookFunction|null}
   */
  post

  /* eslint-disable jsdoc/require-param-description */
  /**
   * @param {ClassWrapSpecParams} params
   */
  constructor(params) {
    super(params)

    this.es6 = params.es6 ?? false
    this.pre = params.pre ?? null
    this.post = params.post ?? null
  }
}

module.exports = ClassWrapSpec
