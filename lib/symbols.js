/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  cache: Symbol('cache'),
  connection: Symbol('connection'),
  databaseName: Symbol('databaseName'),
  instrumented: Symbol('instrumented'),
  instrumentedErrored: Symbol('instrumentedErrored'),
  original: Symbol('original'),
  storeDatabase: Symbol('storeDatabase'),
  transactionInfo: Symbol('transactionInfo'),
  unwrap: Symbol('unwrap'),
}
