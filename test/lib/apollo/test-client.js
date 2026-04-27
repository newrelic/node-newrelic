/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const http = require('node:http')

/**
 * Execute a GraphQL POST request with multiple queries batched.
 * Data will be sent up in form [{ query: <input 0> }, { query: <input 1> }, ...]
 * @param {string} url to make request to
 * @param {Array} queries list of queries to make
 * @param {Function} callback function to call after request
 */
function executeQueryBatch(url, queries, callback) {
  const data = queries.map((innerQuery) => {
    return { query: innerQuery }
  })

  const postData = JSON.stringify(data)

  makeRequest(url, postData, callback)
}

/**
 * Execute a GraphQL POST request for a single query.
 * Data will be sent up in form { query: <input> }
 * @param {string} url to make request to
 * @param {string} query to make
 * @param {Function} callback function to call after request
 */
function executeQuery(url, query, callback) {
  const postData = JSON.stringify({ query })

  makeRequest(url, postData, callback)
}

/**
 * Execute a GraphQL POST request with the given JSON.
 * Data will not be modified other than stringifying.
 * @param {string} url to make request to
 * @param {object} json post data
 * @param {Function} callback function to call after request
 */
function executeJson(url, json, callback) {
  const postData = JSON.stringify(json)
  makeRequest(url, postData, callback)
}

/**
 * Execute a graphql request
 * @param {string} url to make request to
 * @param {object} postData post data
 * @param {Function} callback function to call after request
 */
function makeRequest(url, postData, callback) {
  const options = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'client-name': 'ApolloTestClient'
    }
  }

  if (postData) {
    options.method = 'POST'
    options.headers['Content-Length'] = Buffer.byteLength(postData)
  }

  const req = http.request(url, options, (res) => {
    res.setEncoding('utf8')

    let data = ''
    res.on('data', (chunk) => {
      data += chunk
    })

    res.on('end', () => {
      const result = JSON.parse(data)
      callback(null, result)
    })
  })

  req.on('error', (e) => {
    callback(e)
  })

  if (postData) {
    req.write(postData)
  }
  req.end()
}

module.exports = {
  executeJson,
  executeQuery,
  executeQueryBatch,
  makeRequest
}
