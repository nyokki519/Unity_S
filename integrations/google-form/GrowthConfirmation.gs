/** Bound to the actual Google Form. No names, event titles or participant fields are sent. */
function setupGrowthTracking() {
  var props=PropertiesService.getScriptProperties(),token=props.getProperty('GROWTH_CONFIRM_TOKEN');
  if(!token||token.length<32)throw new Error('Set GROWTH_CONFIRM_TOKEN in Script Properties first.');
  var form=FormApp.getActiveForm();if(!form)throw new Error('Open Apps Script from the actual Google Form.');
  var title='Unity計測ID（自動入力・任意）',items=form.getItems(FormApp.ItemType.TEXT);
  var item=items.filter(function(x){return x.getTitle()===title;})[0];
  if(!item)item=form.addTextItem().setTitle(title).setRequired(false).setHelpText('公式HP経由の申込導線を匿名で集計するためのIDです。空欄のままでも申し込めます。');
  item=item.asTextItem?item.asTextItem():item;
  item.setRequired(false);
  var prefilled=form.createResponse().withItemResponse(item.createResponse('unity-growth-probe')).toPrefilledUrl();
  var match=prefilled.match(/[?&](entry\.\d+)=/);if(!match)throw new Error('Tracking entry could not be determined.');
  props.setProperty('UNITY_TRACKING_ITEM_ID',String(item.getId()));
  props.setProperty('UNITY_TRACKING_ENTRY',match[1]);
  var exists=ScriptApp.getProjectTriggers().some(function(t){return t.getHandlerFunction()==='onUnityGrowthSubmit'&&t.getTriggerSourceId()===form.getId();});
  if(!exists)ScriptApp.newTrigger('onUnityGrowthSubmit').forForm(form).onFormSubmit().create();
  // Only the public entry name is returned/logged, never secret values or form responses.
  console.log('formEntry: '+match[1]);return match[1];
}
/** Run only AFTER deploying tracking-config.js with the returned entry. */
function activateGrowthConfirmation() {
  var props=PropertiesService.getScriptProperties(),entry=props.getProperty('UNITY_TRACKING_ENTRY');
  if(!entry||!/^entry\.\d{1,20}$/.test(entry))throw new Error('Run setupGrowthTracking before activation.');
  var response=UrlFetchApp.fetch('https://nyokki519.github.io/Unity_S/tracking-config.js',{muteHttpExceptions:true,followRedirects:false});
  var text=response.getContentText(),match=text.match(/formEntry\s*:\s*['"](entry\.\d{1,20})['"]/);
  if(response.getResponseCode()!==200||!match||match[1]!==entry)throw new Error('Matching formEntry is not deployed in public tracking-config.js.');
  var form=FormApp.getActiveForm();
  var exists=form&&ScriptApp.getProjectTriggers().some(function(t){return t.getHandlerFunction()==='onUnityGrowthSubmit'&&t.getTriggerSourceId()===form.getId();});
  if(!exists)throw new Error('Form onSubmit trigger missing; rerun setupGrowthTracking.');
  postUnityGrowth_({type:'activate'});
}
function onUnityGrowthSubmit(event) {
  if(!event||!event.response)throw new Error('Use a Form onSubmit trigger, not a spreadsheet trigger.');
  var props=PropertiesService.getScriptProperties(),itemId=props.getProperty('UNITY_TRACKING_ITEM_ID');
  var row=event.response.getItemResponses().filter(function(r){return String(r.getItem().getId())===itemId;})[0];
  var id=row?String(row.getResponse()).trim():'';
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id))return;
  var bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(event.response.getId()),Utilities.Charset.UTF_8);
  var receipt=bytes.map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');
  postUnityGrowth_({journeyId:id,receipt:receipt});
}
function postUnityGrowth_(body) {
  var token=PropertiesService.getScriptProperties().getProperty('GROWTH_CONFIRM_TOKEN');
  if(!token||token.length<32)throw new Error('Confirmation key missing.');
  for(var attempt=0;attempt<3;attempt++){
    var response;
    try{response=UrlFetchApp.fetch('https://unity-analytics.vercel.app/api/growth/confirm',{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+token},payload:JSON.stringify(body),muteHttpExceptions:true,followRedirects:false});}
    catch(error){if(attempt<2){Utilities.sleep(1000*(attempt+1));continue;}throw new Error('Confirmation connection unavailable; no participant data was logged.');}
    var status=response.getResponseCode();
    if(status>=200&&status<300)return;
    if((status===429||status>=500)&&attempt<2){Utilities.sleep(1000*(attempt+1));continue;}
    throw new Error('Confirmation API HTTP '+status+'; do not log form responses or keys.');
  }
}
