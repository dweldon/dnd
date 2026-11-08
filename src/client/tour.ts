import { driver } from 'driver.js';

const KEY = 'tour-seen';

// Shows once per browser; any close counts as seen. Returns a cleanup.
export function startTour(): (() => void) | undefined {
  try {
    if (localStorage.getItem(KEY)) return;
  } catch {
    return;
  }
  const tour = driver({
    popoverClass: 'dnd-tour',
    showProgress: true,
    // Look, don't touch: keeps Send and drags out of the tour
    disableActiveInteraction: true,
    steps: [
      {
        popover: {
          title: 'Quick tour',
          description:
            "New here? Here's a 30-second look around. Close anytime with ✕.",
        },
      },
      {
        element: '#tour-abilities',
        popover: {
          title: 'Attack & Spells',
          description:
            'Click one, or drag it onto a monster or ally. No need to type out "attack" or "cast healing word".',
        },
      },
      {
        element: '#tour-items',
        popover: {
          title: 'Items',
          description:
            'Same idea: click an item or drag it onto a target. Saves you typing something like "use the healing potion on the wizard".',
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
            "The room you're in. If monsters show up, click one to set up an attack on it.",
        },
      },
      {
        element: '#tour-action',
        popover: {
          side: 'left',
          align: 'start',
          title: 'Your Action',
          description:
            'Every click fills in your action here. You can also manually type everything if you prefer. Nothing happens until you press Send, and you can only send on your turn.',
        },
      },
    ],
    onDestroyed: () => {
      try {
        localStorage.setItem(KEY, '1');
      } catch {}
    },
  });
  tour.drive();
  return () => tour.destroy();
}
