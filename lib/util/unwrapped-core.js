/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const copy = require('./copy')
const fs = require('fs')
const fsPromises = require('fs/promises')

exports.fs = copy.shallow(fs)
exports.fsPromises = copy.shallow(fsPromises)
