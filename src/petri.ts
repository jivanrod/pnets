import _ = require('lodash');
import events = require('events');
import Rx = require('rx');
import xml2js = require('xml2js');
/**
* Petri nets module
* @preferred
*/
module petri {
	export class Arc {
		public inputNode: Node = null;
		public outputNode: Node = null;
		public m: number = 1;
		constructor(public input: Node, public output: Node, m: number) {
			this.inputNode = input;
			this.outputNode = output;
			this.m = m;
			input.outputArcs.push(this);
			output.inputArcs.push(this);
		}
	}

	export class Token {
		constructor(type: string){
			this.type = type;
		}

		public type: string = 'default'
	}

	export interface NodeDescription {
		name: String
	}

	export class Node extends events.EventEmitter {
		public inputArcs: Arc[] = [];
		public outputArcs: Arc[] = [];
		public obs: Rx.Observable<any> = null;

		constructor(public name: string) {
			super();
		}

		inputs() {
			return _.map(this.inputArcs, 'input');
		}

		outputs() {
			return _.map(this.outputArcs, 'output');
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
		public tokens: Token[] = [];

		constructor(public name: string) {
			super(name);
			this.obs = Rx.Observable.defer( () => Rx.Observable.create( (observer) => {
				// Iterating over input arc
				_.forEach(this.inputArcs, (arc: Arc) => {
					// Subscribe to nodes
					arc.inputNode.obs.subscribe(
						(x: Token[]) => {
							this.tokens = _.concat(this.tokens,x);
							observer.onNext(true);
						},
						(err) => {
							console.error(err);
						},
						() => {
							console.log("Done");
						}
					)
				})
			}));
		}

		consume() {
			/*if (this.tokens < 1) {
				return;
			}*/
			return;

			//this.tokens -= 1;
		}

		produce() {
			//this.tokens += 1;
		}

		describe(): PlaceDescription {
			return <PlaceDescription> _.extend(super.describe(), {
				type: 'place',
				tokens: this.tokens,
				transitions: _.map(this.outputs(), 'name')
			});
		}
	}

	/**
	* Places with spontaneous token generation based on condition.
	*/
	export class ConditionalPlace extends Place {
		constructor(public name: string){
			super(name)
		}
	}

	export interface TransitionDescription extends NodeDescription {
		places: String[];
		enabled: boolean;
	}

	export abstract class Transition extends Node {
		constructor(public name: string) {
			super(name);

			this.obs = Rx.Observable.defer( () => Rx.Observable.create( (observer) => {
				// Iterating over input arc
				_.forEach(this.inputArcs, (arc: Arc) => {
					// Subscribe to nodes
					arc.inputNode.obs.subscribe(
						(x: boolean) => {
							// Iterating across input nodes to check firing
							if (this.enabled()){
								this.fire();
							}
						},
						(err) => {
							console.error(err);
						},
						() => {
							console.log("Done");
						}
					)
				})
			}));
		}

		/**
		* Checks whether preconditions are filled for firing
		* @return boolean
		*/
		enabled(): boolean {

			var enable = true;
			_.forEach(this.inputArcs, (arc: Arc) => {
				var node = <Place>arc.inputNode;
				enable = enable && (node.tokens.length == arc.m);
			});
			return enable;
		}

		fire() {
			if (!this.enabled()) {
				return;
			}

			_.each(this.inputs(), (p: Place) => p.consume());
			_.each(this.outputs(), (p: Place) => p.produce());
			this.emit('fire');
		}

		/**
		* Abstract method for non-instantaneous task execution
		* @return Returns RxJS observable resolving the task executiong
		*/
		abstract execute(): Rx.Observable<any>;

		describe(): TransitionDescription {
			return <TransitionDescription> _.extend(super.describe(), {
				type: 'transition',
				places: _.map(this.outputs(), 'name')
			});
		}
	}

	export class Net {
		transitions: Transition[];
		places: Place[];

		constructor() {
			//var visitResult = visit(this.start);

			this.transitions = [];//visitResult.transitions;
			this.places = [];//visitResult.places;
		}

		ingest(count: number = 1) {
			//this.start.tokens += count;
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

		/**
		* Static function to create Net from Pnml
		*/
		static fromPnml(xmlString: string): Net {
			var net = new Net();
			xml2js.parseString(xmlString, (err, results) => {
				
			});
			return net;
		}
	}

	export interface VisitResult {
		places: Place[];
		transitions: Transition[]
	}

	export function visit(start: Place, result: VisitResult = { places: [], transitions: [] }) : VisitResult {
		if (_.includes(result.places, start)) {
			return result;
		}

		result.places.push(start);

		var transitions = <Transition[]> start.outputs();

		if (transitions.length === 0) {
			return result;
		}

		result.transitions = result.transitions.concat(transitions);

		_.each(transitions, (transition) => {
			_.each(transition.outputs(), (place: Place) => {
				visit(place, result);
			});
		});

		return result;
	}

}

export = petri;
