// Texto do relato para cada evento da partida.
import { t } from '../i18n/index.js';

export function describeEvent(e, m) {
  const team = e.side ? m[e.side].name : '';
  // Quem saiu de campo (expulso, substituído) continua com nome no relato.
  const player = e.playerId ? [...m[e.side].lineup, ...(m.sentOff ?? []), ...(m.subbedOff ?? [])].find((p) => p?.id === e.playerId)?.name : '';
  switch (e.type) {
    case 'kickoff': return e.minute === 0 ? t('event.kickoff') : null;
    case 'halftime': return t('event.halftime');
    case 'fulltime': return t('event.fulltime');
    case 'highlight': return t('event.highlight', { team });
    case 'corner': return t('event.corner', { team });
    case 'freekick': return t('event.freekick', { team });
    case 'goal': return t(e.kind === 'penalty' ? 'event.goal.penalty' : 'event.goal', { team, player });
    case 'yellow': return t('event.yellow', { player });
    case 'red': return t(e.second ? 'event.red.second' : 'event.red', { player });
    case 'injury': return t('event.injury', { player });
    case 'chance':
      if (e.outcome === 'saved') return t('event.saved', { player });
      if (e.outcome === 'wide') return t('event.wide', { player });
      return null;
    default: return null;
  }
}
