import _ = require('lodash');
import events = require('events');
import Rx = require('rx');
import xml2js = require('xml2js');
import {Promise} from 'es6-promise';
import {Matrix,Vector} from 'mathlib';
import {Node,Transition,Place,Arc,Token,TimedTransition} from './petri';
import {SubnetTransition} from './extensions/transitions/transition-subnet';
import * as path from "path";
import * as fs from "fs";

/**
* Petri nets module
* @preferred
*/
module petri {
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
		placeSubject: Rx.Subject<any>;
		supriseIndex: number = 0;
		pIndex: number = 0;
		pIndexLUT: number = 0;
		pIndexFUT: number = 0;

		constructor(public namespace: string = "") {
			this.arcSubject = new Rx.Subject<any>();
			this.transitionSubject = new Rx.Subject<any>();
			this.placeSubject = new Rx.Subject<any>();

			this.placeSubject.subscribe( (p: Place) => {
				var nNode = this.findNode("!"+p.name);
				if (nNode != undefined){
					// Cast to place
					var pp = <Place>nNode.node;
					// Negate nNode
					if (p.tokens.length > 0){
						pp.tokens = [];
					}
					else {
						pp.addTokens(new Token(),1);
					}
					pp.subject.onNext(true);
				}

			})

			// Basic net logging
			this.arcSubject.subscribe(
				(arc) => {
					// Updating perplexity
					var t1 = this.pIndexLUT;
					var t2 = new Date().getTime();
					var diff = t2 - t1;
					var simTasks = _.reduce(this.transitions, (tot, t) => {
						return t.enabled() ? (tot + 1) : tot
					},0);
					this.pIndex += simTasks * diff;
					this.pIndexLUT = t2;
				},
				(err) => { throw new Error(err);},
				() => { console.log("Arc completed");}
			);
			this.transitionSubject.subscribe(
				(t) => {
					// Notify fire
					console.log(this.getFullName(t)+ " fired");
					// Update
				},
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

		initAgent(agentName: string, agentType: string, tokenNumber: number){
			this.ingest('__agent', tokenNumber, agentType);
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
			return place.subject;
		}

		/**
		* Gets full name including namespace
		*/
		getFullName(nodeId: string): string {
			return this.namespace.length == 0 ? nodeId : this.namespace + "::" + nodeId;
		}

		/**
		* Add agent place and connects to non-dispatchable transitions
		*/
		useAgents() {
			if (this.findNode("__agent") == undefined){
				var agentPlace = new Place("__agent");
				this.dispatch(agentPlace);
			}
		}

		/**
		*
		*/
		dispatch(agentNode: Place) {
			this.addPlace(agentNode);
			_.forEach(this.transitions, t => {
					if (!t.dispatchable()){
						this.addArc(agentNode.name, t.name, 1);
						this.addArc(t.name, agentNode.name, 1);
					}
					else {
						t.dispatch(agentNode);
					}
				});
		}

		/**
		* Finds and returns node in existing net
		* @param nodeId ID of the node
		* @return Returns object with handle to the node and node type if found, undefined otherwise
		*/
		findNode(nodeId: string): { node: Node, type: string, index: number } {
			// Check namespace
			var spl = nodeId.split('::');
			if (spl.length > 1){
				var ns = spl.shift();
				var nsNode = this.findNode(ns);
				if (nsNode == undefined){
					return undefined;
				}
				else {
					return (<SubnetTransition>nsNode.node).getNet().findNode(spl.join('::'));
				}
			}

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
			pHandle.subject.subscribe(this.placeSubject);
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
		addArc(sourceId: string, targetId: string, m: number, type: string = 'default') {
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
		fire(nodeId: string, update: boolean = false, type: string = 'default'){
			var node = this.findNode(nodeId);
			if (node === undefined) { throw new Error("Node "+nodeId+" doesn't exist")}
			if (node.type != 'transition'){ throw new Error("Place node cannot be fired")}
			var t = <Transition>node.node;
			var pMarkings = this.basisMarkings(this.getMarking(),nodeId);
			var wasReady = t.fire(type);
			// To be cleanup surprise index calculation
			this.supriseIndex += (wasReady ? 0 : 1 );
			if (update){
				if (pMarkings.length > 0){
					this.setMarking(pMarkings[0]);
				}
			}
		}

		/**
		* Inserts tokens in a given place of the petri net
		* @param nodeId String ID of the node to be added tokens
		* @param count Number of tokens to be added (default:1)
		*/
		ingest(nodeId: string, count: number = 1, type: string = 'default') {
			// To be cleanup, perplexity calculation
			this.pIndexLUT = this.pIndexFUT = new Date().getTime();
			var node = this.findNode(nodeId);
			if (node === undefined) { throw new Error("Node "+nodeId+" doesn't exist")}
			if (node.type != 'place'){ throw new Error("Transition node can't ingest")}
			var place = <Place>node.node;
			place.addTokens(new Token(type), 1);
		}

		/**
		* Building algebraic structures used for some algorithms
		*/
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

		/**
		* Gets the current marking as a Mathlib Vector
		* @return Returns the current marking
		*/
		getMarking(){
			var M = Vector.zero(this.places.length);
			_.each(this.places, (place, index) => {
				M[index] = place.tokens.length;
			});
			return M;
		}

		/**
		* Sets the marking of the petri net
		* @param M Marking to replace the current one
		*/
		setMarking(M: Vector){
			_.each(this.places, (place, index) => {
				place.tokens = _.times(M[index], () => { return new Token() });
			});
		}

		/**
		* Calculates minimal e-vector $Y_{min}(M,t)$ (from Giua et al. 2013 (11cep.pdf))
		* Returns an array of minimal e-vectors
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
		* Basis marking set (as calculated in Cabasino and Giua, Algorithm 11)
		* @return Returns an array containing the basis marking set
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
		static fromPnml(xmlString: string, namespace: string = "", extensions: any = null,
			 							recursive: boolean = false, dataRoot: string = ""): Net {
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

			var net = new Net(namespace);
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
					var tid = t['$']['id'];
					var fPath = path.join(dataRoot,tid+".xml");
					// If recursive, load subnet
					if (recursive && fs.existsSync(fPath)){
						var xmlString = fs.readFileSync(fPath,'utf8');
						net.addTransition(new SubnetTransition(tid, Net.fromPnml(xmlString, net.getFullName(tid), extensions, true, dataRoot)));
					}
					else {
						net.addTransition(new TimedTransition(tid,1));
					}
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
