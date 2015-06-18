'use strict';

var startProcess = require('../lib/process').startProcess,
    assert = require('assert');

var NO_OP = function() {};

describe('process tests', function() {
    this.timeout(2000);

    var output;

    it('should complete a process without errors', function(done) {
        output = '';
        startProcess({
            execCommand: 'true',
            timeout: 500,
            successCallback: assertOutput('', done)
        }, appendToOutput);
    });

    it('should not output anything without defined handlers', function(done) {
        output = '';
        startProcess({
            execCommand: 'echo foo',
            successCallback: assertOutput('', done)
        }, appendToOutput);
    });

    it('should produce output from command', function(done) {
        output = '';
        startProcess({
            execCommand: 'echo foo',
            debug: NO_OP,
            successCallback: assertOutput('foo\n', done)
        }, appendToOutput);
    });

    it('should produce debug output as well', function(done) {
        output = '';
        startProcess({
            execCommand: 'echo foo',
            debug: appendArgsToOutput,
            successCallback: assertOutput('Process starting\nfoo\nProcess succeeded in 0s\n', done)
        }, appendToOutput);
    });

    it('should produce error output in any case', function(done) {
        output = '';
        startProcess({
            execCommand: 'echo error >&2',
            successCallback: assertOutput('error\n', done)
        }, appendToOutput);
    });

    it('should fail on nonzero exit code', function(done) {
        output = '';
        startProcess({
            title: 'Failure process',
            execCommand: 'false',
            successCallback: assert.fail,
            errorCallback: assertOutput('Failure process ended after 0s with exit code 1\n', done)
        }, appendToOutput);
    });

    it('should respect the configured timeout and fail gracefully', function(done) {
        output = '';
        startProcess({
            execCommand: 'sleep 0.2',
            timeout: 100, // 0.1 seconds
            successCallback: assert.fail,
            errorCallback: assertOutput('Process ended abnormally after 0.1s with signal SIGTERM\n', done)
        }, appendToOutput);
    });

    it('should not fail if timeout is not reached', function(done) {
        output = '';
        startProcess({
            execCommand: 'sleep 0.1',
            timeout: 200, // 0.2 seconds
            successCallback: assertOutput('', done)
        }, appendToOutput);
    });

    function appendToOutput(data) {
        output += data.toString();
    }

    function appendArgsToOutput() {
        output += Array.prototype.join.call(arguments, ' ') + '\n';
    }

    function assertOutput(expected, done) {
        return function() {
            assert.equal(output, expected);
            done();
        }
    }
});
