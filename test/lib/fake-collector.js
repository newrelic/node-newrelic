'use strict'

var path    = require('path')
  , util    = require('util')
  , fs      = require('fs')
  , jsv     = require('JSV').JSV
  , env     = jsv.createEnvironment()
  , restify = require('restify')
  , codec   = require('../../lib/util/codec.js')
  , logger  = require('../../lib/logger.js')
                .child({component : 'fake_collector'})


var DEFAULT_HOST = 'collector.lvh.me'
  , ACTUAL_HOST  = 'collector-1.lvh.me'
  , PORT         = 8089
  , PATHS        = {
      connect   : path.join(__dirname, 'schemas/connect.json'),
      container : path.join(__dirname, 'schemas/transaction_sample_data.json'),
      trace     : path.join(__dirname, 'schemas/transaction_trace.json'),
      error     : path.join(__dirname, 'schemas/error_data.json'),
      metric    : path.join(__dirname, 'schemas/metric_data.json'),
      sql       : path.join(__dirname, 'schemas/sql_trace_data.json'),
      sqlParams : path.join(__dirname, 'schemas/sql_params.json')
    }


var schemas = {}
Object.keys(PATHS).forEach(function cb_forEach(key) {
  schemas[key] = JSON.parse(fs.readFileSync(PATHS[key]))
})

function getHostname(request) {
  return request.header('Host').split(/:/)[0]
}

function decodeTraceData(encodedArray, callback) {
  var toDecode = encodedArray.length
  var decoded = []

  encodedArray.forEach(function cb_forEach(data) {
    var element = data[4]
    codec.decode(element, function (error, extracted) {
      if (error) return callback(error)

      decoded.push(extracted)
      toDecode -= 1
      if (toDecode < 1) callback(null, decoded)
    })
  })
}

function validate(schema, namespace) {
  return function (submitted, validations, callback) {
    var data = submitted

    var report = env.validate(data, schema)
    if (report.errors.length > 0) validations[namespace] = report.errors
    return callback(null, validations)
  }
}

function getRedirectURL() {
  return util.format("%s:%d", ACTUAL_HOST, PORT)
}

function returnData(validations, returned) {
  if (Object.keys(validations).length > 0) returned.validations = validations
  return returned
}

var validators = {
  originalHost : function originalHost(request, validations) {
    var host = getHostname(request)

    validations.host_name_errors = []

    if (host !== DEFAULT_HOST) {
      validations.host_name_errors.push("not connecting to root collector")
    }

    if (host === ACTUAL_HOST) {
      validations.host_name_errors.push("already connected to redirect target")
    }

    if (validations.host_name_errors.length < 1) delete validations.host_name_errors

    return validations
  },

  redirectedHost : function (request, validations) {
    var host = getHostname(request)
    if (host !== ACTUAL_HOST) {
      validations.host_name_errors = ["didn't redirect to " + ACTUAL_HOST]
    }

    return validations
  },

  connect : validate(schemas.connect, 'connect'),
  errors  : validate(schemas.error,   'error_data'),
  metrics : validate(schemas.metric,  'metric_data'),

  transactionTraces : function (transactionData, validations, callback) {
    var data = JSON.parse(transactionData)

    var report = env.validate(data, schemas.container)
    if (report.errors.length > 0) validations.transaction_sample_data = report.errors

    var traces = data[1]
    decodeTraceData(traces, function (err, traces) {
      if (err) {
        validations.transaction_traces =
          [util.format("unable to inflate encoded traces. zlib says: %s", err.message)]
        return callback(null, validations)
      }

      validations.transaction_traces = traces.map(function cb_map(trace) {
        var report = env.validate(trace, schemas.trace)
        if (report.errors.length > 0) return report.errors
      }).filter(function cb_filter(trace) { if (trace) return true; })

      if (validations.transaction_traces.length < 1) {
        delete validations.transaction_traces
      }

      return callback(null, validations)
    })
  },

  sqlTraces : function (sqlTraceData, validations, callback) {
    var data = JSON.parse(sqlTraceData)

    var report = env.validate(data, schemas.sql)
    if (report.errors.length > 0) validations.sql_trace_data = report.errors

    validations.sql_param_decode_errors = []
    validations.sql_params = []

    var toDecode = data.length
    data.forEach(function cb_forEach(trace) {
      codec.decode(trace[9], function (error, extracted) {
        if (error) {
          var message = util.format(
            "unable to inflate encoded SQL parameters. zlib says: %s",
            error.message
          )
          validations.sql_param_decode_errors.push(message)
        }
        else {
          var report = env.validate(extracted, schemas.sqlParams)
          if (report.errors.length > 0) validations.sql_params.push(report.errors)
        }

        toDecode -= 1
        if (toDecode < 1) {
          if (validations.sql_param_decode_errors.length < 1) {
            delete validations.sql_param_decode_errors
          }

          if (validations.sql_params.length < 1) {
            delete validations.sql_params
          }

          callback(null, validations)
        }
      })
    })
  },

  queryString : function (query, validation) {
    validation.query_errors = []

    if (!query.marshal_format) {
      validation.query_errors.push("marshal_format not set")
    }
    else if (query.marshal_format !== 'json') {
      validation.query_errors.push(util.format("this validator checks JSON, not %s",
                                               query.marshal_format))
    }

    var version = query.protocol_version
    if (!version) {
      validation.query_errors.push("protocol_version not set")
    }
    else if ((version < 9 || version > 15)) {
      validation.query_errors.push(
        util.format("protocol_version %d is not between 9 and 15", version)
      )
    }

    if (!query.license_key) {
      validation.query_errors.push("license_key not set")
    }

    if (!query.method) {
      validation.query_errors.push("no method to be invoked")
    }

    if (validation.query_errors.length === 0) delete validation.query_errors

    return validation
  },

  httpHeaders : function (request, validation) {
    validation.header_errors = []

    var encoding = request.header('content-encoding')
    if (!encoding) {
      validation.header_errors.push("'Content-Encoding' not set")
    }
    else if (!(encoding === 'identity' || encoding === 'deflate')) {
      validation.header_errors.push(
        util.format("'Content-Encoding' must be 'identity' or 'deflate', not '%s'",
                    encoding)
      )
    }

    if (request.header('content-type') !== 'application/json') {
      validation.header_errors.push(
        "you really ought to be setting 'Content-Type' to 'application/json'" +
        " (The collector doesn't care, though)"
      )
    }

    // NewRelic-NodeAgent/0.9.1-46 (nodejs 0.8.12 darwin-x64)
    var userAgentPattern = /^NewRelic-[a-zA-Z0-9]+\/[0-9.\-]+ \(.+\)$/
    if (!userAgentPattern.test(request.header('User-Agent'))) {
      validation.header_errors.push("'User-Agent' should conform to New Relic standards")
    }

    if (validation.header_errors.length === 0) delete validation.header_errors

    return validation
  }
}

function handleGenerically(validator) {
  return function handle(req, res, validations, next) {
    validators.redirectedHost(req, validations)
    validator(req.body, validations, function (error, validations) {
      if (error) return next(error)

      res.send(returnData(validations, {return_value : {}}))
      return next()
    })
  }
}

var methods = {
  get_redirect_host : function (req, res, validations, next) {
    validators.originalHost(req, validations)

    if (!Array.isArray(req.body) || req.body.length > 0) {
      validations.body_errors = ["get_redirect_host expects a body of '[]'"]
    }

    res.send(returnData(validations, {return_value : getRedirectURL()}))
    return next()
  },

  connect : function (req, res, validations, next) {
    validators.redirectedHost(req, validations)
    validators.connect(req.body, validations, function (error, validations) {
      if (error) return next(error)

      res.send(
        returnData(
          validations,
          {
            return_value : {
              agent_run_id   : 1337,
              collect_errors : true,
              collect_traces : true,
              apdex_t        : 0.5,
              encoding_key   : req.query.license_key
            }
          }
        )
      )

      return next()
    })
  },

  transaction_sample_data : handleGenerically(validators.transactionTraces),
  error_data              : handleGenerically(validators.errors),
  metric_data             : handleGenerically(validators.metrics),
  sql_trace_data          : handleGenerically(validators.sqlTraces)
}

function bootstrap(options, callback) {
  var server = restify.createServer()

  server.use(restify.queryParser({mapParams : false}))
  server.use(restify.bodyParser({mapParams : false}))

  restify.defaultResponseHeaders = function () {
    // LOL -- the collector *always* leaves the content-type set to text/plain
    this.header('Content-Type', 'text/plain')
  }

  server.on('after', restify.auditLogger({log : logger}))

  server.post('/agent_listener/invoke_raw_method', function (req, res, next) {
    var validations = {}
    validators.queryString(req.query, validations)
    validators.httpHeaders(req, validations)

    if (!methods[req.query.method]) {
      validations.query_errors.push("unfamiliar method invoked; bailing out")
      res.send(404, validations)
      next()
    }
    else {
      methods[req.query.method](req, res, validations, next)
    }
  })

  server.listen(options.port, function () {
    callback(null, server)
  })
}

module.exports = bootstrap
