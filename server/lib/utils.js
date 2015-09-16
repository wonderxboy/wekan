/* global isIpAddressAllowed */
/* global allowIsBoardAdmin */
/* global allowIsBoardMember */
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

isIpAddressAllowed = function(ip) {
  var allowedIpAddresses = Meteor.settings.allowedBackendServiceIp.split(',');
  for(var k in allowedIpAddresses) {
    if (allowedIpAddresses[k] == ip) {
      return true;
    }
  }
  
  return false;
}