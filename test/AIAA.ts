import {Net} from '../src/net';
import fs = require('fs');
var xmlString = fs.readFileSync('data/descent_approach_land.xml','utf8');

var dataRoot = "data/";

var net: Net;
var rate = 50.0;

net = Net.fromPnml(xmlString, "DAL", null, true, dataRoot);

if (!net){
  throw new Error('XML import failed');
}

net.makeEnd('end').subscribe( (obs) => {
  console.log("Pnet reached end state");
});

net.useAgents();

net.init();
net.initAgent('pilot','human', 1);
net.initAgent('pilot','ai', 1);

// Init states
net.ingest('Land::!gearDown',1);
net.ingest('Land::!flaps',1);

net.ingest('start',1);
net.ingest('Cleared',1);
