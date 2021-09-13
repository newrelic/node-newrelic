/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const newrelic = require('newrelic') // eslint-disable-line node/no-extraneous-require

/*
`recordCustomEvent` records a custom event, allowing you to set the event's name
and attributes.

An event's name may have alphanumerics (a-z, A-Z, 0-9) as well as ':', '_', and
' ' characters. The event's attributes are an object whose keys can be strings,
numbers, or booleans.

This method is synchronous. The event is queued to be reported during the next
harvest cycle.
*/

newrelic.recordCustomEvent('my_app:my_event', {
  custom: 'properties',
  n: 1,
  ok: true
})
