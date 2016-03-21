"use strict";
var petri_1 = require('../src/petri');
var fs = require('fs');
var xmlString = fs.readFileSync('data/final_approach_2.xml', 'utf8');
describe('PNML Import', function () {
    var net;
    beforeEach(function () {
        net = petri_1.Net.fromPnml(xmlString);
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
        net.init('Obs');
        net.makeEnd('end').then(function () {
            console.log("Pnet reached end state");
            done();
        });
        net.ingest('start', 3);
        net.ingest('ros.AtGreenDotSpeed', 100);
        net.ingest('ros.2000AGL', 100);
        net.ingest('ros.VFE1', 100);
        net.ingest('ros.VFE2', 100);
        console.log(net.getMarking().toString());
        net.basisMarkings(net.getMarking(), 'selectFull');
    });
});
