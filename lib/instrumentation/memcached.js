exports.initialize = function(agent, trace, memcached) {
    var self = this;

    // Thanks Hernan@ngmoco
    // Monkey Patch the memcached driver to intercept calls and keep stats on them.

    // Replace the original 'command' function with our proxy.
    var origFn = memcached.prototype.command;
    //console.log('origFn: '+origFn);

    memcached.prototype.command = function() {

        var tx = agent.getTransaction();
        if (!tx) {
            origFn.apply(this,arguments);
            return;
        }

        var args = Array.prototype.slice.call(arguments);

        // The 'command' function will be called with a single function argument.
        // That function returns a simple object describing the memcached call.
        // Call that function to get that call description.
        var cmdObj = args[0]();
        //console.log('cmdObj: '+util.inspect(cmdObj));
        
        // FIXME Hernan - I'm sure this is wrong.  I need the command string here for the metric name
        var metricName = 'Memcache/' + cmdObj;
        var tracer = new trace.Tracer(tx, function(tracer, unscopedStats, scopedStats) {
            [unscopedStats.getStats("Memcache/all"),            
                unscopedStats.getStats("Memcache/allWeb"),
                unscopedStats.getStats(metricName),
                scopedStats.getStats(metricName)].forEach(function(stat) {
                   stat.recordValueInMillis(tracer.getDurationInMillis); 
                });
        });

        // One of the keys in cmdObj is 'callback'.  We want to proxy that so we
        // know when the call has ended.
        var origCallback = cmdObj.callback;
        //console.log('origCallback: '+origCallback);

        //console.log('Proxying cmdObj.callback: '+cmdObj);
        cmdObj.callback = function() {

            //console.log('======================== in the callback: '+util.inspect(arguments));
            tracer.finish();
            origCallback.apply(this,Array.prototype.slice.call(arguments));
        };

        // The origFn expects a function as its argument. It expects that function to return 
        // a 'command' object describing the memcached operation to perform. Fortunately,
        // it's an easy requirement to meet.
        function universalCmdFn() { return cmdObj; }

        // finally, call the original function.
        origFn.apply(this,[universalCmdFn]);
    };
};