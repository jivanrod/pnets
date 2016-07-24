![Build status](https://travis-ci.org/smamessier/pnets.svg?branch=master)

# Pnets v 0.1
A library for modelling and executing [Petri Nets](http://en.wikipedia.org/wiki/Petri_net).
Initially inspired from  inspired from [warrenseymour/petri-net](warrenseymour/petri-net),
it has little to do with the initial library. TypeScript has be picked as the
development language for scalability purposes.

## Features
- Representation of petri nets
- Places, Transitions, Tokens, Arcs with multiplicity
- Use of RXJS observable pattern and promises for asynchronous events handling
- Import from PNML format
- Weighted Arcs

## Roadmap
- Extensions such as Coloured, Timed and Hierarchical Nets
- Make sure to comply with High-level petri nets part 2- https://www.iso.org/obp/ui/#iso:std:iso-iec:15909:-2:ed-1:v1:en

## Usage

Todo

## Installation

Clone this repository, install npm dependencies and TypeScript declarations.
```bash
npm install
typings install
```
### Fix Mathlib bindings
Copy the modified TypeScript declaration file for Mathlib from `dep` directory to `typings/main/mathlib/index.d.ts`. Also go in `node_modules/mathlib` and modify the `main` field of `package.json` to `build/commonjs/Mathlib.js`. This should get the Mathlib package working together with the rest of the petri net library.

### Fix Roslib bindings
Replace `declare module "ROSLIB"` with `declare module "roslib"` to make the declaration files work with roslib vanilla npm package.

### Run test suite
```bash
npm test
```

You can also run the tests individually. For this, first install `mocha` globally.
```
npm install -g mocha
```

### Generate the documentation (Requires typedoc)
```
npm install -g typedoc
typedoc --out doc/ --module commonjs --target ES5 --ignoreCompilerErrors src/
```
