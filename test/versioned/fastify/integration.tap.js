/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
// run integration tests via versioned runner
require('../../integration/fastify/fastify.tap.js')

require('../../integration/fastify/naming.tap.js')

require('../../integration/fastify/errors.tap.js')

require('../../integration/fastify/new-state-tracking.tap.js')
