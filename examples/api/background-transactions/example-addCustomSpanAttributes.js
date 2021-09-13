/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const newrelic = require('newrelic') // eslint-disable-line node/no-extraneous-require

/*
`addCustomSpanAttributes` adds custom span attributes to an existing transaction.
It takes an `attributes` object as its sole parameter,
adding its keys and values as span attributes to the transaction.

Internally, the agent uses `addCustomSpanAttribute` to add these span attributes to the transaction.
Much like this:

```javascript
for (const [key, value] of Object.entries(attributes)) {
  newrelic.addCustomSpanAttribute(key, value)
}
```

In this example, we create a background transaction in order to modify it.
Once run, a transaction will be reported that has the span attribute `hello` with the value `world`.
*/

newrelic.startBackgroundTransaction('myCustomTransaction', function handle() {
  const transaction = newrelic.getTransaction()
  newrelic.addCustomSpanAttributes({ hello: 'world' })
  transaction.end()
})
