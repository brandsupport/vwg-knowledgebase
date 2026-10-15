import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  RUNNER_LANES,
  TRAIN_MOTION_CONFIG,
  POWERUP_DROP_CONFIG,
  createObstacleWave,
  choosePowerupType,
  maybeSpawnWavePowerup,
  animateTrain,
  advanceIdleTrains,
  shuffleQuestionDeck,
} from "../knowledge-rush-prototype/gameplay-config.js";

function seededRandom(seed = 12345) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

test("obstacle waves preserve an open lane and never stack two obstacles in one lane", () => {
  const random = seededRandom(20261014);

  for (let waveIndex = 0; waveIndex < 180; waveIndex += 1) {
    const pattern = createObstacleWave(waveIndex, random);
    const occupiedLanes = pattern.map((obstacle) => obstacle.lane);

    assert.ok(pattern.length >= 1 && pattern.length <= 2);
    assert.equal(new Set(occupiedLanes).size, occupiedLanes.length);
    assert.ok(occupiedLanes.every((lane) => lane >= 0 && lane < RUNNER_LANES.length));
    assert.ok(RUNNER_LANES.length - new Set(occupiedLanes).size >= 1);
    assert.equal(pattern[0].type, waveIndex === 0 || waveIndex % 3 === 0
      ? "train"
      : pattern[0].type);
  }
});

test("the first train can appear in any of the three lanes", () => {
  const samples = [0.01, 0.5, 0.99].map((roll) => createObstacleWave(0, () => roll));
  assert.deepEqual(samples.map((wave) => wave[0].lane), [0, 1, 2]);
  assert.ok(samples.every((wave) => wave[0].type === "train"));
});

test("jetpack has a strictly lower drop weight than every other power-up", () => {
  const weights = POWERUP_DROP_CONFIG.weights;
  assert.equal(weights.jetpack, 1);
  assert.ok(Object.entries(weights)
    .filter(([type]) => type !== "jetpack")
    .every(([, weight]) => weight > weights.jetpack));
  assert.equal(choosePowerupType(() => 12.5 / 13), "jetpack");
});

test("pickup drops follow wave timing and use the selected open lane", () => {
  const pickups = [];
  const game = { spawnPowerup: (...args) => pickups.push(args) };
  const rolls = [0.1, 12.5 / 13];
  let rollIndex = 0;

  const spawned = maybeSpawnWavePowerup(
    game,
    1,
    [0, 2],
    TRAIN_MOTION_CONFIG.spawnZ,
    () => rolls[rollIndex++] ?? 0.1,
  );

  assert.equal(spawned, true);
  assert.deepEqual(pickups, [[0, TRAIN_MOTION_CONFIG.spawnZ + 18, "jetpack"]]);
});

test("train animation spins marked wheels around the axle and moves the train slightly", () => {
  const wheel = { userData: { trainWheel: true }, rotation: { y: Math.PI / 2, z: 0 } };
  const unrelatedPart = { userData: {}, rotation: { y: 0 } };
  const mesh = {
    position: { x: 0, z: -10 },
    rotation: { y: 0 },
    traverse(callback) {
      callback(wheel);
      callback(unrelatedPart);
    },
  };
  const train = { type: "train", lane: 1, mesh, elapsed: 0, approachMultiplier: 1.3 };

  animateTrain(train, 0.1);

  assert.ok(wheel.rotation.z > 0);
  assert.equal(wheel.rotation.y, Math.PI / 2);
  assert.equal(unrelatedPart.rotation.z, 0);
  assert.notEqual(mesh.position.x, RUNNER_LANES[1]);
  assert.ok(Math.abs(mesh.rotation.y) > 0);
});

test("idle trains are recycled to the far end of the track", () => {
  const mesh = {
    position: { x: RUNNER_LANES[0], z: 13 },
    rotation: { y: 0 },
    traverse() {},
  };
  const game = {
    obstacles: [{ type: "train", lane: 0, z: 13, mesh, elapsed: 0, approachMultiplier: 1.3 }],
  };

  advanceIdleTrains(game, 0.25);

  assert.equal(game.obstacles[0].z, TRAIN_MOTION_CONFIG.idleSpawnZ);
  assert.equal(mesh.position.z, TRAIN_MOTION_CONFIG.idleSpawnZ);
});

test("trains use a visibly faster approach and more pronounced motion", () => {
  assert.ok(TRAIN_MOTION_CONFIG.approachMin >= 1.7);
  assert.ok(TRAIN_MOTION_CONFIG.approachRange >= 0.4);
  assert.ok(TRAIN_MOTION_CONFIG.wheelRotationSpeed >= 24);
  assert.ok(TRAIN_MOTION_CONFIG.idleSpeed >= 12);
});

test("question decks include every prompt once and do not immediately repeat the previous prompt", () => {
  const questions = ["question A", "question B", "question C", "question D"];
  const deck = shuffleQuestionDeck(questions, seededRandom(314159), "question A");

  assert.deepEqual([...deck].sort(), [...questions].sort());
  assert.notEqual(deck[0], "question A");
});

test("live Knowledge Rush wiring shows shoes during super-jump and keeps question order across retries", () => {
  const source = readFileSync(
    new URL("../knowledge-rush-prototype/knowledge-rush.js", import.meta.url),
    "utf8",
  );

  assert.match(source, /attachSuperJumpShoes\(this\.runner,this\.powerupMaterials\.superJump\)/);
  assert.match(source, /this\.superJumpShoes\.forEach\(\(\{mesh\}\)=>mesh\.visible=this\.superJumpTime>0\)/);
  assert.match(source, /this\.runner\.group\.rotation\.set\(0,Math\.PI,0\)/);
  assert.match(source, /shuffleQuestionDeck\(gameQuestions,Math\.random,currentQuestion\)/);
  assert.doesNotMatch(source, /function U\(\)\{continueChances=3,questionPointer=0/);
});
