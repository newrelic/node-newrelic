/*
* Copyright 2020 New Relic Corporation. All rights reserved.
* SPDX-License-Identifier: Apache-2.0
*/
'use strict'

const http = require('http')
const fs = require('fs')
const path = require('path')

function createSqsServer() {
  const server = http.createServer(function(req, res) {
    if (req.method === 'POST') {
      handleSqsPost(req, res)
      return
    }

    res.statusCode = 500
    res.end()
  })

  return server
}

function handleSqsPost(req, res) {
  let body = ''

  req.on('data', chunk => {
      body += chunk.toString()
  })

  req.on('end', () => {
    const endpoint = `http://localhost:${req.connection.localPort}`
    const parsed = parseBody(body)

    const getDataFunction = createGetDataFromAction(endpoint, parsed)

    getDataFunction((err, data) => {
      if (err) {
        res.statusCode = 500
        // eslint-disable-next-line no-console
        console.log(err)
      }

      res.end(data)
    })
  })
}

function createGetDataFromAction(endpoint, body) {
  switch (body.Action) {
    case 'CreateQueue':
      return getCreateQueueResponse.bind(null, endpoint, body.QueueName)
    case 'SendMessage':
      return getSendMessageResponse.bind(null)
    case 'SendMessageBatch':
      return getSendMessageBatchResponse.bind(null)
    case 'ReceiveMessage':
      return getReceiveMessageResponse.bind(null)
    default:
      return function actionNotImplemented(callback) {
        setImmediate(() => {
          callback(new Error('Action not implemented'))
        })
      }
  }
}

function parseBody(body) {
  const parsed = Object.create(null)

  const items = body.split('&')
  items.forEach((item) => {
    const [key, value] = item.split('=')
    parsed[key] = value
  })

  return parsed
}

let createQueueResponse = null
function getCreateQueueResponse(endpoint, queueName, callback) {
  if (createQueueResponse) {
    const modifiedResponse = replaceQueueUrl(createQueueResponse, endpoint, queueName)

    setImmediate(() => {
      callback(null, modifiedResponse)
    })
    return
  }

  readFromXml('create-queue-response.xml', (err, data) => {
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
function getSendMessageResponse(callback) {
  if (sendMessageResponse) {
    setImmediate(() => {
      callback(null, sendMessageResponse)
    })
    return
  }

  readFromXml('send-message-response.xml', (err, data) => {
    if (err) {
      callback(err)
      return
    }

    sendMessageResponse = data
    callback(null, sendMessageResponse)
  })
}

let sendMessageBatchResponse = null
function getSendMessageBatchResponse(callback) {
  if (sendMessageBatchResponse) {
    setImmediate(() => {
      callback(null, sendMessageBatchResponse)
    })
    return
  }

  readFromXml('send-message-batch-response.xml', (err, data) => {
    if (err) {
      callback(err)
      return
    }

    sendMessageBatchResponse = data
    callback(null, sendMessageBatchResponse)
  })
}

let receiveMessageResponse = null
function getReceiveMessageResponse(callback) {
  if (receiveMessageResponse) {
    setImmediate(() => {
      callback(null, receiveMessageResponse)
    })
    return
  }

  readFromXml('receive-message-response.xml', (err, data) => {
    if (err) {
      callback(err)
      return
    }

    receiveMessageResponse = data
    callback(null, receiveMessageResponse)
  })
}

function readFromXml(fileName, callback) {
  const fullPath = path.join(__dirname, 'responses', fileName)
  fs.readFile(fullPath, 'utf8', function(err, data) {
    callback(err, data)
  })
}

module.exports = createSqsServer
