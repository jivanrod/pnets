/// <reference path="../typings/main.d.ts" />
import {Net} from 'pnets';
import fs = require('fs');
var xmlString = fs.readFileSync('test.xml','utf8');

describe('PNML Import', () => {
  var net: Net;

  beforeEach(function() {
    net = Net.fromPnml(xmlString);
  })

  it ('should load the XML in a Javascript object', () => {
    console.log(JSON.stringify(net, null,2));
    if (!net){
      throw new Error('XML import failed');
    }
  })
});
