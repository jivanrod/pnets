import _ = require('lodash');
import events = require('events');
import Rx = require('rx');
import xml2js = require('xml2js');
import {Promise} from 'es6-promise';
import {Matrix,Vector} from 'mathlib';
import * as path from "path";
import * as fs from "fs";

/**
* Petri nets module
* @preferred
*/
module petri {
	/**
	* Class for petri net arcs
	*/
	export class Arc {
		public inputNode: Node = null;
		public outputNode: Node = null;
		public m: number = 1;
		public sub: Rx.Disposable = null;
		public observable: Rx.Observable<Arc> = null;
		public observer: Rx.Observer<any> = null;
		constructor(input: Node, output: Node, m: number, public type: string = 'default') {
			// Setting input/output nodes and arc multiplicity
			this.inputNode = input;
			this.outputNode = output;
			this.m = m;

			// Adding arc to input/output nodes
			this.inputNode.outputArcs.push(this);
			this.outputNode.inputArcs.push(this);

			// Setting arc observable to forward input stimuli
			this.observable = Rx.Observable.create<Arc>( (obs) => {
				this.sub = this.inputNode.subject.subscribe(
					(x) => {
						// Upstream place notifies of new token
						obs.onNext(this);
					},
					(err) => { throw new Error(err);},
					() => { console.log("Arc of type "+this.type+" completed");}
				)
			});
		}
	}

	/**
	* Class for petri tokens
	*/
	export class Token {
		constructor(type: string = 'default'){
			this.type = type;
		}

		public type: string = 'default'
	}

	/**
	* Base class for petri nodes
	*/
	export class Node extends events.EventEmitter {
		public inputArcs: Arc[] = [];
		public outputArcs: Arc[] = [];
		public subject: Rx.Subject<any> = null;
		public sub: Rx.Disposable = null;
		constructor(public name: string) {
			super();
		}
	}

	/**
	* Class for petri places
	*/
	export class Place extends Node {
		public tokens: Token[] = [];
		public isEnd: boolean = false;
		public prop: () => Promise<number>; // Truth proposition promise (should return in [0,1])
		public extraSubject: Rx.Subject<Place>;

		constructor(public name: string, public namespace: string = "") {
			super(name);
			// Creating a deferred observable, created on first subscribe
			this.subject = new Rx.Subject();
			this.extraSubject = new Rx.Subject<Place>();
		}

		/**
		* Set tokens property to given tokens array
		* @param tokens Array of tokens that will replace current tokens
		*/
		protected setTokens(tokens: Token[]){
			this.tokens = [].concat(tokens);
			this.subject.onNext(true);
			if (this.isEnd){
				this.subject.onCompleted();
			}
		}

		/**
		* Add tokens to place and notifies downstream transitions
		* @param tokens Array of tokens to be added
		*/
		addTokens(tokens: Token[]) {
			this.tokens = this.tokens.concat(tokens);
			//console.log("Added "+tokens.length+" tokens to place: "+this.name+" (Total:"+this.tokens.length+")");
			this.extraSubject.onNext(this);
			this.subject.onNext(true);
			if (this.isEnd){
				this.subject.onCompleted();
			}
			// Check negative places
		}

		init() {
			//console.log("Initializing place: "+this.name);
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
		}

		/**
		* Returns activation level of the place = number of tokens for vanilla petri nets
		*/
		activationLevel(): Number{
			return this.tokens.length;
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

	/**
	* Class for petri net transitions
	*/
	export class Transition extends Node {
		/**
		* Execucation type of the transition
		*/
		protected execType: string = 'default';

		/**
		* What happens when transition is activated, initiated to function returning resolved promise
		*/
		protected executeFn: (tokens: Token[]) => Rx.Observable<string>;

		/**
		* Observer of incoming arcs
		*/
		public arcObserver: Rx.Observer<Arc>;

		private activationTokens: { string: Token[] };

		/**
		* Transition constructor
		*/
		constructor(public name: string, public namespace: string = "") {
			super(name);
			this.subject = new Rx.Subject();
		}

		/**
		* Initializion of the transition node
		*/
		init(execType: string) {
			// Setting execution type
			this.execType = execType;
			//console.log("Initializing transition: "+this.name);

			// Initializing transition's arc observer
			this.arcObserver = Rx.Observer.create(
				(arc: Arc) => {
					// Iterating across input nodes to check firing
					var enabled = this.enabled(arc.type);
					// If conditions not satisfied, do nothing
					if (!enabled) {
						return;
					}
					// If transition enabled but Net in other execution mode, log
					if (arc.type != this.execType){
						return;
						//return console.log(this.name + " would have fired in "+arc.type+" mode.");
					}
					// If transition enabled in Net execution mode, consume specified and fire.
					var tokens = this.consume(arc.type);

					// Perform asynchronous transition execution
					this.execute(tokens).subscribe( () => {
						// Actually fires net transition upon execution completion
						this.fire(this.execType, true);
					});
				}, (err) => { console.error(err); }, () => { console.log("Done"); }
			);
			// Registering arc observer to all input arcs
			_.forEach(this.inputArcs, (arc: Arc) => {
				// Subscribe to nodes
				arc.sub = arc.observable.subscribe(this.arcObserver);
			})
		}

		/**
		* Forcing transition firing (Interesting for debugging)
		* @return Returns boolean if transition was actually enabled (useful for monitoring inacurrate nets)
		*/
		fire(type: string, enable: boolean = false): boolean {
				// Checking if transition was enabled on a certain type
				var enabled = this.enabled(type) || enable;
				// If not enabled, we file a mismatch
				if (!enabled){
					console.log("Transition "+this.name+" force fired prematurely")
				}
				// Notifying transition observers of the fire event
				this.subject.onNext(this.name);
				// Feeding downstream tokens (could be done using observers)
				_.forEach(this.outputArcs, (arc: Arc) => {
					// Only feeding downstream nodes through arcs of firing type
					if (arc.type != type) { return; }
					var tokens = _.times(arc.m, () => { return new Token() });
					(<Place>arc.outputNode).addTokens(tokens); // Casting node into Place
				})
				return enabled;
		}

		/**
		* Allows to implement customized asynchronous task execution behavior
		* @param fn Function returning an es6 promise resolving on task completion
		*/
		implement(fn: (tokens: Token[]) => Rx.Observable<string>): void {
			this.executeFn = fn;
		}

		/**
		* Checks whether preconditions are filled for firing
		* @return Null if not ready to fire, array of tokens if firing.
		*/
		enabled(type: string = 'default') {
			// Check that all arcs multiplicities are satisfied
			var enabled = _.reduce(this.inputArcs, (enable,arc) => {
				return enable && (arc.type == type) && ( (<Place>arc.inputNode).activationLevel() >= arc.m)
			}, true);
			return enabled;
		}

		/**
		* Actually consumes the tokens from incoming places and return an array containing them
		*/
		consume(type: string = 'default'): Token[] {
			return _.reduce(this.inputArcs, (tokens,arc) => {
				var node = <Place>arc.inputNode;
				return (arc.type == type) ? tokens.concat(node.consume(arc.m)) : tokens;
			}, []);
		}


		/**
		* Execution promise factory function for internal use only
		* @param tokens Array of tokens involved in the transition execution
		* @return Returns ES6 promise resolving on transition completion
		*/
		execute(tokens: Token[]): Rx.Observable<string> {
			if (this.executeFn === null){
				throw new Error("Non validation transition execution promise")
			}
			return this.executeFn(tokens)
		}

		dispatch(agentNode: Place) {}
		/**
		* Flag representing if a transition is compounded
		*/
		dispatchable(): boolean { return false; }

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
				return Rx.Observable.create<string>( (observer) => {
					setTimeout( () => { observer.onNext('ok'); }, duration*1000);
				});
				/*return new Promise<string>( (resolve,reject) => {
					setTimeout( () => { resolve('ok'); }, duration*1000);
				});*/
			};
		}

	}

}

export = petri;
