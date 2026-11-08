import {
  type DragEvent,
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
import {
  art,
  describeEffect,
  HpBar,
  Panel,
  Portrait,
  ResetButton,
  type Send,
  Tooltip,
  useScrollToEnd,
} from './ui';

type Props = {
  view: View;
  thinking: boolean;
  error: string | null;
  send: Send;
};

// Who a dragged command can be dropped on
type Target = 'ally' | 'foe';
type Drag = { command: string; on: Target };

// Shared by panels that fill the chat box or take part in drag and drop
type Shortcuts = {
  fill: (text: string) => void;
  drag: Drag | null;
  setDrag: (drag: Drag | null) => void;
};

// Only single-target effects can be dragged onto someone
function targetOf(effect: Effect): Target | null {
  if (effect.kind === 'weaken') return 'foe';
  if (effect.kind === 'heal' && effect.area === 'one') return 'ally';
  if (effect.kind === 'damage' && effect.area === 'one') return 'foe';
  return null;
}

const dropText = (command: string, name: string) =>
  command === 'attack' ? `attack ${name}` : `${command} on ${name}`;

const clickable = 'cursor-pointer select-none';

// Hoverable list row; grip brightens via group-hover
const rowBase = '-mx-1 rounded px-1';
const row = `group ${rowBase} hover:bg-stone-800/70`;

function Grip() {
  return (
    <span className="mr-1.5 text-stone-600 group-hover:text-stone-300">⠿</span>
  );
}

// Handlers for something you can click or drag
function source(
  { fill, setDrag }: Shortcuts,
  command: string,
  on: Target | null,
  ready = true,
) {
  if (!ready) return { className: 'cursor-not-allowed select-none' };
  return {
    className: clickable,
    onClick: () => fill(command),
    draggable: !!on,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.setData('text/plain', command); // Firefox needs data to drag
      if (on) setDrag({ command, on });
    },
    onDragEnd: () => setDrag(null),
  };
}

// Handlers and highlight for something you can drop on
function dropZone({ fill, drag }: Shortcuts, on: Target, name: string) {
  if (drag?.on !== on) return { className: '' };
  return {
    className: 'bg-sky-500/10 ring-2 ring-sky-400',
    onDragOver: (e: DragEvent) => e.preventDefault(),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      fill(dropText(drag.command, name));
    },
  };
}

export function Game({ view, thinking, error, send }: Props) {
  const myTurn = view.turn === view.you;
  const canAct = myTurn && !thinking;
  const [draft, setDraft] = useState('');
  const [drag, setDrag] = useState<Drag | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  // Replace the draft and focus the box with the cursor at the end
  const fill = (text: string) => {
    setDraft(text);
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(text.length, text.length);
    });
  };
  const sc: Shortcuts = { fill, drag, setDrag };

  useEffect(() => {
    if (canAct) input.current?.focus();
  }, [canAct]);

  // Flag the browser tab so players in other tabs notice
  useEffect(() => {
    document.title = myTurn ? `⚔ Your turn! · ${TITLE}` : TITLE;
  }, [myTurn]);

  return (
    <div className="flex flex-col lg:h-screen">
      {/* Keyed per turn so the flash replays each time */}
      {myTurn && <div key={view.turnEndsAt} className="turn-flash" />}
      <Header view={view} thinking={thinking} send={send} />
      <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[17rem_auto_minmax(20rem,1fr)]">
        <div className="min-h-0 space-y-3 overflow-y-auto">
          <You view={view} sc={sc} />
          <Party view={view} sc={sc} />
        </div>
        <div className="min-h-0 space-y-3 overflow-y-auto">
          <Panel title="Map">
            <Compass view={view} fill={fill} />
          </Panel>
          <Room view={view} sc={sc} />
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
            fill={fill}
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
  send,
}: {
  view: View;
  thinking: boolean;
  send: Send;
}) {
  const now = useNow();
  const secs = Math.max(0, Math.ceil((view.turnEndsAt - now) / 1000));
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const active = view.players.find((p) => p.characterId === view.turn);
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 px-4 py-2">
      <h1 className="font-pixel text-xs text-amber-300 sm:text-sm">{TITLE}</h1>
      <div className="flex items-center gap-3">
        {view.turn === view.you ? (
          <span className="animate-pulse font-pixel text-xs text-amber-300">
            Your turn!
          </span>
        ) : (
          <span className="text-stone-300">{active?.name}'s turn</span>
        )}
        <span className="text-sm text-stone-500 tabular-nums">{clock}</span>
        {thinking && (
          <span className="text-sm text-sky-300 italic">DM is thinking…</span>
        )}
      </div>
      <ResetButton send={send} />
    </header>
  );
}

// Your hero: HP, attack, abilities with cooldowns, items
function You({ view, sc }: { view: View; sc: Shortcuts }) {
  const me = view.players.find((p) => p.characterId === view.you);
  if (!me) return null;
  const c: Character = CHARACTERS[me.characterId];
  const { bonus } = me;
  const attack = source(sc, 'attack', 'foe');
  const gear = [
    bonus.ac && `+${bonus.ac} AC`,
    bonus.attack && `+${bonus.attack} to hit`,
    bonus.damage && `+${bonus.damage} damage`,
  ].filter(Boolean);
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

      <ul className="mt-3 space-y-1.5 text-sm">
        <li>
          <Tooltip
            {...attack}
            title={c.attack.name}
            text="Your basic attack."
            stats={[
              `+${c.attack.bonus + bonus.attack} to hit`,
              `Damage ${c.attack.damage}${bonus.damage ? `+${bonus.damage}` : ''}`,
              'One enemy',
              'Usable every turn',
            ]}
            className={`flex items-center justify-between gap-2 ${row} ${attack.className}`}
          >
            <span>
              <Grip />
              {c.attack.name}{' '}
              <span className="text-xs text-stone-500">{c.attack.damage}</span>
            </span>
            <Chip ready>Always</Chip>
          </Tooltip>
        </li>
        {c.abilities.map((a) => {
          const wait = me.cooldowns[a.id] ?? 0;
          const src = source(sc, `cast ${a.name}`, targetOf(a.effect), !wait);
          return (
            <li key={a.id}>
              <Tooltip
                {...src}
                title={a.name}
                text={a.description}
                stats={[
                  ...describeEffect(a.effect),
                  `Usable every ${a.cooldown + 1} turns`,
                  wait
                    ? `Ready in ${wait} turn${wait > 1 ? 's' : ''}`
                    : 'Ready now',
                ]}
                className={`flex items-center justify-between gap-2 ${wait ? rowBase : row} ${src.className}`}
              >
                <span>
                  <Grip />
                  {a.name}
                </span>
                <Chip ready={!wait}>
                  {wait ? `${wait} turn${wait > 1 ? 's' : ''}` : 'Ready'}
                </Chip>
              </Tooltip>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2">
        {me.items.map((id, i) => {
          const item: Item = ITEMS[id];
          const src = source(sc, `use ${item.name}`, targetOf(item.effect));
          return (
            <Tooltip
              {...src}
              // biome-ignore lint/suspicious/noArrayIndexKey: items can repeat
              key={`${id}-${i}`}
              title={item.name}
              icon={item.icon}
              text={item.description}
              stats={[
                ...describeEffect(item.effect),
                item.effect.kind === 'equip' ? 'Equip once' : 'Single use',
              ]}
              className={`flex items-center gap-1.5 rounded border border-stone-700 bg-stone-800 px-1.5 py-1 text-xs hover:border-stone-500 hover:bg-stone-700 ${src.className}`}
            >
              <img
                src={art(item.icon)}
                alt=""
                width={24}
                height={24}
                className="pixel"
              />
              {item.name}
            </Tooltip>
          );
        })}
        {!me.items.length && (
          <span className="text-xs text-stone-500">No items</span>
        )}
      </div>
      {gear.length > 0 && (
        <p className="mt-2 text-xs text-emerald-300">Gear: {gear.join(', ')}</p>
      )}
    </Panel>
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

function Party({ view, sc }: { view: View; sc: Shortcuts }) {
  return (
    <Panel title="Party">
      <ul className="space-y-2">
        {view.players.map((p) => {
          const c: Character = CHARACTERS[p.characterId];
          const active = p.characterId === view.turn;
          const zone = dropZone(sc, 'ally', p.name);
          const down = p.hp === 0;
          return (
            // biome-ignore lint/a11y/useKeyWithClickEvents: mouse shortcut; typing still works
            <li
              key={p.characterId}
              {...zone}
              onClick={down ? () => sc.fill(`revive ${p.name}`) : undefined}
              className={`flex items-center gap-2 rounded p-1 ${zone.className || (active ? 'bg-amber-500/10 ring-1 ring-amber-400' : '')} ${down ? clickable : ''}`}
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
function Room({ view, sc }: { view: View; sc: Shortcuts }) {
  const { room } = view;
  return (
    <Panel title={room?.name ?? 'Corridor'} className="min-w-0">
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
          {room.monsters.map((m) => {
            const zone = dropZone(sc, 'foe', m.name);
            return (
              // biome-ignore lint/a11y/noStaticElementInteractions: mouse shortcuts; typing still works
              // biome-ignore lint/a11y/useKeyWithClickEvents: mouse shortcuts; typing still works
              <div
                key={m.id}
                {...zone}
                onClick={() => sc.fill(dropText('attack', m.name))}
                className={`max-w-64 min-w-40 flex-1 rounded border border-red-900/60 bg-red-950/30 p-2 ${clickable} ${zone.className}`}
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
            );
          })}
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
  fill,
}: Omit<Props, 'view'> & {
  myTurn: boolean;
  draft: string;
  setDraft: (text: string) => void;
  input: RefObject<HTMLTextAreaElement | null>;
  fill: (text: string) => void;
}) {
  const canType = myTurn && !thinking;
  const submit = () => {
    if (!canType || !draft.trim()) return;
    send({ type: 'chat', text: draft });
    setDraft('');
  };

  return (
    <Panel title="Your Action" className="shrink-0">
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
          // Dropped commands replace the draft instead of splicing into it
          onDrop={(e) => {
            e.preventDefault();
            fill(e.dataTransfer.getData('text/plain'));
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
              onClick={() => fill(cmd)}
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
