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
    resultStream = through(add_result)
    logger = Logger({
      name: 'my-logger',
      level: 'info',
      hostname: 'my-host',
      stream: resultStream
    })
  })

  function add_result(data) {
    results = results.concat(data.toString().split('\n').filter(Boolean).map(JSON.parse))
  }

  it('should interpolate values', function(done) {
    logger.info('%d: %s', 1, 'a')
    logger.info('123', 4, '5')
    logger.once('readable', function(){
      expect(results.length).equal(2)
      compare_entry(results[0], '1: a', 30)
      compare_entry(results[1], '123 4 5', 30)
      done()
    })
  })

  it('should support prepended extras', function(done) {
    logger.info({a: 1, b: 2}, '%d: %s', 1, 'a')
    logger.info({a: 1, b: 2}, '123', 4, '5')
    logger.once('readable', function(){
      var keys = ['a', 'b'].concat(DEFAULT_KEYS)
      expect(results.length).equal(2)
      compare_entry(results[0], '1: a', 30, keys)
      expect(results[0].a).equal(1)
      expect(results[0].b).equal(2)
      compare_entry(results[1], '123 4 5', 30, keys)
      expect(results[1].a).equal(1)
      expect(results[1].b).equal(2)
      done()
    })
  })

  it('should only log expected levels', function(done) {
    logger.trace('trace')
    logger.debug('debug')
    logger.info('info')
    logger.warn('warn')
    logger.error('error')
    logger.fatal('fatal')
    logger.once('readable', function() {
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
      done()
    })
  })

  it('should be togglable', function(done) {
    logger.info('on')
    logger.enabled = false
    logger.on('readable', function(){
      expect(results.length).equal(1)
      logger.info('off')
      expect(results.length).equal(1)
      done()
    })
  })

  it('should support child loggers', function(done) {
    var child_a = logger.child({a: 1})
    var child_b = logger.child({b: 2, c: 3})
    var child_c = child_b.child({c: 6})
    child_a.info('hello a')
    child_b.info({b: 5}, 'hello b')
    child_c.info({a: 10}, 'hello c')

    logger.on('readable', function(){
      expect(results.length).equal(3)
      expect(results[0].a).equal(1)
      compare_entry(results[1], 'hello b', 30, ['b', 'c'].concat(DEFAULT_KEYS))
      expect(results[1].b).equal(5)
      expect(results[1].c).equal(3)

      compare_entry(results[2], 'hello c', 30, ['a', 'b', 'c'].concat(DEFAULT_KEYS))
      expect(results[2].a).equal(10)
      expect(results[2].b).equal(2)
      expect(results[2].c).equal(6)
      done()
    })
  })

  it('should stringify objects', function(done) {
    var obj = {a: 1, b: 2}
    obj.self = obj
    logger.info('JSON: %s', obj)
    logger.on('readable', function(){
      expect(results.length).equal(1)
      compare_entry(results[0], 'JSON: {"a":1,"b":2,"self":"[Circular ~]"}', 30)
      done()
    })
  })
})

describe('logger write queue', function() {
  it('should buffer writes', function(done) {

    var bigString = new Array(16 * 1024).join('a')

    var logger = Logger({
      name: 'my-logger',
      level: 'info',
      hostname: 'my-host',
    })

    logger.once('readable', function() {

      logger.push = function(str){
        var parts = str.split('\n').filter(Boolean).map(function(a){return a.toString()}).map(JSON.parse)
        compare_entry(parts[0], 'b', 30)
        compare_entry(parts[1], 'c', 30)
        compare_entry(parts[2], 'd', 30)
    
        return Logger.prototype.push.call(this, str)
      }

      logger.info('b')
      logger.info('c')
      logger.info('d')

      logger.read()

      logger.once('readable', function(){
        done()
      })

    })

    logger.info(bigString)

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
