/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const retrieveHeaders = require('#agentlib/subscribers/aws-sdk/utils/retrieve-headers.js')

test('should return empty object when message has no MessageAttributes', (t, end) => {
  const message = {}

  const headers = retrieveHeaders({ message })

  assert.deepEqual(headers, {}, 'should return empty object')
  assert.strictEqual(Object.keys(headers).length, 0)
  end()
})

test('should return empty object when MessageAttributes is empty', (t, end) => {
  const message = {
    MessageAttributes: {}
  }

  const headers = retrieveHeaders({ message })

  assert.deepEqual(headers, {}, 'should return empty object')
  assert.strictEqual(Object.keys(headers).length, 0)
  end()
})

test('should retrieve traceparent header', (t, end) => {
  const message = {
    MessageAttributes: {
      traceparent: {
        DataType: 'String',
        StringValue: 'traceparent-value'
      }
    }
  }

  const headers = retrieveHeaders({ message })

  assert.strictEqual(Object.keys(headers).length, 1)
  assert.strictEqual(headers.traceparent, 'traceparent-value')
  end()
})

test('should retrieve tracestate header', (t, end) => {
  const message = {
    MessageAttributes: {
      tracestate: {
        DataType: 'String',
        StringValue: 'tracestate-value'
      }
    }
  }

  const headers = retrieveHeaders({ message })

  assert.strictEqual(Object.keys(headers).length, 1)
  assert.strictEqual(headers.tracestate, 'tracestate-value')
  end()
})

test('should retrieve newrelic header', (t, end) => {
  const message = {
    MessageAttributes: {
      newrelic: {
        DataType: 'String',
        StringValue: 'newrelic-value'
      }
    }
  }

  const headers = retrieveHeaders({ message })

  assert.strictEqual(Object.keys(headers).length, 1)
  assert.strictEqual(headers.newrelic, 'newrelic-value')
  end()
})

test('should retrieve all DT headers when present', (t, end) => {
  const message = {
    MessageAttributes: {
      traceparent: {
        DataType: 'String',
        StringValue: 'tp-value'
      },
      tracestate: {
        DataType: 'String',
        StringValue: 'ts-value'
      },
      newrelic: {
        DataType: 'String',
        StringValue: 'nr-value'
      }
    }
  }

  const headers = retrieveHeaders({ message })

  assert.strictEqual(Object.keys(headers).length, 3)
  assert.strictEqual(headers.traceparent, 'tp-value')
  assert.strictEqual(headers.tracestate, 'ts-value')
  assert.strictEqual(headers.newrelic, 'nr-value')
  end()
})

test('should only retrieve DT headers and ignore other attributes', (t, end) => {
  const message = {
    MessageAttributes: {
      traceparent: {
        DataType: 'String',
        StringValue: 'tp-value'
      },
      customAttribute: {
        DataType: 'String',
        StringValue: 'custom-value'
      },
      anotherAttribute: {
        DataType: 'Number',
        StringValue: '123'
      }
    }
  }

  const headers = retrieveHeaders({ message })

  assert.strictEqual(Object.keys(headers).length, 1)
  assert.strictEqual(headers.traceparent, 'tp-value')
  assert.strictEqual(headers.customAttribute, undefined)
  assert.strictEqual(headers.anotherAttribute, undefined)
  end()
})

test('should retrieve subset of DT headers when only some present', (t, end) => {
  const message = {
    MessageAttributes: {
      traceparent: {
        DataType: 'String',
        StringValue: 'tp-value'
      },
      newrelic: {
        DataType: 'String',
        StringValue: 'nr-value'
      }
      // tracestate not present
    }
  }

  const headers = retrieveHeaders({ message })

  assert.strictEqual(Object.keys(headers).length, 2)
  assert.strictEqual(headers.traceparent, 'tp-value')
  assert.strictEqual(headers.newrelic, 'nr-value')
  assert.strictEqual(headers.tracestate, undefined)
  end()
})

test('should return empty object when only non-DT headers present', (t, end) => {
  const message = {
    MessageAttributes: {
      customAttribute1: {
        DataType: 'String',
        StringValue: 'value1'
      },
      customAttribute2: {
        DataType: 'String',
        StringValue: 'value2'
      }
    }
  }

  const headers = retrieveHeaders({ message })

  assert.deepEqual(headers, {})
  assert.strictEqual(Object.keys(headers).length, 0)
  end()
})

test('should handle message with MessageAttributes set to null', (t, end) => {
  const message = {
    MessageAttributes: null
  }

  const headers = retrieveHeaders({ message })

  assert.deepEqual(headers, {})
  assert.strictEqual(Object.keys(headers).length, 0)
  end()
})

test('should handle message with MessageAttributes set to undefined', (t, end) => {
  const message = {
    MessageAttributes: undefined
  }

  const headers = retrieveHeaders({ message })

  assert.deepEqual(headers, {})
  assert.strictEqual(Object.keys(headers).length, 0)
  end()
})
