import {Transition,Token,Place} from '../../petri';
import {Net} from '../../net';
import _ = require('lodash');
import Rx = require('rx');

/**
* Transition with nested petri net
*/
export class SubnetTransition extends Transition{
	private startPlace: Place;
	private net_: Net;
	constructor(name:string, net: Net){
    // Calling super class Transition constructor
    super(name);
		this.net_ = net;
		this.startPlace = <Place>net.findNode('start').node;
    this.executeFn = (tokens: Token[]) => {
      net.ingest('start', this.startPlace.outputArcs.length);
      return net.makeEnd('end');
    };
	}

	init(execType: string) {
		super.init(execType);
		this.	net_.init();
	}

	getNet(){
		return this.net_;
	}

	dispatch(agentNode: Place) {
		this.net_.dispatch(agentNode);
	}

	dispatchable(): boolean { return true;}

}
