/// <reference path="../typings/main.d.ts" />
import {Net} from '../src/petri';
import fs = require('fs');
import {Matrix,Vector} from 'mathlib';
var xmlString = fs.readFileSync('data/final_approach_2.xml','utf8');

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

/*
  it ('should calculate math stuff on the net', () => {
    net.ingest('start',3);
    net.buildMath();
    console.log("After build math");
    net.minExp(net.getMarking(), 'T4');
  })
*/
/*
  it ('should insert a token in start place and run it', function(done) {
    this.timeout(10000);
    net.init();//'default'
    net.makeEnd('end').then( () => {
      done();
    });
    net.ingest('start',3);
  })
*/
  it ('should force fire a transition', function(done) {
    this.timeout(100000);
    net.init('Obs');//'default'
    net.makeEnd('end').then( () => {
      console.log("Pnet reached end state");
      done();
    });
    /* Initial marking */
    net.ingest('start',3);
    net.ingest('ros.AtGreenDotSpeed',100);
    net.ingest('ros.2000AGL',100);
    net.ingest('ros.VFE1',100);

    console.log(net.getMarking().toString());

    //net.minExp(net.getMarking(),'ros.SelectFlaps3');
    net.basisMarkings(net.getMarking(),'ros.SelectFlaps3');
    //net.fire('ros.SelectFlaps3');
    //console.log(net.getMarking().toString());
  })

});
