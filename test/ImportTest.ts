/// <reference path="../typings/main.d.ts" />
import {Net} from '../src/petri';
import fs = require('fs');
import {Matrix,Vector} from 'mathlib';
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

  it ('should calculate math stuff on the net', () => {
    net.ingest('start',3);
    net.buildMath();
    console.log("After build math");
    net.minExp(net.getMarking(), 'T4');
  })

/*
  it ('should insert a token in start place and run it', function(done) {
    this.timeout(10000);
    net.init();//'default'
    net.ingest('start',3);
    net.makeEnd('end').then( () => {
      done();
    });
  })*/
});
