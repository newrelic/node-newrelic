/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const helpers = module.exports

helpers.getCreateQueueResponse = function getCreateQueueResponse(
  endpoint,
  queueName,
  isJson,
  callback
) {
  const createQueueResponse = require('./responses/create-queue-response')(
    endpoint,
    queueName,
    isJson
  )
  callback(null, createQueueResponse)
}

helpers.formatUrl = function formatUrl(endpoint, queueName) {
  // See https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-queue-message-identifiers.html#sqs-general-identifiers
  // for details on the format of an SQS queue URL.
  return `${endpoint}/1234567890/${queueName}`
}

helpers.getSendMessageResponse = function getSendMessageResponse(isJson, callback) {
  const sendMessageResponse = require('./responses/send-message-response')(isJson)
  callback(null, sendMessageResponse)
}

helpers.getSendMessageBatchResponse = function getSendMessageBatchResponse(isJson, callback) {
  const sendMessageBatchResponse = require('./responses/send-message-batch-response')(isJson)
  callback(null, sendMessageBatchResponse)
}

helpers.getReceiveMessageResponse = function getReceiveMessageResponse(isJson, callback) {
  const receiveMessageResponse = require('./responses/receive-message-response')(isJson)
  callback(null, receiveMessageResponse)
}
