'use strict'
const tap = require('tap')
const SpanStreamer = require('../../../lib/spans/span-streamer')
const GrpcConnection = require('../../../lib/grpc/connection')

tap.test((t)=>{
  const spanStreamer = new SpanStreamer(
    'nr-internal.aws-us-east-2.tracing.staging-edge.nr-data.net:443',
    'abc123',
    (new GrpcConnection)
  )

  t.ok(spanStreamer, "instantiated the object")
  t.end()
})
