"use strict";
var petri_1 = require('../src/petri');
var fs = require('fs');
var ROSLIB_1 = require('ROSLIB');
var place_ros_1 = require('../src/extensions/places/place-ros');
var transition_ros_1 = require('../src/extensions/transitions/transition-ros');
var xmlString = fs.readFileSync('data/final_approach_3.xml', 'utf8');
describe('Ros Places', function () {
    var net;
    var ros;
    var rate = 50.0;
    before(function () {
        net = petri_1.Net.fromPnml(xmlString, {
            'ros': {
                place: place_ros_1.RosPlace,
                transition: transition_ros_1.RosTransition
            }
        });
    });
    it('should load the XML in a Javascript object', function () {
        if (!net) {
            throw new Error('XML import failed');
        }
    });
    it('should connect to ROS', function (done) {
        this.timeout(10000);
        ros = new ROSLIB_1.Ros({
            url: 'ws://192.168.56.101:9090'
        });
        ros.on('connection', function () {
            done();
        });
        ros.on('error', function (error) {
            throw new Error('Error while connecting to ros: ' + error);
        });
    });
    it('should initialize the Ros-connected net', function (done) {
        this.timeout(0);
        net.init('Obs');
        var addRosObs = function (topic, type, fn, throttle) {
            if (throttle === void 0) { throttle = 1000 / rate; }
            var tHandle = new ROSLIB_1.Topic({
                ros: ros,
                name: topic,
                messageType: type,
                throttle_rate: throttle
            });
            tHandle.subscribe(fn);
        };
        var flapState = 0;
        addRosObs('/sim/values/cockpit/controls/flap_request_ratio', 'std_msgs/Float32', function (msg) {
            switch (flapState) {
                case 0:
                    if (msg.data > 0.15) {
                        net.fire('SelectFlaps1', true);
                        flapState = 1;
                    }
                    break;
                case 1:
                    if (msg.data > 0.39) {
                        net.fire('SelectFlaps2', true);
                        flapState = 2;
                    }
                    break;
                case 2:
                    if (msg.data > 0.60) {
                        net.fire('SelectFlaps3', true);
                        flapState = 3;
                    }
                    break;
                case 3:
                    if (msg.data > 0.95) {
                        net.fire('selectFull', true);
                        flapState = 4;
                    }
                    break;
            }
        });
        addRosObs('/sim/commands', 'std_msgs/String', function (msg) {
            if (msg.data == '/controls/autobrake/med_toggle') {
                net.fire('LdgGear', true);
            }
        });
        net.ingest('start', 4);
        net.makeEnd('end').then(function () {
            console.log("Perplexity: " + 1.0 * net.pIndex / (1.0 * net.pIndexLUT - 1.0 * net.pIndexFUT));
            console.log("Surprise: " + net.supriseIndex);
            done();
        });
    });
});
