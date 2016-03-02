import _ = require('lodash');
import events = require('events');
import Rx = require('rx');
import xml2js = require('xml2js');
import {Promise} from 'es6-promise';

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

		/**
		* Consumes m tokens from a place
		* @param m Number of tokens to be consumed
		* @return Array of tokens that were removed from the place
		*/
		consume(m: number): Token[] {
			if (m > this.tokens.length){
				throw new Error("Trying to consume more tokens that place has");
			}
			return this.tokens.splice(0,m);

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

	export class Transition extends Node {
		protected executeFn: any = null;
		constructor(public name: string) {
			super(name);

			this.obs = Rx.Observable.defer( () => Rx.Observable.create( (observer) => {
				// Iterating over input arc
				_.forEach(this.inputArcs, (arc: Arc) => {
					// Subscribe to nodes
					arc.inputNode.obs.subscribe(
						(x: boolean) => {
							// Iterating across input nodes to check firing
							var tokens = this.enabled();
							if (tokens !== null){
								this.execute(tokens).then( () => {
									console.log("Task "+this.name+" completed");
								});
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
		* Allows to implement customized asynchronous task execution behavior
		* @param fn Function returning an es6 promise resolving on task completion
		*/
		implement(fn: any): void {
			this.executeFn = fn;
		}

		/**
		* Checks whether preconditions are filled for firing
		* @return Null if not ready to fire, array of tokens if firing.
		*/
		enabled(): Token[] {
			var enable = null;
			_.forEach(this.inputArcs, (arc: Arc) => {
				var node = <Place>arc.inputNode;
				if (node.tokens.length > arc.m){
					enable = enable || [];
					enable = _.concat(enable, node.consume(arc.m));
				}
			});
			return enable;
		}

		/**
		* Execution promise factory function for internal use only
		* @param tokens Array of tokens involved in the transition execution
		* @return Returns ES6 promise resolving on transition completion
		*/
		execute(tokens: Token[]): Promise<string> {
			if (this.executeFn === null){
				return Promise.resolve('ok');
			}
			else{
				return this.executeFn(tokens)
			}
		}

		describe(): TransitionDescription {
			return <TransitionDescription> _.extend(super.describe(), {
				type: 'transition',
				places: _.map(this.outputs(), 'name')
			});
		}
	}

	/**
	* Class represented a transition with a fixed time duration.
	*/
	export class TimedTransition extends Transition {
		private duration: number = 1;
		/**
		* TimedTransition constructor
		* @param duration Transition duration in seconds
		*/
		constructor(name: string, duration: number) {
			super(name);
			this.duration = duration;
			this.executeFn = (tokens: Token[]) => {
				return new Promise<string>( (resolve,reject) => {
					setTimeout( () => { resolve('ok'); }, duration);
				});
			};
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
				console.log(JSON.stringify(results,null,2));
				// Importing places
				var places = results['pnml']['net'][0]['place'];
				_.forEach(places, (pl) => {
					net.places.push(new Place(pl['$']['id']));
				});
				// Importing transitions
				var transitions = results['pnml']['net'][0]['transition'];
				_.forEach(transitions, (t) => {
					net.transitions.push(new TimedTransition(t['$']['id'],1));
				});
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
