/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  cache: Symbol('cache'),
  connection: Symbol('connection'),
  databaseName: Symbol('databaseName'),
  disableDT: Symbol('Disable distributed tracing'), // description for backwards compatibility
  instrumented: Symbol('instrumented'),
  instrumentedErrored: Symbol('instrumentedErrored'),
  original: Symbol('original'),
  segment: Symbol('segment'),
  storeDatabase: Symbol('storeDatabase'),
  transactionInfo: Symbol('transactionInfo'),
  unwrap: Symbol('unwrap'),
}
