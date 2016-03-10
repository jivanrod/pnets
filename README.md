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

## Usage

Todo

## Development

Clone this repository, install npm dependencies and TypeScript declarations.
```bash
npm install
typings install
```
### Run test suite
```bash
npm test
```

### Generate the documentation (Requires typedoc)
```
npm install -g typedoc
typedoc --out doc/ --module commonjs --target ES5 --ignoreCompilerErrors src/
```
