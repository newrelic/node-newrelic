/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const createEmptyResponseServer = require('./empty-response-server')
const createResponseServer = require('./response-server')
const semver = require('semver')
const path = require('node:path')
const fs = require('node:fs')

// Specific values are unimportant because we'll be hitting our
// custom servers. But they need to be populated.
const FAKE_CREDENTIALS = {
  accessKeyId: 'FAKE ID',
  secretAccessKey: 'FAKE KEY'
}

/**
 * Determines whether to use the http or http2 mock server
 * given the `@aws-sdk/client-bedrock-runtime` package
 * version.
 * @param {string} rootPath The root path to the `node_modules` folder with AWS Bedrock `package.json`.
 * @returns {object} The mock AWS Bedrock server, http or http2.
 */
function getAiResponseServer(rootPath) {
  const bedrockPackagePath = path.join(rootPath, '/node_modules/@aws-sdk/client-bedrock-runtime/package.json')
  const { version: pkgVersion } = JSON.parse(
    fs.readFileSync(bedrockPackagePath)
  )
  if (semver.gte(pkgVersion, '3.798.0')) {
    return require('./ai-server/http2')
  }
  return require('./ai-server')
}

module.exports = {
  createEmptyResponseServer,
  createResponseServer,
  FAKE_CREDENTIALS,
  getAiResponseServer
}
