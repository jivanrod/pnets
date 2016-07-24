import {Transition,Token,Place} from '../../petri';
import _ = require('lodash');
import {Topic,Ros,Message} from 'roslib';
import {Promise} from 'es6-promise';

/**
* Transition with completion condition observing a ROS topic
*/
export class RosTransition extends Transition{

  private topicHandle: any;
  private completePromise: Promise<string>;
  private history;

  /**
  * RosPlace constructors
  * @param name Name of the petri transition
  * @param topic Ros topic to subscribe to. (Must be Float32 right now)
  * @param throttle Period at which topic message is sent through Roslibjs
  * @param completeFn Callback mapping a Ros msg to (True,False)
  */
	constructor(name: string, topic: string, type: string,
              private completeFn: (Message, any) => boolean, throttle: number, rosHandle: Ros){
    // Calling super class Place constructor
    super(name);
    // Creating topic
    this.topicHandle = new Topic({
      ros: rosHandle,
      name: topic,
      messageType: type,
      throttle_rate: throttle
    })
    if (completeFn !== null){
      this.generatePromise();
    }
    // Implementing ROS callback
    this.implement( (tokens: Token[]) => { return this.completePromise;} );
	}

  private generatePromise = function(){
    this.completePromise = new Promise<string>(function(resolve,reject){
      this.topicHandle.subscribe( (msg) => {
        if (this.completeFn(Message)){
          resolve('ok');
        }
      })
    });
  }

  /**
  * Setter for completion condition
  */
  completion( completeFn: (Message, any) => boolean){
    this.completeFn = completeFn;
    this.generatePromise();
  }

}
