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

function verifiyDbResumeToken(username, resumeToken) {
  if (!username || !resumeToken) {
    return null;
  }
  var user = Meteor.users.findOne({ username: username });
  if (user) {
    var loginTokens = user.services.resume.loginTokens;
    if (loginTokens && loginTokens.length > 0) {
      var hashResumedToken = Accounts._hashStampedToken({ token: resumeToken, when: new Date() });
      var existingToken = loginTokens[loginTokens.length - 1];
      if (existingToken 
          && existingToken.hashedToken == hashResumedToken.hashedToken
          && existingToken.when <= hashResumedToken.when) {
        return user;
      }
    }
  }
  
  return null;
}

function verifySettingAuthToken(username, settingAuthToken){
  if (username && settingAuthToken) {
    if (settingAuthToken !== Meteor.settings.authToken) {
      return null;
    }
    
    return Meteor.users.findOne({ username: username });
  }
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

function getUserBoards(userId, team): any {

  if (team == null) {
    return { stausCode: 404, message: "Team name is required" };
  }
  
  var teamnameRegex = new RegExp('^' + team.toLowerCase(), 'i')
  var result = Boards.find(
          { $and: [{ team: {$regex: teamnameRegex} }, 
                   { members: { $elemMatch: { userId: userId }}}]},
          { fields: { title:1, team:1 }})
    .fetch();

  if (result.length == 0){
    return { stausCode: 404, message: "User " + userId + " does not have any board" }; 
  }
  
  return { boards : result };
}

  // Global API configuration
  var Api = new Restivus({
    useDefaultAuth: false,
    auth: {
      user: function() {
        var username = this.request.headers['x-username'];
        var resumeToken = this.request.headers['x-resumetoken'];

        var tokenUser = verifiyDbResumeToken(username, resumeToken);
        if (tokenUser) {
          return { user : tokenUser };
        }
        
        //TODO: check token auth first
        var authUser = verifySettingAuthToken(this.queryParams.username, this.queryParams.token);
        if (authUser) {
          return { user : authUser };
        }
      }
    },
    prettyJson: true,
    onLoggedIn: function () {
      console.log(this.user.username + ' (' + this.userId + ') logged in');
    },
  });
  
  //#Api for admins only

  //Add user
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

  //get user resume token
  //since task sub system wont be directly used as front end login, 
  //user account will be created through api by admin(system account) in the backend system
  //and resume token will be created through backend by admin(system account) and then pass to
  //foront end js code as auth token
  Api.addRoute('users/:username', { authRequired: true }, {
    get: {
      roleRequired: ['admin'],
      action: function () {
        var targetUsername = this.urlParams.username;
        if (!targetUsername) {
          return { stausCode: 404, message: "username is required" };
        }
        
        var targetUser = Meteor.users.findOne({ username: this.urlParams.username });
        if (!targetUser) {
          return { stausCode: 404, message: "User with username '" + targetUsername + "' is not found" };
        }
        
        var stampedToken = Accounts._generateStampedLoginToken();
        var hashStampedToken = Accounts._hashStampedToken(stampedToken);
        
        //push resume token
        Meteor.users.update(targetUser._id, 
          {$push: {'services.resume.loginTokens': hashStampedToken}}
        );
        
        var when = stampedToken.when;
        
        when.setDate(when.getDate() + 365);
        return { 
          'username': targetUsername,
          'userId': targetUser._id,
          'token': stampedToken.token,
          'tokenExpire': when.toString()
        };
      }
    }
  });

  //create boards
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

  //Give board permissions to user
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

  //Api for users
  //Get user boards
  Api.addRoute('boards/teams/:team', { authRequired: true }, {
    get: { 
          action: function() {
            return getUserBoards(Meteor.userId, this.urlParams.team);
          }
      }
  });
    