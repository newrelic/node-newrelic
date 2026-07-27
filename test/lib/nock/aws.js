/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const nock = require('nock')

module.exports.mockAWSInfo = function () {
  const awsHost = 'http://169.254.169.254'
  const awsResponses = {
    'instance-type': 'test.type',
    'instance-id': 'test.id',
    'placement/availability-zone': 'us-west-2b'
  }

  const awsRedirect = nock(awsHost)
  for (const awsPath in awsResponses) {
    if (Object.hasOwnProperty.call(awsResponses, awsPath)) {
      awsRedirect.get('/2008-02-01/meta-data/' + awsPath).reply(200, awsResponses[awsPath])
    }
  }
}
