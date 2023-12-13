/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const hashes = require('../../lib/util/hashes')
const ENCODING_KEY = 'Old Spice'

const SYNTHETICS_DATA_ARRAY = [
  1, // version
  567, // account id
  'resource',
  'job',
  'monitor'
]

const SYNTHETICS_DATA = {
  version: SYNTHETICS_DATA_ARRAY[0],
  accountId: SYNTHETICS_DATA_ARRAY[1],
  resourceId: SYNTHETICS_DATA_ARRAY[2],
  jobId: SYNTHETICS_DATA_ARRAY[3],
  monitorId: SYNTHETICS_DATA_ARRAY[4]
}

const SYNTHETICS_HEADER = hashes.obfuscateNameUsingKey(
  JSON.stringify(SYNTHETICS_DATA_ARRAY),
  ENCODING_KEY
)
const SYNTHETICS_INFO = {
  version: 1,
  type: 'unitTest',
  initiator: 'cli',
  attributes: {
    'Attr-Test': 'value',
    'attr2Test': 'value1',
    'xTest-Header': 'value2'
  }
}
const SYNTHETICS_INFO_HEADER = hashes.obfuscateNameUsingKey(
  JSON.stringify(SYNTHETICS_INFO),
  ENCODING_KEY
)

module.exports = {
  SYNTHETICS_INFO,
  SYNTHETICS_DATA,
  SYNTHETICS_HEADER,
  SYNTHETICS_DATA_ARRAY,
  ENCODING_KEY,
  SYNTHETICS_INFO_HEADER
}
