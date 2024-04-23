/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const common = module.exports
const path = require('path')
const fs = require('fs')

common.parseBody = function parseBody(body, headers) {
  try {
    const parsed = JSON.parse(body)
    parsed.Action = headers['x-amz-target'].split('.')[1]
    return parsed
  } catch {
    const parsed = Object.create(null)

    const items = body.split('&')
    items.forEach((item) => {
      const [key, value] = item.split('=')
      parsed[key] = value
    })

    return parsed
  }
}

common.readFromXml = function readFromXml(filePath, callback) {
  const fullPath = path.join(__dirname, filePath)
  fs.readFile(fullPath, 'utf8', function (err, data) {
    callback(err, data)
  })
}
