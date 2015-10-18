/* global allowIsBoardAdmin */
/* global allowIsBoardMember */
/* global getUserBoards */
/* global verifiyDbResumeToken */
/* global verifySettingAuthToken */

/* global Boards */
/* global Restivus */
/* global headers */

allowIsBoardAdmin = function(userId, board) {
  const admins = _.pluck(_.where(board.members, {isAdmin: true}), 'userId');
  return _.contains(admins, userId);
};

allowIsBoardMember = function(userId, board) {
  return _.contains(_.pluck(board.members, 'userId'), userId);
};

verifiyDbResumeToken = function(username, resumeToken) {
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
};

verifySettingAuthToken = function(username, settingAuthToken){
  if (username && settingAuthToken) {
    if (settingAuthToken !== Meteor.settings.authToken) {
      return null;
    }
    
    return Meteor.users.findOne({ username: username });
  }
};

getUserBoards = function(userId, team, title) {

  var teamnameRegex = new RegExp('^' + team.toLowerCase(), 'i')
  var result;

  if (title) {
    var titleRegex = new RegExp('^' + title.toLowerCase(), 'i')

    result = Boards.find({ $and: [{ team: {$regex: teamnameRegex }},
                                { title: {$regex: titleRegex }},
                                { members: { $elemMatch: { userId: userId }}}]},
                        { fields: { title:1, team:1, slug:1 }})
      .fetch();
  }
  else{
    result = Boards.find({ $and: [{ team: { $regex: teamnameRegex }}, 
                                { members: { $elemMatch: { userId: userId }}}]},
                        { fields: { title:1, team:1, slug:1 }})
                  .fetch();
  }

  return result;
};

Meteor.methods({
  getUserBoardsServer: function(userId, team, title) {
    check(userId, String);
    check(team, String);
    check(title, String);
    return getUserBoards(userId, team, title);
  }
});
