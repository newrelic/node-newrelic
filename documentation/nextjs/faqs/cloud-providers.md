# Deploy Next.js to Cloud Provider

Q: Can Next.js instrumentation work when deploying to [Vercel](https://vercel.com/frameworks/nextjs), [AWS Amplify](https://aws.amazon.com/amplify/), [Netlify](https://www.netlify.com/with/nextjs/), [Azure Static Sites](https://azure.microsoft.com/en-us/products/app-service/static), etc?

A: The short answer is no. Most of these cloud providers lack the ability to control run options to load the New Relic Node.js agent.  Also, most of these cloud providers execute code in a Function as a Service(FaaS) environment.  Our agent requires a different setup and then additional processes to load the telemetry.  Our recommendation is to rely on OpenTelemetry and load the telemetry via our OTLP endpoint.

## OpenTelemetry setup with New Relic

To setup Next.js to load OpenTelemetry data to New Relic you must do the following:

1. Enable [experimental instrumentation hook](https://nextjs.org/docs/app/building-your-application/optimizing/open-telemetry). In your `next.config.js` add:

```js
{
    experimental: {
        instrumentationHook: true
    }
}
```

2. Install OpenTelemetry packages.

```sh
npm @opentelemetry/api @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-metrics-otlp-proto @opentelemetry/exporter-trace-otlp-proto @opentelemetry/sdk-metrics @opentelemetry/sdk-node @opentelemetry/sdk-trace-node"
```
3. Setup OpenTelemetry configuration in `new-relic-instrumentation.js` 

```js
const opentelemetry = require('@opentelemetry/sdk-node')
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node')
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-proto')
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-proto')
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics')
const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api')

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO)

const sdk = new opentelemetry.NodeSDK({
  traceExporter: new OTLPTraceExporter(),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter(),
  }),
  instrumentations: [getNodeAutoInstrumentations()]
})

sdk.start()
```

4. Add the following to `instrumentation.ts` in the root of your Next.js project:

```js
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    require('./new-relic-instrumentation.js')
  }
}
```

5. Export the following environment variables:

**Note**: `<your_license_key>` should be a New Relic ingest key.

```sh
export OTEL_SERVICE_NAME=nextjs-otel-app
export OTEL_RESOURCE_ATTRIBUTES=service.instance.id=123
export OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp.nr-data.net
export OTEL_EXPORTER_OTLP_HEADERS=api-key=<your_license_key>
export OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT=4095
export OTEL_EXPORTER_OTLP_COMPRESSION=gzip
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
export OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=delta
```

For more information on using OpenTelemetry with New Relic, check out this [example application](https://github.com/newrelic/newrelic-opentelemetry-examples/tree/7154872abd2bfd466fa77af4049b4189dcfff99f/getting-started-guides/javascript)


