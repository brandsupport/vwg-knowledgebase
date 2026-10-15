/**
 * Gameplay configuration and deterministic helpers for Knowledge Rush.
 *
 * Keep lane patterns, train approach/animation, and pickup rarity here so these
 * rules can be reviewed and tested independently from the Three.js renderer.
 */
export const RUNNER_LANES = Object.freeze([-3.2, 0, 3.2]);

export const TRAIN_MOTION_CONFIG = Object.freeze({
  spawnZ: -82,
  approachMin: 1.78,
  approachRange: 0.48,
  wheelRotationSpeed: 24,
  swayAmplitude: 0.12,
  swayFrequency: 3.6,
  collisionHalfLength: 5.55,
  idleSpeed: 14,
  idleRecycleZ: 14,
  idleSpawnZ: -70,
});

export const POWERUP_DROP_CONFIG = Object.freeze({
  waveInterval: 3,
  waveOffset: 1,
  chance: 0.9,
  travelOffset: 18,
  // Jetpack is deliberately the rarest pickup: 1 weight vs 4 for each other type.
  weights: Object.freeze({
    magnet: 4,
    doubleScore: 4,
    superJump: 4,
    jetpack: 1,
  }),
});

/**
 * Produce one or two obstacles while always preserving at least one open lane.
 * Trains are intentionally common enough to make the railway feel active, but
 * wave 0 and every third wave guarantee an approaching train.
 */
export function createObstacleWave(waveIndex, random = Math.random) {
  const lane = Math.floor(random() * RUNNER_LANES.length);
  const trainIsPrimary =
    waveIndex === 0 ||
    waveIndex % 3 === 0 ||
    (waveIndex > 5 && random() < 0.22);
  const primaryType = trainIsPrimary
    ? "train"
    : random() < 0.5
      ? "barrier"
      : "gate";

  const wave = [{ lane, type: primaryType }];

  if (waveIndex > 2 && random() > 0.55) {
    const secondLane =
      (lane + 1 + Math.floor(random() * (RUNNER_LANES.length - 1))) %
      RUNNER_LANES.length;
    const secondType =
      random() < (trainIsPrimary ? 0.72 : 0.25)
        ? "train"
        : random() < 0.5
          ? "barrier"
          : "gate";

    wave.push({ lane: secondLane, type: secondType });
  }

  return wave;
}

/** Choose a pickup using explicit relative weights. */
export function choosePowerupType(random = Math.random) {
  const entries = Object.entries(POWERUP_DROP_CONFIG.weights);
  const totalWeight = entries.reduce((total, [, weight]) => total + weight, 0);
  let roll = random() * totalWeight;

  for (const [type, weight] of entries) {
    roll -= weight;
    if (roll < 0) return type;
  }

  return entries[0][0];
}

/**
 * Keep pickup timing and rarity policy out of the main game loop.
 * A normal pickup wave is eligible every third obstacle wave; no wave guarantees
 * a jetpack, so it remains rare even during long runs.
 */
export function maybeSpawnWavePowerup(
  game,
  waveIndex,
  openLanes,
  spawnZ,
  random = Math.random,
) {
  const config = POWERUP_DROP_CONFIG;
  if (
    !openLanes.length ||
    waveIndex % config.waveInterval !== config.waveOffset ||
    random() >= config.chance
  ) {
    return false;
  }

  const lane = openLanes[(waveIndex + 1) % openLanes.length];
  game.spawnPowerup(
    lane,
    spawnZ + config.travelOffset,
    choosePowerupType(random),
  );
  return true;
}

/** Update the distinct visual cues that make an approaching train feel in motion. */
export function animateTrain(obstacle, deltaSeconds, lanes = RUNNER_LANES) {
  if (obstacle.type !== "train") return;

  obstacle.elapsed = (obstacle.elapsed || 0) + deltaSeconds;
  const sway = Math.sin(obstacle.elapsed * TRAIN_MOTION_CONFIG.swayFrequency);

  obstacle.mesh.position.x =
    lanes[obstacle.lane] + sway * TRAIN_MOTION_CONFIG.swayAmplitude;
  obstacle.mesh.position.y = 0.02 + Math.abs(sway) * 0.025;
  obstacle.mesh.rotation.y = sway * 0.035;

  obstacle.mesh.traverse((part) => {
    if (part.userData.trainWheel) {
      // The wheel is a torus whose local Z axis is rotated onto the train's X axle.
      // Spin around that local Z axis, not Y (which would tilt the wheel).
      part.rotation.z +=
        deltaSeconds *
        TRAIN_MOTION_CONFIG.wheelRotationSpeed *
        obstacle.approachMultiplier;
    }
  });
}

/** Give the start-screen demo trains subtle motion without starting a run. */
export function advanceIdleTrains(game, deltaSeconds, lanes = RUNNER_LANES) {
  for (const obstacle of game.obstacles) {
    if (obstacle.type !== "train") continue;

    obstacle.z += deltaSeconds * TRAIN_MOTION_CONFIG.idleSpeed;
    if (obstacle.z > TRAIN_MOTION_CONFIG.idleRecycleZ) {
      obstacle.z = TRAIN_MOTION_CONFIG.idleSpawnZ;
    }

    obstacle.mesh.position.z = obstacle.z;
    animateTrain(obstacle, deltaSeconds, lanes);
  }
}

/**
 * Return every question exactly once in a randomized deck. When a deck is
 * refreshed, keep the previous question out of the first slot to avoid an
 * immediate repeat at the cycle boundary.
 */
export function shuffleQuestionDeck(questions, random = Math.random, previousQuestion = null) {
  const deck = [...questions];

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(random() * (index + 1));
    [deck[index], deck[otherIndex]] = [deck[otherIndex], deck[index]];
  }

  if (deck.length > 1 && deck[0] === previousQuestion) {
    const otherIndex = 1 + Math.floor(random() * (deck.length - 1));
    [deck[0], deck[otherIndex]] = [deck[otherIndex], deck[0]];
  }

  return deck;
}
