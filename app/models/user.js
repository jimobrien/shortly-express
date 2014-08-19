var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var User = db.Model.extend({
  tableName: 'users',
  initialize: function(){
    this.on('creating', function (model, attrs, options) {
      // model.set('password', bcrypt.hashSync(password, bcrypt.genSaltSync(8), null));
    } );
  }
  //
});

module.exports = User;