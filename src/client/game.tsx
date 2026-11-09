import {
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';
import { CHARACTERS, type Character } from '../game/characters';
import { ITEMS, type Item } from '../game/items';
import { TITLE } from '../game/story';
import type { Effect } from '../game/types';
import type { View } from '../game/view';
import { Compass } from './map';
import { soundOn, speechOn } from './settings';
import { startTour } from './tour';
import {
  art,
  describeBonus,
  describeEffect,
  HpBar,
  InfoCard,
  Panel,
  Portrait,
  ResetButton,
  type Send,
  Toggle,
  useScrollToEnd,
  useSecretReset,
} from './ui';

type Props = {
  view: View;
  thinking: boolean;
  voice: boolean;
  error: string | null;
  send: Send;
};

type Act = (text: string) => void;

// Who an attack, ability, or item can be aimed at
type Target = 'foe' | 'ally' | 'foes' | 'party' | 'self';

function targetOf(effect: Effect): Target {
  switch (effect.kind) {
    case 'weaken':
      return 'foe';
    case 'damage':
      return effect.area === 'one' ? 'foe' : 'foes';
    case 'heal':
      return effect.area === 'one' ? 'ally' : effect.area;
  }
}

// A selectable attack, ability, or item; passive gear has no target
type Option = {
  key: string;
  title: string;
  icon?: string;
  text: string;
  stats: string[];
  command: string;
  target: Target | null;
  wait: number;
};

const turns = (n: number) => `${n} turn${n > 1 ? 's' : ''}`;

const aimText = (command: string, name: string) =>
  command === 'attack' ? `attack ${name}` : `${command} on ${name}`;

const clickable = 'cursor-pointer select-none';

// Touch screens pop up a keyboard on focus, so skip it there
const isTouch = () => matchMedia('(pointer: coarse)').matches;

export function Game({ view, thinking, voice, error, send }: Props) {
  const myTurn = view.turn === view.you;
  const canAct = myTurn && !thinking;
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);

  // Replace the draft, flash the box, and bring it into view
  const fill = (text: string) => {
    setDraft(text);
    const el = input.current;
    if (!el) return;
    el.classList.remove('fill-flash');
    void el.offsetWidth; // restart the animation
    el.classList.add('fill-flash');
    requestAnimationFrame(() => {
      if (isTouch()) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } else {
        el.focus();
        el.setSelectionRange(text.length, text.length);
      }
    });
  };
  // On your turn a click acts; otherwise it waits in the draft
  const act = (text: string) => {
    if (canAct) send({ type: 'chat', text });
    else fill(text);
  };

  useEffect(() => {
    if (canAct && !isTouch()) input.current?.focus();
  }, [canAct]);

  // After the focus effect so the popover keeps focus
  useEffect(
    () => startTour(view.you ? CHARACTERS[view.you] : undefined),
    [view.you],
  );

  // Flag the browser tab so players in other tabs notice
  useEffect(() => {
    document.title = myTurn ? `⚔ Your turn! · ${TITLE}` : TITLE;
  }, [myTurn]);

  return (
    <div className="flex flex-col lg:h-screen">
      {/* Keyed per turn so the flash replays each time */}
      {myTurn && <div key={view.turnEndsAt} className="turn-flash" />}
      <Header view={view} thinking={thinking} voice={voice} send={send} />
      <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[17rem_auto_minmax(20rem,1fr)]">
        <div className="min-h-0 space-y-3 overflow-y-auto">
          <You view={view} act={act} />
          <Party view={view} act={act} />
        </div>
        <div className="min-h-0 space-y-3 overflow-y-auto">
          <Panel id="tour-map" title="Map">
            <Compass view={view} act={act} />
          </Panel>
          <Room view={view} act={act} />
        </div>
        <div className="flex min-h-0 flex-col gap-3">
          <Command
            thinking={thinking}
            error={error}
            send={send}
            myTurn={myTurn}
            draft={draft}
            setDraft={setDraft}
            input={input}
            act={act}
          />
          <Chat view={view} thinking={thinking} />
        </div>
      </div>
    </div>
  );
}

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

// Title, whose turn it is with a countdown, and reset
function Header({
  view,
  thinking,
  voice,
  send,
}: {
  view: View;
  thinking: boolean;
  voice: boolean;
  send: Send;
}) {
  const now = useNow();
  const secs = Math.max(0, Math.ceil((view.turnEndsAt - now) / 1000));
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const active = view.players.find((p) => p.characterId === view.turn);
  const reset = useSecretReset();
  const [sound, setSound] = soundOn.use();
  const [speech, setSpeech] = speechOn.use();
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 px-4 py-2">
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: hidden reset gesture */}
      <h1
        className="font-pixel text-xs text-amber-300 select-none sm:text-sm"
        onClick={reset.onClick}
      >
        {TITLE}
      </h1>
      <div className="flex items-center gap-3">
        {view.turn === view.you ? (
          <span className="animate-pulse font-pixel text-xs text-amber-300">
            Your turn!
          </span>
        ) : (
          <span className="text-stone-300">{active?.name}'s turn</span>
        )}
        <span className="text-sm text-stone-500 tabular-nums">{clock}</span>
        <Toggle label="Sound" on={sound} onChange={setSound} />
        {voice && <Toggle label="Speech" on={speech} onChange={setSpeech} />}
        {thinking && (
          <span className="text-sm text-sky-300 italic">DM is thinking…</span>
        )}
      </div>
      {reset.shown && <ResetButton send={send} />}
    </header>
  );
}

// Your hero: HP, attack, abilities with cooldowns, items, and a target picker
function You({ view, act }: { view: View; act: Act }) {
  const [selKey, setSelKey] = useState<string | null>(null);
  // Close the details box when clicking elsewhere
  useEffect(() => {
    if (!selKey) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as Element).closest('[data-keep-open]')) setSelKey(null);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [selKey]);
  const me = view.players.find((p) => p.characterId === view.you);
  if (!me) return null;
  const c: Character = CHARACTERS[me.characterId];
  const { bonus } = me;

  const attack: Option = {
    key: 'attack',
    title: c.attack.name,
    text: 'Your basic attack.',
    stats: [
      `+${c.attack.bonus + bonus.attack} to hit`,
      `Damage ${c.attack.damage}${bonus.damage ? `+${bonus.damage}` : ''}`,
      'One enemy',
      'Usable every turn',
    ],
    command: 'attack',
    target: 'foe',
    wait: 0,
  };
  const abilities: Option[] = c.abilities.map((a) => {
    const wait = me.cooldowns[a.id] ?? 0;
    return {
      key: a.id,
      title: a.name,
      text: a.description,
      stats: [
        ...describeEffect(a.effect),
        `Usable every ${a.cooldown + 1} turns`,
      ],
      command: `cast ${a.name}`,
      target: targetOf(a.effect),
      wait,
    };
  });
  const items: Option[] = me.items.map((id, i) => {
    const item: Item = ITEMS[id];
    return {
      key: `${id}-${i}`, // items can repeat
      title: item.name,
      icon: item.icon,
      text: item.description,
      stats: item.effect
        ? [...describeEffect(item.effect), 'Single use']
        : [describeBonus(item.bonus ?? {}), 'Always active'],
      command: `use ${item.name}`,
      target: item.effect ? targetOf(item.effect) : null,
      wait: 0,
    };
  });
  // Derived so a used-up item drops its selection
  const sel = [attack, ...abilities, ...items].find((o) => o.key === selKey);
  const toggle = (o: Option) => setSelKey(sel?.key === o.key ? null : o.key);
  const ring = (o: Option) =>
    sel?.key === o.key ? 'bg-amber-500/15 ring-1 ring-amber-400' : '';

  return (
    <Panel title="You">
      <div className="flex gap-3">
        <Portrait src={c.portrait} size={96} hp={me.hp} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="leading-tight font-semibold">{c.name}</div>
          <div className="text-xs text-amber-200/80">
            {c.race} {c.className} · AC {c.ac + bonus.ac}
          </div>
          <HpBar hp={me.hp} max={me.maxHp} />
          {me.hp === 0 && (
            <div className="text-xs text-red-400">Down! Waiting for help.</div>
          )}
        </div>
      </div>

      <ul id="tour-abilities" className="mt-3 space-y-1.5 text-sm">
        {[attack, ...abilities].map((o) => (
          <li key={o.key}>
            <button
              type="button"
              data-keep-open
              onClick={() => toggle(o)}
              className={`-mx-1 flex w-[calc(100%+0.5rem)] items-center justify-between gap-2 rounded px-1 text-left hover:bg-stone-800/70 ${clickable} ${ring(o)}`}
            >
              <span className={o.wait ? 'text-stone-500' : ''}>
                {o.title}{' '}
                {o === attack && (
                  <span className="text-xs text-stone-500">
                    {c.attack.damage}
                  </span>
                )}
              </span>
              <Chip ready={!o.wait}>
                {o === attack ? 'Always' : o.wait ? turns(o.wait) : 'Ready'}
              </Chip>
            </button>
          </li>
        ))}
      </ul>

      <div id="tour-items" className="mt-3 flex flex-wrap gap-2">
        {items.map((o) => (
          <button
            key={o.key}
            type="button"
            data-keep-open
            onClick={() => toggle(o)}
            className={`flex items-center gap-1.5 rounded border border-stone-700 bg-stone-800 px-1.5 py-1 text-xs hover:border-stone-500 hover:bg-stone-700 ${clickable} ${ring(o)}`}
          >
            <img
              src={art(o.icon ?? '')}
              alt=""
              width={24}
              height={24}
              className="pixel"
            />
            {o.title}
          </button>
        ))}
        {!items.length && (
          <span className="text-xs text-stone-500">No items</span>
        )}
      </div>
      {sel && (
        <Targets
          key={sel.key}
          opt={sel}
          view={view}
          pick={(text) => {
            act(text);
            setSelKey(null);
          }}
        />
      )}
    </Panel>
  );
}

const pickButton =
  'flex items-center gap-1.5 rounded border border-sky-500/60 bg-sky-500/10 px-2 py-1 text-xs text-sky-100 hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:border-stone-700 disabled:bg-transparent disabled:text-stone-500';

// Details for the selected option and who it can be used on
function Targets({
  opt,
  view,
  pick,
}: {
  opt: Option;
  view: View;
  pick: (text: string) => void;
}) {
  const monsters = view.room?.monsters ?? [];
  const off = opt.wait > 0;

  const button = (label: ReactNode, text: string, key?: string) => (
    <button
      key={key}
      type="button"
      disabled={off}
      onClick={() => pick(text)}
      className={pickButton}
    >
      {label}
    </button>
  );
  const none = <p className="text-xs text-stone-500">No targets here</p>;

  const single = (names: { key: string; name: string; tag?: string }[]) =>
    names.length ? (
      <div className="flex flex-wrap gap-1.5">
        {names.map((n) =>
          button(
            <>
              {n.name}
              {n.tag && <Tag down={n.tag === 'Down'}>{n.tag}</Tag>}
            </>,
            aimText(opt.command, n.name),
            n.key,
          ),
        )}
      </div>
    ) : (
      none
    );

  // Everyone affected at once, confirmed with one button
  const group = (names: string[], label: string) =>
    names.length ? (
      <>
        <div className="mb-1.5 rounded border border-dashed border-sky-500/60 p-1.5">
          <div className="mb-1 text-[10px] text-sky-300 uppercase">
            Affects everyone
          </div>
          <div className="flex flex-wrap gap-1.5">
            {names.map((n) => (
              <span
                key={n}
                className="rounded bg-stone-800 px-1.5 py-0.5 text-xs"
              >
                {n}
              </span>
            ))}
          </div>
        </div>
        {button(label, opt.command)}
      </>
    ) : (
      none
    );

  const foes = monsters.map((m) => ({ key: m.id, name: m.name }));
  // You first, then alphabetical
  const party = view.players.toSorted(
    (a, b) =>
      Number(b.characterId === view.you) - Number(a.characterId === view.you) ||
      a.name.localeCompare(b.name),
  );
  const allies = party.map((p) => ({
    key: p.characterId,
    name: p.name,
    tag: p.hp === 0 ? 'Down' : p.characterId === view.you ? 'You' : undefined,
  }));
  const choices =
    opt.target &&
    {
      foe: () => single(foes),
      ally: () => single(allies),
      foes: () =>
        group(
          monsters.map((m) => m.name),
          'Hit all enemies',
        ),
      party: () =>
        group(
          party.map((p) => p.name),
          'Heal whole party',
        ),
      self: () => button('On yourself', opt.command),
    }[opt.target];

  return (
    <div
      data-keep-open
      className="tooltip mt-3 rounded-lg border border-amber-500/40 bg-stone-950/60 p-3 text-xs"
    >
      <InfoCard
        title={opt.title}
        icon={opt.icon}
        text={opt.text}
        stats={opt.stats}
      />
      {choices && (
        <div className="mt-2 border-t border-stone-700 pt-2">
          <div className="mb-1.5 text-stone-400">
            {off ? `Ready in ${turns(opt.wait)}` : 'Choose a target:'}
          </div>
          {choices()}
        </div>
      )}
    </div>
  );
}

function Chip({ ready, children }: { ready: boolean; children: ReactNode }) {
  return (
    <span
      className={`shrink-0 rounded px-1.5 text-[11px] ${ready ? 'bg-emerald-500/20 text-emerald-300' : 'bg-stone-700 text-stone-400'}`}
    >
      {children}
    </span>
  );
}

function Party({ view, act }: { view: View; act: Act }) {
  return (
    <Panel title="Party">
      <ul className="space-y-2">
        {view.players.map((p) => {
          const c: Character = CHARACTERS[p.characterId];
          const active = p.characterId === view.turn;
          const down = p.hp === 0;
          return (
            // biome-ignore lint/a11y/useKeyWithClickEvents: mouse shortcut; typing still works
            <li
              key={p.characterId}
              onClick={down ? () => act(`revive ${p.name}`) : undefined}
              className={`flex items-center gap-2 rounded p-1 ${active ? 'bg-amber-500/10 ring-1 ring-amber-400' : ''} ${down ? clickable : ''}`}
            >
              <Portrait src={c.portrait} size={40} hp={p.hp} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="truncate">{p.name}</span>
                  {p.characterId === view.you && <Tag>You</Tag>}
                  {down && <Tag down>Down</Tag>}
                </div>
                <HpBar hp={p.hp} max={p.maxHp} />
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function Tag({
  down = false,
  children,
}: {
  down?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`shrink-0 rounded px-1 text-[10px] uppercase ${down ? 'bg-red-500/30 text-red-200' : 'bg-stone-700 text-stone-300'}`}
    >
      {children}
    </span>
  );
}

// Current room and its monsters
function Room({ view, act }: { view: View; act: Act }) {
  const { room } = view;
  return (
    <Panel id="tour-room" title={room?.name ?? 'Corridor'} className="min-w-0">
      {room ? (
        <>
          <p className="text-xs text-stone-400">{room.description}</p>
          {room.hint && (
            <p className="mt-1 text-xs text-sky-300/80 italic">{room.hint}</p>
          )}
          {room.riddle && (
            <p className="mt-1 text-xs text-amber-300/90">
              Riddle: {room.riddle}
            </p>
          )}
        </>
      ) : (
        <p className="text-xs text-stone-400">A twisty stone passage.</p>
      )}
      {room?.monsters.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {room.monsters.map((m) => (
            // biome-ignore lint/a11y/noStaticElementInteractions: mouse shortcuts; typing still works
            // biome-ignore lint/a11y/useKeyWithClickEvents: mouse shortcuts; typing still works
            <div
              key={m.id}
              onClick={() => act(aimText('attack', m.name))}
              className={`max-w-64 min-w-40 flex-1 rounded border border-red-900/60 bg-red-950/30 p-2 ${clickable}`}
            >
              <div className="flex items-center gap-2">
                <img
                  src={art(m.art)}
                  alt=""
                  width={40}
                  height={40}
                  className="pixel"
                />
                <div className="min-w-0 text-sm">
                  <div className="leading-tight break-words">{m.name}</div>
                  {m.stunned && <Tag>Stunned</Tag>}
                </div>
              </div>
              <HpBar hp={m.hp} max={m.maxHp} />
            </div>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}

// Shared DM log
function Chat({ view, thinking }: { view: View; thinking: boolean }) {
  const last = view.chat.at(-1);
  const log = useScrollToEnd(`${view.chat.length}|${last?.text}|${thinking}`);
  const me = view.players.find((p) => p.characterId === view.you);

  return (
    <Panel
      title="Dungeon Master"
      className="flex max-h-[70svh] min-h-80 flex-1 flex-col lg:max-h-none"
    >
      <div ref={log} className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {view.chat.map((m, i) => (
          <p
            // biome-ignore lint/suspicious/noArrayIndexKey: append-only log
            key={i}
            className={`text-sm whitespace-pre-wrap ${m.from === 'DM' ? 'text-amber-100' : 'rounded bg-stone-800 px-2 py-1 text-sky-200'}`}
          >
            <span
              className={`mr-2 font-semibold ${m.from === 'DM' ? 'text-amber-400' : m.from === me?.name ? 'text-emerald-300' : 'text-sky-400'}`}
            >
              {m.from}:
            </span>
            {m.text}
          </p>
        ))}
        {thinking && (
          <p className="animate-pulse text-sm text-sky-300 italic">
            The DM is thinking…
          </p>
        )}
      </div>
    </Panel>
  );
}

// Anyone can draft, only the active player can send
function Command({
  thinking,
  error,
  send,
  myTurn,
  draft,
  setDraft,
  input,
  act,
}: Omit<Props, 'view' | 'voice'> & {
  myTurn: boolean;
  draft: string;
  setDraft: (text: string) => void;
  input: RefObject<HTMLTextAreaElement | null>;
  act: (text: string) => void;
}) {
  const canType = myTurn && !thinking;
  const submit = () => {
    if (!canType || !draft.trim()) return;
    send({ type: 'chat', text: draft });
    setDraft('');
  };

  return (
    <Panel id="tour-action" title="Your Action" className="shrink-0">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          ref={input}
          value={draft}
          rows={2}
          maxLength={500}
          onChange={(e) => setDraft(e.target.value)}
          // Enter sends, Shift+Enter adds a new line; ignore IME confirms
          onKeyDown={(e) => {
            if (
              e.key === 'Enter' &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={
            myTurn
              ? thinking
                ? 'The DM is thinking…'
                : 'Try "move east" or ask a question'
              : 'Waiting for your turn…'
          }
          className={`block w-full resize-y rounded border px-3 py-2 text-base outline-none ${
            myTurn
              ? 'border-amber-400 bg-stone-800 ring-2 ring-amber-400/50'
              : 'border-stone-700 bg-stone-900'
          }`}
        />
        <div className="mt-3 flex items-center gap-2">
          {['search', 'skip'].map((cmd) => (
            <button
              key={cmd}
              type="button"
              className="rounded border border-stone-700 px-3 py-1.5 text-sm text-stone-300 capitalize hover:text-stone-100"
              onClick={() => act(cmd)}
            >
              {cmd}
            </button>
          ))}
          <button
            type="submit"
            className="ml-auto rounded border-2 border-amber-400 bg-amber-500 px-10 py-2.5 text-base font-bold text-stone-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:border-stone-700 disabled:bg-transparent disabled:text-stone-500"
            disabled={!canType}
            title={
              canType
                ? undefined
                : myTurn
                  ? 'Wait for the DM to finish'
                  : "You can send when it's your turn"
            }
          >
            Send
          </button>
        </div>
      </form>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </Panel>
  );
}
