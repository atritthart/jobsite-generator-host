'use strict';

var express = require('express');
var bodyParser = require('body-parser');
var startProcess = require('./process').startProcess;
var metrics = require('./metrics');

var ENV         = process.env.TFOX_ENV;
var DEPLOY_TASK = 'deploy';

var DEPLOY_INTERVAL  = process.env.JOBSITE_DEPLOY_INTERVAL || 30*60*1000; // 30 mins
var DEPLOY_SCHEDULED = process.env.JOBSITE_DEPLOY_SCHEDULED;
var METRICS_ENABLED = process.env.JOBSITE_DEPLOY_METRICS_ENABLED;

var PORT   = process.env.JOBSITE_GENERATOR_PORT || 8080;
var SECRET = process.env.PRISMIC_SECRET;
var APIURL = process.env.PRISMIC_APIURL;
var DEBUG  = process.env.JOBSITE_GENERATOR_DEBUG;

var BRANCH_FOR_ENV = {
    dev: 'develop',
    qa: 'qa',
    prod: 'master'
};
var BRANCH = BRANCH_FOR_ENV[ENV];

if (!BRANCH) {
    console.error('Environment variable TFOX_ENV needs to be one of: dev, qa, prod');
    process.exit(1);
}

var MILLISECONDS = 'Milliseconds';
var ENV_CAPS = ENV.toUpperCase();

var TYPE   = "api-update";
var TEST_TYPE = "test-trigger";
var app    = module.exports = express();

var deployProcess = null;
var deployProcessStartTime = null;

var putMetricData = metrics({
    namespace: 'JobsiteGen-' + ENV_CAPS,
    metricsEnabled: METRICS_ENABLED,
    debug: DEBUG
});

process.chdir('/opt/workplace/static-site-gen');
debug('Debug logging enabled');

// scheduled update of the site, to work around Greenhouse's limited webhooks
if (DEPLOY_SCHEDULED) {
    console.log('Scheduled deployment for every', DEPLOY_INTERVAL/1000, 'seconds');
    setInterval(startDeploy, DEPLOY_INTERVAL);
} else {
    debug('Scheduled deployment disabled');
}

setTimeout(startCodeUpdateAndDeploy, 0);

/*
 * HTTP server
 */

// parse json on all requests
app.use(bodyParser.json());

app.get('/healthcheck', function (req, res, next) {
    res.send('OK');
});

app.post('/prismic-hook', function (req, res, next) {
    if (DEBUG) {
        debug('Got a request, headers:', req.headers, ', body:', req.body);
    }

    var secret = req.body.secret;
    var apiUrl = req.body.apiUrl;
    var type   = req.body.type;

    if (secret === SECRET && apiUrl === APIURL && (type === TYPE || type === TEST_TYPE)) {
        putMetricData('PrismicHookOk');
        if (startDeploy()) {
            res.status(202).json({ status: 'Deployment started' });
        } else {
            res.status(503);
            next(new Error('Deployment already in progress'));
        }
    } else {
        putMetricData('PrismicHookBadRequest');
        res.status(400);
        next(new Error('Invalid POST data on prismic hook'));
    }
});

app.post('/github-hook', function (req, res, next) {
    if (DEBUG) {
        debug('Got a request, headers:', req.headers, ', body:', req.body);
    }

    var type = req.get('X-Github-Event');

    if (type === 'ping') {
        putMetricData('GithubHookPing');
        res.send('OK');
    } else if (type === 'push') {
        if (req.body.ref === 'refs/heads/' + BRANCH) {
            putMetricData('GithubHookDeploy');
            startCodeUpdateAndDeploy();
            res.status(202).json({ status: 'Code update and deployment started' });
        } else {
            res.send('OK');
        }
    } else {
        res.status(400);
        next(new Error('Invalid request'));
    }
});

app.use(function nonMatchingRouteHandler(req, res, next) {
    res.sendStatus(404);
});

app.use(function errorHandler(err, req, res, next) {
    res.json({error: err.message});
});

var server   = app.listen(PORT, function() {
    var host = server.address().address;
    var port = server.address().port;

    console.log('Server listening at http://%s:%s', host, port);
});

/*
 * Update/deploy processes
 */

var deploy = {
    name: 'Deployment' + ENV_CAPS,
    title: 'Deployment for ' + ENV_CAPS,
    execCommand: './node_modules/.bin/gulp ' + DEPLOY_TASK + ' -e ' + ENV,
    successCallback: null,
    timeout: 30*60*1000,
    putMetricData: putMetricData,
    debug: DEBUG && debug,
    process: null,
    startTime: null,
};

var codeUpdateAndDeploy = {
    name: 'CodeUpdate' + ENV_CAPS,
    title: 'Code update for ' + ENV_CAPS,
    execCommand: 'bash /opt/workplace/server/code-update.sh ' + BRANCH,
    successCallback: startDeploy,
    timeout: 10*60*1000,
    putMetricData: putMetricData,
    debug: DEBUG && debug,
    process: null,
    startTime: null,
};

function startDeploy() {
    if (deploy.process) {
        debug('Deployment already in progress');
        putMetricData('DeploymentInProgress', Date.now() - deploy.startTime, MILLISECONDS);
        return false;
    }

    startProcess(deploy);
    return true;
}

function startCodeUpdateAndDeploy() {
    startProcess(codeUpdateAndDeploy);
}

/*
 * Helpers
 */

function debug(arg1 /*...*/) {
    if (DEBUG) {
        console.log.apply(console, arguments);
    }
}
