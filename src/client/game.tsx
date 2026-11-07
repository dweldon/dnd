import { type ReactNode, useEffect, useRef, useState } from 'react';
import { CHARACTERS, type Character } from '../game/characters';
import { ITEMS, type Item } from '../game/items';
import { TITLE } from '../game/story';
import type { View } from '../game/view';
import { Compass, DungeonMap } from './map';
import {
  art,
  button,
  HpBar,
  Panel,
  Portrait,
  ResetButton,
  type Send,
  useScrollToEnd,
} from './ui';

type Props = {
  view: View;
  thinking: boolean;
  error: string | null;
  send: Send;
};

export function Game({ view, thinking, error, send }: Props) {
  const myTurn = view.turn === view.you;
  const canAct = myTurn && !thinking;

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
          <You view={view} />
          <Party view={view} />
        </div>
        <div className="min-h-0 space-y-3 overflow-y-auto">
          <Panel title="Map">
            <DungeonMap view={view} />
          </Panel>
          <div className="flex gap-3">
            <Panel title="Compass">
              <Compass view={view} canAct={canAct} send={send} />
            </Panel>
            <Room view={view} />
          </div>
        </div>
        <div className="flex min-h-0 flex-col gap-3">
          <Chat
            view={view}
            thinking={thinking}
            error={error}
            send={send}
            myTurn={myTurn}
          />
          <Actions view={view} />
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
function You({ view }: { view: View }) {
  const me = view.players.find((p) => p.characterId === view.you);
  if (!me) return null;
  const c: Character = CHARACTERS[me.characterId];
  const { bonus } = me;
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
        <li className="flex items-center justify-between gap-2">
          <span title={`+${c.attack.bonus + bonus.attack} to hit`}>
            {c.attack.name}{' '}
            <span className="text-xs text-stone-500">{c.attack.damage}</span>
          </span>
          <Chip ready>Always</Chip>
        </li>
        {c.abilities.map((a) => {
          const wait = me.cooldowns[a.id] ?? 0;
          return (
            <li
              key={a.id}
              title={`${a.description} Usable every ${a.cooldown + 1} turns.`}
              className="flex items-center justify-between gap-2"
            >
              <span>{a.name}</span>
              <Chip ready={!wait}>
                {wait ? `${wait} turn${wait > 1 ? 's' : ''}` : 'Ready'}
              </Chip>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2">
        {me.items.map((id, i) => {
          const item: Item = ITEMS[id];
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: items can repeat
              key={`${id}-${i}`}
              title={`${item.name}: ${item.description}`}
              className="flex items-center gap-1.5 rounded border border-stone-700 bg-stone-800 px-1.5 py-1 text-xs"
            >
              <img
                src={art(item.icon)}
                alt=""
                width={24}
                height={24}
                className="pixel"
              />
              {item.name}
            </div>
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

function Party({ view }: { view: View }) {
  return (
    <Panel title="Party">
      <ul className="space-y-2">
        {view.players.map((p) => {
          const c: Character = CHARACTERS[p.characterId];
          const active = p.characterId === view.turn;
          return (
            <li
              key={p.characterId}
              className={`flex items-center gap-2 rounded p-1 ${active ? 'bg-amber-500/10 ring-1 ring-amber-400' : ''}`}
            >
              <Portrait src={c.portrait} size={40} hp={p.hp} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="truncate">{p.name}</span>
                  {p.characterId === view.you && <Tag>You</Tag>}
                  {p.hp === 0 && <Tag down>Down</Tag>}
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
function Room({ view }: { view: View }) {
  const { room } = view;
  return (
    <Panel title={room?.name ?? 'Corridor'} className="min-w-0 flex-1">
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
        <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-2">
          {room.monsters.map((m) => (
            <div
              key={m.id}
              className="rounded border border-red-900/60 bg-red-950/30 p-2"
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
                  <div className="truncate">{m.name}</div>
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

// Shared DM log; only the active player can type
function Chat({
  view,
  thinking,
  error,
  send,
  myTurn,
}: Props & { myTurn: boolean }) {
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const last = view.chat.at(-1);
  const log = useScrollToEnd(`${view.chat.length}|${last?.text}|${thinking}`);
  const canType = myTurn && !thinking;
  const active = view.players.find((p) => p.characterId === view.turn);
  const me = view.players.find((p) => p.characterId === view.you);

  useEffect(() => {
    if (canType) input.current?.focus();
  }, [canType]);

  return (
    <Panel title="Dungeon Master" className="flex min-h-80 flex-1 flex-col">
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
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          send({ type: 'chat', text });
          setText('');
        }}
      >
        <input
          ref={input}
          value={text}
          disabled={!canType}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            myTurn
              ? thinking
                ? 'The DM is thinking…'
                : 'Your turn: try "move east" or ask a question'
              : `Waiting for ${active?.name ?? 'the party'}…`
          }
          className={`min-w-0 flex-1 rounded border px-3 py-2 text-sm outline-none ${
            myTurn
              ? 'border-amber-400 bg-stone-800 ring-2 ring-amber-400/50'
              : 'border-stone-700 bg-stone-900 opacity-60'
          }`}
        />
        <button type="submit" className={button} disabled={!canType}>
          Send
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </Panel>
  );
}

// Compact list of what each action did
function Actions({ view }: { view: View }) {
  const ref = useScrollToEnd(`${view.log.length}|${view.log.at(-1)}`);
  return (
    <Panel title="Actions" className="flex h-48 shrink-0 flex-col">
      <div ref={ref} className="min-h-0 flex-1 overflow-y-auto">
        {view.log.map((line, i) => (
          <p
            // biome-ignore lint/suspicious/noArrayIndexKey: append-only log
            key={i}
            className="border-b border-stone-800 py-0.5 font-mono text-xs text-stone-300"
          >
            {line}
          </p>
        ))}
      </div>
    </Panel>
  );
}
