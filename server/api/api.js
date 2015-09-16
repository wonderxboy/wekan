Boards = new Mongo.Collection('board');

  // Global API configuration
  var Api = new Restivus({
    useDefaultAuth: false,
    auth: {
      user: function() {
        if (this.queryParams.token && this.queryParams.username) {
          var clientIpAddress = this.request.headers['x-forwarded-for'].split(',')[0];
          if (!isIpAddressAllowed(clientIpAddress)) {
            return null;
          }
          
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
          return { 'username': this.user.username, 'token': this.user.services.resume.loginTokens };
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