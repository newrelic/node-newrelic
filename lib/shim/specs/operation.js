/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const RecorderSpec = require('./recorder')

/* eslint-disable jsdoc/require-property-description */
/**
 * @typedef {object} OperationSpecParams
 * @mixes RecorderSpecParams
 * @property {DatastoreParameters|QueueMessageParameters|null} [parameters]
 * @property {boolean} [record]
 */

/**
 * Spec that describes an operation, e.g. connecting to a database.
 */
class OperationSpec extends RecorderSpec {
  /**
   * Extra parameters to be set on the metric for the operation.
   *
   * @type {DatastoreParameters|QueueMessageParameters|null}
   */
  parameters

  /**
   * Indicates if the operation should be recorded as a metric. A segment will
   * be created even if this is `false`.
   *
   * @type {boolean}
   */
  record

  /* eslint-disable jsdoc/require-param-description */
  /**
   * @param {OperationSpecParams} params
   */
  constructor(params) {
    super(params)

    this.parameters = params.parameters ?? null
    this.record = params.record ?? true
    this.internal = params.internal ?? true
  }
}

module.exports = OperationSpec
