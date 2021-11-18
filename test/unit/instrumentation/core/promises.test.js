/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const test = tap.test

const helper = require('../../../lib/agent_helper')

test('Promise trace', (t) => {
  t.autoend()

  let agent = null

  t.beforeEach(() => {
    agent = helper.instrumentMockedAgent({
      feature_flag: {
        promise_segments: true,
        await_support: false
      }
    })
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  t.test('should handle straight chains', (t) => {
    // a---b---c---d
    // a[b]; b[c]; c[d]; d[]
    const expected = ['a', ['b', ['c', ['d']]]]

    return helper.runInTransaction(agent, function (tx) {
      return start('a')
        .then(step('b'))
        .then(step('c'))
        .then(step('d'))
        .then(checkTrace(t, tx, expected))
        .then(() => {
          t.end()
        })
    })
  })

  t.test('should handle jumping to a catch', (t) => {
    //  /-----\
    // a- -b- -c---d
    //         ^-(catch)
    // a[c]; c[d] d[]

    const expected = ['a', ['c', ['d']]]

    return helper.runInTransaction(agent, function (tx) {
      return start('a', true)
        .then(step('b'))
        .catch(step('c'))
        .then(step('d'))
        .then(checkTrace(t, tx, expected))
        .then(() => {
          t.end()
        })
    })
  })

  t.test('should handle jumping over a catch', (t) => {
    //      /-----\
    // a---b- -c- -d
    //         ^-(catch)
    // a[b]; b[d]; d[]

    const expected = ['a', ['b', ['d']]]

    return helper.runInTransaction(agent, function (tx) {
      return start('a')
        .then(step('b'))
        .catch(step('c'))
        .then(step('d'))
        .then(checkTrace(t, tx, expected))
        .then(() => {
          t.end()
        })
    })
  })

  t.test('should handle independent branching legs', (t) => {
    //   /--e---f
    //  /
    // a---b---c---d
    // a[b,e]; b[c]; c[d]; d[]; e[f]; f[]

    const expected = ['a', ['e', ['f']], ['b', ['c', ['d']]]]

    return helper.runInTransaction(agent, function (tx) {
      const a = start('a')
      a.then(step('e')).then(step('f'))

      return a
        .then(step('b'))
        .then(step('c'))
        .then(step('d'))
        .then(checkTrace(t, tx, expected))
        .then(() => {
          t.end()
        })
    })
  })

  t.test('should handle jumping to branched catches', (t) => {
    //   /-----\
    //  // -e- -f
    // |/       ^-(catch)
    // a- -b- -c---d
    //  \-----/^-(catch)
    // a[c,f]; c[d]; f[]

    const expected = ['a', ['f'], ['c', ['d']]]

    return helper.runInTransaction(agent, function (tx) {
      const a = start('a', true)
      a.then(step('e')).catch(step('f'))

      return a
        .then(step('b'))
        .catch(step('c'))
        .then(step('d'))
        .then(checkTrace(t, tx, expected))
        .then(() => {
          t.end()
        })
    })
  })

  t.test('should handle branching in the middle', (t) => {
    //       /--e
    //      /
    // a---b---c---d
    // a[b]; b[c,e]; c[d]; d[]; e[]

    const expected = ['a', ['b', ['e'], ['c', ['d']]]]

    return helper.runInTransaction(agent, function (tx) {
      const b = start('a').then(step('b'))
      b.then(step('e'))

      return b
        .then(step('c'))
        .then(step('d'))
        .then(checkTrace(t, tx, expected))
        .then(() => {
          t.end()
        })
    })
  })

  t.test('should handle jumping across a branch', (t) => {
    //    /----\
    //   /   / -e
    //  /   /   ^-(catch)
    // a- -b- -c---d
    //  \-----/^-(catch)
    // a[e,c]; c[d]; d[]; e[]

    const expected = ['a', ['e'], ['c', ['d']]]

    return helper.runInTransaction(agent, function (tx) {
      const b = start('a', true).then(step('b'))
      b.catch(step('e'))

      return b
        .catch(step('c'))
        .then(step('d'))
        .then(checkTrace(t, tx, expected))
        .then(() => {
          t.end()
        })
    })
  })

  t.test('should handle jumping over a branched catch', (t) => {
    //    /----\
    //   /   / -e
    //  /   /
    // a- -b- - - - - -c---d
    //  \  ^-(catch)  /
    //   \-----------/
    // a[e,c]; c[d]; d[]; e[]

    const expected = ['a', ['e'], ['c', ['d']]]

    return helper.runInTransaction(agent, function (tx) {
      const b = start('a').catch(step('b'))
      b.then(step('e'))

      return b
        .then(step('c'))
        .then(step('d'))
        .then(checkTrace(t, tx, expected))
        .then(() => {
          t.end()
        })
    })
  })

  t.test('should handle branches joined by `all`', (t) => {
    //         /--g- -\
    //        /        \
    //       /--e---f--all-\
    //      /               \
    // a---b- - - - - - - - -c---d
    // a[b]; b[e,g,all]; c[d]; d[]; e[f]; f[]; g[]; all[c]

    const expected = [
      'a',
      [
        'b',
        ['e', ['f', ['!!!ignore!!!']]],
        ['g'],
        ['Promise.all', ['Promise#then __NR_thenContext', ['!!!ignore!!!'], ['c', ['d']]]],
        ['!!!ignore!!!'],
        ['!!!ignore!!!'],
        ['!!!ignore!!!'],
        ['!!!ignore!!!']
      ]
    ]

    return helper.runInTransaction(agent, function (tx) {
      return start('a')
        .then(function () {
          name('b')
          return Promise.all([start('e').then(step('f')), start('g')])
        })
        .then(step('c'))
        .then(step('d'))
        .then(checkTrace(t, tx, expected))
        .then(() => {
          t.end()
        })
    })
  })

  t.test('should handle continuing from returned promises', (t) => {
    //   (return)
    //       /--e---f---g--\
    //      /               \
    // a---b- - - - - - - - -c---d
    // a[b]; b[e]; c[d]; d[]; e[f]; f[g]; g[c]

    const expected = [
      'a',
      [
        'b',
        [
          'e',
          [
            'f',
            [
              'g',
              [
                'Promise#then __NR_thenContext', // Implementation detail.
                ['!!!ignore!!!'],
                ['c', ['d']]
              ]
            ]
          ]
        ]
      ]
    ]

    return helper.runInTransaction(agent, function (tx) {
      return start('a')
        .then(step('b'))
        .then(function () {
          name('e')
          return start('f').then(step('g'))
        })
        .then(step('c'))
        .then(step('d'))
        .then(checkTrace(t, tx, expected))
        .then(() => {
          t.end()
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

function name(newName) {
  const segment = helper.getContextManager().getContext()
  segment.name = newName
}

function checkTrace(t, tx, expected) {
  // Expected is an array containing the name and each child, recursively.
  // name: <string>
  // segment: [<name> {, <segment_1> {... , <segment_n>}}]

  return function thenCheckTrace() {
    name('checkTrace') // So we can skip this segment.
    _check(tx.trace.root.children[0], expected)
  }

  function _check(segment, expectedChildren) {
    const expectedName = expectedChildren.shift() // shift === pop_front

    // Remove `checkTrace` from the segment before checking it.
    const lastChild = segment.children[segment.children.length - 1]
    if (lastChild && lastChild.name === 'checkTrace') {
      segment.children.pop()
    }

    // Check the segment is named correctly and has the expected amount of children.
    t.equal(segment.name, expectedName)
    t.equal(segment.children.length, expectedChildren.length)

    // Check each child is as expected, passing over any implementation details.
    segment.children.forEach(function (child, i) {
      if (expectedChildren[i][0] !== '!!!ignore!!!') {
        _check(child, expectedChildren[i])
      }
    })
  }
}
