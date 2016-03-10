import {Net, Place, Transition, Token} from '../src/petri';
import fs = require('fs');
import {Ros, Message} from 'ROSLIB';
import {RosPlace} from '../src/extensions/places/place-ros';
import {RosTransition} from '../src/extensions/transitions/transition-ros';
var xmlString = fs.readFileSync('data/final_approach.xml','utf8');

describe('Ros Places', () => {
  var net: Net;
  var ros: Ros;
  var rate = 10.0;

  before(function() {
    net = Net.fromPnml(xmlString, {
      'ros': {
        place: RosPlace,
        transition: RosTransition
      }
    });
  })

  it ('should load the XML in a Javascript object', () => {
    if (!net){
      throw new Error('XML import failed');
    }
  });

  it ('should connect to ROS', function(done){
    this.timeout(10000);
    ros = new Ros({
      url : 'ws://192.168.56.101:9090'
    });
    ros.on('connection', function() {
      done()
    });
    ros.on('error', function(error) {
      throw new Error('Error while connecting to ros: '+ error);
    });
  });

  it ('should initialize the Ros-connected net', function(done) {
    this.timeout(0);
    net.init();

    // Ros places

    // At green dot speed
    var n1 = <RosPlace>(net.findNode('ros.AtGreenDotSpeed').node);
    n1.initRos('/sim/values/flightmodel/aircraft/position/airspeed_indicated_kts','std_msgs/Float32', RosPlace.LT(200), 10000.0/rate, ros);
    // Below 2000 ft AGL
    var n2 = <RosPlace>(net.findNode('ros.2000AGL').node);
    n2.initRos('/sim/values/flightmodel/aircraft/position/altitude_indicated_ft','std_msgs/Float32', RosPlace.LT(2000+1089),3000.0/rate, ros); // Airfield elevation 1090
    // At VFE1
    var n3 = <RosPlace>(net.findNode('ros.VFE1').node);
    n3.initRos('/sim/values/flightmodel/aircraft/position/airspeed_indicated_kts','std_msgs/Float32', RosPlace.LT(185), 2000.0/rate, ros);
    // At VFE2
    var n4 = <RosPlace>(net.findNode('ros.VFE2').node);
    n4.initRos('/sim/values/flightmodel/aircraft/position/airspeed_indicated_kts','std_msgs/Float32', RosPlace.LT(177), 2000.0/rate, ros);

    // Ros transitions

    net.ingest('start',1);
    net.makeEnd('end').then( () => {
      done();
    });
  })


});
