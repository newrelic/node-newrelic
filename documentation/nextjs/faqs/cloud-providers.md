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
npm install @opentelemetry/sdk-node @opentelemetry/resources @opentelemetry/semantic-conventions @opentelemetry/sdk-trace-node @opentelemetry/exporter-trace-otlp-http
```

3. Setup OpenTelemetry configuration in `new-relic-instrumentation.js` 

```js
const { NodeSDK } = require('@opentelemetry/sdk-node')
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node')
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http')
const { Resource } = require('@opentelemetry/resources')
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions')
const { SimpleSpanProcessor } = require('@opentelemetry/sdk-trace-node')
 
const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'next-app',
  }),
  spanProcessor: new SimpleSpanProcessor(new OTLPTraceExporter({
    url: 'https://otlp.nr-data.net',
    headers: {
      'api-key': process.env.NEW_RELIC_API_KEY
    }
  })),
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

