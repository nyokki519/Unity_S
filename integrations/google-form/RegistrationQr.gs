/** Bind to the EXISTING response Google Form. Never deploy as a public web app. */
function setupUnityRegistrationQr() {
  var props=PropertiesService.getScriptProperties(),secret=props.getProperty('QR_FORM_SECRET');
  var form=FormApp.getActiveForm();
  if(!form||!secret||secret.length<32)throw new Error('Open the existing Form and set QR_FORM_SECRET first.');
  var title='Unity申込照合ID（自動入力）',items=form.getItems(),matches=items.filter(function(i){return i.getTitle()===title;});
  var fields=['お名前','イベント名','日時','公開イベントID'];
  fields.forEach(function(t){if(items.filter(function(i){return i.getTitle()===t;}).length!==1)throw new Error('Required Form question missing or ambiguous: '+t);});
  if(matches.length>1||(matches.length&&matches[0].getType()!==FormApp.ItemType.TEXT))throw new Error('Claim question title/type conflict.');
  var item=matches.length?matches[0].asTextItem():form.addTextItem().setTitle(title);
  item.setRequired(false).setHelpText('申込サイトから自動入力されます。空欄でも申し込めます。');
  var url=form.createResponse().withItemResponse(item.createResponse('0'.repeat(64))).toPrefilledUrl();
  var entry=url.match(/[?&](entry\.\d{1,20})=/);
  if(!entry)throw new Error('Actual prefill entry could not be determined.');
  props.setProperty('UNITY_QR_CLAIM_ITEM_ID',String(item.getId()));
  var exists=ScriptApp.getProjectTriggers().some(function(t){return t.getHandlerFunction()==='onUnityQrSubmit'&&t.getTriggerSourceId()===form.getId();});
  if(!exists)ScriptApp.newTrigger('onUnityQrSubmit').forForm(form).onFormSubmit().create();
  postUnityQr_('/config',{entry:entry[1],enabled:true});
  console.log('QR claim setup complete; public entry: '+entry[1]);
  return entry[1];
}
function onUnityQrSubmit(event) {
  if(!event||!event.response)throw new Error('Use the existing Form onSubmit trigger.');
  var props=PropertiesService.getScriptProperties(),itemId=props.getProperty('UNITY_QR_CLAIM_ITEM_ID');
  if(!itemId)throw new Error('Run setupUnityRegistrationQr first.');
  var rows=event.response.getItemResponses(),claims=rows.filter(function(r){return String(r.getItem().getId())===itemId;});
  var hash=claims.length===1?String(claims[0].getResponse()).trim():'';
  if(!hash)return; // Legacy submissions are unaffected.
  if(!/^[a-f0-9]{64}$/.test(hash))throw new Error('Invalid claim hash.');
  function answer(title) {
    var found=rows.filter(function(r){return r.getItem().getTitle()===title;});
    if(found.length!==1)throw new Error('Accepted response field missing or ambiguous.');
    return String(found[0].getResponse()).trim();
  }
  var name=answer('お名前'),eventId=answer('公開イベントID'),eventDate=answer('日時'),eventName=answer('イベント名');
  if(!name||name.length>100||/[\x00-\x1f\x7f]/.test(name)||!eventId||eventId.length>128||/[\x00-\x1f\x7f]/.test(eventId)||!eventName||eventName.length>300||/[\x00-\x1f\x7f]/.test(eventName))throw new Error('Invalid accepted response.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)||!Number.isFinite(Date.parse(eventDate+'T00:00:00Z'))||new Date(eventDate+'T00:00:00Z').toISOString().slice(0,10)!==eventDate)throw new Error('Invalid event date.');
  var responseId=event.response.getId();if(!responseId)throw new Error('Accepted response ID missing.');
  var bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(responseId),Utilities.Charset.UTF_8);
  var receiptHash=bytes.map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');
  postUnityQr_('/accepted',{claimHash:hash,receiptHash:receiptHash,name:name,eventId:eventId,eventDate:eventDate,eventName:eventName});
}
function postUnityQr_(path,body) {
  if(path!=='/config'&&path!=='/accepted')throw new Error('Invalid QR endpoint.');
  var secret=PropertiesService.getScriptProperties().getProperty('QR_FORM_SECRET');
  if(!secret||secret.length<32)throw new Error('QR_FORM_SECRET missing.');
  for(var attempt=0;attempt<3;attempt++){
    var response;
    try{response=UrlFetchApp.fetch('https://unity-qr-free-79cc330c2434.kukki519.workers.dev/api/v2/form'+path,{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+secret},payload:JSON.stringify(body),muteHttpExceptions:true,followRedirects:false});}
    catch(error){if(attempt<2){Utilities.sleep(1000*(attempt+1));continue;}throw new Error('QR bridge unavailable; no participant data logged.');}
    var status=response.getResponseCode();
    if(status>=200&&status<300)return;
    if((status===429||status>=500)&&attempt<2){Utilities.sleep(1000*(attempt+1));continue;}
    throw new Error('QR bridge HTTP '+status+'; inspect configuration without logging answers or keys.');
  }
}
