/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const OperationSpec = require('./operation')

/**
 * Retrieves the query argument from an array of arguments.
 *
 * @typedef {function} QueryFunction
 * @param {Shim} shim The shim this function was passed to.
 * @param {Function} func The function being recorded.
 * @param {string} name The name of the function.
 * @param {Array.<*>} args The arguments being passed into the function.
 * @returns {string} The query string from the arguments list.
 */

/* eslint-disable jsdoc/require-property-description */
/**
 * @typedef {object} QuerySpecParams
 * @mixes OperationSpecParams
 * @property {number|string|QueryFunction} [query]
 */

/**
 * Spec that describes a database query operation.
 */
class QuerySpec extends OperationSpec {
  /**
   * When set to a number it represents the position in the function's
   * arguments that is the query string. If a string, it is the query to be
   * executed. Otherwise, if it is a function, it will be passed the
   * arguments and must return the query string.
   *
   * @type {number|string|QueryFunction}
   */
  query

  /* eslint-disable jsdoc/require-param-description */
  /**
   * @param {QuerySpecParams} params
   */
  constructor(params) {
    super(params)

    this.query = params.query ?? null
  }
}

module.exports = QuerySpec
