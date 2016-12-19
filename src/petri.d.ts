import events = require('events');
import Rx = require('rx');
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
        clone(): Token;
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
        namespace: string;
        tokens: Token[];
        isEnd: boolean;
        prop: () => Promise<number>;
        extraSubject: Rx.Subject<Place>;
        constructor(name: string, namespace?: string);
        protected setTokens(tokens: Token[]): void;
        addTokens(token: Token, n: number): void;
        init(): void;
        consume(m: number): Token[];
        activationLevel(): number;
    }
    class ConditionalPlace extends Place {
        name: string;
        constructor(name: string);
    }
    class Transition extends Node {
        name: string;
        namespace: string;
        protected execType: string;
        protected executeFn: (tokens: Token[]) => Rx.Observable<string>;
        arcObserver: Rx.Observer<Arc>;
        private activationTokens;
        constructor(name: string, namespace?: string);
        init(execType: string): void;
        fire(type: string, coeff?: number, enable?: boolean): boolean;
        implement(fn: (tokens: Token[]) => Rx.Observable<string>): void;
        enabled(type?: string): {
            fire: boolean;
            result: number;
        };
        consume(type?: string): Token[];
        execute(tokens: Token[]): Rx.Observable<string>;
        processFireEvent(enableParams: any): void;
        dispatch(agentNode: Place): void;
        dispatchable(): boolean;
    }
    class TimedTransition extends Transition {
        private duration;
        constructor(name: string, duration: number);
    }
}
export = petri;
