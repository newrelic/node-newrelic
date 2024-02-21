/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const RecorderSpec = require('./recorder')
const { ARG_INDEXES } = require('./constants')

/* eslint-disable jsdoc/require-property-description */
/**
 * @typedef {object} RenderSpecParams
 * @mixes RecorderSpecParams
 * @property {number} [view]
 */

/**
 * Spec describing how to wrap a view middleware.
 *
 * @see https://github.com/newrelic/node-newrelic/blob/cde1014e/lib/shim/webframework-shim/index.js#L301-L333
 */
class RenderSpec extends RecorderSpec {
  /**
   * Identifies the position of the view name argument in the instrumented
   * view middleware's arguments list.
   *
   * @type {number}
   */
  view

  /* eslint-disable jsdoc/require-param-description */
  /**
   * @param {RenderSpecParams} params
   */
  constructor(params) {
    super(params)

    this.view = params.view ?? ARG_INDEXES.FIRST
  }
}

module.exports = RenderSpec
