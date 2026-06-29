/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Represents the list of methods/commmands that are available in the MongoDB
 * client which target the "admin" collection instead of the actually selected
 * collection.
 *
 * @see https://jira.mongodb.org/browse/NODE-827
 * @type {string[]}
 */
module.exports = [
  'rename',
  'renameCollection'
]
