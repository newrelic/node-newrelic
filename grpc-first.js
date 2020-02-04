'use strict'

// const grpc = require('grpc');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const utilHash = require('./lib/util/hashes')

const packageDefinition = protoLoader.loadSync(
  __dirname + '/lib/config/mtb-v1.proto',

  // what do these even mean?
  {keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });

const mtb = grpc.loadPackageDefinition(packageDefinition).com.newrelic.trace.v1;
const client = new mtb.IngestService(
  'mtb.nr-data.net:443',
  grpc.credentials.createSsl()
)

const metadata = new grpc.Metadata()
metadata.add('api_key','NRII-P-ebIQ1gvBIarrCMiNgVuyfBXEiolV6K')


// console.log(metadata)

const traceId = utilHash.makeId()
// const intrinsics = new Map();
const intrinsics = {
  'appName':{string_value:'Node Jam App'},
  'type':{string_value:'Span'},
  'traceId':{string_value:traceId},
  'guid':{string_value:utilHash.makeId()},
  'parentId':{string_value:null},
  'transactionId':{string_value:utilHash.makeId()},
  'sampled':{bool_value:true},
  'priority':{double_value:1.845508},
  'name':{string_value:'Nodejs/Middleware/Expressjs/expressInit'},
  'category':{string_value:'generic'},
  'component':{string_value:null},
  'timestamp':{int_value:(new Date()).getTime()},
  'duration':{double_value:0.000178934},
  'nr.entryPoint':{string_value:null},
  'span.kind':{string_value:null},
  'trustedParentId':{string_value:null},
  'tracingVendors':{string_value:null},
}



const fakeSpan = {
  trace_id:traceId,
  intrinsics: intrinsics,
  user_attributes: new Map(),
  agent_attributes: new Map(),
}

const stream = client.recordSpan(metadata)
stream.on('data', function handle(data) {
  console.log("It's Data!")
  console.log(data)
})

stream.on('end', function handle(endData) {
  console.log("It's Over!")
  console.log(endData)
})

console.log("About to Write This Object")
console.log('--START-------------------------------------------')
console.log(fakeSpan)
stream.write(fakeSpan)
console.log('--END---------------------------------------------')
stream.end()
console.log("Wrote")
