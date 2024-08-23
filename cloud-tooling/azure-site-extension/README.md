## Testing

How to test the site extension in Azure. 

1. Create web app in Azure. 
    - Home > Create a resource > Web App > Create
    - Select the "Node Team Sandbox" subscription. 
    - Select or create a new resource group.
    - Name your application. Uncheck "unique default hostname". 
    - Select how you want to publish your web app (code, container or static web app).
    - Select a runtime stack. 
    - Select "Windows" as the operating system. 
    - Leave pricing on the "Free F1" option. 
    - Leave zone redundancy to "disabled". 
    - Review + create > Create. (No need to setup other things like database, deployment, networking...etc)

2. Deploy web app
    - Deploy your web application to Azure. There are several ways you can do that: manual (uploading a zip file containing your application files), Azure CLI, VS Code Extensions, local git, ftp/ftps and github actions. 
    - Make sure your deployed app has a `web.config` file that looks something like this otherwise you will get a "You do not have permission to view this directory or page" error: 
      <details>
        <?xml version="1.0" encoding="utf-8"?>
        <!--
            This configuration file is required if iisnode is used to run node processes behind
            IIS or IIS Express.  For more information, visit:

            https://github.com/tjanczuk/iisnode/blob/master/src/samples/configuration/web.config
        -->

        <configuration>
          <system.webServer>
            <!-- Visit http://blogs.msdn.com/b/windowsazure/archive/2013/11/14/introduction-to-websockets-on-windows-azure-web-sites.aspx for more information on WebSocket support -->
            <webSocket enabled="false" />
            <handlers>
              <!-- Indicates that the server.js file is a node.js site to be handled by the iisnode module -->
              <add name="iisnode" path="index.js" verb="*" modules="iisnode"/>
            </handlers>

            <rewrite>
              <rules>
                <!-- Do not interfere with requests for node-inspector debugging -->
                <rule name="NodeInspector" patternSyntax="ECMAScript" stopProcessing="true">
                  <match url="^index.js\/debug[\/]?" />
                </rule>

                <!-- First we consider whether the incoming URL matches a physical file in the /public folder -->
                <rule name="StaticContent">
                  <action type="Rewrite" url="public{PATH_INFO}"/>
                </rule>

                <!-- All other URLs are mapped to the node.js site entry point -->
                <rule name="DynamicContent">
                  <conditions>
                    <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="True"/>
                  </conditions>
                  <action type="Rewrite" url="index.js"/>
                </rule>
              </rules>
            </rewrite>
            
            <!-- 'bin' directory has no special meaning in node.js and apps can be placed in it -->
            <security>
              <requestFiltering>
                <hiddenSegments>
                  <remove segment="bin"/>
                </hiddenSegments>
              </requestFiltering>
            </security>

            <!-- Make sure error responses are left untouched -->
            <httpErrors existingResponse="PassThrough" />

            <!--
              You can control how Node is hosted within IIS using the following options:
                * watchedFiles: semi-colon separated list of files that will be watched for changes to restart the server
                * node_env: will be propagated to node as NODE_ENV environment variable
                * debuggingEnabled - controls whether the built-in debugger is enabled

              See https://github.com/tjanczuk/iisnode/blob/master/src/samples/configuration/web.config for a full list of options
            -->
            <!--<iisnode watchedFiles="web.config;*.js"/>-->
          </system.webServer>
        </configuration>
        - Note: update the path in the web.config file to match your entry file. 
      </details>

3. Install site extension
    - You can do this in two different ways:
      - Using CLI: Development Tools > Extensions > Add > Search for site extension
      - Using Kudu: Development Tools > Advanced Tools > Go > Site Extensions > Gallery + Search for site extension
4. Add environment variables
    - Select Web App > Settings > Environment variables
    - Add `NEW_RELIC_LICENSE_KEY`, `NEW_RELIC_LOG_ENABLED` set to `true` and `NEW_RELIC_LOG_LEVEL` set to `trace`. 
    - Click "Apply"
5. Restart application
    - Overview > Restart

### Using Kudu to view:
  - Site extension logs:
    - Development Tools > Advanced Tools > Go > Debug console > Powershell > SiteExtensions > Select the site extension > install.log (download the file or click on pencil icon to see it in the console)
  - New Relic logs:
     - Development Tools > Advanced Tools > Go > Debug console > Powershell > site > wwwroot > newrelic_agent.log (download the file or click on pencil icon to see it in the console)
  - Environment variables, app settings, system info, connection strings, path, headers, server variables
    - Development Tools > Advanced Tools > Go > Environment
  - Additional log files:
    - Development Tools > Advanced Tools > Go > Debug console > Powershell > LogFiles