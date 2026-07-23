function sendSlackMessage_(text) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('SLACK_BOT_TOKEN');
  var channel = props.getProperty('SLACK_CHANNEL_ID');
  if (!token || !channel) return;

  try {
    UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify({ channel: channel, text: text }),
      muteHttpExceptions: true
    });
  } catch (err) {
    Logger.log('Slack 알림 전송 실패: ' + err.message);
  }
}

function getSlackUserIdByEmail_(email) {
  if (!email) return null;
  var token = PropertiesService.getScriptProperties().getProperty('SLACK_BOT_TOKEN');
  if (!token) return null;

  try {
    var response = UrlFetchApp.fetch(
      'https://slack.com/api/users.lookupByEmail?email=' + encodeURIComponent(email),
      {
        headers: { Authorization: 'Bearer ' + token },
        muteHttpExceptions: true
      }
    );
    var data = JSON.parse(response.getContentText());
    if (data.ok && data.user) return data.user.id;
  } catch (err) {
    Logger.log('Slack 사용자 조회 실패: ' + err.message);
  }
  return null;
}

function mentionForStaffName_(name) {
  if (!name) return '(미상)';
  var staff = getAllRows('직원목록').find(function (r) { return r.이름 === name; });
  if (!staff || !staff.이메일) return name;
  var slackId = getSlackUserIdByEmail_(staff.이메일);
  return slackId ? ('<@' + slackId + '>') : name;
}
