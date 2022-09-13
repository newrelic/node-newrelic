[![Community Plus header](https://github.com/newrelic/opensource-website/raw/master/src/images/categories/Community_Plus.png)](https://opensource.newrelic.com/oss-category/#community-plus)

# New Relic Next.js instrumentation [![Next.js Instrumentation CI][1]][2]

This is New Relic's official Next.js framework instrumentation for use with the New Relic [Node.js agent](https://github.com/newrelic/node-newrelic).

This module is a dependency of the agent and is installed by default when you install the agent.

This module provides instrumentation for server-side rendering via [getServerSideProps](https://nextjs.org/docs/basic-features/data-fetching/get-server-side-props), [middleware](https://nextjs.org/docs/middleware), and New Relic transaction naming for both page and server requests. It does not provide any instrumentation for actions occurring during build or in client-side code.  If you want telemetry data on actions occurring on the client (browser), you can [inject the browser agent](./docs/inject-browser-agent.md).

Here are documents for more in-depth explanations about [transaction naming](./docs/transactions.md), [segments/spans](./docs/segments-and-spans.md), and [injecting the browser agent](./docs/inject-browser-agent.md).

**Note**: The minimum supported Next.js version is [12.0.9](https://github.com/vercel/next.js/releases/tag/v12.0.9).  If you are using Next.js middleware the minimum supported version is [12.2.0](https://github.com/vercel/next.js/releases/tag/v12.2.0).

## Installation

Typically, most users use the version auto-installed by the agent. You can see agent install instructions [here](https://github.com/newrelic/node-newrelic#installation-and-getting-started).

In some cases, installing a specific version is ideal. For example, new features or major changes might be released via a major version update to this module, prior to inclusion in the main New Relic Node.js agent.

```
npm install @newrelic/next
```

```js
NODE_OPTIONS='-r @newrelic/next' next start
```

If you cannot control how your program is run, you can load the `@newrelic/next` module before any other module in your program. However, we strongly suggest you avoid this method at all costs.  We found bundling when running `next build` causes problems and also will make your bundle unnecessarily large.

```js
require('@newrelic/next')

/* ... the rest of your program ... */
```

### Custom Next.js servers

If you are using next as a [custom server](https://nextjs.org/docs/advanced-features/custom-server), you're probably not running your application with the `next` CLI.  In that scenario we recommend running the Next.js instrumentation as follows.

```js
node -r @newrelic/next your-program.js
```

For more information, please see the agent [installation guide][3].

## Getting Started

Our [API and developer documentation](http://newrelic.github.io/node-newrelic/docs/) for writing instrumentation will be of help. We particularly recommend the tutorials and various "shim" API documentation.

## Client-side Instrumentation

Next.js is a full stack React Framework. This module augments the Node.js New Relic agent, thus any client-side actions will not be instrumented. However, below is a method of adding the [New Relic Browser agent](https://docs.newrelic.com/docs/browser/browser-monitoring/getting-started/introduction-browser-monitoring/) to get more information on client-side actions.

The most appropriate approach would be to follow the [beforeInteractive strategy](https://nextjs.org/docs/basic-features/script#beforeinteractive).  Put the following in your `pages/_document.ts`

```ts
const newrelic = require('newrelic');
import Document, {
  DocumentContext,
  DocumentInitialProps,
  Html,
  Head,
  Main,
  NextScript,
} from 'next/document';
import Script from 'next/script';

type DocumentProps = {
  browserTimingHeader: string
}

class MyDocument extends Document<DocumentProps> {
  static async getInitialProps(
    ctx: DocumentContext
  ): Promise<DocumentInitialProps> {
    const initialProps = await Document.getInitialProps(ctx);

    const browserTimingHeader = newrelic.getBrowserTimingHeader({
      hasToRemoveScriptWrapper: true,
    });

    return {
      ...initialProps,
      browserTimingHeader,
    };
  }

  render() {
    const { browserTimingHeader } = this.props

    return (
      <Html>
        <Head>{/* whatever you need here */}</Head>
        <body>
          <Main />
          <NextScript />
          <Script
            dangerouslySetInnerHTML={{ __html: browserTimingHeader }}
            strategy="beforeInteractive"
          ></Script>
        </body>
      </Html>
    );
  }
}

export default MyDocument;
```

For static compiled pages, you can use the [copy-paste method](https://docs.newrelic.com/docs/browser/browser-monitoring/installation/install-browser-monitoring-agent/#copy-paste-app) for enabling the New Relic Browser agent.

For more information, please see the agent [compatibility and requirements][4].

### Error Handling

For capturing both the client and server side errors it is best to use `pages/_error.js` pattern recommended by Next.js documentation on [Advanced Error Page Customization](https://nextjs.org/docs/advanced-features/custom-error-page#more-advanced-error-page-customizing)

This pattern can be used to send either client, server or both types of errors to New Relic.

```js
function Error({ statusCode }) {
  return (
    <p>
      {statusCode
        ? `An error ${statusCode} occurred on server`
        : "An error occurred on client"}
    </p>
  );
}

Error.getInitialProps = ({ res, err }) => {
  if (typeof window === "undefined") {
    const newrelic = require('newrelic');
    newrelic.noticeError(err);
  } else {
    window.newrelic.noticeError(err);
  }

  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
```

The example above assumes that both the New Relic Browser and Node.js agents are [integrated](#client-side-instrumentation). The `getInitialProps` function's `if` statement checks whether an error was thrown on the server side (`typeof window === "undefined"`) and if it was the case, it `requires` New Relic Node.js agent and sends an `err` with `noticeError` method. Otherwise it assumes the error was thrown on the front-end side, and uses the browser agent to send the error to New Relic by using `window.newrelic.noticeError(err)`.

## Testing

The module includes a suite of unit and functional tests which should be used to
verify that your changes don't break existing functionality.

All tests are stored in `tests/` and are written using
[Tap](https://www.npmjs.com/package/tap) with the extension `.test.js` (unit), or `.tap.js` (versioned).

To run the full suite, run: `npm test`.

Individual test scripts include:

```
npm run unit
npm run versioned
```

## Example project
[Click here](https://github.com/newrelic-experimental/newrelic-nextjs-integration) for our official Next.js example project that integrates both the New Relic Next.js plugin and the browser agent.

## Support

New Relic hosts and moderates an online forum where you can interact with New Relic employees as well as other customers to get help and share best practices. Like all official New Relic open source projects, there's a related community topic in the New Relic Explorers Hub. You can find this project's topic/threads here:

* [New Relic Documentation](https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/introduction-new-relic-nodejs): Comprehensive guidance for using our platform
* [New Relic Community](https://discuss.newrelic.com/tags/c/telemetry-data-platform/agents/nodeagent): The best place to engage in troubleshooting questions
* [New Relic Developer](https://developer.newrelic.com/): Resources for building a custom observability applications
* [New Relic University](https://learn.newrelic.com/): A range of online training for New Relic users of every level
* [New Relic Technical Support](https://support.newrelic.com/) 24/7/365 ticketed support. Read more about our [Technical Support Offerings](https://docs.newrelic.com/docs/licenses/license-information/general-usage-licenses/support-plan).

## Contribute

We encourage your contributions to improve the Next.js instrumentation module! Keep in mind that when you submit your pull request, you'll need to sign the CLA via the click-through using CLA-Assistant. You only have to sign the CLA one time per project.

If you have any questions, or want to execute our corporate CLA (which is required if your contribution is on behalf of a company), drop us an email at opensource@newrelic.com.

**A note about vulnerabilities**

As noted in our [security policy](../../security/policy), New Relic is committed to the privacy and security of our customers and their data. We believe that providing coordinated disclosure by security researchers and engaging with the security community are important means to achieve our security goals.

If you believe you have found a security vulnerability in this project or any of New Relic's products or websites, we welcome and greatly appreciate you reporting it to New Relic through [HackerOne](https://hackerone.com/newrelic).

If you would like to contribute to this project, review [these guidelines](./CONTRIBUTING.md).

To all contributors, we thank you!  Without your contribution, this project would not be what it is today.  We also host a community project page dedicated to [New Relic Next.js instrumentation](https://opensource.newrelic.com/projects/newrelic/newrelic-node-nextjs).

## License
New Relic Next.js instrumentation is licensed under the [Apache 2.0](http://apache.org/licenses/LICENSE-2.0.txt) License.

New Relic Next.js instrumentation also uses source code from third-party libraries. You can find the full details on which libraries are used and the terms under which they are licensed in the third-party notices document.

[1]: https://github.com/newrelic/newrelic-node-nextjs/workflows/Next.js%20Instrumentation%20CI/badge.svg
[2]: https://github.com/newrelic/node-newrelic-nextjs/actions
[3]: https://docs.newrelic.com/docs/agents/nodejs-agent/installation-configuration/install-nodejs-agent
[4]: https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/compatibility-requirements-nodejs-agent
