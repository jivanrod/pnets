"use strict";
var net_1 = require('../src/net');
var fs = require('fs');
var xmlString = fs.readFileSync('data/test.xml', 'utf8');
describe('PNML Import', function () {
    var net;
    beforeEach(function () {
        net = net_1.Net.fromPnml(xmlString);
    });
    it('should load the XML in a Javascript object', function () {
        if (!net) {
            throw new Error('XML import failed');
        }
    });
    it('should initialize the net', function () {
        net.init();
    });
    it('should force fire a transition', function (done) {
        this.timeout(100000);
        net.init();
        net.makeEnd('end').subscribe(function (obs) {
            console.log("Pnet reached end state");
            done();
        });
        net.ingest('start', 3);
    });
});
