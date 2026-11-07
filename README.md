# D&D

A simple, workplace-friendly multiplayer D&D game. Players join a shared lobby, pick a hero, and explore a dungeon together to recover a stolen coffee pot from the Goblin King. An AI Dungeon Master (Claude) interprets chat commands and narrates the adventure.

## Environment variables

- `PORT` (optional): Server port (default `3000`).
- `ANTHROPIC_KEY` (optional): Anthropic API key for the AI DM. Without it, a basic keyword parser is used.

Bun loads a `.env` file automatically.

## Running

Requires [Bun](https://bun.sh).

```sh
bun install
bun dev     # development, with watch
bun start   # production
```

Then open http://localhost:3000.
