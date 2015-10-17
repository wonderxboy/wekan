//This function is a copy of the Board.before.insert function of the BoardCollections in Boards.js
function getBoard(userId, doc) {
  doc.slug = doc.title;
  doc.createdAt = new Date();
  doc.archived = false;
  doc.members = doc.members || [{
    userId,
    isAdmin: true,
    isActive: true,
  }];
  doc.stars = 0;
  //Boards refers to the Boards instance from BoardCollections
  doc.color = Boards.simpleSchema()._schema.color.allowedValues[0];

  //Handle labels
  const colors = Boards.simpleSchema()._schema['labels.$.color'].allowedValues;
  const defaultLabelsColors = _.clone(colors).splice(0, 6);
  doc.labels = _.map(defaultLabelsColors, (color) => {
    return {
      color,
      _id: Random.id(6),
      name: '',
    };
  });
  
  return doc;
}
    
function boostrapAdmin(){
  // Roles.createRole("admin");
  // var userId = Accounts.createUser({ 
  //   username: "admin", 
  //   email: "wonderxboy+ctaskAdmin@gmail.com", 
  //   password: "{add password here}", 
  //   roles: ['admin'] });
    
  // if (!userId) {
  //   return 'admin not created';
  // }
  // var adminUser = Meteor.users.findOne({ "username": "admin" });
  // Roles.addUsersToRoles(adminUser._id, "admin"); 
}

function getUserBoards(username, team): any {
  var existingUser = Meteor.users.findOne({ username : username });
  if (existingUser == null) {
    return { stausCode: 404, message: "User " + username + " not found" };
  }

  if (team == null) {
    return { stausCode: 404, message: "Team name is required" };
  }
  
  var teamnameRegex = new RegExp('^' + team.toLowerCase(), 'i')
  var result = Boards.find(
          { $and: [{ team: {$regex: teamnameRegex} }, 
                   { members: { $elemMatch: { userId: existingUser._id }}}]},
          { fields: { title:1, team:1 }})
    .fetch();

  if (result.length == 0){
    return { stausCode: 404, message: "User " + username + " does not have any board" }; 
  }
  
  return { boards : result };
}

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
  
  //users
  Api.addRoute('users/:id', { authRequired: true }, {
    get: {
        roleRequired: ['admin'],
        action: function () {
          //TODO: use run as to run as user :id for this function, so that the auth token user and the target user can be different
          var stampedToken = Accounts._generateStampedLoginToken();
          var hashStampedToken = Accounts._hashStampedToken(stampedToken);
          
          //push resume token
          Meteor.users.update(this.userId, 
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

  Api.addRoute('users/:username/:team/boards', { authRequired: true }, {
    get: { 
          roleRequired: ['admin'],
          action: function() {
            return getUserBoards(this.urlParams.username, this.urlParams.team);
          }
      }
    });
    
  Api.addRoute('users', { authRequired: true }, {
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
        
        return { stausCode: 500, message: "Error when creating user account" };  
      }
    }
  });

  //boards
  Api.addRoute('boards', { authRequired: true }, {
    post: { 
      roleRequired: ['admin'],
      action: function () {
        var boardTitle = this.bodyParams.title;
        var username = this.bodyParams.username;
        var team = this.bodyParams.team;
        
        if (boardTitle == null){
          return { stausCode: 404, message: "Title is requried." };
        }
        
        if (username == null){
          return { stausCode: 404, message: "Username is requried." };
        }
        
        if (team == null) {
          return { stausCode: 404, message: "Team is requried." };
        }
        
        var boardAdmin = Meteor.users.findOne({ "username": username });
        if (boardAdmin == null) {
          return { stausCode: 404, message: "User '" + username + "' does not exist" };
        }
        
        var board = Boards.findOne({ "title" : boardTitle, "team" : team });
        if (board != null && board._id != null) {
          return { _id : board._id, team: board.team, title: board.title };
        }
        else {
            //TODO: make it work with hooks (matb33/meteor-collection-hooks) defined in Boards.js
            var boardToInsert = getBoard(boardAdmin._id, { title: boardTitle, team: team, permission: "private" });
            var boardId =  Boards.direct.insert(boardToInsert);
            return { _id: boardId, team: team, title: boardTitle };
        }
        
        return { stausCode: 500, message: "Error when creating board" };  
      }
    }
  });

  Api.addRoute('boards/:id/persmissions', { authRequired: true }, {
    post: { 
      roleRequired: ['admin'],
      action: function () {
        
        var board = Boards.findOne({ "_id" : this.urlParams.id });
        if (board == null && board._id == null) {
          return { stausCode: 404, message: "Board not found." };
        }
        
        var users = this.bodyParams.users;
        if (users == null) {
          return { stausCode: 404, message: "Users are requried." };
        }
        
        var usersToAdd = [];
        for(var key in users) {
          var grantuser = Meteor.users.findOne({ "username": users[key] });
          if (grantuser != null) {
            if (!_.findWhere(board.members, { userId : grantuser._id })) {
              usersToAdd.push({ userId: grantuser._id, isAdmin: false, isActive: true });
            }
          }
        }
        
        if (usersToAdd.length > 0) {
            Boards.direct.update(board._id, 
              {$push: {'members': { $each: usersToAdd }}}
            );
            return { stausCode: 200 };
        }
        
        return { stausCode: 200 };
      }
    }
  });