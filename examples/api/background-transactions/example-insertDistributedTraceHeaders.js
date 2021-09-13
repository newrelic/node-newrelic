/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const newrelic = require('newrelic') // eslint-disable-line node/no-extraneous-require

/*
For context on how to use this call and its partner call insertDistributedTraceHeaders, first read Enable distributed tracing with agent APIs:

https://docs.newrelic.com/docs/distributed-tracing/enable-configure/language-agents-enable-distributed-tracing/

`transactionHandle.insertDistributedTraceHeaders` is used to implement distributed tracing. It modifies the headers map that is passed in by adding W3C Trace Context headers and New Relic Distributed Trace headers. The New Relic headers can be disabled with `distributed_tracing.exclude_newrelic_header: true` in the config. This method replaces the deprecated createDistributedTracePayload method, which only creates New Relic Distributed Trace payloads.
*/

// example, mocked request.
// insertDistributedTraceHeaders modifies `req.headers`,
// adding trace headers for observability reporting
const req = { headers: {} }

newrelic.startBackgroundTransaction('myCustomTransaction', function handle() {
  const transaction = newrelic.getTransaction()
  transaction.insertDistributedTraceHeaders(req.headers)
  transaction.end()
})
