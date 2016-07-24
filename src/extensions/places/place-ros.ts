import {Place,Token} from '../../petri';
import _ = require('lodash');
import {Topic,Ros,Message} from 'roslib';

/* Don't know if useful yet
export interface RosFloat32 {
  data: number
}
export interface RosInt32 {
  data: number
}
*/


/**
* Place getting tokens from a ROS topic
*/
export class RosPlace extends Place{

  private topicHandle: any;
  private tokenFn: (Message) => Token[];
  /**
  * RosPlace constructor
  * @param name Name of the petri place
  * @param topic Ros topic to subscribe to. (Must be Float32 right now)
  * @param throttle Period at which topic message is sent through Roslibjs
  * @param tokenFn Callback mapping a Ros msg to a token array
  */
	constructor(name: string){
    // Calling super class Place constructor
    super(name);
	}

  initRos(topic: string, type: string,
              tokenFn: (Message) => Token[], throttle: number, rosHandle: Ros){
    this.topicHandle = new Topic({
      ros: rosHandle,
      name: topic,
      messageType: type,
      throttle_rate: throttle
    })
    // Implementing ROS callback
    this.topicHandle.subscribe( (msg) => {
      this.setTokens(tokenFn(msg));
    })
  }
  // Helpers
  static LT(value: number){
    return (msg) => { return (msg.data < value) ? [new Token()] : [] ; };
  }
}
