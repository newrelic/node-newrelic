/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const proxyquire = require('proxyquire')
const sinon = require('sinon')
const { EventEmitter } = require('events')
const { removeModules } = require('#testlib/cache-buster.js')

const SCRIPT_PATH = '../version-manager'

function afterEach() {
  removeModules(['commander'])
}

function makeRunner(opts = {}) {
  const runner = new EventEmitter()
  runner.failures = opts.failures ?? []
  runner.tests = opts.tests ?? []
  runner.opts = opts.runnerOpts ?? {}
  runner.start = sinon.stub().resolves()
  return runner
}

function makePrinter() {
  return {
    update: sinon.stub(),
    end: sinon.stub()
  }
}

test('version-manager script', async (t) => {
  await t.test('int', async (t) => {
    t.beforeEach((ctx) => {
      const script = proxyquire(SCRIPT_PATH, {
        colors: {},
        './versioned-runner/suite': sinon.stub(),
        './versioned-runner/printers': {},
        './versioned-runner/globber': { buildGlobs: sinon.stub(), resolveGlobs: sinon.stub() }
      })
      ctx.nr = { script }
    })

    t.afterEach(afterEach)

    await t.test('should parse a string to an integer', (t) => {
      const { script } = t.nr
      assert.equal(script.int('5'), 5)
      assert.equal(script.int('10'), 10)
    })

    await t.test('should truncate decimal values', (t) => {
      const { script } = t.nr
      assert.equal(script.int('3.9'), 3)
    })
  })

  await t.test('printMode', async (t) => {
    t.beforeEach((ctx) => {
      const script = proxyquire(SCRIPT_PATH, {
        colors: {},
        './versioned-runner/suite': sinon.stub(),
        './versioned-runner/printers': {},
        './versioned-runner/globber': { buildGlobs: sinon.stub(), resolveGlobs: sinon.stub() }
      })
      ctx.nr = { script }
    })

    t.afterEach(afterEach)

    await t.test('should return "pretty" for a valid mode', (t) => {
      const { script } = t.nr
      assert.equal(script.printMode('pretty'), 'pretty')
    })

    await t.test('should return "simple" for a valid mode', (t) => {
      const { script } = t.nr
      assert.equal(script.printMode('simple'), 'simple')
    })

    await t.test('should return "quiet" for a valid mode', (t) => {
      const { script } = t.nr
      assert.equal(script.printMode('quiet'), 'quiet')
    })

    await t.test('should call process.exit(5) for an invalid mode', (t) => {
      const { script } = t.nr
      const exitStub = sinon.stub(process, 'exit')
      t.after(() => exitStub.restore())

      script.printMode('invalid')

      assert.ok(exitStub.calledWith(5))
    })
  })

  await t.test('run', async (t) => {
    t.beforeEach((ctx) => {
      const runner = makeRunner()
      const MockSuite = sinon.stub().returns(runner)
      const printer = makePrinter()
      const MockPrettyPrinter = sinon.stub().returns(printer)
      const MockSimplePrinter = sinon.stub().returns(printer)
      const MockQuietPrinter = sinon.stub().returns(printer)

      const mockPrinters = {
        PrettyPrinter: MockPrettyPrinter,
        SimplePrinter: MockSimplePrinter,
        QuietPrinter: MockQuietPrinter
      }

      const script = proxyquire(SCRIPT_PATH, {
        colors: {},
        './versioned-runner/suite': MockSuite,
        './versioned-runner/printers': mockPrinters,
        './versioned-runner/globber': { buildGlobs: sinon.stub(), resolveGlobs: sinon.stub() }
      })

      ctx.nr = { script, runner, MockSuite, printer, mockPrinters }
    })

    t.afterEach(afterEach)

    await t.test('should create a Suite with the resolved file directories', async (t) => {
      const { script, MockSuite } = t.nr
      const files = ['test/versioned/foo/foo.test.js']
      const cmd = { print: 'pretty', jobs: 2, major: false, patch: false }

      await script.run(files, [], cmd)

      assert.equal(MockSuite.callCount, 1)
      const [dirs, opts] = MockSuite.firstCall.args
      assert.ok(Array.isArray(dirs))
      assert.equal(opts.limit, 2)
      assert.equal(opts.versions, 'minor')
    })

    await t.test('should set versions mode to "major" when cmd.major is true', async (t) => {
      const { script, MockSuite } = t.nr
      const cmd = { print: 'pretty', jobs: 1, major: true, patch: false }

      await script.run(['test/foo/foo.test.js'], [], cmd)

      const [, opts] = MockSuite.firstCall.args
      assert.equal(opts.versions, 'major')
    })

    await t.test('should set versions mode to "patch" when cmd.patch is true', async (t) => {
      const { script, MockSuite } = t.nr
      const cmd = { print: 'pretty', jobs: 1, major: false, patch: true }

      await script.run(['test/foo/foo.test.js'], [], cmd)

      const [, opts] = MockSuite.firstCall.args
      assert.equal(opts.versions, 'patch')
    })

    await t.test('should use PrettyPrinter when print mode is "pretty"', async (t) => {
      const { script, mockPrinters } = t.nr
      const cmd = { print: 'pretty', jobs: 1, major: false, patch: false }

      await script.run(['test/foo/foo.test.js'], [], cmd)

      assert.equal(mockPrinters.PrettyPrinter.callCount, 1)
      assert.equal(mockPrinters.SimplePrinter.callCount, 0)
    })

    await t.test('should use SimplePrinter when print mode is "simple"', async (t) => {
      const { script, mockPrinters } = t.nr
      const cmd = { print: 'simple', jobs: 1, major: false, patch: false }

      await script.run(['test/foo/foo.test.js'], [], cmd)

      assert.equal(mockPrinters.SimplePrinter.callCount, 1)
      assert.equal(mockPrinters.PrettyPrinter.callCount, 0)
    })

    await t.test('should call runner.start()', async (t) => {
      const { script, runner } = t.nr
      const cmd = { print: 'quiet', jobs: 1, major: false, patch: false }

      await script.run(['test/foo/foo.test.js'], [], cmd)

      assert.equal(runner.start.callCount, 1)
    })

    await t.test('should call process.exit(4) when there are failures', async (t) => {
      const { script, runner } = t.nr
      runner.failures = [
        { currentRun: { packageVersions: ['foo@1.0.0'], test: 'test/foo.js' } }
      ]
      const exitStub = sinon.stub(process, 'exit')
      t.after(() => exitStub.restore())

      const cmd = { print: 'quiet', jobs: 1, major: false, patch: false }
      await script.run(['test/foo/foo.test.js'], [], cmd)

      assert.ok(exitStub.calledWith(4))
    })
  })
})
