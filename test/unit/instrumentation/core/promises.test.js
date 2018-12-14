'use strict'

var expect = require('chai').expect
var helper = require('../../../lib/agent_helper')


describe('Promise trace', function() {
  var agent = null

  before(function() {
    agent = helper.instrumentMockedAgent({
      feature_flag: {
        promise_segments: true,
        await_support: false
      }
    })
  })

  after(function() {
    helper.unloadAgent(agent)
  })

  describe('simple, linear sequence', function() {
    it('should handle straight chains', function() {
      // a---b---c---d
      // a[b]; b[c]; c[d]; d[]

      return helper.runInTransaction(agent, function(tx) {
        return start('a').then(step('b')).then(step('c')).then(step('d'))
          .then(checkTrace(tx, ['a', ['b', ['c', ['d']]]]))
      })
    })

    it('should handle jumping to a catch', function() {
      //  /-----\
      // a- -b- -c---d
      //         ^-(catch)
      // a[c]; c[d] d[]

      return helper.runInTransaction(agent, function(tx) {
        return start('a', true).then(step('b')).catch(step('c')).then(step('d'))
          .then(checkTrace(tx, ['a', ['c', ['d']]]))
      })
    })

    it('should handle jumping over a catch', function() {
      //      /-----\
      // a---b- -c- -d
      //         ^-(catch)
      // a[b]; b[d]; d[]

      return helper.runInTransaction(agent, function(tx) {
        return start('a').then(step('b')).catch(step('c')).then(step('d'))
          .then(checkTrace(tx, ['a', ['b', ['d']]]))
      })
    })
  })

  describe('branching tree', function() {
    it('should handle independent branching legs', function() {
      //   /--e---f
      //  /
      // a---b---c---d
      // a[b,e]; b[c]; c[d]; d[]; e[f]; f[]

      return helper.runInTransaction(agent, function(tx) {
        var a = start('a')
        a.then(step('e')).then(step('f'))

        return a.then(step('b')).then(step('c')).then(step('d'))
          .then(checkTrace(tx, ['a',
            ['e', ['f']],
            ['b', ['c', ['d']]]
          ]))
      })
    })

    it('should handle jumping to branched catches', function() {
      //   /-----\
      //  // -e- -f
      // |/       ^-(catch)
      // a- -b- -c---d
      //  \-----/^-(catch)
      // a[c,f]; c[d]; f[]

      return helper.runInTransaction(agent, function(tx) {
        var a = start('a', true)
        a.then(step('e')).catch(step('f'))

        return a.then(step('b')).catch(step('c')).then(step('d'))
          .then(checkTrace(tx, ['a',
            ['f'],
            ['c', ['d']]
          ]))
      })
    })

    it('should handle branching in the middle', function() {
      //       /--e
      //      /
      // a---b---c---d
      // a[b]; b[c,e]; c[d]; d[]; e[]

      return helper.runInTransaction(agent, function(tx) {
        var b = start('a').then(step('b'))
        b.then(step('e'))

        return b.then(step('c')).then(step('d'))
          .then(checkTrace(tx, ['a', ['b',
            ['e'],
            ['c', ['d']]
          ]]))
      })
    })

    it('should handle jumping across a branch', function() {
      //    /----\
      //   /   / -e
      //  /   /   ^-(catch)
      // a- -b- -c---d
      //  \-----/^-(catch)
      // a[e,c]; c[d]; d[]; e[]

      return helper.runInTransaction(agent, function(tx) {
        var b = start('a', true).then(step('b'))
        b.catch(step('e'))

        return b.catch(step('c')).then(step('d'))
          .then(checkTrace(tx, ['a',
            ['e'],
            ['c', ['d']]
          ]))
      })
    })

    it('should handle jumping over a branched catch', function() {
      //    /----\
      //   /   / -e
      //  /   /
      // a- -b- - - - - -c---d
      //  \  ^-(catch)  /
      //   \-----------/
      // a[e,c]; c[d]; d[]; e[]

      return helper.runInTransaction(agent, function(tx) {
        var b = start('a').catch(step('b'))
        b.then(step('e'))

        return b.then(step('c')).then(step('d'))
          .then(checkTrace(tx, ['a',
            ['e'],
            ['c', ['d']]
          ]))
      })
    })

    it('should handle branches joined by `all`', function() {
      //         /--g- -\
      //        /        \
      //       /--e---f--all-\
      //      /               \
      // a---b- - - - - - - - -c---d
      // a[b]; b[e,g,all]; c[d]; d[]; e[f]; f[]; g[]; all[c]

      return helper.runInTransaction(agent, function(tx) {
        return start('a').then(function() {
          name('b')
          return Promise.all([start('e').then(step('f')), start('g')])
        })
          .then(step('c')).then(step('d'))
          .then(checkTrace(tx, ['a', ['b',
            ['e', ['f', ['!!!ignore!!!']]],
            ['g'],
            ['Promise.all', ['Promise#then __NR_thenContext',
              ['!!!ignore!!!'],
              ['c', ['d']]
            ]],
            ['!!!ignore!!!'],
            ['!!!ignore!!!'],
            ['!!!ignore!!!'],
            ['!!!ignore!!!']
          ]]))
      })
    })
  })

  describe('returned promises', function() {
    it('should handle continuing from returned promises', function() {
      //   (return)
      //       /--e---f---g--\
      //      /               \
      // a---b- - - - - - - - -c---d
      // a[b]; b[e]; c[d]; d[]; e[f]; f[g]; g[c]

      return helper.runInTransaction(agent, function(tx) {
        return start('a').then(step('b')).then(function() {
          name('e')
          return start('f').then(step('g'))
        }).then(step('c')).then(step('d'))
          .then(checkTrace(tx, ['a', ['b', ['e', ['f', ['g',
            ['Promise#then __NR_thenContext', // Implementation detail.
              ['!!!ignore!!!'],
              ['c', ['d']]
            ]
          ]]]]]))
      })
    })
  })
})

function start(n, rejection) {
  return new Promise(function startExecutor(resolve, reject) {
    name(n)
    rejection ? reject(new Error(n + ' rejection (start)')) : resolve()
  })
}

function step(n, rejection) {
  return function thenStep() {
    name(n)
    if (rejection) {
      throw new Error(n + ' rejection (step)')
    }
  }
}

function name(n) {
  helper.getAgent().tracer.segment.name = n
}

function checkTrace(tx, expected) {
  // Expected is an array containing the name and each child, recursively.
  // name: <string>
  // segment: [<name> {, <segment_1> {... , <segment_n>}}]

  return function thenCheckTrace() {
    name('checkTrace') // So we can skip this segment.
    _check(tx.trace.root.children[0], expected)
  }

  function _check(segment, expectedChildren) {
    var expectedName = expectedChildren.shift() // shift === pop_front

    // Remove `checkTrace` from the segment before checking it.
    var lastChild = segment.children[segment.children.length - 1]
    if (lastChild && lastChild.name === 'checkTrace') {
      segment.children.pop()
    }

    // Check the segment is named correctly and has the expected amount of children.
    expect(segment, 'segment').to.have.property('name', expectedName)
    expect(segment, 'segment ' + expectedName).property('children')
      .to.have.lengthOf(expectedChildren.length)

    // Check each child is as expected, passing over any implementation details.
    segment.children.forEach(function(child, i) {
      if (expectedChildren[i][0] !== '!!!ignore!!!') {
        _check(child, expectedChildren[i])
      }
    })
  }
}
