import _ = require('lodash');
import events = require('events');
import Rx = require('rx');
import xml2js = require('xml2js');
import {Promise} from 'es6-promise';
import {Matrix,Vector} from 'mathlib';

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
			this.inputNode = input;
			this.outputNode = output;
			this.m = m;
			this.inputNode.outputArcs.push(this);
			this.outputNode.inputArcs.push(this);
			this.observable = Rx.Observable.create<Arc>( (obs) => {
				this.sub = this.inputNode.subject.subscribe(
					(x) => { obs.onNext(this); },
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
		public arcObserver: Rx.Observer<Arc>;
		constructor(public name: string) {
			super(name);
			this.subject = new Rx.Subject();
			// Default instantaneous transition execution
			this.executeFn = () => { return Promise.resolve('ok');}
		}

		init(execType: string) {
			this.execType = execType;
			//console.log("Initializing transition: "+this.name);
			this.arcObserver = Rx.Observer.create(
				(arc: Arc) => {
					// Iterating across input nodes to check firing
					var enabled = this.enabled(arc.type);
					// If conditions not satisfied, do nothing
					if (!enabled) { return; }
					// If transition enabled but Net in other execution mode, log
					if (arc.type != this.execType){
						return console.log(this.name + " would have fired in "+arc.type+" mode.");
					}
					// If transition enabled in Net execution mode, consume and fire.
					var tokens = this.consume(arc.type);
					this.execute(tokens).then( () => {
						this.fire();
					});
				}, (err) => { console.error(err); }, () => { console.log("Done"); }
			);
			// Registering arc observer to all transition input arcs
			_.forEach(this.inputArcs, (arc: Arc) => {
				// Subscribe to nodes
				arc.sub = arc.observable.subscribe(this.arcObserver);
			})
		}

		/**
		* Forcing transition firing (Interesting for debugging)
		*/
		fire(type: string = 'default') {
				// Checking if transition was enabled on a certain type
				var enabled = this.enabled(type);
				// If not enabled, we file a mismatch
				if (!enabled){
					console.log("Transition "+this.name+" force fired prematurely")
				}
				// Notifying transition observers
				this.subject.onNext(this.name);
				// Feeding downstream tokens (could be done using observers)
				_.forEach(this.outputArcs, (arc: Arc) => {
					var tokens = _.times(arc.m, () => { return new Token() });
					(<Place>arc.outputNode).addTokens(tokens);
				})
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
		Pre: Matrix;
		Post: Matrix;
		C: Matrix;
		perplex: number;
		arcSubject: Rx.Subject<any>;
		transitionSubject: Rx.Subject<any>;

		constructor() {
			this.arcSubject = new Rx.Subject<any>();
			this.transitionSubject = new Rx.Subject<any>();

			// Basic net logging
			this.arcSubject.subscribe(
				(arc) => { },
				(err) => { throw new Error(err);},
				() => { console.log("Arc completed");}
			);
			this.transitionSubject.subscribe(
				(t) => { console.log(t+ " fired")},
				(err) => { throw new Error(err);},
				() => { console.log("Transition completed");}
			);
		}

		/**
		* Initializes the net for continuous time execution
		*/
		init(execType: string = 'default'){
			_.forEach(this.transitions, (t) => { t.init(execType) });
			_.forEach(this.places, (p) => { p.init(); });
			this.buildMath();
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
		findNode(nodeId: string): { node: Node, type: string, index: number } {
			var checkP = _.find(this.places, (p) => { return p.name == nodeId});
			// If node found in places array
			if (checkP !== undefined){
				return {
					node: checkP,
					type: 'place',
					index: _.findIndex(this.places, (p) => { return p.name == nodeId})
				}
			}
			// Else, check transitions
			var checkT = _.find(this.transitions, (t) => { return t.name == nodeId});
			if (checkT !== undefined){
				return {
					node: checkT,
					type: 'transition',
					index: _.findIndex(this.transitions, (t) => { return t.name == nodeId})
				}
			}
			// If neither place nor transition, return undefined
			return undefined;
		}

		/**
		* Adds place to petri net
		*/
		addPlace(pHandle: Place){
			//pHandle.subject.subscribe(this.placeObserver);
			this.places.push(pHandle);
		}

		/**
		* Adds transition to petri net
		*/
		addTransition(tHandle: Transition){
			tHandle.subject.subscribe(this.transitionSubject);
			this.transitions.push(tHandle);
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
			// Subscribing net and creating arc
			var arc = new Arc(source.node, target.node, m);
			arc.observable.subscribe(this.arcSubject);
			this.arcs.push(arc);
		}

		/**
		* Force-fires transition in net
		* @param nodeId String ID of the transition
		*/
		fire(nodeId: string, type: string = 'default'){
			var node = this.findNode(nodeId);
			if (node === undefined) { throw new Error("Node "+nodeId+" doesn't exist")}
			if (node.type != 'transition'){ throw new Error("Place node cannot be fired")}
			var t = <Transition>node.node;
			t.fire(type);
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

		buildMath(){
			// Building C = Post - Pre
			this.C = Matrix.zero(this.places.length,this.transitions.length);
			this.Pre = Matrix.zero(this.places.length,this.transitions.length);
			this.Post = Matrix.zero(this.places.length,this.transitions.length);
			_.each(this.arcs, (arc) => {
				var input = this.findNode(arc.inputNode.name);
				var output = this.findNode(arc.outputNode.name);
				var i = input.index;
				var j = output.index;
				if (input.type == 'place'){
					this.Pre[i][j] = arc.m;
				}
				else {
					this.Post[j][i] = arc.m;
				}
			});
			this.C = this.Post.minus(this.Pre);
		}

		getMarking(){
			var M = Vector.zero(this.places.length);
			_.each(this.places, (place, index) => {
				M[index] = place.tokens.length;
			});
			return M;
		}

		/**
		* Calculates minimal e-vector $Y_{min}(M,t)$ (from Giua et al. 2013 (11cep.pdf))
		*/
		minExp(M: Vector, t: string){
			var tInd = this.findNode(t).index;
			console.log("Calculating minumum explanation for transition "+t+" from Marking:");
			console.log(M.toString());
			var m = this.places.length;
			var n = this.transitions.length;
			// 1. Let Gamma = ...
			var ct = this.C.transpose();
			var temp = this.Pre.toColVectors()[tInd]; // Get last column
			var A = <Vector[]>[];
			var B = <Vector[]>[];
			A.push(M.minus(temp));
			B.push(Vector.zero(n));
			var negEntry = (A) => {
				var r = { i: -1, j: -1};
				_.forEach(A, (v, ind) => {
					var col = v.reduce( (neg,val,index) => { return val < 0 ? index : neg},-1);
					if (col > 0){ r.i = parseInt(ind); r.j = col };
				})
				return (r.i<0) ? null : r;
			}

			var k = negEntry(A);
			// 2. While A has negative entries
			while (k){
				// 2.2
				var i_plus = ct.toRowVectors().reduce( (list,row,index) => {
					if (row[k.j] > 0) { return list.concat([index]);}
					else { return list;}
				},[]);
				// 2.3
				_.each(i_plus, (ii) => {
					var newA = A[k.i].plus( ct.toRowVectors()[ii] );
					var newB = B[k.i]; newB[ii] +=1;
					A.push( newA );
					B.push( newB );
				});
				// 2.4
				A.splice(k.i,1); B.splice(k.i,1);
				k = negEntry(A);
			}
			// 3
			console.log("B final:");
			_.each(B, (b) => { console.log(b.toString()) });
			return B;
		}

		/**
		* Basis marking set
		*/
		basisMarkings(M0: Vector, t: string){
			var tInd = this.findNode(t).index;
			var m = this.places.length;
			var n = this.transitions.length;
			var Mbar = [{ m: M0, y: Vector.zero(n), g: Vector.zero(n)}];
			var pM = [];
			// 6.1.1
			var Ymin = this.minExp(M0,t);
			_.each(Ymin, (e: Vector) => {
				var ct = this.C.toColVectors()[tInd];
				var MM = M0.plus(this.C.times(e).plus(ct)); // 6.1.1.1
				pM.push(MM);
			})
			console.log("Potential new states");
			_.each(pM, (b) => { console.log(b.toString()) });
			return pM;
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
					net.addPlace(new pClass(pId));
				});
				// Importing transitions
				var transitions = results['pnml']['net'][0]['transition'];
				_.forEach(transitions, (t) => {
					net.addTransition(new TimedTransition(t['$']['id'],1));
				});
				// Importing arcs
				var arcs = results['pnml']['net'][0]['arc'];
				_.forEach(arcs, (arc) => {
					var multiplicity = <number>arc['inscription'][0]['value'][0].split(',')[1];
					net.addArc(arc['$']['source'],arc['$']['target'],1*multiplicity); // 1* to force number
				});
			});
			return net;
		}
	}

}

export = petri;
