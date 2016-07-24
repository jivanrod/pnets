import {Net} from '../src/petri';
import fs = require('fs');
import {Ros} from 'roslib';
var xmlString = fs.readFileSync('data/test2.xml','utf8');

describe('Ros Places', () => {
  var net: Net;

  before(function() {
    net = Net.fromPnml(xmlString);
    // Ros stuff

    net.init();
  })

  it ('should load the XML in a Javascript object', () => {
    if (!net){
      throw new Error('XML import failed');
    }
  });

  it ('should connect to ROS', function(done){
    this.timeout(10000);
    var ros = new Ros({
      url : 'ws://192.168.56.101:9090'
    });
    ros.on('connection', function() {
      done()
    });
    ros.on('error', function(error) {
      throw new Error('Error while connecting to ros: '+ error);
    });
  });

  it ('should run the net', function(done) {
    net.ingest('start',3);
    net.makeEnd('end').then( () => {
      done();
    });
  })
});
