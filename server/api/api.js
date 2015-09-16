Boards = new Mongo.Collection('board');

  // Global API configuration
  var Api = new Restivus({
    useDefaultAuth: false,
    auth: {
      user: function() {
        var clientIpAddress = this.request.headers['x-forwarded-for'].split(',')[0];
        if (!isIpAddressAllowed(clientIpAddress)) {
          return null;
        }
        
        if (this.queryParams.token !== Meteor.settings.authToken) {
          return null;
        }
        
        return { user : Meteor.users.findOne({"username": "mike"})};
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

  // Generates: POST on /api/users and GET, DELETE /api/users/:id for
  // Meteor.users collection
  Api.addCollection(Meteor.users, {
    //excludedEndpoints: ['getAll', 'put'],
    routeOptions: {
      authRequired: false
    },
    endpoints: {
      post: {
        authRequired: false
      },
      delete: {
        roleRequired: 'admin'
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