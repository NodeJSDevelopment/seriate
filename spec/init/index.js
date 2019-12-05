const path = require( "path" );
const proxy = require( "proxyquire" ).noPreserveCache().noCallThru();
const chai = require( "chai" );

const ROOT_PATH = path.join( __dirname, "../../" );

chai.use( require( "sinon-chai" ) );
chai.use( require( "chai-as-promised" ) );
chai.use( require( "dirty-chai" ) );

global.sinon = require( "sinon" );
global.should = chai.should();
global.expect = chai.expect;
global.machina = require( "machina" );
global.fakeRecords = require( "../data/fakeRecordSet.json" );
global._ = require( "lodash" );

global.proxyquire = ( module, ...args ) => {
	// Add some sugar to allow us to proxyquire from the root of the app
	if ( module.startsWith( "~" ) ) {
		module = path.join( ROOT_PATH, module.substr( 1 ) );
	}
	return proxy( module, ...args );
};

function deepCompare( a, b, k ) {
	let diffs = [];
	if ( b === undefined ) {
		diffs.push( `expected ${ k } to equal ${ a } but was undefined ` );
	} else if ( _.isObject( a ) || _.isArray( a ) ) {
		_.each( a, function( v, c ) {
			const key = k ? [ k, c ].join( "." ) : c;
			diffs = diffs.concat( deepCompare( a[ c ], b[ c ], key ) );
		} );
	} else {
		// eslint-disable-next-line eqeqeq
		const equal = a == b;
		if ( !equal ) {
			diffs.push( `expected ${ k } to equal ${ a } but got ${ b }` );
		}
	}
	return diffs;
}

chai.Assertion.addMethod( "partiallyEql", function( partial ) {
	let obj = this._obj;
	if ( !obj.then ) {
		obj = Promise.resolve( obj );
	}
	const self = this;
	return obj.then( function( actual ) {
		const diffs = deepCompare( partial, actual );
		return self.assert(
			diffs.length === 0,
			diffs.join( "\n\t" )
		);
	} );
} );
