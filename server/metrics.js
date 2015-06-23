'use strict';

var AWS = require('aws-sdk');

var cloudwatch = new AWS.CloudWatch();

module.exports = function(options) {
    var namespace = options.namespace;
    var debug = options.debug ? debugMetricData : noop;

    return options.metricsEnabled ? putMetricData : debug

    function putMetricData(metricName, value, unit) {
        value = (value != null) ? value : 1;
        unit = unit || 'None';

        debug(metricName, value, unit);
        cloudwatch.putMetricData({
            Namespace: namespace,
            MetricData: [{
                MetricName: metricName,
                Value: value,
                Unit: unit
            }]
        }).send();
    }
};

function debugMetricData(metricName, value, unit) {
    console.log.apply(console.log, Array.prototype.concat.apply(['Metric data:'], arguments));
}

function noop() {

}
