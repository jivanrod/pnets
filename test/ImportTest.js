"use strict";
var petri_1 = require('../src/petri');
var fs = require('fs');
var xmlString = fs.readFileSync('data/test.xml', 'utf8');
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
    it('should calculate math stuff on the net', function () {
        net.ingest('start', 3);
        net.buildMath();
        console.log("After build math");
        net.minExp(net.getMarking(), 'T4');
    });
});
