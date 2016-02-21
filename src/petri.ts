/// <reference path="../typings/main.d.ts" />

import _ = require('lodash');
import events = require('events');

module petri {
	export class Arc {
		constructor(public input: Node, public output: Node) {
			input.outputArcs.push(this);
			output.inputArcs.push(this);
		}
	}

	export interface NodeDescription {
		name: String
	}

	export class Node extends events.EventEmitter {
		public inputArcs: Arc[] = [];
		public outputArcs: Arc[] = [];

		constructor(public name: string) {
			super();
		}

		inputs() {
			return _.pluck(this.inputArcs, 'input');
		}

		outputs() {
			return _.pluck(this.outputArcs, 'output');
		}

		describe(): NodeDescription {
			return {
				name: this.name
			};
		}
	}

	export interface PlaceDescription extends NodeDescription {
		transitions: String[];
		tokens: number;
	}

	export class Place extends Node {
		public tokens: number = 0;

		constructor(public name: string) {
			super(name);
		}

		consume() {
			if (this.tokens < 1) {
				return;
			}

			this.tokens -= 1;
		}

		produce() {
			this.tokens += 1;
		}

		describe(): PlaceDescription {
			return <PlaceDescription> _.extend(super.describe(), {
				type: 'place',
				tokens: this.tokens,
				transitions: _.pluck(this.outputs(), 'name')
			});
		}
	}

	export interface TransitionDescription extends NodeDescription {
		places: String[];
		enabled: boolean;
	}

	export class Transition extends Node {
		constructor(public name: string, inputs: Place[], outputs: Place[]) {
			super(name);

			inputs.forEach((input) => {
				new Arc(input, this);
			});

			outputs.forEach((output) => {
				new Arc(this, output);
			});
		}

		enabled(): boolean {
			var places = <Place[]> this.inputs();

			var placeHasToken = function(p: Place): boolean {
				return p.tokens > 0;
			};

			return _.filter(places, placeHasToken).length === places.length;
		}

		fire() {
			if (!this.enabled()) {
				return;
			}

			_.each(this.inputs(), (p: Place) => p.consume());
			_.each(this.outputs(), (p: Place) => p.produce());
			this.emit('fire');
		}

		describe(): TransitionDescription {
			return <TransitionDescription> _.extend(super.describe(), {
				type: 'transition',
				places: _.pluck(this.outputs(), 'name')
			});
		}
	}

	export class Net {
		transitions: Transition[];
		places: Place[];

		constructor(private start: Place) {
			var visitResult = visit(this.start);

			this.transitions = visitResult.transitions;
			this.places = visitResult.places;
		}

		ingest(count: number = 1) {
			this.start.tokens += count;
		}

		execute() {
			_.each(this.transitions, (t: Transition) => t.fire());
		}

		summary(): String[] {
			var summarize = (place) : String => {
				return [place.name, place.tokens].join(': ');
			};

			return _.map(this.places, summarize);
		}

		describe(): Object[] {
			var places = _.map(this.places, (place) => {
				return place.describe();
			});

			var transitions = _.map(this.transitions, (transition) => {
				return transition.describe();
			});

			return [].concat(places, transitions);
		}
	}

	export interface VisitResult {
		places: Place[];
		transitions: Transition[]
	}

	export function visit(start: Place, result: VisitResult = { places: [], transitions: [] }) : VisitResult {
		if (_.contains(result.places, start)) {
			return result;
		}

		result.places.push(start);

		var transitions = <Transition[]> start.outputs();

		if (transitions.length === 0) {
			return result;
		}

		result.transitions = result.transitions.concat(transitions);

		_.each(transitions, (transition) => {
			_.each(transition.outputs(), (place) => {
				visit(place, result);
			});
		});

		return result;
	}
}

export = petri;
