/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { ARG_INDEXES } = require('./constants')
const RecorderSpec = require('./recorder')

/* eslint-disable jsdoc/require-property-description */
/**
 * @typedef {object} MiddlewareSpecParams
 * @augments RecorderSpecParams
 * @property {boolean} [appendPath]
 * @property {number} [next]
 * @property {Object<string, string>} [params]
 * @property {number} [req]
 * @property {number} [res]
 * @property {number|null} [route]
 * @property {string} [type]
 */

/**
 * Spec that describes how to instrument a framework middleware function, e.g.
 * an `express` middleware.
 */
class MiddlewareSpec extends RecorderSpec {
  /**
   * Indicates if the route path for the middleware should be appended to
   * the transaction name or not.
   *
   * @type {boolean}
   */
  appendPath

  /**
   * Indicates the argument position of the "next" callback in the original
   * middleware function's parameters list.
   *
   * @type {number}
   */
  next

  /**
   * A hash of request parameter names to their values.
   *
   * @example
   * const route = '/foo/:name'
   * assert.deepEqual(req.params, { name: 'bar' })
   *
   * @type {Object<string, string>}
   */
  params

  /**
   * Indicates the argument position of the request object in the middleware
   * function's arguments list.
   *
   * @type {number}
   */
  req

  /**
   * Indicates the argument position of the response object in the middleware
   * function's arguments list.
   *
   * @type {number}
   */
  res

  /**
   * Indicates the argument position of the route string in the middleware
   * function's arguments list.
   *
   * @type {number|null}
   */
  route

  /**
   * Indicates the type of middleware that is being instrumented.
   *
   * @see {MiddlewareTypeNames}
   * @type {string}
   */
  type

  /**
   * @param {MiddlewareSpecParams} constructorParams
   */
  constructor(constructorParams) {
    super(constructorParams)

    this.appendPath = constructorParams.appendPath ?? true
    this.next = constructorParams.next ?? ARG_INDEXES.THIRD
    this.params = constructorParams.params ?? constructorParams.req?.params
    this.req = constructorParams.req ?? ARG_INDEXES.FIRST
    this.res = constructorParams.res ?? ARG_INDEXES.SECOND
    this.route = constructorParams.route ?? null
    this.type = constructorParams.type ?? 'MIDDLEWARE'
  }
}

module.exports = MiddlewareSpec
