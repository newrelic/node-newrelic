/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const newrelic = require('newrelic')

/*
`addCustomAttribute` adds a custom attribute to an existing transaction.
It takes `name` and `value` parameters, adding them to the object reported to New Relic.

In this example, we create a background transaction in order to modify it.
Once run, a transaction will be reported that has the attribute `hello` with the value `world`.
*/

newrelic.startBackgroundTransaction('myCustomTransaction', function handle() {
  const transaction = newrelic.getTransaction()
  newrelic.addCustomAttribute('hello', 'world')
  transaction.end()
})
