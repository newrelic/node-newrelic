/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const Timer = require('../../lib/timer')

test('Timer', async function (t) {
  await t.test("should know when it's active", function () {
    const timer = new Timer()
    assert.equal(timer.isActive(), true)
  })

  await t.test("should know when it hasn't yet been started", function () {
    const timer = new Timer()
    assert.equal(timer.isRunning(), false)
  })

  await t.test("should know when it's running", function () {
    const timer = new Timer()
    timer.begin()
    assert.equal(timer.isRunning(), true)
  })

  await t.test("should know when it's not running", function () {
    const timer = new Timer()
    assert.equal(timer.isRunning(), false)

    timer.begin()
    timer.end()
    assert.equal(timer.isRunning(), false)
  })

  await t.test("should know when it hasn't yet been stopped", function () {
    const timer = new Timer()
    assert.equal(timer.isActive(), true)

    timer.begin()
    assert.equal(timer.isActive(), true)
  })

  await t.test("should know when it's stopped", function () {
    const timer = new Timer()
    timer.begin()
    timer.end()

    assert.equal(timer.isActive(), false)
  })

  await t.test('should return the time elapsed of a running timer', function (t, end) {
    const timer = new Timer()
    timer.begin()
    setTimeout(function () {
      assert.ok(timer.getDurationInMillis() > 3)

      end()
    }, 5)
  })

  await t.test('should allow setting the start as well as the duration of the range', function () {
    const timer = new Timer()
    const start = Date.now()
    timer.setDurationInMillis(5, start)

    assert.equal(timer.start, start)
  })

  await t.test('should return a range object', function () {
    const timer = new Timer()
    const start = Date.now()
    timer.setDurationInMillis(5, start)

    assert.deepEqual(timer.toRange(), [start, start + 5])
  })

  await t.test('should calculate start times relative to other timers', function (t, end) {
    const first = new Timer()
    first.begin()

    const second = new Timer()
    second.begin()

    first.end()
    second.end()

    let delta
    assert.doesNotThrow(function () {
      delta = second.startedRelativeTo(first)
    })
    assert.ok(typeof delta === 'number')
    end()
  })

  await t.test('should support updating the duration with touch', function (t, end) {
    const timer = new Timer()
    timer.begin()

    setTimeout(function () {
      timer.touch()
      const first = timer.getDurationInMillis()

      assert.ok(first > 0)
      assert.equal(timer.isActive(), true)

      setTimeout(function () {
        timer.end()

        const second = timer.getDurationInMillis()
        assert.ok(second > first)
        assert.equal(timer.isActive(), false)

        end()
      }, 20)
    }, 20)
  })

  await t.test('endsAfter indicates whether the timer ended after another timer', async (t) => {
    t.beforeEach(function (ctx) {
      ctx.nr = {}
      const start = Date.now()
      const first = new Timer()
      first.setDurationInMillis(10, start)
      ctx.nr.second = new Timer()
      ctx.nr.start = start
      ctx.nr.first = first
    })

    await t.test('with the same start and duration', function (t) {
      const { start, second, first } = t.nr
      second.setDurationInMillis(10, start)
      assert.equal(second.endsAfter(first), false)
    })

    await t.test('with longer duration', function (t) {
      const { start, second, first } = t.nr
      second.setDurationInMillis(11, start)
      assert.equal(second.endsAfter(first), true)
    })

    await t.test('with shorter duration', function (t) {
      const { start, second, first } = t.nr
      second.setDurationInMillis(9, start)
      assert.equal(second.endsAfter(first), false)
    })

    await t.test('with earlier start', function (t) {
      const { start, second, first } = t.nr
      second.setDurationInMillis(10, start - 1)
      assert.equal(second.endsAfter(first), false)
    })

    await t.test('with later start', function (t) {
      const { start, second, first } = t.nr
      second.setDurationInMillis(10, start + 1)
      assert.equal(second.endsAfter(first), true)
    })
  })

  await t.test('overwriteDurationInMillis', async function (t) {
    await t.test('stops the timer', function () {
      const timer = new Timer()
      timer.begin()
      assert.equal(timer.isActive(), true)

      timer.overwriteDurationInMillis(10)
      assert.equal(timer.isActive(), false)
    })

    await t.test('overwrites duration recorded by end() and touch()', function (t, end) {
      const timer = new Timer()
      timer.begin()
      setTimeout(function () {
        assert.equal(timer.getDurationInMillis() > 1, true)
        timer.overwriteDurationInMillis(1)
        assert.equal(timer.getDurationInMillis(), 1)
        end()
      }, 2)
    })
  })
})
