/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Mock most methods so we can control the results.
 * Wrap calling the callback in a `setImmediate` so it will
 * properly emit both `end` and `asyncEnd` within the tracing channel
 * @param {object} params to function
 * @param {object} params.dns dns package
 * @param {object} params.sandbox sinon sandbox
 */
module.exports = function mockDns({ dns, sandbox }) {
  sandbox.stub(dns, 'reverse').callsFake((_addr, cb) => {
    setImmediate(() => {
      cb(null, ['localhost'])
    })
  })
  sandbox.stub(dns.promises, 'reverse').callsFake(async() => Promise.resolve(['localhost']))

  sandbox.stub(dns, 'resolve').callsFake((_, cb) => {
    setImmediate(() => {
      cb(null, ['127.0.0.1'])
    })
  })
  sandbox.stub(dns.Resolver.prototype, 'resolve').callsFake((_, cb) => {
    setImmediate(() => {
      cb(null, ['127.0.0.1'])
    })
  })
  sandbox.stub(dns.promises, 'resolve').callsFake(async () => Promise.resolve(['127.0.0.1']))
  sandbox.stub(dns.promises.Resolver.prototype, 'resolve').callsFake(async () => Promise.resolve(['127.0.0.1']))
  sandbox.stub(dns, 'resolve4').callsFake((_, cb) => {
    setImmediate(() => {
      cb(null, ['127.0.0.1'])
    })
  })
  sandbox.stub(dns.promises, 'resolve4').callsFake(async () => Promise.resolve(['127.0.0.1']))
  sandbox.stub(dns, 'resolve6').callsFake((_, cb) => {
    setImmediate(() => {
      cb(null, ['::1'])
    })
  })
  sandbox.stub(dns.promises, 'resolve6').callsFake(async () => Promise.resolve(['::1']))
  const error = Error('boom')
  error.code = 'ENODATA'
  sandbox.stub(dns, 'resolveCname').callsFake((_, cb) => {
    setImmediate(() => {
      cb(error)
    })
  })
  sandbox.stub(dns.promises, 'resolveCname').callsFake(async () => Promise.reject(error))
  sandbox.stub(dns, 'resolveMx').callsFake((_, cb) => {
    setImmediate(() => {
      cb(null, ['127.0.0.1'])
    })
  })
  sandbox.stub(dns.promises, 'resolveMx').callsFake(async () => Promise.resolve(['127.0.0.1']))
  sandbox.stub(dns, 'resolveNs').callsFake((_, cb) => {
    setImmediate(() => {
      cb(null, ['a.iana-servers.net', 'b.iana-servers.net'])
    })
  })
  sandbox.stub(dns.promises, 'resolveNs').callsFake(async () => Promise.resolve(['a.iana-servers.net', 'b.iana-servers.net']))
  sandbox.stub(dns, 'resolveTxt').callsFake((_, cb) => {
    setImmediate(() => {
      cb(null, ['one', 'two', 'three'])
    })
  })
  sandbox.stub(dns.promises, 'resolveTxt').callsFake(async () => Promise.resolve(['one', 'two', 'three']))
  sandbox.stub(dns, 'resolveSrv').callsFake((_, cb) => {
    setImmediate(() => {
      cb(error)
    })
  })
  sandbox.stub(dns.promises, 'resolveSrv').callsFake(async () => Promise.reject(error))
}
