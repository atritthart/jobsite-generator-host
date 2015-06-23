'use strict';

var exec = require('child_process').exec,
    putMetricData = require('./metrics').putData;

var NO_DEBUG = function() {};
var MILLISECONDS = 'Milliseconds';

module.exports = {
    /**
     * @param {Object} processObj
     *   @property {String} execCommand Command to execute
     *   @property {String} name (optional) Process name tag to be used for metrics
     *   @property {String} title (optional) Human-readable title for logging output
     *   @property {Function} successCallback (optional) Function to execute on successful process end
     *   @property {Function} errorCallback(exitCode, signal) (optional) Function to execute on unsuccessful process end
     *   @property {Integer} timeout (optional) Process running timeout, after which it will be sent a SIGTERM
     *   @property {Function} debug (optional) Debug output handler function
     * @param {Object} dataLogger (optional) custom function for consuming output from the process
     *
     * When starting the process, processObj also receives two additional
     * properties that can be used for tracking process status from outside:
     *
     *   @property {Object} process The runninc process, returned by exec. Will be set to null after process completed
     *   @property {Object} startTime Process latest start time, in milliseconds from epoch
     */
    startProcess: function(processObj, dataLogger) {
        dataLogger = dataLogger || logDataLine;
        var debug = processObj.debug || NO_DEBUG;
        var name = processObj.name || 'Process';
        var title = processObj.title || 'Process';
        var options = {
            timeout: processObj.timeout
        };

        debug(title, 'starting');

        processObj.startTime = Date.now();
        var proc = processObj.process = exec(processObj.execCommand, options);
        putMetricData(name + 'Started');

        proc.on('exit', function(code, signal) {
            processObj.process = null;
            var runtimeMillis = Date.now() - processObj.startTime;
            var runtimeSecStr = Math.round(runtimeMillis / 100) / 10 + 's';
            if (code === 0) {
                debug(title, 'succeeded in', runtimeSecStr);
                putMetricData(name + 'Success', runtimeMillis, MILLISECONDS);
                putMetricData(name + 'ExitCode', code);
                if (processObj.successCallback) {
                    processObj.successCallback();
                }
            } else {
                if (code === null) {
                    dataLogger([title, 'ended abnormally after', runtimeSecStr, 'with signal', signal].join(' ') + '\n');
                    putMetricData(name + 'Signal', signal);
                } else {
                    dataLogger([title, 'ended after', runtimeSecStr, 'with exit code', code].join(' ') + '\n');
                    putMetricData(name + 'ExitCode', code);
                }
                putMetricData(name + 'FailureTime', runtimeMillis, MILLISECONDS);
                if (processObj.errorCallback) {
                    processObj.errorCallback(code, signal);
                }
            }
        });

        proc.stderr.on('data', dataLogger);
        if (debug != NO_DEBUG) {
            proc.stdout.on('data', dataLogger);
        }
    }
}

function logDataLine(data) {
    process.stdout.write(data.toString());
}
