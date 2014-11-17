var Logger = require('../../../lib/util/logger')
var chai = require('chai')
var expect = chai.expect
var through = require('through')
var stream = require('stream')

var DEFAULT_KEYS = [
  'hostname',
  'level',
  'msg',
  'name',
  'pid',
  'time',
  'v'
]

describe('logger', function() {
  var results
  var logger

  beforeEach(function() {
    results = []
    logger = Logger({
      name: 'my-logger',
      level: 'info',
      hostname: 'my-host',
      stream: through(add_result)
    })
  })

  function add_result(data) {
    results = results.concat(data.split('\n').filter(Boolean).map(JSON.parse))
  }

  it('should interpolate values', function() {
    logger.info('%d: %s', 1, 'a')
    logger.info('123', 4, '5')
    expect(results.length).equal(2)
    compare_entry(results[0], '1: a', 30)
    compare_entry(results[1], '123 4 5', 30)
  })

  it('should support prepended extras', function() {
    logger.info({a: 1, b: 2}, '%d: %s', 1, 'a')
    logger.info({a: 1, b: 2}, '123', 4, '5')

    var keys = ['a', 'b'].concat(DEFAULT_KEYS)
    expect(results.length).equal(2)
    compare_entry(results[0], '1: a', 30, keys)
    expect(results[0].a).equal(1)
    expect(results[0].b).equal(2)
    compare_entry(results[1], '123 4 5', 30, keys)
    expect(results[1].a).equal(1)
    expect(results[1].b).equal(2)
  })

  it('should only log expected levels', function() {
    logger.trace('trace')
    logger.debug('debug')
    logger.info('info')
    logger.warn('warn')
    logger.error('error')
    logger.fatal('fatal')

    expect(results.length).equal(4)
    compare_entry(results[0], 'info', 30)
    compare_entry(results[1], 'warn', 40)
    compare_entry(results[2], 'error', 50)
    compare_entry(results[3], 'fatal', 60)

    logger.level('trace')
    logger.trace('trace')
    logger.debug('debug')
    expect(results.length).equal(6)
    compare_entry(results[4], 'trace', 10)
    compare_entry(results[5], 'debug', 20)
  })

  it('should support child loggers', function() {
    var child_a = logger.child({a: 1})
    var child_b = logger.child({b: 2, c: 3})
    var child_c = child_b.child({c: 6})
    child_a.info('hello a')
    child_b.info({b: 5}, 'hello b')
    child_c.info({a: 10}, 'hello c')

    expect(results.length).equal(3)
    compare_entry(results[0], 'hello a', 30, ['a'].concat(DEFAULT_KEYS))
    expect(results[0].a).equal(1)
    compare_entry(results[1], 'hello b', 30, ['b', 'c'].concat(DEFAULT_KEYS))
    expect(results[1].b).equal(5)
    expect(results[1].c).equal(3)

    compare_entry(results[2], 'hello c', 30, ['a', 'b', 'c'].concat(DEFAULT_KEYS))
    expect(results[2].a).equal(10)
    expect(results[2].b).equal(2)
    expect(results[2].c).equal(6)
  })

  it('should stringify objects', function() {
    var obj = {a: 1, b: 2}
    obj.self = obj
    logger.info('JSON: %s', obj)
    expect(results.length).equal(1)
    compare_entry(results[0], 'JSON: {"a":1,"b":2,"self":"[Circular ~]"}', 30)
  })
})

describe('logger write queue', function() {
  it('should buffer writes', function(done) {
    var logger = Logger({
      name: 'my-logger',
      level: 'info',
      hostname: 'my-host',
      stream: new SlowConcat()
    })

    logger.stream.on('drain', function() {
      if(logger.state.queue) {
        return
      }

      logger.stream.end()
    })

    logger.info('a')
    logger.info('b')
    logger.info('c')
    logger.info('d')

    logger.stream.on('finish', function() {
      expect(logger.stream.chunks.length).equal(2)
      compare_entry(JSON.parse(logger.stream.chunks[0]), 'a', 30)
      var parts = logger.stream.data.split('\n').filter(Boolean).map(JSON.parse)

      compare_entry(parts[0], 'a', 30)
      compare_entry(parts[1], 'b', 30)
      compare_entry(parts[2], 'c', 30)
      compare_entry(parts[3], 'd', 30)
      done()
    })
  })
})

function compare_entry(entry, msg, level, keys) {
  expect(entry.hostname).equal('my-host')
  expect(entry.name).equal('my-logger')
  expect(entry.pid).equal(process.pid)
  expect(entry.v).equal(0)
  expect(entry.level).equal(level)
  expect(entry.msg).equal(msg)
  expect(Object.keys(entry).sort()).deep.equal(keys || DEFAULT_KEYS)
}

function SlowConcat() {
  if(!(this instanceof SlowConcat)) {
    return new SlowConcat()
  }

  stream.Writable.call(this, {highWaterMark: 64})
  this.chunks = []
  this.data = ''
}

SlowConcat.prototype = Object.create(stream.Writable.prototype)

SlowConcat.prototype._write = function write(chunk, encoding, cb) {
  this.chunks.push(chunk)
  this.data += chunk
  setImmediate(cb)
}
