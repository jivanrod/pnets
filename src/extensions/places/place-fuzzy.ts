import {Place,Token} from '../../petri';
import _ = require('lodash');

/**
* Implementation of a fuzzy petri net place
*/
export class FuzzyPlace extends Place{

  /**
  * Fuzzy place constructor
  * @param name Name of the petri place
  */
	constructor(name: string){
    // Calling super class Place constructor
    super(name);
	}

  /**
  * Overrides activation level to match fuzzy formalism
  */
  activationLevel(): Number{
    return this.outputFn();
  }
}
