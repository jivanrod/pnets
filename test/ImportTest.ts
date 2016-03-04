/// <reference path="../typings/main.d.ts" />
import {Net} from '../src/petri';
import fs = require('fs');
var xmlString = fs.readFileSync('data/test.xml','utf8');

describe('PNML Import', () => {
  var net: Net;

  beforeEach(function() {
    net = Net.fromPnml(xmlString);
  })

  it ('should load the XML in a Javascript object', () => {
    if (!net){
      throw new Error('XML import failed');
    }
  });

  it ('should initialize the net', () => {
    net.init();
  })

  it ('should insert a token in start place', function(done) {
    this.timeout(0);
    net.init();
    net.ingest('start',3);
    setTimeout(function(){console.log('test'); done();  },10000);
  })
});
