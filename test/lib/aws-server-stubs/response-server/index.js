/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const http = require('http')
const dns = require('node:dns')
const semver = require('semver')
const { getAddTagsResponse } = require('./elasticache')
const { getAcceptExchangeResponse } = require('./redshift')
const { getSendEmailResponse } = require('./ses')
const { getPublishResponse, getListTopicsResponse } = require('./sns')
const {
  getCreateQueueResponse,
  getSendMessageResponse,
  getSendMessageBatchResponse,
  getReceiveMessageResponse
} = require('./sqs')
const { parseBody } = require('./common')
const { patchDestroy } = require('../common')

function createResponseServer() {
  const server = http.createServer(function (req, res) {
    if (req.method === 'POST') {
      handlePost(req, res)
      return
    }

    res.statusCode = 500
    res.end()
  })

  const lookup = dns.lookup
  dns.lookup = (...args) => {
    const address = args[0]
    if (address === 'sqs.us-east-1.amazonaws.com') {
      if (semver.satisfies(process.version, '18')) {
        return args.pop()(null, '127.0.0.1', 4)
      }
      // Node >= 20 changes the callback signature.
      return args.pop()(null, [{ address: '127.0.0.1', family: 4 }])
    }
    lookup.apply(dns, args)
  }

  const close = server.close
  server.close = () => {
    close.call(server)
    dns.lookup = lookup
  }

  patchDestroy(server)

  return server
}

function handlePost(req, res) {
  let body = ''

  req.on('data', (chunk) => {
    body += chunk.toString()
  })

  req.on('end', () => {
    const isJson = !!req.headers['x-amz-target']
    const endpoint = `http://${req.headers.host}`
    const parsed = parseBody(body, req.headers)

    const getDataFunction = createGetDataFromAction(endpoint, parsed, isJson)

    getDataFunction((err, data) => {
      if (err) {
        res.statusCode = 500
        // eslint-disable-next-line no-console
        console.log(err)
      }

      if (isJson) {
        res.setHeader('x-amz-request-id', data.ResponseMetadata.RequestId)
        data = JSON.stringify(data)
      }
      res.end(data)
    })
  })
}

function createGetDataFromAction(endpoint, body, isJson) {
  switch (body.Action) {
    case 'Publish':
      return getPublishResponse.bind(null)
    case 'ListTopics':
      return getListTopicsResponse.bind(null)
    case 'CreateQueue':
      return getCreateQueueResponse.bind(null, endpoint, body.QueueName, isJson)
    case 'SendMessage':
      return getSendMessageResponse.bind(null, isJson)
    case 'SendMessageBatch':
      return getSendMessageBatchResponse.bind(null, isJson)
    case 'ReceiveMessage':
      return getReceiveMessageResponse.bind(null, isJson)
    case 'SendEmail':
      return getSendEmailResponse.bind(null)
    case 'AcceptReservedNodeExchange':
      return getAcceptExchangeResponse.bind(null)
    case 'AddTagsToResource':
      return getAddTagsResponse.bind(null)
    default:
      return function actionNotImplemented(callback) {
        setImmediate(() => {
          callback(new Error('Action not implemented'))
        })
      }
  }
}

module.exports = createResponseServer
