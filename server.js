'use strict';

var express        = require('express');
var bodyParser     = require('body-parser');
var exec = require('child_process').exec;

var ENV         = process.env.TFOX_ENV;
var DEPLOY_TASK = 'deploy';

var DEPLOY_INTERVAL  = process.env.JOBSITE_DEPLOY_INTERVAL || 30*60*1000; // 30 mins
var DEPLOY_SCHEDULED = process.env.JOBSITE_DEPLOY_SCHEDULED;

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

var TYPE   = "api-update";
var TEST_TYPE = "test-trigger";
var app    = module.exports = express();

var deployProcess = null;
var deployProcessStartTime = null;

process.chdir('/opt/workplace/static-site-gen');
debug('Debug logging enabled');

// scheduled update of the site, to work around Greenhouse's limited webhooks
if (DEPLOY_SCHEDULED) {
    console.log('Scheduled deployment for every', DEPLOY_INTERVAL/1000, 'seconds');
    setInterval(startDeploy, DEPLOY_INTERVAL);
} else {
    debug('Scheduled deployment disabled');
}

setTimeout(codeUpdateAndDeploy, 0);

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
        if (startDeploy()) {
            res.status(202).json({ status: 'Deployment started' });
        } else {
            res.status(503);
            next(new Error('Deployment already in progress'));
        }
    } else {
        res.status(400);
        next(new Error('Invalid POST data on prismic hook'));
    }
});

app.post('/github-hook', function (req, res, next) {
    if (DEBUG) {
        debug('Got a request, headers:', req.headers, ', body:', req.body);
    }

    var type = req.get('X-Github-Event');

    if (type === 'push' && req.body.ref === 'refs/heads/' + BRANCH) {
        codeUpdateAndDeploy();
        res.status(202).json({ status: 'Code update and deployment started' });
    } else {
        res.status(400);
        next(new Error('Invalid request'));
    }
});

function startDeploy() {
    if (deployProcess) {
        debug('Deployment already in progress');
        return false;
    }
    debug('Starting deployment to', ENV);

    deployProcessStartTime = Date.now();
    deployProcess = exec('./node_modules/.bin/gulp ' + DEPLOY_TASK + ' -e ' + ENV, {
        timeout: 30*60*1000  // 30 mins
    });

    deployProcess.on('exit', function(code, signal) {
        deployProcess = null;
        var runtimeSec = parseInt((Date.now() - deployProcessStartTime) / 1000, 10) + 's';
        if (code === 0) {
            debug('Deployment to', ENV, 'succeeded in', runtimeSec);
        } else if (code === null) {
            console.log('Deployment process ended abnormally after', runtimeSec, 'with signal', signal);
        } else {
            console.log('Deployment process ended after', runtimeSec, 'with exit code', code);
        }
    });

    deployProcess.stderr.on('data', logDataLine);
    if (DEBUG) {
        deployProcess.stdout.on('data', logDataLine);
    }

    return true;
}

function codeUpdateAndDeploy() {
    debug('Starting code update for', ENV);

    var updateProcStartTime = Date.now();
    var updateProc = exec('bash code-update.sh ' + BRANCH, {
        timeout: 10*60*1000  // 10 mins
    });

    updateProc.on('exit', function(code, signal) {
        var runtimeSec = parseInt((Date.now() - updateProcStartTime) / 1000, 10) + 's';
        if (code === 0) {
            debug('Code update for', ENV, 'succeeded in', runtimeSec);
            startDeploy();
        } else if (code === null) {
            console.log('Code update ended abnormally after', runtimeSec, 'with signal', signal);
        } else {
            console.log('Code update ended after', runtimeSec, 'with exit code', code);
        }
    });

    updateProc.stderr.on('data', logDataLine);
    if (DEBUG) {
        updateProc.stdout.on('data', logDataLine);
    }
}

// handling non-matching routes
app.use(function(req, res, next) {
    res.sendStatus(404);
});

// error handler
app.use(function(err, req, res, next) {
    res.json({error: err.message});
});

var server   = app.listen(PORT, function() {
    var host = server.address().address;
    var port = server.address().port;

    console.log('Server listening at http://%s:%s', host, port);
});

function debug(arg1 /*...*/) {
    if (DEBUG) {
        console.log.apply(console, arguments);
    }
}

function logDataLine(data) {
    process.stdout.write(data.toString());
}
