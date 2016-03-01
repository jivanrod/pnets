var _ = require('lodash');
require('source-map-support').install();

import {Place} from 'pnets';
import {Net} from 'pnets';
import fs = require('fs');

var p1 = new Place('p1'),
	p2 = new Place('p2'),
	p3 = new Place('p3');

var xmlString = fs.readFileSync('test.xml','utf8');
var net = Net.fromPnml(xmlString);
