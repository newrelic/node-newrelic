/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var copy = require('./copy')
var fs = require('fs')

exports.fs = copy.shallow(fs)
