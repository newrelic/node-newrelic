/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const basicPoolTests = require('../mysql/basic-pool')
const constants = require('./constants')
const helper = require('../../lib/agent_helper')

const pkgVersion = helper.readPackageVersion(__dirname, 'mysql2')
basicPoolTests({ factory: () => require('mysql2'), constants, pkgVersion })
