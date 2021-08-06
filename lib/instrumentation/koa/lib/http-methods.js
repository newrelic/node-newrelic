/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const http = require('http')
const methodsLower = http.METHODS.map((method) => method.toLowerCase())
module.exports.METHODS = methodsLower
