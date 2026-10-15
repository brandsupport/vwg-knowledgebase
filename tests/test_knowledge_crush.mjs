import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../src/pages/knowledge-crush.js", import.meta.url),
  "utf8",
);

test("wrong knowledge answers and expired timers end the run", () => {
  assert.match(source, /function finishButton\(good,q,card\)\{if\(!good\)\{endGame\(card\);return\}/);
  assert.match(source, /function endGame\(card\)\{gameOver=true;locked=true/);
  assert.match(source, /title\.textContent='GAME OVER'/);
  assert.match(source, /btn\.textContent='Restart game';btn\.disabled=false;btn\.onclick=\(\)=>resetGame\(\)/);
  assert.match(source, /if\(seconds<=0&&!answered\)\{clearInterval\(questionTimer\);questionTimer=null;[\s\S]*?finishButton\(false,q,card\)\}/);
});

test("game-over modal cannot be dismissed to keep playing, and restart resets the run", () => {
  assert.match(source, /function closeQuestion\(\)\{if\(gameOver\)return/);
  assert.match(source, /function resetGame\(\)[\s\S]*?gameOver=false;locked=false/);
  assert.match(source, /if\(locked&&!gameOver\)return;resetGame\(\)/);
  assert.match(source, /if\(locked\|\|gameOver\|\|blastCharges<=0\)return/);
});

test("Line Blast spends a charge without earning one from its own cleared row or cascades", () => {
  assert.match(source, /async function resolve\(set,awardBlastReward=true\)/);
  assert.match(source, /if\(awardBlastReward&&count>=4\)\{blastCharges=Math\.min\(3,blastCharges\+1\)/);
  assert.match(source, /async function blast\(\)[\s\S]*?blastCharges\--;[\s\S]*?await resolve\(set,false\)/);
  assert.match(source, /finally\{if\(!\$\('overlay'\)\.classList\.contains\('open'\)&&!gameOver\)locked=false;update\(\)\}/);
});
