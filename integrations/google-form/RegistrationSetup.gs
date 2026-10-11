/** Run from the EXISTING Google Form's Apps Script. Does not submit answers. */
function setupUnityRegistration() {
  var form=FormApp.getActiveForm(),props=PropertiesService.getScriptProperties();
  if(!form||!form.getDestinationId())throw new Error('Existing response destination is required.');
  // Owner must stop web publication and verify anonymous gviz/CSV access is denied.
  // Drive PRIVATE alone does not establish that published-to-web copies are disabled.
  if(props.getProperty('UNITY_PRIVATE_DESTINATION_VERIFIED')!=='true')throw new Error('Verify private storage and anonymous denial; set privacy attestation first.');
  if(DriveApp.getFileById(form.getDestinationId()).getSharingAccess()!==DriveApp.Access.PRIVATE)throw new Error('Response destination must be private.');
  var specs=[
    {key:'experience',title:'Unityへの参加経験',type:FormApp.ItemType.MULTIPLE_CHOICE,required:false,choices:['初めて','参加したことがある']},
    {key:'eventId',title:'公開イベントID',type:FormApp.ItemType.TEXT,required:false,help:'申込サイトから自動入力されます。自由入力の場合は空欄です。'},
    {key:'mode',title:'イベント入力方法',type:FormApp.ItemType.TEXT,required:false,help:'申込サイトから自動入力されます。'}
  ];
  // Validate all existing matches BEFORE making changes, including repeat runs.
  var existing=form.getItems();specs.forEach(function(spec){
    var matches=existing.filter(function(item){return item.getTitle()===spec.title;});
    if(matches.length>1||(matches.length===1&&matches[0].getType()!==spec.type))throw new Error('Registration question conflict; inspect matching titles/types.');
  });
  var entries={};
  specs.forEach(function(spec){
    var found=existing.filter(function(item){return item.getTitle()===spec.title;})[0];
    var item=found?(spec.type===FormApp.ItemType.TEXT?found.asTextItem():found.asMultipleChoiceItem()):(spec.type===FormApp.ItemType.TEXT?form.addTextItem():form.addMultipleChoiceItem()).setTitle(spec.title);
    item.setRequired(spec.required);if(spec.help)item.setHelpText(spec.help);if(spec.choices)item.setChoiceValues(spec.choices);
    var response=item.createResponse(spec.choices?spec.choices[0]:'unity-registration-probe');
    var url=form.createResponse().withItemResponse(response).toPrefilledUrl(),match=url.match(/[?&](entry\.\d+)=/);
    if(!match)throw new Error('Actual registration entry could not be determined.');
    entries[spec.key]=match[1];props.setProperty('UNITY_REGISTRATION_'+spec.key.toUpperCase()+'_ENTRY',match[1]);
  });
  // Optional metadata entry names only. Existing three-entry submissions remain valid.
  var config={enabled:false,privacyVerified:true,experience:entries.experience,eventId:entries.eventId,mode:entries.mode};
  console.log(JSON.stringify(config));return config;
}
