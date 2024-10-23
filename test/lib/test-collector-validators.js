/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const util = require('node:util')

class CollectorValidators {
  httpHeaders(req, validation = {}) {
    const errors = []

    const encoding = req.getHeader('content-encoding')
    if (!encoding) {
      errors.push("'Content-Encoding' not set")
    } else if (encoding !== 'identity' && encoding !== 'deflate') {
      errors.push(
        util.format("'Content-Encoding' must be 'identity' or 'deflate', not '%s'", encoding)
      )
    }

    if (req.getHeader('content-type') !== 'application/json') {
      errors.push(
        "you really ought to be setting 'Content-Type' to 'application/json' (The collector doesn't care, though)"
      )
    }

    // NewRelic-NodeAgent/0.9.1-46 (nodejs 0.8.12 darwin-x64)
    const userAgentPattern = /^NewRelic-[a-zA-Z0-9]+\/[0-9.\-]+ \(.+\)$/
    if (userAgentPattern.test(req.getHeader('User-Agent')) === false) {
      errors.push("'User-Agent' should conform to New Relic standards")
    }

    if (errors.length > 0) {
      validation.header_errors = errors
    }

    return validation
  }

  queryString(query, validation = {}) {
    const errors = []

    if (!query.marshal_format) {
      errors.push('marshal_format not set')
    } else if (query.marshal_format !== 'json') {
      errors.push(util.format('this validator checks JSON, not %s', query.marshal_format))
    }

    const version = query.protocol_version
    if (!version) {
      errors.push('protocol_version not set')
    } else if (version < 9 || version > 17) {
      errors.push(util.format('protocol_version %d is not between 9 and 17', version))
    }

    if (!query.license_key) {
      errors.push('license_key not set')
    }

    if (!query.method) {
      errors.push('no method to be invoked')
    }

    if (errors.length > 0) {
      validation.query_errors = errors
    }

    return validation
  }
}

module.exports = CollectorValidators
