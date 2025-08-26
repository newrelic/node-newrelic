/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const sinon = require('sinon')
const proxyquire = require('proxyquire')

test('NR URL utilities', async function (t) {
  t.beforeEach(function (ctx) {
    ctx.nr = {}
    const loggerStub = {
      warn: sinon.stub()
    }
    ctx.nr.urltils = proxyquire('../../../lib/util/urltils', {
      '../logger': {
        child: sinon.stub().returns(loggerStub)
      }
    })
    ctx.nr.loggerStub = loggerStub
  })

  await t.test('parsing parameters', async function (t) {
    await t.test('should find empty object of params in url lacking query', function (t) {
      const { urltils } = t.nr
      const url = new URL('http://example.com/favicon.ico')
      assert.deepEqual(urltils.parseParameters(url), {})
    })

    await t.test('should find v param in url containing ?v with no value', function (t) {
      const { urltils } = t.nr
      const url = new URL('http://example.com/status?v')
      assert.deepEqual(urltils.parseParameters(url), { v: true })
    })

    await t.test('should find v param with value in url containing ?v=1', function (t) {
      const { urltils } = t.nr
      const url = new URL('http://example.com/status?v=1')
      assert.deepEqual(urltils.parseParameters(url), { v: '1' })
    })

    await t.test('should parsed multiple params', function (t) {
      const { urltils } = t.nr
      const url = new URL('http://example.com/status?v=1&test=bar&empty=&t')
      assert.deepEqual(urltils.parseParameters(url), { v: '1', test: 'bar', empty: '', t: true })
    })
  })

  await t.test('scrub url', async function (t) {
    await t.test('should scrub url if it contains session info in uri', function (t) {
      const { urltils } = t.nr
      const url = new URL('http://example.com/status;foo=bar;sessionid=1234;baz=quux?v=1&test=bar&empty=&t')
      assert.equal(urltils.scrub(url), '/status')
    })

    await t.test('should not scrub url if it does not contain session info in uri', function (t) {
      const { urltils } = t.nr
      const url = new URL('http://example.com/status?v=1&test=bar&empty=&t')
      assert.equal(urltils.scrub(url), '/status')
    })

    await t.test('should not scrub url if it does not contain session info in uri and no path', function (t) {
      const { urltils } = t.nr
      const url = new URL('http://example.com')
      assert.equal(urltils.scrub(url), '/')
    })
  })

  await t.test('should scrub and parse params', function (t) {
    const { urltils } = t.nr
    const url = new URL('http://example.com/status;foo=bar;sessionid=1234;baz=quux?v=1&test=bar&empty=&t')
    assert.deepEqual(urltils.scrubAndParseParameters(url), {
      protocol: 'http:',
      path: '/status',
      parameters: { v: '1', test: 'bar', empty: '', t: true }
    })
  })

  await t.test('determining whether an HTTP status code is an error', async function (t) {
    let config = { error_collector: { ignore_status_codes: [] } }

    await t.test('should not throw when called with no params', function (t) {
      const { urltils } = t.nr
      assert.doesNotThrow(function () {
        urltils.isError()
      })
    })

    await t.test('should not throw when called with no code', function (t) {
      const { urltils } = t.nr
      assert.doesNotThrow(function () {
        urltils.isError(config)
      })
    })

    await t.test('should not throw when config is missing', function (t) {
      const { urltils } = t.nr
      assert.doesNotThrow(function () {
        urltils.isError(null, 200)
      })
    })

    await t.test('should NOT mark an OK request as an error', function (t) {
      const { urltils } = t.nr
      assert.equal(urltils.isError(config, 200), false)
    })

    await t.test('should NOT mark a permanent redirect as an error', function (t) {
      const { urltils } = t.nr
      assert.equal(urltils.isError(config, 301), false)
    })

    await t.test('should NOT mark a temporary redirect as an error', function (t) {
      const { urltils } = t.nr
      assert.equal(urltils.isError(config, 303), false)
    })

    await t.test('should mark a bad request as an error', function (t) {
      const { urltils } = t.nr
      assert.equal(urltils.isError(config, 400), true)
    })

    await t.test('should mark an unauthorized request as an error', function (t) {
      const { urltils } = t.nr
      assert.equal(urltils.isError(config, 401), true)
    })

    await t.test('should mark a "payment required" request as an error', function (t) {
      const { urltils } = t.nr
      assert.equal(urltils.isError(config, 402), true)
    })

    await t.test('should mark a forbidden request as an error', function (t) {
      const { urltils } = t.nr
      assert.equal(urltils.isError(config, 403), true)
    })

    await t.test('should mark a not found request as an error', function (t) {
      const { urltils } = t.nr
      assert.equal(urltils.isError(config, 404), true)
    })

    await t.test('should mark a request with too long a URI as an error', function (t) {
      const { urltils } = t.nr
      assert.equal(urltils.isError(config, 414), true)
    })

    await t.test('should mark a method not allowed request as an error', function (t) {
      const { urltils } = t.nr
      assert.equal(urltils.isError(config, 405), true)
    })

    await t.test('should mark a request with unacceptable types as an error', function (t) {
      const { urltils } = t.nr
      assert.equal(urltils.isError(config, 406), true)
    })

    await t.test('should mark a request requiring proxy auth as an error', function (t) {
      const { urltils } = t.nr
      assert.equal(urltils.isError(config, 407), true)
    })

    await t.test('should mark a timed out request as an error', function (t) {
      const { urltils } = t.nr
      assert.equal(urltils.isError(config, 408), true)
    })

    await t.test('should mark a conflicted request as an error', function (t) {
      const { urltils } = t.nr
      assert.equal(urltils.isError(config, 409), true)
    })

    await t.test('should mark a request for a disappeared resource as an error', function (t) {
      const { urltils } = t.nr
      assert.equal(urltils.isError(config, 410), true)
    })

    await t.test('should mark a request with a missing length as an error', function (t) {
      const { urltils } = t.nr
      assert.equal(urltils.isError(config, 411), true)
    })

    await t.test('should mark a request with a failed precondition as an error', function (t) {
      const { urltils } = t.nr
      assert.equal(urltils.isError(config, 412), true)
    })

    await t.test('should mark a too-large request as an error', function (t) {
      const { urltils } = t.nr
      assert.equal(urltils.isError(config, 413), true)
    })

    await t.test('should mark a request for an unsupported media type as an error', function (t) {
      const { urltils } = t.nr
      assert.equal(urltils.isError(config, 415), true)
    })

    await t.test('should mark a request for an unsatisfiable range as an error', function (t) {
      const { urltils } = t.nr
      assert.equal(urltils.isError(config, 416), true)
    })

    await t.test('should mark a request with a failed expectation as an error', function (t) {
      const { urltils } = t.nr
      assert.equal(urltils.isError(config, 417), true)
    })

    await t.test('should mark a request asserting teapotness as an error', function (t) {
      const { urltils } = t.nr
      assert.equal(urltils.isError(config, 418), true)
    })

    await t.test('should mark a request with timed-out auth as an error', function (t) {
      const { urltils } = t.nr
      assert.equal(urltils.isError(config, 419), true)
    })

    await t.test('should mark a request for enhanced calm (brah) as an error', function (t) {
      const { urltils } = t.nr
      assert.equal(urltils.isError(config, 420), true)
    })

    await t.test('should work with strings', function (t) {
      const { urltils } = t.nr
      config = { error_collector: { ignore_status_codes: [403] } }
      assert.equal(urltils.isError(config, '200'), false)
      assert.equal(urltils.isError(config, '403'), false)
      assert.equal(urltils.isError(config, '404'), true)
    })
  })

  await t.test('isIgnoredError', async function (t) {
    const config = { error_collector: { ignore_status_codes: [] } }

    await t.test('returns true if the status code is an HTTP error in the ignored list', (t) => {
      const { urltils } = t.nr
      const errorCodes = [
        400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414, 415, 416, 417,
        418, 419, 420, 500, 503
      ]

      errorCodes.forEach((code) => {
        assert.equal(urltils.isIgnoredError(config, code), false)
        config.error_collector.ignore_status_codes = [code]
        assert.equal(urltils.isIgnoredError(config, code), true)
      })
    })

    await t.test('returns false if the status code is NOT an HTTP error', function (t) {
      const { urltils } = t.nr
      const statusCodes = [200]
      statusCodes.forEach((code) => {
        assert.equal(urltils.isIgnoredError(config, code), false)
        config.error_collector.ignore_status_codes = [code]
        assert.equal(urltils.isIgnoredError(config, code), false)
      })
    })
  })

  await t.test('copying parameters from a query hash', async function (t) {
    t.beforeEach(function (ctx) {
      ctx.nr.source = {}
      ctx.nr.dest = {}
    })

    await t.test("shouldn't not throw on missing configuration", function (t) {
      const { urltils, source, dest } = t.nr
      assert.doesNotThrow(function () {
        urltils.copyParameters(null, source, dest)
      })
    })

    await t.test('should not throw on missing source', function (t) {
      const { urltils, dest } = t.nr
      assert.doesNotThrow(function () {
        urltils.copyParameters(null, dest)
      })
    })

    await t.test('should not throw on missing destination', function (t) {
      const { urltils, source } = t.nr
      assert.doesNotThrow(function () {
        urltils.copyParameters(source, null)
      })
    })

    await t.test('should copy parameters from source to destination', function (t) {
      const { urltils, source, dest } = t.nr
      dest.existing = 'here'
      source.firstNew = 'present'
      source.secondNew = 'accounted for'

      assert.doesNotThrow(function () {
        urltils.copyParameters(source, dest)
      })

      assert.deepEqual(dest, {
        existing: 'here',
        firstNew: 'present',
        secondNew: 'accounted for'
      })
    })

    await t.test('should not overwrite existing parameters in destination', function (t) {
      const { urltils, source, dest } = t.nr
      dest.existing = 'here'
      dest.firstNew = 'already around'
      source.firstNew = 'present'
      source.secondNew = 'accounted for'

      urltils.copyParameters(source, dest)

      assert.deepEqual(dest, {
        existing: 'here',
        firstNew: 'already around',
        secondNew: 'accounted for'
      })
    })

    await t.test('should not overwrite null parameters in destination', function (t) {
      const { urltils, source, dest } = t.nr
      dest.existing = 'here'
      dest.firstNew = null
      source.firstNew = 'present'

      urltils.copyParameters(source, dest)

      assert.deepEqual(dest, {
        existing: 'here',
        firstNew: null
      })
    })

    await t.test('should not overwrite undefined parameters in destination', function (t) {
      const { urltils, source, dest } = t.nr
      dest.existing = 'here'
      dest.firstNew = undefined
      source.firstNew = 'present'

      urltils.copyParameters(source, dest)

      assert.deepEqual(dest, {
        existing: 'here',
        firstNew: undefined
      })
    })
  })

  await t.test('obfuscates path by regex', async function (t) {
    t.beforeEach((ctx) => {
      ctx.nr.config = {
        url_obfuscation: {
          enabled: false,
          regex: {
            pattern: null,
            flags: '',
            replacement: ''
          }
        }
      }
      ctx.nr.path = '/foo/123/bar/456/baz/789'
    })

    await t.test('should not obfuscate path by default', function (t) {
      const { urltils, config, path } = t.nr
      assert.equal(urltils.obfuscatePath(config, path), path)
    })

    await t.test(
      'should not obfuscate if obfuscation is enabled but pattern is not set',
      function (t) {
        const { urltils, config, path } = t.nr
        config.url_obfuscation.enabled = true
        assert.equal(urltils.obfuscatePath(config, path), path)
      }
    )

    await t.test(
      'should not obfuscate if obfuscation is enabled but pattern is invalid',
      function (t) {
        const { urltils, config, path } = t.nr
        config.url_obfuscation.enabled = true
        config.url_obfuscation.regex.pattern = '/foo/bar/baz/[0-9]+'
        assert.equal(urltils.obfuscatePath(config, path), path)
      }
    )

    await t.test(
      'should obfuscate with empty string `` if replacement is not set and pattern is set',
      function (t) {
        const { urltils, config, path } = t.nr
        config.url_obfuscation.enabled = true
        config.url_obfuscation.regex.pattern = '/foo/[0-9]+/bar/[0-9]+/baz/[0-9]+'
        assert.equal(urltils.obfuscatePath(config, path), '')
      }
    )

    await t.test(
      'should obfuscate with replacement if replacement is set and pattern is set',
      function (t) {
        const { urltils, config, path } = t.nr
        config.url_obfuscation.enabled = true
        config.url_obfuscation.regex.pattern = '/foo/[0-9]+/bar/[0-9]+/baz/[0-9]+'
        config.url_obfuscation.regex.replacement = '/***'
        assert.equal(urltils.obfuscatePath(config, path), '/***')
      }
    )

    await t.test(
      'should obfuscate as expected with capture groups pattern over strings',
      function (t) {
        const { urltils, config, path } = t.nr
        config.url_obfuscation.enabled = true
        config.url_obfuscation.regex.pattern = '(/foo/)(.*)(/bar/)(.*)(/baz/)(.*)'
        config.url_obfuscation.regex.replacement = '$1***$3***$5***'
        assert.equal(urltils.obfuscatePath(config, path), '/foo/***/bar/***/baz/***')
      }
    )

    await t.test('should obfuscate as expected with regex patterns and flags', function (t) {
      const { urltils, config, path } = t.nr
      config.url_obfuscation.enabled = true
      config.url_obfuscation.regex.pattern = '[0-9]+'
      config.url_obfuscation.regex.flags = 'g'
      config.url_obfuscation.regex.replacement = '***'
      assert.equal(urltils.obfuscatePath(config, path), '/foo/***/bar/***/baz/***')
    })

    await t.test(
      'should call logger warn if obfuscation is enabled but pattern is invalid',
      function (t) {
        const { urltils, config, path } = t.nr
        config.url_obfuscation.enabled = true
        config.url_obfuscation.regex.pattern = '[0-9+'

        urltils.obfuscatePath(config, path)

        assert.equal(t.nr.loggerStub.warn.calledOnce, true)
      }
    )
  })
})
