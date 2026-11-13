import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("src/pages/detag-challenge.js", "utf8");
const nodes = new Map();
function makeNode() {
  return {
    style: {},
    textContent: "",
    innerHTML: "",
    classList: { add() {} },
    addEventListener() {},
  };
}
const document = {
  querySelector(selector) {
    if (!nodes.has(selector)) nodes.set(selector, makeNode());
    return nodes.get(selector);
  },
  querySelectorAll() {
    return [];
  },
};
const window = { scrollTo() {} };
const context = { document, window, setInterval() {}, Math };
vm.runInNewContext(source, context, { filename: "detag-challenge.js" });
const resolve = window.VWGDetagChallengeRules.resolveCase;

const cases = [
  ["VWPC P-10 ID removes grant and de-allocates",
    {brand:"VWPC",type:"Retailer",status:"P-10",demo:"No",modelType:"ID",stockMatch:"No"},
    r => !r.stop && /de-allocate/.test(r.action) && /GOV grant/.test(r.action) && /No evidence/.test(r.evidence)],
  ["VWPC P-10 normal model remains in retailer stock",
    {brand:"VWPC",type:"Retailer",status:"P-10",demo:"No",modelType:"Normal",stockMatch:"No"},
    r => !r.stop && /retailer stock/.test(r.action) && !/GOV grant/.test(r.action)],
  ["VWPC 20-30 requires order form or cancellation letter",
    {brand:"VWPC",type:"Retailer",status:"20-30",demo:"No",stockMatch:"No"},
    r => !r.stop && /order form or cancellation letter/.test(r.evidence) && /add a note/.test(r.action)],
  ["VWPC demo has no evidence requirement",
    {brand:"VWPC",type:"Retailer",status:"20-30",demo:"Yes",stockMatch:"No"},
    r => !r.stop && /No proof/.test(r.evidence)],
  ["VWPC 36-40 without TO adds CO and EDE for 24 hours",
    {brand:"VWPC",type:"Retailer",status:"36-40",demo:"No",transport:"No",stockMatch:"No"},
    r => !r.stop && /Consignment/.test(r.action) && /Mandatory Block/.test(r.action) && /24 hours/.test(r.action) && r.notes.some(n => /re-tag/i.test(n))],
  ["VWPC 36-40 with TO does not add mandatory block",
    {brand:"VWPC",type:"Retailer",status:"36-40",demo:"No",transport:"Yes",stockMatch:"No"},
    r => !r.stop && /do NOT add a mandatory block/.test(r.action)],
  ["VWPC Motability letter failing 7-day age gate stops",
    {brand:"VWPC",type:"Retailer",status:"36-40",demo:"No",transport:"No",motabilityLetter:"Yes",motabilityFresh:"No",stockMatch:"No"},
    r => r.stop],
  ["VWPC Motability letter meeting 7-day age gate can continue",
    {brand:"VWPC",type:"Retailer",status:"36-40",demo:"No",transport:"No",motabilityLetter:"Yes",motabilityFresh:"Yes",stockMatch:"No"},
    r => !r.stop],
  ["VWPC stock match must be same customer",
    {brand:"VWPC",type:"Retailer",status:"20-30",demo:"No",stockMatch:"Yes",sameCustomer:"No"},
    r => r.stop],
  ["VWPC 40-70 with TO is de-tag only without a mandatory block",
    {brand:"VWPC",type:"Retailer",status:"40-70",demo:"No",transport:"Yes",stockMatch:"No"},
    r => !r.stop && /do NOT add a mandatory block/.test(r.action)],
  ["VWPC 40-70 without TO is not defined and stops",
    {brand:"VWPC",type:"Retailer",status:"40-70",demo:"No",transport:"No",stockMatch:"No"},
    r => r.stop],

  ["VWCV ID Buzz is rejected and CV0678-22 is requested",
    {brand:"VWCV",type:"Retailer",status:"P-10",idBuzz:"Yes"},
    r => r.stop && r.notes.join(" ").includes("CV0678-22")],
  ["VWCV normal P-10 requires order form or cancellation letter",
    {brand:"VWCV",type:"Retailer",status:"P-10",demo:"No",idBuzz:"No",stockMatch:"No"},
    r => !r.stop && /order form or cancellation letter/.test(r.evidence) && /do NOT de-allocate/.test(r.action)],
  ["VWCV demo has no evidence requirement",
    {brand:"VWCV",type:"Retailer",status:"20-30",demo:"Yes",idBuzz:"No",stockMatch:"No"},
    r => !r.stop && /No proof/.test(r.evidence)],
  ["VWCV 36-40 without TO adds CO and EDE",
    {brand:"VWCV",type:"Retailer",status:"36-40",demo:"No",idBuzz:"No",transport:"No",stockMatch:"No"},
    r => !r.stop && /Consignment/.test(r.action) && /Mandatory Block/.test(r.action)],
  ["VWCV Motability letter failing age gate stops",
    {brand:"VWCV",type:"Retailer",status:"36-40",demo:"No",idBuzz:"No",transport:"No",motabilityLetter:"Yes",motabilityFresh:"No",stockMatch:"No"},
    r => r.stop],

  ...["00","01","02","03","04","06","07"].map(orderType => [
    "Škoda order type " + orderType + " de-allocates",
    {brand:"SKODA",type:"Retailer",status:"P-10",demo:"No",orderType,skodaType:"Normal",stockMatch:"No"},
    r => !r.stop && /de-allocate/.test(r.action) && !/do NOT/.test(r.action),
  ]),
  ["Škoda order type 05 is normal de-tag and does not de-allocate",
    {brand:"SKODA",type:"Retailer",status:"P-10",demo:"No",orderType:"05",skodaType:"Normal",stockMatch:"No"},
    r => !r.stop && /do NOT de-allocate/.test(r.action)],
  ["Škoda demo has no evidence requirement",
    {brand:"SKODA",type:"Retailer",status:"20-30",demo:"Yes",orderType:"05",stockMatch:"No"},
    r => !r.stop && /No proof/.test(r.evidence)],
  ["Škoda Motability letter failing age gate stops",
    {brand:"SKODA",type:"Retailer",status:"P-10",demo:"No",orderType:"05",skodaType:"Motability",motabilityFresh:"No",stockMatch:"No"},
    r => r.stop],
  ["Škoda 36-40 without TO adds MT and EDE",
    {brand:"SKODA",type:"Retailer",status:"36-40",demo:"No",skodaType:"Normal",transport:"No",stockMatch:"No"},
    r => !r.stop && /Protected from Mandatory/.test(r.action) && /Mandatory Block/.test(r.action)],
  ["Škoda lower-status stock match needs customer wait letter",
    {brand:"SKODA",type:"Retailer",status:"20-30",demo:"No",orderType:"05",skodaType:"Normal",stockMatch:"Yes",sameCustomer:"Yes",lowerStockStatus:"Yes",customerWaitLetter:"No"},
    r => r.stop],
  ["Škoda lower-status stock match passes with customer wait letter",
    {brand:"SKODA",type:"Retailer",status:"20-30",demo:"No",orderType:"05",skodaType:"Normal",stockMatch:"Yes",sameCustomer:"Yes",lowerStockStatus:"Yes",customerWaitLetter:"Yes"},
    r => !r.stop && r.notes.some(n => /accepts the wait/.test(n))],

  ["Audi P-10 de-tags to 07 and remains in retailer stock",
    {brand:"AUDI",type:"Retailer",status:"P-10",demo:"No",audiCancelledEtronRS:"No",stockMatch:"No"},
    r => !r.stop && /status 07/.test(r.action) && /retailer stock/.test(r.action)],
  ["Audi 20-30 de-tags to 07 and remains in Centre stock",
    {brand:"AUDI",type:"Retailer",status:"20-30",demo:"No",audiCancelledEtronRS:"No",stockMatch:"No"},
    r => !r.stop && /status 07/.test(r.action) && /Centre/.test(r.action)],
  ["Audi 36-40 without TO adds MT and EDE",
    {brand:"AUDI",type:"Retailer",status:"36-40",demo:"No",audiCancelledEtronRS:"No",transport:"No",stockMatch:"No"},
    r => !r.stop && /Protected from Mandatory/.test(r.action) && /Mandatory Block/.test(r.action)],
  ["Audi stock match behind original status is rejected",
    {brand:"AUDI",type:"Retailer",status:"P-10",demo:"No",audiCancelledEtronRS:"No",stockMatch:"Yes",audiStockStatus:"Behind",audiSameModelGroup:"Yes"},
    r => r.stop],
  ["Audi stock match outside model group is rejected",
    {brand:"AUDI",type:"Retailer",status:"P-10",demo:"No",audiCancelledEtronRS:"No",stockMatch:"Yes",audiStockStatus:"Ahead",audiSameModelGroup:"No"},
    r => r.stop],
  ["Audi stock match passes when status and model-group checks pass",
    {brand:"AUDI",type:"Retailer",status:"P-10",demo:"No",audiCancelledEtronRS:"No",stockMatch:"Yes",audiStockStatus:"Ahead",audiSameModelGroup:"Yes"},
    r => !r.stop && r.notes.some(n => /model-group/.test(n))],
  ["Audi cancelled e-tron/RS documentation exemption is conditional",
    {brand:"AUDI",type:"Retailer",status:"20-30",demo:"No",audiCancelledEtronRS:"Yes",stockMatch:"No"},
    r => !r.stop && /No documentation is required/.test(r.evidence)],
  ["Audi other cases are sent to procedure verification for evidence",
    {brand:"AUDI",type:"Retailer",status:"20-30",demo:"No",audiCancelledEtronRS:"No",stockMatch:"No"},
    r => !r.stop && /verify the evidence requirement/.test(r.evidence)],

  ["SEAT/CUPRA routes to UK Team for the case",
    {brand:"SEAT/CUPRA",type:"Retailer",status:"40-70",demo:"No"},
    r => !r.stop && /UK Team/.test(r.action)],
  ["SEAT/CUPRA demo has no evidence requirement",
    {brand:"SEAT/CUPRA",type:"Retailer",status:"P-10",demo:"Yes"},
    r => !r.stop && /No proof/.test(r.evidence)],

  ["Existing Agency 36-38 no-TO guidance remains available",
    {brand:"VWPC",type:"Agency",status:"36-38",transport:"No"},
    r => !r.stop && /Detag & Deallocate/.test(r.action)],
  ["Unlisted Agency transport-order combination stops rather than guessing",
    {brand:"VWPC",type:"Agency",status:"36-38",transport:"Yes"},
    r => r.stop],
];

for (const [name, input, predicate] of cases) {
  test(name, () => {
    const result = resolve(input);
    assert.equal(predicate(result), true, JSON.stringify(result));
  });
}
