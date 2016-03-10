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
	/**
	* Class for petri net arcs
	*/
	export class Arc {
		public inputNode: Node = null;
		public outputNode: Node = null;
		public m: number = 1;
		public sub: Rx.Disposable = null;
		public observable: Rx.Observable<string> = null;
		public observer: Rx.Observer<any> = null;
		constructor(input: Node, output: Node, m: number, public type: string = 'default') {
			this.inputNode = input;
			this.outputNode = output;
			this.m = m;
			this.inputNode.outputArcs.push(this);
			this.outputNode.inputArcs.push(this);
			this.observable = Rx.Observable.create<string>( (obs) => {
				this.sub = this.inputNode.subject.subscribe(
					(x) => { obs.onNext(this.type); },
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

		constructor(public name: string) {
			super(name);
			// Creating a deferred observable, created on first subscribe
			this.subject = new Rx.Subject();
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
			console.log("Added tokens to place: "+this.name);
			this.tokens = this.tokens.concat(tokens);
			this.subject.onNext(true);
			if (this.isEnd){
				this.subject.onCompleted();
			}
		}

		init() {
			console.log("Initializing place: "+this.name);
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
		protected execType: string = 'default';
		protected executeFn: (tokens: Token[]) => Promise<string>
		constructor(public name: string) {
			super(name);
			this.subject = new Rx.Subject();
			// Default instantaneous transition execution
			this.executeFn = () => { return Promise.resolve('ok');}
		}

		init(execType: string) {
			this.execType = execType;
			console.log("Initializing transition: "+this.name);
			_.forEach(this.inputArcs, (arc: Arc) => {
				// Subscribe to nodes
				console.log(this.name+" subscribing to "+arc.inputNode.name);
				arc.sub = arc.observable.subscribe(this.subject);
			})
			this.sub = this.subject.subscribe(
				(type: string) => {
					console.log("Checking transition "+this.name+" in mode "+type);
					// Iterating across input nodes to check firing
					var enabled = this.enabled(type);
					// If conditions not satisfied, do nothing
					if (!enabled) { return; }
					// If transition enabled but Net in other execution mode, log
					if (type != this.execType){
						return console.log(this.name + " would have fired in "+type+" mode.");
					}
					// If transition enabled in Net execution mode, consume and fire.
					var tokens = this.consume(type);
					this.execute(tokens).then( () => {
						console.log("Task "+this.name+" completed");
						_.forEach(this.outputArcs, (arc: Arc) => {
							var tokens = _.times(arc.m, () => { return new Token() });
							(<Place>arc.outputNode).addTokens(tokens);
						})
					});
				},
				(err) => {
					console.error(err);
				},
				() => {
					console.log("Done");
				}
			)
		}

		/**
		* Allows to implement customized asynchronous task execution behavior
		* @param fn Function returning an es6 promise resolving on task completion
		*/
		implement(fn: (tokens: Token[]) => Promise<string>): void {
			this.executeFn = fn;
		}

		/**
		* Checks whether preconditions are filled for firing
		* @return Null if not ready to fire, array of tokens if firing.
		*/
		enabled(type: string = 'default') {
			// Check that all arcs multiplicities are satisfied
			var enabled = _.reduce(this.inputArcs, (enable,arc) => {
				return enable && (arc.type == type) && ( (<Place>arc.inputNode).tokens.length >= arc.m)
			}, true);
			return enabled;
		}

		consume(type: string = 'default'): Token[] {
			return _.reduce(this.inputArcs, (tokens,arc) => {
				var node = <Place>arc.inputNode;
				return (arc.type == type) ? tokens.concat(node.consume(arc.m)) : tokens;
			}, []);
		}
		/**
		*
		*/

		/**
		* Execution promise factory function for internal use only
		* @param tokens Array of tokens involved in the transition execution
		* @return Returns ES6 promise resolving on transition completion
		*/
		execute(tokens: Token[]): Promise<string> {
			if (this.executeFn === null){
				throw new Error("Non validation transition execution promise")
			}
			return this.executeFn(tokens)
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
					setTimeout( () => { resolve('ok'); }, duration*1000);
				});
			};
		}

	}

	export class Net {
		transitions: Transition[] = [];
		places: Place[] = [];
		arcs: Arc[] = [];

		constructor() {
		}

		/**
		* Initializes the net for continuous time execution
		*/
		init(execType: string = 'default'){
			_.forEach(this.transitions, (t) => { t.init(execType) });
			_.forEach(this.places, (p) => { p.init(); });
		}

		/**
		* Sets end place
		*/
		makeEnd(endPlace: string) {
			var result = this.findNode(endPlace);
			if (result === undefined) { throw new Error(endPlace+" does not exist"); }
			if (result.type != 'place') { throw new Error("Only places can be used as net end");}
			var place = <Place>result.node;
			place.isEnd = true;
			return place.subject.toPromise(Promise);
		}

		/**
		* Finds and returns node in existing net
		* @param nodeId ID of the node
		* @return Returns object with handle to the node and node type if found, undefined otherwise
		*/
		findNode(nodeId: string): { node: Node, type: string } {
			var checkP = _.find(this.places, (p) => { return p.name == nodeId});
			// If node found in places array
			if (checkP !== undefined){
				return {
					node: checkP,
					type: 'place'
				}
			}
			// Else, check transitions
			var checkT = _.find(this.transitions, (t) => { return t.name == nodeId});
			if (checkT !== undefined){
				return {
					node: checkT,
					type: 'transition'
				}
			}
			// If neither place nor transition, return undefined
			return undefined;
		}

		/**
		* Adds arc with multiplicity
		* @param sourceId Id of the source node
		* @param targetId Id of the target node
		* @param m Multiplicity of the arc
		*/
		addArc(sourceId: string, targetId: string, m: number) {
			//console.log("Adding arc between "+sourceId+" and "+targetId);
			var source = this.findNode(sourceId);
			var target = this.findNode(targetId);
			if (source === undefined) { throw new Error("Source node not found")};
			if (target === undefined) { throw new Error("Target node not found")};
			if (source.type == target.type){
				throw new Error("Can't create arc between two nodes of same type");
			}
			this.arcs.push(new Arc(source.node, target.node, m));
		}

		/**
		* Inserts tokens in a given place of the petri net
		* @param nodeId String ID of the node to be added tokens
		* @param count Number of tokens to be added (default:1)
		*/
		ingest(nodeId: string, count: number = 1) {
			var node = this.findNode(nodeId);
			if (node === undefined) { throw new Error("Node "+nodeId+" doesn't exist")}
			if (node.type != 'place'){ throw new Error("Transition node can't ingest")}
			var place = <Place>node.node;
			var tokens = _.times(count, () => { return new Token() });
			place.addTokens(tokens);
		}


		/**
		* Static function to create Net from Pnml
		* @param Xml string
		* @return Petri net
		*/
		static fromPnml(xmlString: string, extensions: any = null): Net {
			var placeClass = (id) => {
				var pClass = Place;
				// Checking if extensions were passed
				if (extensions == null) { return pClass;}
				// Checking if node identifier contains extension
				var spl = id.split('.');
				if (spl.length < 2) { return pClass;}
				// Checking if identifier extension passed in extensions
				_.forEach(extensions, (classes,ext) => {
					if (classes.place && ext == spl[0]){
						pClass = classes.place
					}
				})
				return pClass;
			}
			var net = new Net();
			xml2js.parseString(xmlString, (err, results) => {
				//console.log(JSON.stringify(results,null,2));
				// Importing places
				var places = results['pnml']['net'][0]['place'];
				_.forEach(places, (pl) => {
					var pId = pl['$']['id'];
					var pClass = placeClass(pId)
					net.places.push(new pClass(pId));
				});
				// Importing transitions
				var transitions = results['pnml']['net'][0]['transition'];
				_.forEach(transitions, (t) => {
					net.transitions.push(new TimedTransition(t['$']['id'],1));
				});
				// Importing arcs
				var arcs = results['pnml']['net'][0]['arc'];
				_.forEach(arcs, (arc) => {
					net.addArc(arc['$']['source'],arc['$']['target'],1);
				});
			});
			return net;
		}
	}

}

export = petri;
