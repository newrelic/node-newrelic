// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('grpc');
var lib_protobuff_com_newrelic_trace_v1_pb = require('../../lib/protobuff/com.newrelic.trace.v1_pb.js');

function serialize_com_newrelic_trace_v1_RecordStatus(arg) {
  if (!(arg instanceof lib_protobuff_com_newrelic_trace_v1_pb.RecordStatus)) {
    throw new Error('Expected argument of type com.newrelic.trace.v1.RecordStatus');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_com_newrelic_trace_v1_RecordStatus(buffer_arg) {
  return lib_protobuff_com_newrelic_trace_v1_pb.RecordStatus.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_com_newrelic_trace_v1_Span(arg) {
  if (!(arg instanceof lib_protobuff_com_newrelic_trace_v1_pb.Span)) {
    throw new Error('Expected argument of type com.newrelic.trace.v1.Span');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_com_newrelic_trace_v1_Span(buffer_arg) {
  return lib_protobuff_com_newrelic_trace_v1_pb.Span.deserializeBinary(new Uint8Array(buffer_arg));
}


var IngestServiceService = exports.IngestServiceService = {
  // Accepts a stream of Span messages, and returns an irregular stream of
// RecordStatus messages.
recordSpan: {
    path: '/com.newrelic.trace.v1.IngestService/RecordSpan',
    requestStream: true,
    responseStream: true,
    requestType: lib_protobuff_com_newrelic_trace_v1_pb.Span,
    responseType: lib_protobuff_com_newrelic_trace_v1_pb.RecordStatus,
    requestSerialize: serialize_com_newrelic_trace_v1_Span,
    requestDeserialize: deserialize_com_newrelic_trace_v1_Span,
    responseSerialize: serialize_com_newrelic_trace_v1_RecordStatus,
    responseDeserialize: deserialize_com_newrelic_trace_v1_RecordStatus,
  },
};

exports.IngestServiceClient = grpc.makeGenericClientConstructor(IngestServiceService);
