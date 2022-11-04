/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  cache: Symbol('cache'),
  context: Symbol('context'),
  databaseName: Symbol('databaseName'),
  disableDT: Symbol('Disable distributed tracing'), // description for backwards compatibility
  executorContext: Symbol('executorContext'),
  instrumented: Symbol('instrumented'),
  instrumentedErrored: Symbol('instrumentedErrored'),
  name: Symbol('name'),
  onceExecuted: Symbol('onceExecuted'),
  offTheRecord: Symbol('offTheRecord'),
  original: Symbol('original'),
  segment: Symbol('segment'),
  shim: Symbol('shim'),
  storeDatabase: Symbol('storeDatabase'),
  transaction: Symbol('transaction'),
  transactionInfo: Symbol('transactionInfo'),
  unwrap: Symbol('unwrap')
}
