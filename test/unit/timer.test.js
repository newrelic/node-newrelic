/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

const chai = require('chai')
const expect = chai.expect
const Timer = require('../../lib/timer')

describe('Timer', function () {
  it("should know when it's active", function () {
    const timer = new Timer()
    expect(timer.isActive()).equal(true)
  })

  it("should know when it hasn't yet been started", function () {
    const timer = new Timer()
    expect(timer.isRunning()).equal(false)
  })

  it("should know when it's running", function () {
    const timer = new Timer()
    timer.begin()
    expect(timer.isRunning()).equal(true)
  })

  it("should know when it's not running", function () {
    const timer = new Timer()
    expect(timer.isRunning()).equal(false)

    timer.begin()
    timer.end()
    expect(timer.isRunning()).equal(false)
  })

  it("should know when it hasn't yet been stopped", function () {
    const timer = new Timer()
    expect(timer.isActive()).equal(true)

    timer.begin()
    expect(timer.isActive()).equal(true)
  })

  it("should know when it's stopped", function () {
    const timer = new Timer()
    timer.begin()
    timer.end()

    expect(timer.isActive()).equal(false)
  })

  it('should return the time elapsed of a running timer', function (done) {
    const timer = new Timer()
    timer.begin()
    setTimeout(function () {
      expect(timer.getDurationInMillis()).above(3)

      return done()
    }, 5)
  })

  it('should allow setting the start as well as the duration of the range', function () {
    const timer = new Timer()
    const start = Date.now()
    timer.setDurationInMillis(5, start)

    expect(timer.start).equal(start)
  })

  it('should return a range object', function () {
    const timer = new Timer()
    const start = Date.now()
    timer.setDurationInMillis(5, start)

    expect(timer.toRange()).deep.equal([start, start + 5])
  })

  it('should calculate start times relative to other timers', function () {
    const first = new Timer()
    first.begin()

    const second = new Timer()
    second.begin()

    first.end()
    second.end()

    let delta
    expect(function () {
      delta = second.startedRelativeTo(first)
    }).not.throw()
    expect(delta).a('number')
  })

  it('should support updating the duration with touch', function (done) {
    const timer = new Timer()
    timer.begin()

    setTimeout(function () {
      timer.touch()
      const first = timer.getDurationInMillis()

      expect(first).above(0)
      expect(timer.isActive()).equal(true)

      setTimeout(function () {
        timer.end()

        const second = timer.getDurationInMillis()
        expect(second).above(first)
        expect(timer.isActive()).equal(false)

        done()
      }, 20)
    }, 20)
  })

  describe('endsAfter indicates whether the timer ended after another timer', () => {
    let start
    let first
    let second

    beforeEach(function () {
      start = Date.now()
      first = new Timer()
      first.setDurationInMillis(10, start)
      second = new Timer()
    })

    it('with the same start and duration', function () {
      second.setDurationInMillis(10, start)
      expect(second.endsAfter(first)).equal(false)
    })

    it('with longer duration', function () {
      second.setDurationInMillis(11, start)
      expect(second.endsAfter(first)).equal(true)
    })

    it('with shorter duration', function () {
      second.setDurationInMillis(9, start)
      expect(second.endsAfter(first)).equal(false)
    })

    it('with earlier start', function () {
      second.setDurationInMillis(10, start - 1)
      expect(second.endsAfter(first)).equal(false)
    })

    it('with later start', function () {
      second.setDurationInMillis(10, start + 1)
      expect(second.endsAfter(first)).equal(true)
    })
  })

  describe('overwriteDurationInMillis', function () {
    it('stops the timer', function () {
      const timer = new Timer()
      timer.begin()
      expect(timer.isActive()).equal(true)

      timer.overwriteDurationInMillis(10)
      expect(timer.isActive()).equal(false)
    })

    it('overwrites duration recorded by end() and touch()', function (done) {
      const timer = new Timer()
      timer.begin()
      setTimeout(function () {
        expect(timer.getDurationInMillis() > 1).equal(true)
        timer.overwriteDurationInMillis(1)
        expect(timer.getDurationInMillis()).equal(1)
        done()
      }, 2)
    })
  })
})
