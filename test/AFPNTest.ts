/// <reference path="../typings/main.d.ts" />
import {AdaptiveNet} from '../src/afpn';
import fs = require('fs');
import {Matrix,Vector} from 'mathlib';
var xmlString = fs.readFileSync('data/test.xml','utf8');

describe('PNML Import', () => {
  var net: AdaptiveNet;

  beforeEach(function() {

  })

  it ('should load the XML in a Javascript object', () => {
    if (!net){
      throw new Error('XML import failed');
    }
  });

  it ('should initialize the net', () => {
    net.init();
  })

});
