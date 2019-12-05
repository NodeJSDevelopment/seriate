const mockConnectionFn = require( "../data/mockConnection" );

describe( "TransactionContext", function() {
	let sql, seriate, reqMock, prepMock, transMock;
	function setup() {
		const request = { query: _.noop, execute: _.noop, input: _.noop };
		const preparedStatement = {
			prepare: _.noop,
			execute: _.noop,
			unprepare: _.noop,
			input: _.noop,
			procedure: undefined,
			params: undefined
		};
		const transaction = {
			begin: _.noop,
			commit: _.noop,
			rollback: _.noop
		};
		reqMock = sinon.mock( request );
		prepMock = sinon.mock( preparedStatement );
		transMock = sinon.mock( transaction );

		const connection = mockConnectionFn( true );
		const mssql = require( "mssql" );
		sql = _.merge( mssql, {
			Connection: function() {
				return connection;
			},
			Request: function() {
				return request;
			},
			PreparedStatement: function() {
				return preparedStatement;
			},
			Transaction: function() {
				return transaction;
			},
			"@global": true
		} );
		seriate = proxyquire( "~/src/index", {
			mssql: sql
		} );
		seriate.addConnection( {} );
	}

	describe( "when getting a TransactionContext instance", function() {
		let ctx;

		before( function() {
			setup();
			ctx = seriate.getTransactionContext();
		} );

		it( "should start in uninitialized", function() {
			ctx.states.uninitialized.should.be.ok();
		} );
	} );

	describe( "when calling a query with explicit isolation and no params", function() {
		let ctx, result;
		before( function() {
			setup();
			reqMock.expects( "query" )
				.withArgs( "select * from sys.tables" )
				.once()
				.callsArgWith( 1, null, fakeRecords );

			transMock.expects( "begin" )
				.withArgs( 0x04 )
				.callsArgWith( 1, null )
				.once();

			ctx = seriate.getTransactionContext( { isolationLevel: "serializable" } );
			return ctx.step( "read", {
				query: "select * from sys.tables"
			} )
				.then( function( res ) {
					result = res.sets.read;
				} );
		} );

		it( "should create a \"read\" state", function() {
			ctx.states.read.should.be.ok();
		} );

		it( "should create \"read\" state success handler", function() {
			ctx.states.read.success.should.be.ok();
		} );

		it( "should create \"read\" state error handler", function() {
			ctx.states.read.error.should.be.ok();
		} );

		it( "should call transaction.begin with an explicit isolation level", function() {
			transMock.verify();
		} );

		it( "should call query on request", function() {
			reqMock.verify();
		} );

		it( "should return result set", function() {
			result.should.eql( fakeRecords );
		} );
	} );

	describe( "when calling a proc without parameters", function() {
		let ctx, result;
		before( function() {
			setup();
			reqMock.expects( "execute" )
				.withArgs( "sp_who2" )
				.once()
				.callsArgWith( 1, null, fakeRecords );

			transMock.expects( "begin" )
				.withArgs()
				.callsArgWith( 0, null )
				.once();

			ctx = seriate.getTransactionContext();
			ctx.step( "proc", {
				procedure: "sp_who2"
			} )
				.then( function( res ) {
					result = res;
				} );
		} );

		it( "should create a \"proc\" state", function() {
			ctx.states.proc.should.be.ok();
		} );

		it( "should create \"proc\" state success handler", function() {
			ctx.states.proc.success.should.be.ok();
		} );

		it( "should create \"proc\" state error handler", function() {
			ctx.states.proc.error.should.be.ok();
		} );

		it( "should call begin on the transaction", function() {
			transMock.verify();
		} );

		it( "should call execute on the request", function() {
			reqMock.verify();
		} );

		it( "should return result set", function() {
			result.sets.proc.should.eql( fakeRecords );
		} );
	} );

	describe( "when calling a proc with parameters", function() {
		let ctx, result;
		before( function() {
			setup();
			reqMock.expects( "execute" )
				.withArgs( "sp_who2" )
				.once()
				.callsArgWith( 1, null, fakeRecords );

			transMock.expects( "begin" )
				.withArgs()
				.callsArgWith( 0, null )
				.once();

			reqMock.expects( "input" )
				.withArgs( "param1", sql.INT, 9 ).once();

			reqMock.expects( "input" )
				.withArgs( "param2", "Hai Mom" ).once();

			ctx = seriate.getTransactionContext();
			ctx.step( "proc", {
				procedure: "sp_who2",
				params: {
					param1: {
						type: sql.INT,
						val: 9
					},
					param2: "Hai Mom"
				}
			} )
				.then( function( res ) {
					result = res;
				} );
		} );

		it( "should create a \"proc\" state", function() {
			ctx.states.proc.should.be.ok();
		} );

		it( "should create \"proc\" state success handler", function() {
			ctx.states.proc.success.should.be.ok();
		} );

		it( "should create \"proc\" state error handler", function() {
			ctx.states.proc.error.should.be.ok();
		} );

		it( "should call begin on the transaction", function() {
			transMock.verify();
		} );

		it( "should call execute on the request and input for each parameter", function() {
			reqMock.verify();
		} );

		it( "should return result set", function() {
			result.sets.proc.should.eql( fakeRecords );
		} );
	} );

	describe( "when calling prepared sql with parameters", function() {
		let ctx, result;
		before( function() {
			setup();
			prepMock.expects( "prepare" )
				.withArgs( "select * from sys.tables where type_desc = @usertable" )
				.callsArgWith( 1, undefined )
				.once();

			prepMock.expects( "execute" )
				.withArgs( {
					usertable: "USER_TABLE"
				} )
				.callsArgWith( 1, null, fakeRecords )
				.once();

			prepMock.expects( "input" )
				.withArgs( "usertable", sql.NVarChar )
				.once();

			prepMock.expects( "unprepare" )
				.callsArgWith( 0, undefined )
				.once();

			transMock.expects( "begin" )
				.callsArgWith( 0, null )
				.once();

			ctx = seriate.getTransactionContext();
			ctx.step( "prepped", {
				preparedSql: "select * from sys.tables where type_desc = @usertable",
				params: {
					usertable: {
						type: sql.NVarChar,
						val: "USER_TABLE"
					}
				}
			} )
				.then( function( res ) {
					result = res;
				} );
		} );

		it( "should create a \"prepped\" state", function() {
			ctx.states.prepped.should.be.ok();
		} );

		it( "should create \"prepped\" state success handler", function() {
			ctx.states.prepped.success.should.be.ok();
		} );

		it( "should create \"prepped\" state error handler", function() {
			ctx.states.prepped.error.should.be.ok();
		} );

		it( "should call begin on the transaction", function() {
			transMock.verify();
		} );

		it( "should call execute and unprepare on the prepared statement and input for each parameter", function() {
			prepMock.verify();
		} );

		it( "should return result set", function() {
			result.sets.prepped.should.eql( fakeRecords );
		} );
	} );

	describe( "when calling a query throws an error", function() {
		let ctx, error;
		before( function() {
			const testError = new Error( "so much fail" );
			testError.precedingErrors = [
				{ message: "preceding one" },
				{ message: "preceding two" }
			];

			setup();
			reqMock.expects( "query" )
				.withArgs( "select * from sys.tables" )
				.once()
				.callsArgWith( 1, testError );

			transMock.expects( "begin" )
				.callsArgWith( 0, null )
				.once();

			transMock.expects( "rollback" )
				.callsArgWith( 0, null )
				.once();

			ctx = seriate.getTransactionContext();
			ctx.step( "read", {
				query: "select * from sys.tables"
			} )
				.then( undefined, function( err ) {
					error = err;
				} );
		} );

		it( "should create a \"read\" state", function() {
			ctx.states.read.should.be.ok();
		} );

		it( "should create \"read\" state success handler", function() {
			ctx.states.read.success.should.be.ok();
		} );

		it( "should create \"read\" state error handler", function() {
			ctx.states.read.error.should.be.ok();
		} );

		it( "should call begin on the transaction", function() {
			transMock.verify();
		} );

		it( "should call query on the request", function() {
			reqMock.verify();
		} );

		it( "should report the error correctly", function() {
			error.message.should.eql( "TransactionContext Error. Failed on step \"read\" with: \"so much fail\"\n\tPreceding error: preceding one\n\tPreceding error: preceding two" );
		} );

		it( "should capture the failing step name on the error", function() {
			error.step.should.equal( "read" );
		} );
	} );

	describe( "when calling a stored procedure without parameters throws an error", function() {
		let ctx, error;
		before( function() {
			setup();
			reqMock.expects( "execute" )
				.withArgs( "sp_who2" )
				.once()
				.callsArgWith( 1, new Error( "so much fail" ) );

			transMock.expects( "begin" )
				.callsArgWith( 0, null )
				.once();

			transMock.expects( "rollback" )
				.callsArgWith( 0, null )
				.once();

			ctx = seriate.getTransactionContext();
			ctx.step( "proc", {
				procedure: "sp_who2"
			} )
				.then( undefined, function( err ) {
					error = err;
				} );
		} );

		it( "should create a \"proc\" state", function() {
			ctx.states.proc.should.be.ok();
		} );

		it( "should create \"proc\" state success handler", function() {
			ctx.states.proc.success.should.be.ok();
		} );

		it( "should create \"proc\" state error handler", function() {
			ctx.states.proc.error.should.be.ok();
		} );

		it( "should call begin on the transaction", function() {
			transMock.verify();
		} );

		it( "should call execute on the request", function() {
			reqMock.verify();
		} );

		it( "should report the error correctly", function() {
			error.message.should.eql( "TransactionContext Error. Failed on step \"proc\" with: \"so much fail\"" );
		} );
		it( "should capture the failing step name on the error", function() {
			error.step.should.equal( "proc" );
		} );
	} );

	describe( "when calling a stored procedure with parameters throws an error", function() {
		let ctx, error;

		before( function() {
			setup();
			reqMock.expects( "execute" )
				.withArgs( "sp_who2" )
				.once()
				.callsArgWith( 1, new Error( "so much fail" ) );

			transMock.expects( "begin" )
				.callsArgWith( 0, null )
				.once();

			transMock.expects( "rollback" )
				.callsArgWith( 0, null )
				.once();

			reqMock.expects( "input" )
				.withArgs( "param1", sql.INT, 9 ).once();

			reqMock.expects( "input" )
				.withArgs( "param2", "Hai Mom" ).once();

			ctx = seriate.getTransactionContext();
			ctx.step( "proc", {
				procedure: "sp_who2",
				params: {
					param1: {
						type: sql.INT,
						val: 9
					},
					param2: "Hai Mom"
				}
			} )
				.then( undefined, function( err ) {
					error = err;
				} );
		} );

		it( "should call begin on the transaction", function() {
			transMock.verify();
		} );

		it( "should call execute on the request and input for each parameter", function() {
			reqMock.verify();
		} );

		it( "should report the error correctly", function() {
			error.message.should.eql( "TransactionContext Error. Failed on step \"proc\" with: \"so much fail\"" );
		} );

		it( "should capture the failing step name on the error", function() {
			error.step.should.equal( "proc" );
		} );
	} );

	describe( "when calling prepared sql with parameters throws an error", function() {
		let ctx, error;
		before( function() {
			setup();

			prepMock.expects( "prepare" )
				.withArgs( "select * from sys.tables where type_desc = @usertable" )
				.callsArgWith( 1, undefined )
				.once();

			prepMock.expects( "execute" )
				.withArgs( {
					usertable: "USER_TABLE"
				} )
				.callsArgWith( 1, new Error( "so much fail" ) )
				.once();

			prepMock.expects( "unprepare" )
				.callsArgWith( 0, null )
				.once();

			prepMock.expects( "input" )
				.withArgs( "usertable", sql.NVarChar )
				.once();

			transMock.expects( "begin" )
				.callsArgWith( 0, null )
				.once();

			transMock.expects( "rollback" )
				.callsArgWith( 0, null )
				.once();

			ctx = seriate.getTransactionContext();
			ctx.step( "prepped", {
				preparedSql: "select * from sys.tables where type_desc = @usertable",
				params: {
					usertable: {
						type: sql.NVarChar,
						val: "USER_TABLE"
					}
				}
			} )
				.then( undefined, function( err ) {
					error = err;
				} );
		} );

		it( "should create a \"prepped\" state", function() {
			ctx.states.prepped.should.be.ok();
		} );

		it( "should create \"prepped\" state success handler", function() {
			ctx.states.prepped.success.should.be.ok();
		} );

		it( "should create \"prepped\" state error handler", function() {
			ctx.states.prepped.error.should.be.ok();
		} );

		it( "should call begin and rollback on the transaction", function() {
			transMock.verify();
		} );

		it( "should call prepare on the prepared statement and input for each parameter", function() {
			prepMock.verify();
		} );

		it( "should report the error correctly", function() {
			error.message.should.eql( "TransactionContext Error. Failed on step \"prepped\" with: \"so much fail\"" );
		} );

		it( "should capture the failing step name on the error", function() {
			error.step.should.equal( "prepped" );
		} );
	} );

	describe( "with metrics", function() {
		describe( "when executing a query", function() {
			let metrics;
			before( function() {
				metrics = {
					instrument: sinon.spy( obj => {
						const { call } = obj;
						return call();
					} )
				};
				setup();

				reqMock.expects( "query" )
					.withArgs( "query" )
					.once()
					.callsArgWith( 1, null, fakeRecords );

				transMock.expects( "begin" )
					.withArgs()
					.callsArgWith( 0, null )
					.once();

				seriate.useMetrics( metrics, "seriate-tests" );
				return seriate.executeTransaction( { name: "read", query: "query" } )
					.then( _.identity );
			} );

			it( "should correctly call all steps", function() {
				reqMock.verify();
			} );

			it( "should capture metrics for each step", function() {
				metrics.instrument.should.be.calledOnce()
					.and.calledWithMatch(
						{
							key: [ "sql", "read" ],
							namespace: "seriate-tests"
						} );
			} );
		} );

		describe( "when executing a procedure", function() {
			let metrics;
			before( function() {
				metrics = {
					instrument: sinon.spy( obj => {
						const { call } = obj;
						return call();
					} )
				};
				setup();

				reqMock.expects( "execute" )
					.withArgs( "myStoredProc" )
					.once()
					.callsArgWith( 1, null, fakeRecords );

				transMock.expects( "begin" )
					.withArgs()
					.callsArgWith( 0, null )
					.once();

				seriate.useMetrics( metrics, "seriate-tests" );
				return seriate.executeTransaction( { procedure: "myStoredProc" } )
					.then( _.identity );
			} );

			it( "should correctly call all steps", function() {
				reqMock.verify();
			} );

			it( "should capture metrics for each step", function() {
				metrics.instrument.should.be.calledOnce()
					.and.calledWithMatch(
						{
							key: [ "sql", "myStoredProc" ],
							namespace: "seriate-tests"
						} );
			} );
		} );

		describe( "when executing a multiple steps", function() {
			let metrics;
			before( function() {
				metrics = {
					instrument: sinon.spy( obj => {
						const { call } = obj;
						return call();
					} )
				};
				setup();

				reqMock.expects( "query" )
					.withArgs( "query" )
					.once()
					.callsArgWith( 1, null, fakeRecords );

				reqMock.expects( "execute" )
					.withArgs( "procedure" )
					.once()
					.callsArgWith( 1, null, fakeRecords );

				prepMock.expects( "prepare" )
					.withArgs( "prepared" )
					.callsArgWith( 1, undefined )
					.once();

				prepMock.expects( "execute" )
					.callsArgWith( 1, null, fakeRecords )
					.once();

				prepMock.expects( "unprepare" )
					.callsArgWith( 0, undefined )
					.once();

				transMock.expects( "begin" )
					.withArgs()
					.callsArgWith( 0, null )
					.once();

				seriate.useMetrics( metrics, "seriate-tests" );
				return seriate.getTransactionContext()
					.step( "read", { query: "query" } )
					.step( "proc", { procedure: "procedure" } )
					.step( "prepared", { preparedSql: "prepared" } )
					.then( _.identity );
			} );

			it( "should correctly call all steps", function() {
				reqMock.verify();
				prepMock.verify();
				transMock.verify();
			} );

			it( "should capture metrics for each step", function() {
				metrics.instrument.should.be.calledThrice()
					.and.calledWithMatch(
						{
							key: [ "sql", "read" ],
							namespace: "seriate-tests"
						} )
					.and.calledWithMatch(
						{
							key: [ "sql", "proc" ],
							namespace: "seriate-tests"
						} )
					.and.calledWithMatch(
						{
							key: [ "sql", "prepared" ],
							namespace: "seriate-tests"
						} );
			} );
		} );
	} );
} );
