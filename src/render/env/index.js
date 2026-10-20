// Ambiente completo do lance: luz, gramado, gols, estádio e bola.
import { createLighting } from './lighting.js';
import { createGrass } from './grass.js';
import { createGoals } from './goal.js';
import { createStadium } from './stadium.js';
import { createBall } from './ball.js';

export function createEnvironment(renderer, scene, teams) {
  const lighting = createLighting(renderer, scene);
  const grass = createGrass();
  const goals = createGoals();
  const stadium = createStadium(teams);
  const ball = createBall();
  scene.add(grass, goals.group, stadium.group, ball.mesh);
  let t = 0;
  return {
    ball,
    netHit: (side) => goals.netHit(side),
    setQuality({ shadows, crowd }) { lighting.setShadows(shadows); stadium.setCrowd(crowd); },
    update(dt, focus, worldBall) {
      t += dt;
      lighting.follow(focus);
      goals.update(t, dt);
      stadium.update(t);
      ball.update(worldBall, dt);
    },
    info: () => ({ sky: !!scene.getObjectByName('sky'), grass: grass.userData.info, ...goals.info, ...stadium.info, ball: ball.info }),
  };
}
