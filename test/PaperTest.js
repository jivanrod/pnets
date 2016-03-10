"use strict";
var petri_1 = require('../src/petri');
var fs = require('fs');
var ROSLIB_1 = require('ROSLIB');
var place_ros_1 = require('../src/extensions/places/place-ros');
var transition_ros_1 = require('../src/extensions/transitions/transition-ros');
var xmlString = fs.readFileSync('data/final_approach.xml', 'utf8');
describe('Ros Places', function () {
    var net;
    var ros;
    var rate = 10.0;
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
        net.init();
        var n1 = (net.findNode('ros.AtGreenDotSpeed').node);
        n1.initRos('/sim/values/flightmodel/aircraft/position/airspeed_indicated_kts', 'std_msgs/Float32', place_ros_1.RosPlace.LT(200), 10000.0 / rate, ros);
        var n2 = (net.findNode('ros.2000AGL').node);
        n2.initRos('/sim/values/flightmodel/aircraft/position/altitude_indicated_ft', 'std_msgs/Float32', place_ros_1.RosPlace.LT(2000 + 1089), 3000.0 / rate, ros);
        var n3 = (net.findNode('ros.VFE1').node);
        n3.initRos('/sim/values/flightmodel/aircraft/position/airspeed_indicated_kts', 'std_msgs/Float32', place_ros_1.RosPlace.LT(185), 2000.0 / rate, ros);
        var n4 = (net.findNode('ros.VFE2').node);
        n4.initRos('/sim/values/flightmodel/aircraft/position/airspeed_indicated_kts', 'std_msgs/Float32', place_ros_1.RosPlace.LT(177), 2000.0 / rate, ros);
        net.ingest('start', 1);
        net.makeEnd('end').then(function () {
            done();
        });
    });
});
