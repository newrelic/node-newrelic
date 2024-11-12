/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const basicPoolTests = require('./basic-pool')
const constants = require('./constants')
const { version: pkgVersion } = require('mysql/package')

basicPoolTests({ factory: () => require('mysql'), constants, pkgVersion })
