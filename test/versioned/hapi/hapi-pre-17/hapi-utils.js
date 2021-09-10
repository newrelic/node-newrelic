/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

exports.getServer = function getServer(cfg) {
  cfg = cfg || {}
  const host = cfg.host || 'localhost'
  const port = cfg.port || 0
  const opts = cfg.options || {}
  const hapi = cfg.hapi || require('hapi')

  if (hapi.createServer) {
    return hapi.createServer(host, port, opts)
  }
  // v8-16
  const server = new hapi.Server(opts)
  server.connection({
    host: host,
    port: port
  })
  return server
}

exports.verifier = function verifier(t, verb) {
  verb = verb || 'GET'
  return function (transaction) {
    t.equal(
      transaction.name,
      'WebTransaction/Hapi/' + verb + '//test/{id}',
      'transaction has expected name'
    )

    t.equal(transaction.url, '/test/31337', 'URL is left alone')
    t.equal(transaction.statusCode, 200, 'status code is OK')
    t.equal(transaction.verb, verb, 'HTTP method is ' + verb)
    t.ok(transaction.trace, 'transaction has trace')

    const web = transaction.trace.root.children[0]
    t.ok(web, 'trace has web segment')
    t.equal(web.name, transaction.name, 'segment name and transaction name match')

    t.equal(web.partialName, 'Hapi/' + verb + '//test/{id}', 'should have partial name for apdex')

    t.equal(
      web.getAttributes()['request.parameters.id'],
      '31337',
      'namer gets attributes out of route'
    )
  }
}
