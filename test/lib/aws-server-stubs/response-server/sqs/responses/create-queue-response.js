/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { formatUrl } = require('../index')

module.exports = (endpoint, queueName, isJson) => {
  if (isJson) {
    return {
      QueueUrl: formatUrl(endpoint, queueName),
      ResponseMetadata: {
        RequestId: 'cb919c0a-9bce-4afe-9b48-9bdf2412bb67'
      }
    }
  }
  return `
<CreateQueueResponse>
  <CreateQueueResult>
      <QueueUrl>${formatUrl(endpoint, queueName)}</QueueUrl>
  </CreateQueueResult>
  <ResponseMetadata>
      <RequestId>cb919c0a-9bce-4afe-9b48-9bdf2412bb67</RequestId>
  </ResponseMetadata>
</CreateQueueResponse>`
}
