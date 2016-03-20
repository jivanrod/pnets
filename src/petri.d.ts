import events = require('events');
import Rx = require('rx');
import { Matrix, Vector } from 'mathlib';
declare module petri {
    class Arc {
        type: string;
        inputNode: Node;
        outputNode: Node;
        m: number;
        sub: Rx.Disposable;
        observable: Rx.Observable<Arc>;
        observer: Rx.Observer<any>;
        constructor(input: Node, output: Node, m: number, type?: string);
    }
    class Token {
        constructor(type?: string);
        type: string;
    }
    class Node extends events.EventEmitter {
        name: string;
        inputArcs: Arc[];
        outputArcs: Arc[];
        subject: Rx.Subject<any>;
        sub: Rx.Disposable;
        constructor(name: string);
    }
    class Place extends Node {
        name: string;
        tokens: Token[];
        isEnd: boolean;
        constructor(name: string);
        protected setTokens(tokens: Token[]): void;
        addTokens(tokens: Token[]): void;
        init(): void;
        consume(m: number): Token[];
    }
    class ConditionalPlace extends Place {
        name: string;
        constructor(name: string);
    }
    class Transition extends Node {
        name: string;
        protected execType: string;
        protected executeFn: (tokens: Token[]) => Promise<string>;
        arcObserver: Rx.Observer<Arc>;
        constructor(name: string);
        init(execType: string): void;
        fire(type?: string): void;
        implement(fn: (tokens: Token[]) => Promise<string>): void;
        enabled(type?: string): boolean;
        consume(type?: string): Token[];
        execute(tokens: Token[]): Promise<string>;
    }
    class TimedTransition extends Transition {
        private duration;
        constructor(name: string, duration: number);
    }
    class Net {
        transitions: Transition[];
        places: Place[];
        arcs: Arc[];
        Pre: Matrix;
        Post: Matrix;
        C: Matrix;
        perplex: number;
        arcSubject: Rx.Subject<any>;
        transitionSubject: Rx.Subject<any>;
        constructor();
        init(execType?: string): void;
        makeEnd(endPlace: string): Rx.IPromise<any>;
        findNode(nodeId: string): {
            node: Node;
            type: string;
            index: number;
        };
        addPlace(pHandle: Place): void;
        addTransition(tHandle: Transition): void;
        addArc(sourceId: string, targetId: string, m: number): void;
        fire(nodeId: string, type?: string): void;
        ingest(nodeId: string, count?: number): void;
        buildMath(): void;
        getMarking(): Vector;
        minExp(M: Vector, t: string): void;
        static fromPnml(xmlString: string, extensions?: any): Net;
    }
}
export = petri;
