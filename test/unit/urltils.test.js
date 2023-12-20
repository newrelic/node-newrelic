/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const url = require('url')

tap.test('NR URL utilities', function (t) {
  t.autoend()
  t.beforeEach(function () {
    const loggerStub = {
      warn: sinon.stub()
    }
    t.context.urltils = proxyquire('../../lib/util/urltils', {
      '../logger': {
        child: sinon.stub().returns(loggerStub)
      }
    })
    t.context.loggerStub = loggerStub
  })

  t.test('scrubbing URLs should return "/" if there\'s no leading slash on the path', function (t) {
    const { urltils } = t.context
    t.equal(urltils.scrub('?t_u=http://some.com/o/p'), '/')
    t.end()
  })

  t.test('parsing parameters', function (t) {
    t.autoend()
    t.test('should find empty object of params in url lacking query', function (t) {
      const { urltils } = t.context
      t.same(urltils.parseParameters('/favicon.ico'), {})
      t.end()
    })

    t.test('should find v param in url containing ?v with no value', function (t) {
      const { urltils } = t.context
      t.same(urltils.parseParameters('/status?v'), { v: true })
      t.end()
    })

    t.test('should find v param with value in url containing ?v=1', function (t) {
      const { urltils } = t.context
      t.same(urltils.parseParameters('/status?v=1'), { v: '1' })
      t.end()
    })

    t.test('should find v param when passing in an object', function (t) {
      const { urltils } = t.context
      t.same(urltils.parseParameters(url.parse('/status?v=1', true)), { v: '1' })
      t.end()
    })
  })

  t.test('determining whether an HTTP status code is an error', function (t) {
    t.autoend()
    let config = { error_collector: { ignore_status_codes: [] } }

    t.test('should not throw when called with no params', function (t) {
      const { urltils } = t.context
      t.doesNotThrow(function () {
        urltils.isError()
      })
      t.end()
    })

    t.test('should not throw when called with no code', function (t) {
      const { urltils } = t.context
      t.doesNotThrow(function () {
        urltils.isError(config)
      })
      t.end()
    })

    t.test('should not throw when config is missing', function (t) {
      const { urltils } = t.context
      t.doesNotThrow(function () {
        urltils.isError(null, 200)
      })
      t.end()
    })

    t.test('should NOT mark an OK request as an error', function (t) {
      const { urltils } = t.context
      t.equal(urltils.isError(config, 200), false)
      t.end()
    })

    t.test('should NOT mark a permanent redirect as an error', function (t) {
      const { urltils } = t.context
      t.equal(urltils.isError(config, 301), false)
      t.end()
    })

    t.test('should NOT mark a temporary redirect as an error', function (t) {
      const { urltils } = t.context
      t.equal(urltils.isError(config, 303), false)
      t.end()
    })

    t.test('should mark a bad request as an error', function (t) {
      const { urltils } = t.context
      t.equal(urltils.isError(config, 400), true)
      t.end()
    })

    t.test('should mark an unauthorized request as an error', function (t) {
      const { urltils } = t.context
      t.equal(urltils.isError(config, 401), true)
      t.end()
    })

    t.test('should mark a "payment required" request as an error', function (t) {
      const { urltils } = t.context
      t.equal(urltils.isError(config, 402), true)
      t.end()
    })

    t.test('should mark a forbidden request as an error', function (t) {
      const { urltils } = t.context
      t.equal(urltils.isError(config, 403), true)
      t.end()
    })

    t.test('should mark a not found request as an error', function (t) {
      const { urltils } = t.context
      t.equal(urltils.isError(config, 404), true)
      t.end()
    })

    t.test('should mark a request with too long a URI as an error', function (t) {
      const { urltils } = t.context
      t.equal(urltils.isError(config, 414), true)
      t.end()
    })

    t.test('should mark a method not allowed request as an error', function (t) {
      const { urltils } = t.context
      t.equal(urltils.isError(config, 405), true)
      t.end()
    })

    t.test('should mark a request with unacceptable types as an error', function (t) {
      const { urltils } = t.context
      t.equal(urltils.isError(config, 406), true)
      t.end()
    })

    t.test('should mark a request requiring proxy auth as an error', function (t) {
      const { urltils } = t.context
      t.equal(urltils.isError(config, 407), true)
      t.end()
    })

    t.test('should mark a timed out request as an error', function (t) {
      const { urltils } = t.context
      t.equal(urltils.isError(config, 408), true)
      t.end()
    })

    t.test('should mark a conflicted request as an error', function (t) {
      const { urltils } = t.context
      t.equal(urltils.isError(config, 409), true)
      t.end()
    })

    t.test('should mark a request for a disappeared resource as an error', function (t) {
      const { urltils } = t.context
      t.equal(urltils.isError(config, 410), true)
      t.end()
    })

    t.test('should mark a request with a missing length as an error', function (t) {
      const { urltils } = t.context
      t.equal(urltils.isError(config, 411), true)
      t.end()
    })

    t.test('should mark a request with a failed precondition as an error', function (t) {
      const { urltils } = t.context
      t.equal(urltils.isError(config, 412), true)
      t.end()
    })

    t.test('should mark a too-large request as an error', function (t) {
      const { urltils } = t.context
      t.equal(urltils.isError(config, 413), true)
      t.end()
    })

    t.test('should mark a request for an unsupported media type as an error', function (t) {
      const { urltils } = t.context
      t.equal(urltils.isError(config, 415), true)
      t.end()
    })

    t.test('should mark a request for an unsatisfiable range as an error', function (t) {
      const { urltils } = t.context
      t.equal(urltils.isError(config, 416), true)
      t.end()
    })

    t.test('should mark a request with a failed expectation as an error', function (t) {
      const { urltils } = t.context
      t.equal(urltils.isError(config, 417), true)
      t.end()
    })

    t.test('should mark a request asserting teapotness as an error', function (t) {
      const { urltils } = t.context
      t.equal(urltils.isError(config, 418), true)
      t.end()
    })

    t.test('should mark a request with timed-out auth as an error', function (t) {
      const { urltils } = t.context
      t.equal(urltils.isError(config, 419), true)
      t.end()
    })

    t.test('should mark a request for enhanced calm (brah) as an error', function (t) {
      const { urltils } = t.context
      t.equal(urltils.isError(config, 420), true)
      t.end()
    })

    t.test('should work with strings', function (t) {
      const { urltils } = t.context
      config = { error_collector: { ignore_status_codes: [403] } }
      t.equal(urltils.isError(config, '200'), false)
      t.equal(urltils.isError(config, '403'), false)
      t.equal(urltils.isError(config, '404'), true)
      t.end()
    })
  })

  t.test('isIgnoredError', function (t) {
    t.autoend()
    const config = { error_collector: { ignore_status_codes: [] } }

    t.test('returns true if the status code is an HTTP error in the ignored list', (t) => {
      const { urltils } = t.context
      const errorCodes = [
        400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414, 415, 416, 417,
        418, 419, 420, 500, 503
      ]

      errorCodes.forEach((code) => {
        t.equal(urltils.isIgnoredError(config, code), false)
        config.error_collector.ignore_status_codes = [code]
        t.equal(urltils.isIgnoredError(config, code), true)
      })
      t.end()
    })

    t.test('returns false if the status code is NOT an HTTP error', function (t) {
      const { urltils } = t.context
      const statusCodes = [200]
      statusCodes.forEach((code) => {
        t.equal(urltils.isIgnoredError(config, code), false)
        config.error_collector.ignore_status_codes = [code]
        t.equal(urltils.isIgnoredError(config, code), false)
      })
      t.end()
    })
  })

  t.test('copying parameters from a query hash', function (t) {
    t.autoend()
    t.beforeEach(function (t) {
      t.context.source = {}
      t.context.dest = {}
    })

    t.test("shouldn't not throw on missing configuration", function (t) {
      const { urltils, source, dest } = t.context
      t.doesNotThrow(function () {
        urltils.copyParameters(null, source, dest)
      })
      t.end()
    })

    t.test('should not throw on missing source', function (t) {
      const { urltils, dest } = t.context
      t.doesNotThrow(function () {
        urltils.copyParameters(null, dest)
      })
      t.end()
    })

    t.test('should not throw on missing destination', function (t) {
      const { urltils, source } = t.context
      t.doesNotThrow(function () {
        urltils.copyParameters(source, null)
      })
      t.end()
    })

    t.test('should copy parameters from source to destination', function (t) {
      const { urltils, source, dest } = t.context
      dest.existing = 'here'
      source.firstNew = 'present'
      source.secondNew = 'accounted for'

      t.doesNotThrow(function () {
        urltils.copyParameters(source, dest)
      })

      t.same(dest, {
        existing: 'here',
        firstNew: 'present',
        secondNew: 'accounted for'
      })
      t.end()
    })

    t.test('should not overwrite existing parameters in destination', function (t) {
      const { urltils, source, dest } = t.context
      dest.existing = 'here'
      dest.firstNew = 'already around'
      source.firstNew = 'present'
      source.secondNew = 'accounted for'

      urltils.copyParameters(source, dest)

      t.same(dest, {
        existing: 'here',
        firstNew: 'already around',
        secondNew: 'accounted for'
      })
      t.end()
    })

    t.test('should not overwrite null parameters in destination', function (t) {
      const { urltils, source, dest } = t.context
      dest.existing = 'here'
      dest.firstNew = null
      source.firstNew = 'present'

      urltils.copyParameters(source, dest)

      t.same(dest, {
        existing: 'here',
        firstNew: null
      })
      t.end()
    })

    t.test('should not overwrite undefined parameters in destination', function (t) {
      const { urltils, source, dest } = t.context
      dest.existing = 'here'
      dest.firstNew = undefined
      source.firstNew = 'present'

      urltils.copyParameters(source, dest)

      t.same(dest, {
        existing: 'here',
        firstNew: undefined
      })
      t.end()
    })
  })

  t.test('obfuscates path by regex', function (t) {
    t.autoend()
    t.beforeEach((t) => {
      t.context.config = {
        url_obfuscation: {
          enabled: false,
          regex: {
            pattern: null,
            flags: '',
            replacement: ''
          }
        }
      }
      t.context.path = '/foo/123/bar/456/baz/789'
    })

    t.test('should not obfuscate path by default', function (t) {
      const { urltils, config, path } = t.context
      t.equal(urltils.obfuscatePath(config, path), path)
      t.end()
    })

    t.test('should not obfuscate if obfuscation is enabled but pattern is not set', function (t) {
      const { urltils, config, path } = t.context
      config.url_obfuscation.enabled = true
      t.equal(urltils.obfuscatePath(config, path), path)
      t.end()
    })

    t.test('should not obfuscate if obfuscation is enabled but pattern is invalid', function (t) {
      const { urltils, config, path } = t.context
      config.url_obfuscation.enabled = true
      config.url_obfuscation.regex.pattern = '/foo/bar/baz/[0-9]+'
      t.equal(urltils.obfuscatePath(config, path), path)
      t.end()
    })

    t.test(
      'should obfuscate with empty string `` if replacement is not set and pattern is set',
      function (t) {
        const { urltils, config, path } = t.context
        config.url_obfuscation.enabled = true
        config.url_obfuscation.regex.pattern = '/foo/[0-9]+/bar/[0-9]+/baz/[0-9]+'
        t.equal(urltils.obfuscatePath(config, path), '')
        t.end()
      }
    )

    t.test(
      'should obfuscate with replacement if replacement is set and pattern is set',
      function (t) {
        const { urltils, config, path } = t.context
        config.url_obfuscation.enabled = true
        config.url_obfuscation.regex.pattern = '/foo/[0-9]+/bar/[0-9]+/baz/[0-9]+'
        config.url_obfuscation.regex.replacement = '/***'
        t.equal(urltils.obfuscatePath(config, path), '/***')
        t.end()
      }
    )

    t.test('should obfuscate as expected with capture groups pattern over strings', function (t) {
      const { urltils, config, path } = t.context
      config.url_obfuscation.enabled = true
      config.url_obfuscation.regex.pattern = '(/foo/)(.*)(/bar/)(.*)(/baz/)(.*)'
      config.url_obfuscation.regex.replacement = '$1***$3***$5***'
      t.equal(urltils.obfuscatePath(config, path), '/foo/***/bar/***/baz/***')
      t.end()
    })

    t.test('should obfuscate as expected with regex patterns and flags', function (t) {
      const { urltils, config, path } = t.context
      config.url_obfuscation.enabled = true
      config.url_obfuscation.regex.pattern = '[0-9]+'
      config.url_obfuscation.regex.flags = 'g'
      config.url_obfuscation.regex.replacement = '***'
      t.equal(urltils.obfuscatePath(config, path), '/foo/***/bar/***/baz/***')
      t.end()
    })

    t.test(
      'should call logger warn if obfuscation is enabled but pattern is invalid',
      function (t) {
        const { urltils, config, path } = t.context
        config.url_obfuscation.enabled = true
        config.url_obfuscation.regex.pattern = '[0-9+'

        urltils.obfuscatePath(config, path)

        t.equal(t.context.loggerStub.warn.calledOnce, true)
        t.end()
      }
    )
  })
})
