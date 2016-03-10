import { Transition } from '../../petri';
import { Ros } from 'ROSLIB';
export declare class RosTransition extends Transition {
    private completeFn;
    private topicHandle;
    private completePromise;
    private history;
    constructor(name: string, topic: string, type: string, completeFn: (Message, any) => boolean, throttle: number, rosHandle: Ros);
    private generatePromise;
    completion(completeFn: (Message, any) => boolean): void;
}
