import _ = require('lodash');
import events = require('events');
import Rx = require('rx');
import xml2js = require('xml2js');
import {Promise} from 'es6-promise';
import {Matrix,Vector} from 'mathlib';
import {Node,Transition,Place,Arc,Token,TimedTransition} from './petri';
import {Net} from './net';
import {SubnetTransition} from './extensions/transitions/transition-subnet';
import * as path from "path";
import * as fs from "fs";

/**
* Petri nets module
* @preferred
*/
module petri {

	export class AdaptiveTransition extends Transition{

		public th: number;

		enabled(type: string = 'default') {
			var all_enabled = false;
			// Li et al. Definition 7
			var certaintyFactor = _.reduce(this.inputArcs, (CF,arc) => {
				let level = (<Place>arc.inputNode).activationLevel();
				all_enabled = all_enabled && (level > 0);
				return CF + (arc.type == type ? level * arc.m : 0);
			}, 0);
			return {
				fire: all_enabled && (certaintyFactor > this.th),
				result: certaintyFactor
			};
		}

		processFireEvent(enableParams: any){

		}

	}

	export class AdaptivePlace extends Place{

	}

	export class AdaptiveNet extends Net{
		constructor(public namespace: string = "") {
				super(namespace);
		}

		private sigmoid(x: number, th: number): number {
			let b = 100;
			return 1/(1+Math.exp(-b*(x-th)));
		}

}
}

export = petri;
