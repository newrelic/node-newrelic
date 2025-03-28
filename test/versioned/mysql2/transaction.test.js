/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const transactionTests = require('../mysql/transactions')
const constants = require('./constants')

transactionTests({ factory: () => require('mysql2'), constants })
