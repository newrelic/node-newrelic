/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const fs = require('fs')
const path = require('path')
const responses = require('./responses')
const { internals } = require('./index')

tap.test('encodeChunks encodes to an expected stream', async (t) => {
  const expectedData = fs.readFileSync(path.join(__dirname, 'testdata', 'stream.expected.bin'))
  const input = responses.claude.get('ultimate question stream')
  const stream = internals.encodeChunks(input.chunks)

  let foundData = []
  for await (const chunk of stream) {
    foundData.push(chunk)
  }
  foundData = Buffer.concat(foundData)

  t.same(foundData, expectedData)
})
