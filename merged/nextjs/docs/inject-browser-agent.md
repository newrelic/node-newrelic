# Injecting New Relic browser agent

**Note**: You must [install the New Relic browser agent](https://docs.newrelic.com/docs/browser/browser-monitoring/installation/install-browser-monitoring-agent/) in your account first before injecting it into a Next.js.

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
    const { browserTimingScript } = this.props

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

**Note**: For static compiled pages, you can use the [copy-paste method](https://docs.newrelic.com/docs/browser/browser-monitoring/installation/install-browser-monitoring-agent/#copy-paste-app) for enabling the New Relic browser agent.
