Boards = new Mongo.Collection('board');

  // Global API configuration
  var Api = new Restivus({
    useDefaultAuth: false,
    auth: {
      user: function() {
        //TODO: check token auth first
        if (this.queryParams.token && this.queryParams.username) {
          if (this.queryParams.token !== Meteor.settings.authToken) {
            return null;
          }
          
          return { user : Meteor.users.findOne({"username": this.queryParams.username})};
        }
      }
    },
    prettyJson: true,
    onLoggedIn: function () {
      console.log(this.user.username + ' (' + this.userId + ') logged in');
    },
  });
  
  // Generates: GET, POST on /api/items and GET, PUT, DELETE on
  // /api/items/:id for the Items collection
  Api.addCollection(Boards);

  Api.addRoute('users', { authRequired: true }, {
    get: { 
      roleRequired: ['admin'],
      action: function () {
          var stampedToken = Accounts._generateStampedLoginToken();
          var hashStampedToken = Accounts._hashStampedToken(stampedToken);
          
          //push resume token
          Meteor.users.update(this.user._id, 
            {$push: {'services.resume.loginTokens': hashStampedToken}}
          );
          var when = stampedToken.when;
          
          when.setDate(when.getDate() + 365);
          return { 
            'username': this.user.username,
            'userId': this.userId,
            'token': stampedToken.token, 
            'tokenExpire': when.toString()
          };
      }
    },
    
    post: { 
      roleRequired: ['admin'],
      action: function () {
        var existingUser = Meteor.users.findOne({ "username": this.bodyParams.username });
        if (existingUser != null) {
          return { userId: existingUser._id };
        }
        
        var userId = Accounts.createUser({ username: this.bodyParams.username, email: this.bodyParams.email, password: this.bodyParams.password });
        if (userId) {
          return { userId : userId };
        }
        
        return { stausCode: 500 };  
      }
    }
  });

  // Maps to: /api/articles/:id
  Api.addRoute('boards/:id', {authRequired: true}, {
    get: function () {
      return Boards.findOne(this.urlParams.id);
    }
  });