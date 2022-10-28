/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  agent: Symbol('agent'),
  cache: Symbol('cache'),
  connection: Symbol('connection'),
  context: Symbol('context'),
  databaseName: Symbol('databaseName'),
  disableDT: Symbol('Disable distributed tracing'), // description for backwards compatibility
  executorContext: Symbol('executorContext'),
  id: Symbol('id'),
  instrumented: Symbol('instrumented'),
  instrumentedErrored: Symbol('instrumentedErrored'),
  name: Symbol('name'),
  onceExecuted: Symbol('onceExecuted'),
  original: Symbol('original'),
  segment: Symbol('segment'),
  shim: Symbol('shim'),
  storeDatabase: Symbol('storeDatabase'),
  transaction: Symbol('transaction'),
  transactionInfo: Symbol('transactionInfo'),
  transactionSegment: Symbol('transactionSegment'),
  unwrap: Symbol('unwrap')
}
