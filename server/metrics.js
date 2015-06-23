'use strict';

var AWS = require('aws-sdk');

var METRICS_ENABLED = process.env.JOBSITE_DEPLOY_METRICS_ENABLED;
var DEBUG = process.env.JOBSITE_GENERATOR_DEBUG;

var cloudwatch = new AWS.CloudWatch();

var debug = DEBUG ? debugMetricData : noop;

module.exports = {
    putData: METRICS_ENABLED ? putMetricData : debug
};

function putMetricData(metricName, value, unit) {
    debug(metricName, value, unit);
    cloudwatch.putMetricData({
        Namespace: 'JobsiteGen-' + ENV,
        MetricData: [{
            MetricName: metricName,
            Value: (value != null) ? value : 1,
            Unit: unit || 'None'
        }]
    }).send();
}

function debugMetricData(metricName, value, unit) {
    console.log.apply(console.log, Array.prototype.concat.apply(['Metric data:'], arguments));
}

function noop() {

}
