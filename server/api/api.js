Boards = new Mongo.Collection('board');

  // Global API configuration
  var Api = new Restivus({
    useDefaultAuth: false,
    auth: {
      user: function() {
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

  Api.addRoute('users/:id', {authRequired: true}, {
    get: function () {
      if(this.urlParams.id == this.user.username) {
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
    }
  });

  // Maps to: /api/articles/:id
  Api.addRoute('boards/:id', {authRequired: true}, {
    get: function () {
      return Boards.findOne(this.urlParams.id);
    },
    delete: {
      roleRequired: ['author', 'admin'],
      action: function () {
        if (Articles.remove(this.urlParams.id)) {
          return {status: 'success', data: {message: 'Article removed'}};
        }
        return {
          statusCode: 404,
          body: {status: 'fail', message: 'Article not found'}
        };
      }
    }
  });