import {Place, Transition, Token} from '../src/petri';
import {Net} from '../src/net';
import fs = require('fs');
import {Ros, Message, Topic} from 'roslib';
import {RosPlace} from '../src/extensions/places/place-ros';
import {RosTransition} from '../src/extensions/transitions/transition-ros';
var xmlString = fs.readFileSync('data/final_approach_3.xml','utf8');

describe('Ros Places', () => {
  var net: Net;
  var ros: Ros;
  var rate = 50.0;

  before(function() {
    net = Net.fromPnml(xmlString, "", {
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
    net.init('Obs');

    // Ros places

    // At green dot speed
    /*
    var n1 = <RosPlace>(net.findNode('ros.AtGreenDotSpeed').node);
    n1.initRos('/sim/values/flightmodel/aircraft/position/airspeed_indicated_kts','std_msgs/Float32', RosPlace.LT(200), 10000.0/rate, ros);
    // Below 2000 ft AGL
    var n2 = net.findNode('ros.2000AGL');
    if (n2){
      var rPlace2 = <RosPlace>(n2.node);
      rPlace2.initRos('/sim/values/flightmodel/aircraft/position/altitude_indicated_ft','std_msgs/Float32', RosPlace.LT(2000+1089),3000.0/rate, ros); // Airfield elevation 1090
    }
    // At VFE1
    var n3 = <RosPlace>(net.findNode('ros.VFE1').node);
    n3.initRos('/sim/values/flightmodel/aircraft/position/airspeed_indicated_kts','std_msgs/Float32', RosPlace.LT(185), 2000.0/rate, ros);
    // At VFE2
    var n4 = <RosPlace>(net.findNode('ros.VFE2').node);
    n4.initRos('/sim/values/flightmodel/aircraft/position/airspeed_indicated_kts','std_msgs/Float32', RosPlace.LT(177), 2000.0/rate, ros);
*/
    // Ros transitions
    var addRosObs = (topic, type, fn: (msg) => any, throttle: number = 1000/rate) => {
      var tHandle = new Topic({
        ros: ros,
        name: topic,
        messageType: type,
        throttle_rate: throttle
      })
      tHandle.subscribe(fn);
    }

    var flapState = 0;
    addRosObs('/sim/values/cockpit/controls/flap_request_ratio','std_msgs/Float32', (msg) => {
      switch (flapState){
        case 0:
          if (msg.data > 0.15){
            net.fire('SelectFlaps1',true); flapState = 1;
          }
          break;
        case 1:
          if (msg.data > 0.39){
            net.fire('SelectFlaps2',true); flapState = 2;
          }
          break;
        case 2:
          if (msg.data > 0.60){
            net.fire('SelectFlaps3',true); flapState = 3;
          }
          break;
        case 3:
          if (msg.data > 0.95){
            net.fire('selectFull',true); flapState = 4;
          }
          break;
      }
    });

    addRosObs('/sim/commands','std_msgs/String', (msg) => {
      if (msg.data == '/controls/autobrake/med_toggle'){
        net.fire('LdgGear',true);
      }
    })

    net.ingest('start',4);
    net.makeEnd('end').subscribe( (obs) => {
      console.log("Perplexity: "+1.0*net.pIndex/(1.0*net.pIndexLUT-1.0*net.pIndexFUT));
      console.log("Surprise: "+net.supriseIndex);
      done();
    });
  })


});
