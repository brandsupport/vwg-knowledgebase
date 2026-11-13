const $=s=>document.querySelector(s);
const foxTips=["You’ve got this! Check the brand first — the same status can mean different actions across brands.","ELHub tip: status and transport order are a team. Check both before you commit.","No guessing, clever teammate. If the workbook has no matching rule, stop and check the official procedure.","Evidence matters! Check whether this is Agency, Retailer, or a demo case.","Nice pace! Read the result and evidence notes before moving to the next case.","Remember: a transport order can change the next step. Stay sharp!"];
function rotateFoxTip(){const el=$("#foxTipText");if(el)el.textContent=foxTips[Math.floor(Math.random()*foxTips.length)];}
setInterval(rotateFoxTip,18000);
$("#startGame").addEventListener("click",()=>{$("#welcome").style.display="none";$("#gameShell").classList.add("is-active");rotateFoxTip();window.scrollTo({top:0,behavior:"smooth"});});

const state={step:0,brand:"",type:"",status:"",transport:"",idBuzz:"",modelType:"",demo:"",skodaType:"",selected:"",history:[]};
const navStack=[];
const brands=[["VWPC","Volkswagen Passenger Cars","🚘"],["VWCV","Volkswagen Commercial Vehicles","🚐"],["SKODA","Škoda","🚗"],["SEAT/CUPRA","SEAT / CUPRA","🏁"],["AUDI","Audi","🏎️"]];
const agency={
VWPC:{low:["Detag, Deallocate & cancel commission","For status 20 or above, the RDC must provide at least one: cancellation document, VWFS finance decline letter, or original agreement form."],mid:["Detag & Deallocate","For status 20 or above, provide a cancellation document, VWFS finance decline letter, or original agreement form."],noTO:["Detag & Deallocate","This is the workbook action for status 36–38 without a transport order. Evidence is required for status 20 or above."],withTO:["Detag; add a consignment block for today and immediately remove it. Add 150 days if not already exceeded; if a date-range error occurs, add at least 2 days; if exceeded, add a couple of days.","Evidence is required for status 20 or above."]},
VWCV:{low:["Detag but DON'T deallocate","No documents are required at status 10 or below. At status 20 or above, provide an order form or cancellation."],mid:["Detag but DON'T deallocate","At status 20 or above, provide an order form or cancellation."],noTO:["Detag but DON'T deallocate","At status 20 or above, provide an order form or cancellation."],withTO:["Detag; add a consignment block for today and immediately remove it. Add 150 days if not already exceeded; if a date-range error occurs, add at least 2 days; if exceeded, add a couple of days.","At status 20 or above, provide an order form or cancellation. Special case: reject ID Buzz at any status and request form CV0678-22."]},
SKODA:{low:["Detag, Deallocate & cancel commission",""],mid:["Detag & Deallocate",""],noTO:["Detag & Deallocate",""],withTO:["Detag; add a consignment block for today and immediately remove it. Add 150 days if not already exceeded; if a date-range error occurs, add at least 2 days; if exceeded, add a couple of days.",""]},
"SEAT/CUPRA":{low:["Detag, Deallocate & cancel commission","Refer to the SEAT & CUPRA HUB procedures."],mid:["Detag, Deallocate","Refer to the SEAT & CUPRA HUB procedures."],noTO:["Detag, Deallocate","Refer to the SEAT & CUPRA HUB procedures."],withTO:["Detag; add a consignment block for today and immediately remove it. Add 150 days if not already exceeded; if a date-range error occurs, add at least 2 days; if exceeded, add a couple of days.","Refer to the SEAT & CUPRA HUB procedures."]},
AUDI:{low:["For order types 08, 09 and 11: detag, transfer to 64001 for status 30 or lower, then cancel the call-off.","No evidence needed. If transferring any Audi vehicle to 64001, cancel the call-off if a call-off date exists."],mid:null,noTO:["Detag and add Mandatory Block EDE for 24 hours","No evidence needed."],withTO:["Detag and leave a note","No evidence needed. If transferring any Audi vehicle to 64001, cancel the call-off if a call-off date exists."]}
};
const retail={
VWPC:{p10:["ID: deallocate; no evidence needed. Remove GOV grant. Other models: detag only and leave the vehicle in retailer stock.","No proof required for demos."],mid:["Provide an order form or cancellation letter. Normal de-tag remains in retailer stock; add a note.","Stock match: same customer; trim can differ."],noTO:["Provide an order form or cancellation letter. Motability letter must be 7 days old. For status 36–40 without a transport order, add consignment and mandatory block EDE for 24 hours before de-tagging.","This allows the retailer to re-tag. If they don't, the block drops after 24 hours and the vehicle becomes available in mandatory stock."],withTO:["If there is a transport order, do NOT add a mandatory block; just de-tag.","Stock match: same customer; trim can differ."]},
VWCV:{p10:["Provide an order form or cancellation letter. Normal de-tag remains in retailer stock; add a note.","Reject ID Buzz at any status and request form CV0678-22. No proof required for demos."],mid:["Provide an order form or cancellation letter. Normal de-tag remains in retailer stock; add a note.","No proof required for demos."],noTO:["Provide an order form or cancellation letter. Motability letter must be 7 days old. For status 36–40 without a transport order, add a mandatory block EDE for 24 hours before de-tagging.","No proof required for demos."],withTO:["If there is a transport order, do NOT add a mandatory block; just de-tag.","No proof required for demos."]},
SKODA:{p10:["De-allocate, except do not de-allocate for a demo customer.","Stock match: same customer, not same model. If the stock-match vehicle is at a lower status than the original vehicle, obtain proof that the customer is willing to wait."],mid:["De-allocate, except do not de-allocate for a demo customer.","Stock match: same customer, not same model. If the stock-match vehicle is at a lower status than the original vehicle, obtain proof that the customer is willing to wait."],noTO:["For status 36–40 without a transport order, add mandatory block EDE for 24 hours before de-tagging.","Stock match: same customer, not same model. If the stock-match vehicle is at a lower status than the original vehicle, obtain proof that the customer is willing to wait."],withTO:["If there is a transport order, do NOT add a mandatory block; just de-tag.","Stock match: same customer, not same model. If the stock-match vehicle is at a lower status than the original vehicle, obtain proof that the customer is willing to wait."]},
"SEAT/CUPRA":{p10:["Handled by UK Team.","No proof required for demos."],mid:["Handled by UK Team.","No proof required for demos."],noTO:["Handled by UK Team.","No proof required for demos."],withTO:["Handled by UK Team.","No proof required for demos."]},
AUDI:{p10:["Detag to status 07; vehicle remains in retailer stock.","No proof required for demos."],mid:["Detag to status 07; vehicle remains in centre stock.","For cancelled orders, documentation for e-tron and RS products is currently not required."],noTO:["For status 36–40 without a transport order, add consignment and mandatory block EDE for 24 hours before de-tagging.","Stock match cannot be behind on status codes and must be in the same model group, e.g. A3 to A3."],withTO:["If there is a transport order, do NOT add a mandatory block; just de-tag.","Stock match must be in the same model group. Documentation for cancelled e-tron and RS orders is currently not required."]}
};
function needsTransport(){return state.type==="Retailer"&&(state.status==="36-40"||state.status==="40-70") || state.type==="Agency"&&(state.status==="36-38"||state.status==="40-70");}
function statusOptions(){return state.type==="Agency"?[["0-10","Status 0–10"],["20-30","Status 20–30"],["36-38","Status 36–38"],["40-70","Status 40–70"]]:[["P-10","P-10"],["20-30","Status 20–30"],["36-40","Status 36–40"],["40-70","Status 40–70"]];}
function selectedRule(){let table=state.type==="Agency"?agency:retail;let row=table[state.brand];if(!row)return null;let rule=null;if(state.type==="Agency"){if(state.status==="0-10")rule=row.low;if(state.status==="20-30")rule=row.mid;if(state.status==="36-38")rule=state.transport==="No"?row.noTO:null;if(state.status==="40-70")rule=state.transport==="Yes"?row.withTO:null;}else{if(state.status==="P-10")rule=row.p10;if(state.status==="20-30")rule=row.mid;if(state.status==="36-40")rule=state.transport==="No"?row.noTO:row.withTO;if(state.status==="40-70")rule=state.transport==="Yes"?row.withTO:null;}if(!rule)return null;rule=[...rule];if(state.type==="Retailer"&&state.demo==="Yes"&&state.brand!=="SKODA")rule[1]="No proof of evidence required — demo vehicle. "+rule[1];if(state.brand==="SKODA"){let proofNote;if(state.type==="Agency")proofNote="No proof required for Agency de-tag cases.";else if(state.demo==="Yes")proofNote="No proof required for demo vehicles.";else if(state.skodaType==="Motability")proofNote="Motability proof must be dated within the last 7 days.";else proofNote="Proof required for a normal Retailer de-tag.";rule[1]=proofNote+(rule[1]?" "+rule[1]:"");}return rule;}
function choice(v,t,d,i){return '<button class="choice '+(state.selected===v?'selected':'')+'" data-value="'+v.replace(/"/g,'&quot;')+'"><span class="symbol">'+i+'</span><span><strong>'+t+'</strong><small>'+d+'</small></span></button>'}
function options(){if(state.step===0)return brands.map(b=>[b[0],b[1],b[2]]);if(state.step===4)return [["Yes","Yes — it is an ID Buzz","🚫"],["No","No — it is another VWCV model","🚐"]];if(state.step===5)return [["ID","ID model","🪪"],["Normal","Normal model","🚘"]];if(state.step===1)return [["Agency","Agency de-tag procedure","🏢"],["Retailer","Retailer de-tag procedure","🏬"]];if(state.step===7)return [["Yes","Demo vehicle","🎯"],["No","Not a demo vehicle","🚘"]];if(state.step===8)return [["Motability","Motability de-tag","📅"],["Normal","Normal de-tag","📄"]];if(state.step===2)return statusOptions().map(x=>[x[0],x[1],"🔹"]);return [["Yes","Transport order exists","🚚"],["No","No transport order","🚫"]];}
function resultHTML(){if(state.brand==="VWPC"&&state.type==="Retailer"&&state.status==="P-10")return '<span class="step-tag">MODEL-SPECIFIC RULE</span><h2>'+(state.modelType==="ID"?"ID model — de-tag and de-allocate":"Normal model — de-tag only") + '</h2><div class="result"><h3>'+(state.modelType==="ID"?"De-tag, de-allocate, then remove the government grant.":"De-tag only; keep the vehicle in the retailer’s stock.")+'</h3><p>'+(state.modelType==="ID"?"No evidence is required for this P-10 ID case.":"The vehicle remains in retailer stock.")+'</p></div><p class="note">Case: VWPC → Retailer → P-10 → '+state.modelType+' model.</p>';if(state.brand==="VWCV"&&state.idBuzz==="Yes")return '<span class="step-tag">STOP — SPECIAL CASE</span><h2>ID Buzz: do not continue with the standard process</h2><div class="warning"><b>Reject the request at any status.</b><br>Ask the requester to complete the correct form: <b>CV0678-22</b>. Do not apply the general VWCV de-tag steps to this case.</div><p class="note">Case: VWCV → ID Buzz → stop and request form CV0678-22.</p>';let rule=selectedRule();return '<span class="step-tag">CASE RESULT</span><h2>Your recommended procedure</h2>'+(rule?'<div class="result"><div style="font-size:34px">✨</div><h3>'+rule[0]+'</h3><p><b>Evidence / notes</b><br>'+rule[1]+'</p></div>':'<div class="warning"><b>Stop and verify this case</b><br>The workbook does not define this exact combination clearly. Do not guess; check the official procedure or your team lead.</div>')+'<p class="note">Case: '+state.brand+' → '+state.type+' → '+state.status+(needsTransport()?' → transport order: '+state.transport:'')+'.</p>';}
function render(){let result=(state.step===3&&!needsTransport())||state.step===6;let stepNo=state.step===0?1:state.step===1?2:state.step===2?3:4;let html='<div class="progress-row"><span>'+(result?'CASE RESULT':'CASE SETUP')+'</span><span>'+(result?'COMPLETE':'STEP '+stepNo+' OF 4')+'</span></div><div class="track"><span style="width:'+(result?100:((stepNo-1)/4*100))+'%"></span></div><div class="screen">';
if(result){html+=resultHTML();}else if(state.step===0)html+='<span class="step-tag">STEP 01</span><h2>Which brand are you handling?</h2><p class="sub">Choose the vehicle brand to select the right procedure.</p><div class="choices">'+brands.map(b=>{const paths={"VWPC":"volkswagen.png","VWCV":"vw-commercial-vehicles.png","SKODA":"skoda.png","SEAT/CUPRA":"seat%26cupra.png","AUDI":"audi.png"};return '<button class="choice '+(state.selected===b[0]?'selected':'')+'" data-value="'+b[0]+'"><span class="symbol brand-symbol"><img src="./assets/game/'+paths[b[0]]+'" alt="'+b[1]+' logo"></span><span><strong>'+b[1]+'</strong><small>Select the brand</small></span></button>'}).join("")+'</div>';
else if(state.step===4)html+='<span class="step-tag">QUICK CHECK</span><h2>Is this vehicle an ID Buzz?</h2><p class="sub">VWCV ID Buzz requests must be rejected at any status. We’ll check this before showing the standard procedure.</p><div class="choices">'+options().map(x=>choice(x[0],x[1],x[1],x[2])).join("")+'</div>';
else if(state.step===5)html+='<span class="step-tag">MODEL CHECK</span><h2>Is this a VWPC ID model or a normal model?</h2><p class="sub">For Retailer P-10 cases, the action differs by model type.</p><div class="choices">'+options().map(x=>choice(x[0],x[1],x[1],x[2])).join("")+'</div>';
else if(state.step===1)html+='<span class="step-tag">CASE TYPE</span><h2>Agency or retailer?</h2><p class="sub">Choose the route that applies to this request.</p><div class="choices">'+options().map(x=>choice(x[0],x[1],x[1],x[2])).join("")+'</div>';
else if(state.step===7)html+='<span class="step-tag">RETAILER CHECK</span><h2>Is this a demo vehicle?</h2><p class="sub">Demo vehicles do not need proof of evidence. Other retailer cases follow the applicable evidence rules.</p><div class="choices">'+options().map(x=>choice(x[0],x[1],x[1],x[2])).join("")+'</div>';
else if(state.step===8)html+='<span class="step-tag">ŠKODA CHECK</span><h2>Is this a Motability or normal de-tag?</h2><p class="sub">For Škoda Retailer cases, Motability evidence must be dated within the last seven days. Normal Retailer cases require proof; Agency and Demo cases do not.</p><div class="choices">'+options().map(x=>choice(x[0],x[1],x[1],x[2])).join("")+'</div>';
else if(state.step===2)html+='<span class="step-tag">STEP 03</span><h2>What status range applies?</h2><p class="sub">Choose the band shown in the official workbook.</p><div class="choices">'+options().map(x=>choice(x[0],x[1],"Vehicle status band",x[2])).join("")+'</div>';
else html+='<span class="step-tag">STEP 04</span><h2>Is there a transport order?</h2><p class="sub">Choose the actual transport-order state. If the workbook has no matching rule, the game will stop rather than guess.</p><div class="choices">'+options().map(x=>choice(x[0],x[1],x[1],x[2])).join("")+'</div>';
html+='</div><div class="actions">';if(navStack.length>0)html+='<button class="btn secondary" id="back">← Back</button>';else html+='<span></span>';if(result)html+='<button class="btn primary" id="again">↻ Play another case</button>';else html+='<button class="btn primary" id="next" '+(!state.selected?'disabled':'')+'>'+(state.step===3?'Show result':'Continue →')+'</button>';html+='</div>';$("#game").innerHTML=html;
document.querySelectorAll("[data-value]").forEach(b=>b.addEventListener("click",()=>{state.selected=b.dataset.value;render()}));
$("#next")?.addEventListener("click",()=>{if(!state.selected)return;navStack.push(JSON.parse(JSON.stringify(state)));if(state.step===0){state.brand=state.selected;state.selected="";state.step=state.brand==="VWCV"?4:1;render();return;}if(state.step===4){state.idBuzz=state.selected;state.selected="";state.step=state.idBuzz==="Yes"?6:1;render();return;}if(state.step===5){state.modelType=state.selected;state.selected="";state.step=6;render();return;}if(state.step===1){state.type=state.selected;state.selected="";state.step=state.type==="Retailer"?7:(state.brand==="SKODA"?8:2);render();return;}if(state.step===7){state.demo=state.selected;state.selected="";state.step=state.brand==="SKODA"?8:2;render();return;}if(state.step===8){state.skodaType=state.selected;state.selected="";state.step=2;render();return;}const keys={2:"status",3:"transport"};if(keys[state.step])state[keys[state.step]]=state.selected;state.history.push({step:state.step,selected:state.selected});if(state.step===3){state.step=6;state.selected="";render();return;}if(state.step===2&&!needsTransport()){state.step=3;state.selected="";render();return;}state.step++;state.selected="";render()});
$("#back")?.addEventListener("click",()=>{const previous=navStack.pop();if(!previous)return;Object.assign(state,previous);render()});
$("#again")?.addEventListener("click",()=>{navStack.length=0;Object.assign(state,{step:0,brand:"",type:"",status:"",transport:"",idBuzz:"",modelType:"",demo:"",skodaType:"",selected:"",history:[]});render()});
}

/* Retail De-tag matrix update — appended decision flow and validator. */
Object.assign(state, {
  orderType:"", stockMatch:"", sameCustomer:"", lowerStockStatus:"",
  customerWaitLetter:"", audiStockStatus:"", audiSameModelGroup:"",
  motabilityLetter:"", motabilityFresh:""
});

function vwgStop(message, notes) {
  return {stop:true, action:"STOP — do not proceed using a guessed rule.", evidence:"",
    notes:[message].concat(notes || [])};
}
function vwgEvidence(c) {
  if (c.demo === "Yes" && c.brand !== "AUDI")
    return "No proof of evidence is required for demo vehicles (as explicitly stated for this brand in the sheet).";
  const rules = {
    "VWPC|P-10":"No evidence required.",
    "VWPC|20-30":"Proof of evidence: order form or cancellation letter.",
    "VWPC|36-40":"Proof of evidence: order form or cancellation letter. The sheet says a Motability letter needs to be 7 days old.",
    "VWCV|P-10":"Proof of evidence: order form or cancellation letter.",
    "VWCV|20-30":"Proof of evidence: order form or cancellation letter.",
    "VWCV|36-40":"Proof of evidence: order form or cancellation letter. The sheet says a Motability letter needs to be 7 days old.",
    "SKODA|P-10":"Proof of evidence: order form or cancellation letter. The sheet says a Motability letter needs to be 7 days old.",
    "SKODA|20-30":"Proof of evidence: order form or cancellation letter. The sheet says a Motability letter needs to be 7 days old.",
    "SKODA|36-40":"Proof of evidence: order form or cancellation letter. The sheet says a Motability letter needs to be 7 days old."
  };
  if (c.brand === "AUDI")
    return "The sheet does not state a separate evidence rule for this Audi case. It says documentation for cancelled e-tron and RS orders is currently not required; verify any other evidence requirement against the current Audi procedure.";
  return rules[c.brand + "|" + c.status] ||
    "The supplied matrix does not state a separate evidence rule for this status. Verify the requirement in the current official procedure; do not infer one.";
}
function vwgValidateStock(c) {
  if (c.stockMatch !== "Yes" && c.stockMatch !== "No")
    return {stop:true, notes:["Confirm whether a stock match exists."]};
  if (c.stockMatch === "No") return {stop:false, notes:[]};
  if (["VWPC","VWCV","SKODA"].indexOf(c.brand) >= 0 && c.sameCustomer !== "Yes")
    return {stop:true, notes:["Stock match rejected: it must be for the same customer."]};
  if (c.brand === "VWPC" || c.brand === "VWCV")
    return {stop:false, notes:["Stock match: same customer is required; the trim does not have to match."]};
  if (c.brand === "SKODA") {
    const notes = ["Stock match: same customer is required; the model does not have to match."];
    if (c.lowerStockStatus !== "Yes" && c.lowerStockStatus !== "No")
      return {stop:true, notes:notes.concat(["Confirm whether the stock-match vehicle has a lower status than the original vehicle."])};
    if (c.lowerStockStatus === "Yes" && c.customerWaitLetter !== "Yes")
      return {stop:true, notes:notes.concat(["The stock-match vehicle is at a lower status. Obtain a customer letter confirming they accept the wait before proceeding."])};
    if (c.lowerStockStatus === "Yes")
      notes.push("Customer confirmation letter recorded: the customer accepts the wait for the lower-status stock-match vehicle.");
    return {stop:false, notes:notes};
  }
  if (c.brand === "AUDI") {
    if (c.audiStockStatus === "Behind")
      return {stop:true, notes:["Audi stock match rejected: its status must be equal to or more advanced than the original vehicle."]};
    if (c.audiStockStatus !== "Equal" && c.audiStockStatus !== "Ahead")
      return {stop:true, notes:["Select whether the Audi stock match is at an equal or more advanced status."]};
    if (c.audiSameModelGroup !== "Yes")
      return {stop:true, notes:["Audi stock match rejected: it must meet the model-group requirement (the sheet example is Q3 to Q4)."]};
    return {stop:false, notes:["Audi stock match validated: equal or more advanced status and the stated model-group requirement met (sheet example: Q3 to Q4)."]};
  }
  return {stop:false, notes:[]};
}
function vwgRetailRule(c) {
  if (c.demo !== "Yes" && c.demo !== "No")
    return vwgStop("Confirm whether this is a demo vehicle before applying evidence rules.");
  if (c.brand === "VWCV" && c.idBuzz === "Yes")
    return vwgStop("Reject the ID Buzz request at any status and ask the requester to complete form CV0678-22. Do not continue with the standard VWCV process.");
  if (c.brand === "SEAT/CUPRA")
    return {stop:false, action:"Handled by the UK Team — refer the case to the UK Team for all status bands.",
      evidence:c.demo === "Yes" ? vwgEvidence(c) : "The sheet says these cases are handled by the UK Team; follow that team's procedure.",
      notes:["This routing applies to P-10, 20–30, 36–40 and 40–70."]};

  if (c.brand === "VWPC" && c.status === "P-10" && c.modelType !== "ID" && c.modelType !== "Normal")
    return vwgStop("Choose whether the VWPC P-10 vehicle is an ID model or a normal model.");
  if (c.brand === "SKODA" && ["P-10","20-30"].indexOf(c.status) >= 0 && !c.orderType)
    return vwgStop("Select the Škoda order type. Types 00, 01, 02, 03, 04, 06 and 07 are de-allocated; type 05 is a normal de-tag.");
  if (c.brand === "SKODA" && c.demo !== "Yes" && ["P-10","20-30","36-40"].indexOf(c.status) >= 0 &&
      c.skodaType !== "Motability" && c.skodaType !== "Normal")
    return vwgStop("Confirm whether this is a Motability or normal Škoda de-tag so the 7-day letter requirement can be checked.");
  if (c.brand === "SKODA" && c.demo !== "Yes" && c.skodaType === "Motability" && c.motabilityFresh !== "Yes")
    return vwgStop("The sheet says a Motability letter needs to be 7 days old. Confirm the date meets that requirement before proceeding.");
  if (["VWPC","VWCV"].indexOf(c.brand) >= 0 && c.status === "36-40" && c.demo !== "Yes" &&
      c.motabilityLetter === "Yes" && c.motabilityFresh !== "Yes")
    return vwgStop("The sheet says a Motability letter for this 36–40 case needs to be 7 days old. Confirm the date meets that requirement before proceeding.");

  let action = "";
  const notes = [];
  if (c.status === "P-10") {
    if (c.brand === "VWPC") {
      action = "De-tag the vehicle and keep it in retailer stock.";
      if (c.modelType === "ID") action += " For an ID model, also de-allocate it and remove the GOV grant.";
    } else if (c.brand === "VWCV") {
      action = "De-tag but do NOT de-allocate. The vehicle remains in retailer stock.";
    } else if (c.brand === "SKODA") {
      if (["00","01","02","03","04","06","07"].indexOf(c.orderType) >= 0)
        action = "De-tag and de-allocate order type " + c.orderType + ".";
      else if (c.orderType === "05")
        action = "Normal de-tag for order type 05; do NOT de-allocate.";
      else return vwgStop("Škoda order type " + c.orderType + " is not covered by the supplied rule.");
    } else if (c.brand === "AUDI") action = "De-tag to status 07. The vehicle remains in retailer stock.";
    else return vwgStop("No P-10 rule is defined for this brand.");
  } else if (c.status === "20-30") {
    if (c.brand === "VWPC") action = "De-tag only. The vehicle remains in retailer stock; add a note.";
    else if (c.brand === "VWCV") action = "De-tag but do NOT de-allocate. The vehicle remains in retailer stock; add a note.";
    else if (c.brand === "SKODA") {
      if (["00","01","02","03","04","06","07"].indexOf(c.orderType) >= 0)
        action = "De-tag and de-allocate order type " + c.orderType + ".";
      else if (c.orderType === "05")
        action = "Normal de-tag for order type 05; do NOT de-allocate.";
      else return vwgStop("Škoda order type " + c.orderType + " is not covered by the supplied rule.");
    } else if (c.brand === "AUDI") action = "De-tag to status 07. The vehicle remains in the Centre's stock.";
    else return vwgStop("No 20–30 rule is defined for this brand.");
  } else if (c.status === "36-40") {
    if (c.transport !== "Yes" && c.transport !== "No")
      return vwgStop("Confirm whether a transport order exists for this 36–40 case.");
    if (c.transport === "No") {
      if (c.brand === "VWPC" || c.brand === "VWCV")
        action = "Before de-tagging, add Consignment (CO) and Mandatory Block (EDE) for 24 hours.";
      else if (c.brand === "SKODA" || c.brand === "AUDI")
        action = "Before de-tagging, add Protected from Mandatory (MT) and Mandatory Block (EDE) for 24 hours.";
      else return vwgStop("No 36–40 no-transport-order rule is defined for this brand.");
      notes.push("The 24-hour hold protects the vehicle for the retailer and gives the retailer an opportunity to re-tag. If it is not re-tagged, the block drops off after 24 hours and the vehicle becomes available in mandatory stock.");
      notes.push("The sheet also calls out this 36–40/no-transport-order protection for De-tags, Transfers and Un-adopts.");
    } else {
      action = "Do NOT add a mandatory block; de-tag only.";
      notes.push("The 24-hour no-transport-order protection block does not apply when a transport order exists.");
    }
  } else if (c.status === "40-70") {
    if (c.transport !== "Yes")
      return vwgStop("The supplied 40–70 rule only defines the case where a transport order exists. With no transport order, stop and verify the official procedure.");
    action = "A transport order exists: do NOT add a mandatory block; just de-tag.";
  } else {
    return vwgStop("This status band is not covered by the supplied Retail de-tag matrix.");
  }

  if (c.brand === "SKODA" && c.skodaType === "Motability" && ["P-10","20-30","36-40"].indexOf(c.status) >= 0)
    notes.push("If the evidence is a Motability letter, the sheet says it needs to be 7 days old.");
  if (c.brand === "AUDI" && ["P-10","20-30"].indexOf(c.status) >= 0)
    notes.push("For cancelled orders, documentation for e-tron and RS products is currently not required.");
  const evidence = vwgEvidence(c);
  const stock = vwgValidateStock(c);
  if (stock.stop) return vwgStop("Stock-match validation failed. Do not proceed until corrected.", stock.notes);
  notes.push.apply(notes, stock.notes);
  return {stop:false, action:action, evidence:evidence, notes:notes};
}
function vwgAgencyRule(c) {
  const row = agency[c.brand];
  if (!row) return vwgStop("No Agency rule is defined for this brand.");
  let rule = null;
  if (c.status === "0-10") rule = row.low;
  else if (c.status === "20-30") rule = row.mid;
  else if (c.status === "36-38" && c.transport === "No") rule = row.noTO;
  else if (c.status === "40-70" && c.transport === "Yes") rule = row.withTO;
  if (!rule) return vwgStop("The existing Agency guidance does not define this exact status / transport-order combination. Verify the Agency procedure.");
  const notes = [];
  if (c.status === "36-38" && c.transport === "No")
    notes.push("Shared workbook note: the Retail matrix calls for 24-hour mandatory protection for 36–40/no-transport-order De-tags, Transfers and Un-adopts. It does not specify the Agency block codes; confirm Agency-specific handling before action.");
  return {stop:false, action:rule[0], evidence:rule[1], notes:notes};
}
function vwgResolveCase(c) {
  if (c.brand === "VWCV" && c.idBuzz === "Yes")
    return vwgStop("Reject the ID Buzz request at any status and ask for form CV0678-22.");
  if (c.type === "Agency") return vwgAgencyRule(c);
  if (c.type !== "Retailer") return vwgStop("Select Agency or Retailer before resolving the case.");
  return vwgRetailRule(c);
}
window.VWGDetagChallengeRules = {resolveCase:vwgResolveCase};

function vwgQuestionList() {
  const q = [];
  const add = function(key,title,desc,opts) { q.push({key:key,title:title,desc:desc,opts:opts}); };
  const yesNo = [["Yes","Yes","✅"],["No","No","⛔"]];
  add("brand","Which brand are you handling?","Choose the vehicle brand to load the correct procedure.",
    brands.map(function(b){return [b[0],b[1],b[2]];}));
  if (!state.brand) return q;

  if (state.brand === "VWCV") {
    add("idBuzz","Is this vehicle an ID Buzz?","VWCV ID Buzz requests must be rejected at any status; ask for form CV0678-22.",
      [["Yes","Yes — this is an ID Buzz","🚫"],["No","No — another VWCV model","🚐"]]);
    if (!state.idBuzz || state.idBuzz === "Yes") return q;
  }

  add("type","Agency or Retailer?","The uploaded matrix updates the Retailer route. The existing Agency guidance remains separate.",
    [["Agency","Agency de-tag procedure","🏢"],["Retailer","Retailer de-tag procedure","🏬"]]);
  if (!state.type) return q;

  if (state.type === "Agency") {
    add("status","What status range applies?","Choose the band shown in the existing Agency procedure.",
      statusOptions().map(function(x){return [x[0],x[1],"🔹"];}));
    if (!state.status) return q;
    if (needsTransport())
      add("transport","Is there a transport order?","For Agency 36–38 and 40–70, this answer changes whether the existing Agency rule applies.",
        [["Yes","Transport order exists","🚚"],["No","No transport order","🚫"]]);
    return q;
  }

  add("demo","Is this a demo vehicle?","The sheet explicitly gives a no-proof demo exemption for VWPC, VWCV, Škoda and SEAT/CUPRA. Audi's row does not state the same exemption.",yesNo);
  if (!state.demo) return q;

  add("status","What status range applies?","Choose the band shown in the Retailer matrix.",
    statusOptions().map(function(x){return [x[0],x[1],"🔹"];}));
  if (!state.status) return q;
  if (state.brand === "SEAT/CUPRA") return q;

  if (state.brand === "VWPC" && state.status === "P-10")
    add("modelType","Is this a VWPC ID model or a normal model?","For P-10, ID models also need de-allocation and GOV grant removal.",
      [["ID","ID model","🪪"],["Normal","Normal model","🚘"]]);

  if (state.brand === "SKODA" && ["P-10","20-30"].indexOf(state.status) >= 0)
    add("orderType","What is the Škoda order type?","Order types 00, 01, 02, 03, 04, 06 and 07 are de-allocated. Order type 05 is a normal de-tag (no de-allocation).",
      [["00","00 — de-allocate","🔢"],["01","01 — de-allocate","🔢"],["02","02 — de-allocate","🔢"],
       ["03","03 — de-allocate","🔢"],["04","04 — de-allocate","🔢"],["05","05 — normal de-tag","🔢"],
       ["06","06 — de-allocate","🔢"],["07","07 — de-allocate","🔢"]]);

  if (state.brand === "SKODA" && ["P-10","20-30","36-40"].indexOf(state.status) >= 0 && state.demo !== "Yes") {
    add("skodaType","Is this a Motability or normal Škoda de-tag?","For the listed Škoda statuses, a Motability letter must meet the sheet's 7-day-old requirement.",
      [["Motability","Motability de-tag","📅"],["Normal","Normal de-tag","📄"]]);
    if (state.skodaType === "Motability")
      add("motabilityFresh","Does the Motability letter meet the 7-day age requirement?","The sheet says the letter needs to be 7 days old. Check the actual issue date against the current official interpretation; do not assume this means 'within the last 7 days'.",
        yesNo);
  }

  if (["VWPC","VWCV"].indexOf(state.brand) >= 0 && state.status === "36-40" && state.demo !== "Yes") {
    add("motabilityLetter","Is the 36–40 proof a Motability letter?","The sheet says a Motability letter needs to be 7 days old. Other accepted evidence is an order form or cancellation letter.",
      [["Yes","Yes — Motability letter","📅"],["No","No — order form or cancellation letter","📄"]]);
    if (state.motabilityLetter === "Yes")
      add("motabilityFresh","Does the Motability letter meet the 7-day age requirement?","The sheet says it needs to be 7 days old. Check the actual issue date against the current official interpretation; do not assume this means 'within the last 7 days'.",
        yesNo);
  }

  if (["36-40","40-70"].indexOf(state.status) >= 0)
    add("transport","Is there a transport order?","For 36–40 and 40–70, this answer determines whether the 24-hour protection block is applicable.",
      [["Yes","Transport order exists","🚚"],["No","No transport order","🚫"]]);

  if (["VWPC","VWCV","SKODA","AUDI"].indexOf(state.brand) >= 0) {
    add("stockMatch","Is there a stock match?","Stock-match validation differs by brand. Choose No if there is no stock-match vehicle.",yesNo);
    if (state.stockMatch === "Yes") {
      if (["VWPC","VWCV","SKODA"].indexOf(state.brand) >= 0) {
        add("sameCustomer","Is the stock match for the same customer?","VWPC, VWCV and Škoda require the same customer. Trim/model can differ as stated in the sheet.",yesNo);
        if (state.brand === "SKODA" && state.sameCustomer === "Yes") {
          add("lowerStockStatus","Is the Škoda stock-match vehicle at a lower status?","If it is at a lower status, obtain a customer letter confirming they accept the wait.",yesNo);
          if (state.lowerStockStatus === "Yes")
            add("customerWaitLetter","Do you have the customer's confirmation letter?","The letter must confirm the customer accepts the wait for the lower-status stock-match vehicle.",yesNo);
        }
      }
      if (state.brand === "AUDI") {
        add("audiStockStatus","How does the Audi stock-match status compare?","The stock match must be at an equal or more advanced status code (for example, 40 to 70).",
          [["Behind","Behind the original vehicle","⬇️"],["Equal","Equal status","➡️"],["Ahead","More advanced status","⬆️"]]);
        if (state.audiStockStatus === "Equal" || state.audiStockStatus === "Ahead")
          add("audiSameModelGroup","Does the Audi stock match meet the exact same model-group requirement?","The sheet example is Q3 to Q4. Confirm the applicable model-group pairing against the official Audi procedure.",
            yesNo);
      }
    }
  }
  return q;
}

function vwgClearDependentState(key) {
  const clear = function(keys) { keys.forEach(function(k){ state[k] = ""; }); };
  const allCase = ["idBuzz","type","demo","status","transport","modelType","orderType","skodaType",
    "motabilityLetter","motabilityFresh","stockMatch","sameCustomer","lowerStockStatus",
    "customerWaitLetter","audiStockStatus","audiSameModelGroup"];
  if (key === "brand") clear(allCase);
  else if (key === "idBuzz") clear(["type","demo","status","transport","modelType","orderType","skodaType",
    "motabilityLetter","motabilityFresh","stockMatch","sameCustomer","lowerStockStatus",
    "customerWaitLetter","audiStockStatus","audiSameModelGroup"]);
  else if (key === "type") clear(["demo","status","transport","modelType","orderType","skodaType",
    "motabilityLetter","motabilityFresh","stockMatch","sameCustomer","lowerStockStatus",
    "customerWaitLetter","audiStockStatus","audiSameModelGroup"]);
  else if (key === "demo") clear(["status","transport","modelType","orderType","skodaType","motabilityLetter",
    "motabilityFresh","stockMatch","sameCustomer","lowerStockStatus","customerWaitLetter",
    "audiStockStatus","audiSameModelGroup"]);
  else if (key === "status") clear(["transport","modelType","orderType","skodaType","motabilityLetter",
    "motabilityFresh","stockMatch","sameCustomer","lowerStockStatus","customerWaitLetter",
    "audiStockStatus","audiSameModelGroup"]);
  else if (key === "skodaType" || key === "motabilityLetter") clear(["motabilityFresh"]);
  else if (key === "stockMatch") clear(["sameCustomer","lowerStockStatus","customerWaitLetter","audiStockStatus","audiSameModelGroup"]);
  else if (key === "sameCustomer") clear(["lowerStockStatus","customerWaitLetter"]);
  else if (key === "lowerStockStatus") clear(["customerWaitLetter"]);
  else if (key === "audiStockStatus") clear(["audiSameModelGroup"]);
}

function vwgEscape(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g,function(ch){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch];
  });
}
function vwgChoice(value,title,desc,symbol) {
  return '<button class="choice '+(state.selected===value?'selected':'')+'" data-value="'+vwgEscape(value)+'"><span class="symbol">'+symbol+'</span><span><strong>'+vwgEscape(title)+'</strong><small>'+vwgEscape(desc)+'</small></span></button>';
}
function vwgResultHTML() {
  const result = vwgResolveCase(state);
  const notes = result.notes && result.notes.length ? "<ul>"+result.notes.map(function(n){return "<li>"+vwgEscape(n)+"</li>";}).join("")+"</ul>" : "";
  const evidence = result.evidence ? "<p><b>Evidence / proof</b><br>"+vwgEscape(result.evidence)+"</p>" : "";
  const summary = state.brand+" → "+state.type+" → "+(state.status || "status not selected")+
    (state.transport ? " → transport order: "+state.transport : "");
  return '<span class="step-tag">'+(result.stop?"STOP — VERIFY":"CASE RESULT")+'</span><h2>'+
    (result.stop?"Do not proceed until this is resolved":"Your recommended procedure")+
    '</h2><div class="'+(result.stop?"warning":"result")+'"><h3>'+vwgEscape(result.action)+
    '</h3>'+evidence+notes+'</div><p class="note">Case: '+vwgEscape(summary)+'.</p>';
}
function render() {
  const qs = vwgQuestionList();
  const result = state.step >= qs.length;
  const progress = result ? 100 : Math.min(95,Math.round((state.step/Math.max(qs.length,1))*100));
  let html = '<div class="progress-row"><span>'+(result?"CASE RESULT":"CASE SETUP")+
    '</span><span>'+(result?"COMPLETE":"CHECK "+(state.step+1))+
    '</span></div><div class="track"><span style="width:'+progress+'%"></span></div><div class="screen">';
  if (result) html += vwgResultHTML();
  else {
    const q = qs[state.step];
    html += '<span class="step-tag">DECISION CHECK</span><h2>'+vwgEscape(q.title)+'</h2><p class="sub">'+
      vwgEscape(q.desc)+'</p><div class="choices">'+q.opts.map(function(x){
        return vwgChoice(x[0],x[1],x[1],x[2]);
      }).join("")+'</div>';
  }
  html += '</div><div class="actions">'+(navStack.length?'<button class="btn secondary" id="back">← Back</button>':'<span></span>')+
    (result?'<button class="btn primary" id="again">↻ Play another case</button>':
      '<button class="btn primary" id="next" '+(state.selected?"":"disabled")+'>Continue →</button>')+'</div>';
  $("#game").innerHTML = html;
  document.querySelectorAll("[data-value]").forEach(function(button){
    button.addEventListener("click",function(){state.selected=button.dataset.value;render();});
  });
  $("#next") && $("#next").addEventListener("click",function(){
    if (!state.selected) return;
    const current = vwgQuestionList()[state.step];
    if (!current) return;
    navStack.push(JSON.parse(JSON.stringify(state)));
    if (state[current.key] !== state.selected) vwgClearDependentState(current.key);
    state[current.key] = state.selected;
    state.selected = "";
    state.step += 1;
    render();
  });
  $("#back") && $("#back").addEventListener("click",function(){
    const previous = navStack.pop();
    if (previous) {Object.assign(state,previous);render();}
  });
  $("#again") && $("#again").addEventListener("click",function(){
    navStack.length = 0;
    Object.assign(state,{step:0,brand:"",type:"",status:"",transport:"",idBuzz:"",modelType:"",
      demo:"",skodaType:"",orderType:"",stockMatch:"",sameCustomer:"",lowerStockStatus:"",
      customerWaitLetter:"",audiStockStatus:"",audiSameModelGroup:"",motabilityLetter:"",
      motabilityFresh:"",selected:"",history:[]});
    render();
  });
}

render();

