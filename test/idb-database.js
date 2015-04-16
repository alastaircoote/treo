var expect = require('chai').expect;
var Promise = require('es6-promise').Promise;
var treo = require('../lib');
var schema = require('./support/schema');
treo.Promise = Promise; // set Promise library

describe.only('Database', function() {
  var db;

  beforeEach(function() {
    db = treo('treo.database', schema);
  });

  afterEach(function() {
    return db.del();
  });

  it('has properties', function() {
    expect(db.name).equal('treo.database');
    expect(db.version).equal(4);
    expect(db.stores).length(3);
  });

  it('supports parallel write & read', function() {
    var books = db.store('books');
    var magazines = db.store('magazines');

    return Promise.all([
      books.batch({ 1: { name: 'book 1' }, 2: { id: 2, name: 'book 2' } }),
      books.put(3, { id: 3, name: 'book 3' }),
      magazines.del(5),
      magazines.put({ id: 4, message: 'hey' }),
    ]).then(function() {
      return Promise.all([
        books.getAll().then(function(records) { expect(records).length(3) }),
        magazines.count().then(function(count) { expect(count).equal(1) }),
      ]);
    });
  });

  it('handles "onversionchange" automatically', function() {
    var isCalled;
    db.on('versionchange', function() { isCalled = true });

    return db.store('magazines').put({ id: 4, words: ['hey'] }).then(function() {
      var newSchema = schema.clone().version(5).addStore('users');
      var newDb = treo('treo.database', newSchema);

      expect(newDb.version).equal(5);
      expect(newDb.stores.sort()).eql(['books', 'magazines', 'storage', 'users']);

      return Promise.all([
        newDb.store('users').put(1, { name: 'Jon' }).then(function(key) {
          expect(key).equal(1);
        }),
        newDb.store('magazines').get(4, function(err, obj) {
          expect(obj).eql({ id: 4, words: ['hey'] });
        }),
      ]).then(function() {
        expect(db.status).equal('close');
        expect(isCalled).true;
      });
    });
  });

  it('#close', function() {
    return db.close().then(function() {
      expect(db.status).equal('close');
      expect(db.origin).null;
      expect(Object.keys(db._callbacks || {})).length(0);
    });
  });

  it('#on "abort", "error"', function(done) {
    var magazines = db.store('magazines');
    var events = [];

    magazines.put({ publisher: 'Leanpub' }).then(function(val) {
      magazines.add({ id: val, publisher: 'Leanpub' }); // dublicate key

      db.on('error', function(err) {
        expect(err).exist;
        events.push('error');
        if (events.length == 2) return done();
      });
      db.on('abort', function() {
        expect(arguments).length(0);
        events.push('abort');
        if (events.length == 2) return done();
      });
    });
  });
});