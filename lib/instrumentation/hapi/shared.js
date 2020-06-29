/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// This object defines all the events that we want to wrap extensions
// for, as they are the only ones associated with requests.
var ROUTE_EVENTS = {
  onRequest: true,
  onPreAuth: true,
  onCredentials: true,
  onPostAuth: true,
  onPreHandler: true,
  onPostHandler: true,
  onPreResponse: true,

  // Server events
  onPreStart: false,
  onPostStart: false,
  onPreStop: false,
  onPostStop: false
}

module.exports = {
  ROUTE_EVENTS: ROUTE_EVENTS
}
