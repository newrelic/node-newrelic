/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * @typedef {object} DatastoreParametersParams
 * @property {string} host
 *  The host of the database server being interacted with. If provided, along
 *  with `port_path_or_id`, then an instance metric will also be generated for
 *  this database.
 * @property {number|string} port_path_or_id
 *  The port number or path to domain socket used to connect to the database
 *  server.
 * @property {string} database_name
 *  The name of the database being queried or operated on.
 * @property {string} collection
 *  The name of the collection or table being queried or operated on.
 */

/**
 * Extra parameters which may be added to an operation or query segment. All of
 * these properties are optional.
 */
class DatastoreParameters {
  /* eslint-disable jsdoc/require-param-description */
  /**
   * @param {DatastoreParametersParams} params
   */
  constructor(params = {}) {
    this.host = params.host ?? null
    this.port_path_or_id = params.port_path_or_id ?? null
    this.database_name = params.database_name ?? null
    this.collection = params.collection ?? null
  }
}

module.exports = DatastoreParameters
