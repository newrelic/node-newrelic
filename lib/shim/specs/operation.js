/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const RecorderSpec = require('./recorder')

/**
 * Extra parameters which may be added to an operation or query segment. All of
 * these properties are optional.
 *
 * @typedef {object} DatastoreParameters
 * @property {string} host
 *  The host of the database server being interacted with. If provided, along
 *  with `port_path_or_id`, then an instance metric will also be generated for
 *  this database.
 * @property {number|string} port_path_or_id
 *  The port number or path to domain socket used to connect to the database
 *  server.
 * @property {string} database_name
 *  The name of the database being queried or operated on.
 */

/**
 * Spec that describes an operation, e.g. connecting to a database.
 */
class OperationSpec extends RecorderSpec {
  /**
   * Extra parameters to be set on the metric for the operation.
   *
   * @type {DatastoreParameters|null}
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
   * @param {object} params
   * @param {DatastoreParameters|null} [params.parameters]
   * @param {boolean} [params.record]
   */
  constructor(params) {
    super(params)

    this.parameters = params.parameters ?? null
    this.record = params.record ?? true
  }
}

module.exports = OperationSpec
