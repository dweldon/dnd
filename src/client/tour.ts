import { driver } from 'driver.js';
import type { Character } from '../game/characters';
import { holdSpeech } from './speech';

const KEY = 'tour-seen';

// A typed command this hero might use, e.g. "cast magic missile on the goblin"
function example(c?: Character) {
  const a = c?.abilities.find(
    (a) => a.effect.kind !== 'weaken' && a.effect.area === 'one',
  );
  if (!a) return 'cast healing word on the wizard';
  const target = a.effect.kind === 'heal' ? 'the wizard' : 'the goblin';
  return `cast ${a.name.toLowerCase()} on ${target}`;
}

// Shows once per browser; can't be dismissed, only finished. Returns a cleanup.
export function startTour(c?: Character): (() => void) | undefined {
  try {
    if (localStorage.getItem(KEY)) return;
  } catch {
    return;
  }
  const release = holdSpeech();
  const tour = driver({
    popoverClass: 'dnd-tour',
    showProgress: true,
    // No ✕, Esc, or overlay click; Done on the last step still ends it
    allowClose: false,
    // Look, don't touch: keeps Send out of the tour
    disableActiveInteraction: true,
    steps: [
      {
        popover: {
          title: 'Quick tour',
          description: "New here? Here's a 30-second look around.",
        },
      },
      {
        element: '#tour-abilities',
        popover: {
          title: 'Attack & Spells',
          description: `Tap one to see what it does and pick a target. No need to type "${example(c)}".`,
        },
      },
      {
        element: '#tour-items',
        popover: {
          title: 'Items',
          description:
            'Same idea: tap an item to see what it does and who to use it on.',
        },
      },
      {
        element: '#tour-map',
        popover: {
          title: 'Map',
          description:
            'Shows where your party is. Click a lit arrow on the edge to head that way, rather than typing "move east".',
        },
      },
      {
        element: '#tour-room',
        popover: {
          title: 'The Room',
          description:
            "The room you're in. If monsters show up, click one to attack it.",
        },
      },
      {
        element: '#tour-action',
        popover: {
          side: 'left',
          align: 'start',
          title: 'Your Action',
          description:
            'On your turn, clicks happen right away. Otherwise they fill in your action here, ready to send when your turn comes. You can also type anything you like.',
        },
      },
    ],
    onDestroyed: () => {
      release();
      try {
        localStorage.setItem(KEY, '1');
      } catch {}
    },
  });
  tour.drive();
  // onDestroyed is skipped if destroyed before the first step settles
  return () => {
    tour.destroy();
    release();
  };
}
