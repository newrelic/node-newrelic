/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const helpers = module.exports
const { readFromXml } = require('../common')

let createQueueResponse = null
helpers.getCreateQueueResponse = function getCreateQueueResponse(endpoint, queueName, callback) {
  if (createQueueResponse) {
    const modifiedResponse = replaceQueueUrl(createQueueResponse, endpoint, queueName)

    setImmediate(() => {
      callback(null, modifiedResponse)
    })
    return
  }

  readFromXml('./sqs/responses/create-queue-response.xml', (err, data) => {
    if (err) {
      callback(err)
      return
    }

    createQueueResponse = data
    const modifiedResponse = replaceQueueUrl(createQueueResponse, endpoint, queueName)

    callback(null, modifiedResponse)
  })
}

function replaceQueueUrl(xml, endpoint, queueName) {
  const modifiedResponse = xml.replace(
    '<QueueUrl></QueueUrl>',
    `<QueueUrl>${endpoint}/queue/${queueName}</QueueUrl>`
  )

  return modifiedResponse
}

let sendMessageResponse = null
helpers.getSendMessageResponse = function getSendMessageResponse(callback) {
  if (sendMessageResponse) {
    setImmediate(() => {
      callback(null, sendMessageResponse)
    })
    return
  }

  readFromXml('./sqs/responses/send-message-response.xml', (err, data) => {
    if (err) {
      callback(err)
      return
    }

    sendMessageResponse = data
    callback(null, sendMessageResponse)
  })
}

let sendMessageBatchResponse = null
helpers.getSendMessageBatchResponse = function getSendMessageBatchResponse(callback) {
  if (sendMessageBatchResponse) {
    setImmediate(() => {
      callback(null, sendMessageBatchResponse)
    })
    return
  }

  readFromXml('./sqs/responses/send-message-batch-response.xml', (err, data) => {
    if (err) {
      callback(err)
      return
    }

    sendMessageBatchResponse = data
    callback(null, sendMessageBatchResponse)
  })
}

let receiveMessageResponse = null
helpers.getReceiveMessageResponse = function getReceiveMessageResponse(callback) {
  if (receiveMessageResponse) {
    setImmediate(() => {
      callback(null, receiveMessageResponse)
    })
    return
  }

  readFromXml('./sqs/responses/receive-message-response.xml', (err, data) => {
    if (err) {
      callback(err)
      return
    }

    receiveMessageResponse = data
    callback(null, receiveMessageResponse)
  })
}
