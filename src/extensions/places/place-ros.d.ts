import { Place, Token } from '../../petri';
import { Ros } from 'ROSLIB';
export declare class RosPlace extends Place {
    private topicHandle;
    private tokenFn;
    constructor(name: string);
    initRos(topic: string, type: string, tokenFn: (Message) => Token[], throttle: number, rosHandle: Ros): void;
    static LT(value: number): (msg: any) => Token[];
}
