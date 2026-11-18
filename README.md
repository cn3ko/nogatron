# Nogatron

A browser game that mixes falling-block play with Nonogram clues. Each row has a clue, and a row clears only when it matches its clue exactly.

## Play

Play in the browser at https://cn3ko.github.io/nogatron/. It needs a keyboard, so there are no touch controls yet.

To play locally, double-click `index.html`. There is nothing to install or build, and it works offline.

For development, run it from a local server instead:

```
python run.py
```

This opens the game at http://127.0.0.1:8000/ with caching turned off, so a normal reload shows your latest edits. Stop it with Ctrl+C. Use `--port 9000` to pick another port, or `--no-browser` to skip opening the browser.

## Project layout

```
index.html        Page markup and the sunset background scene
css/style.css     Panels, overlays and layout
js/rules.js       Game data, clue rules and the Game class (no drawing or input)
js/main.js        Canvas drawing, overlays, keyboard input and the frame loop
js/tutorial.js    Animated how-to-play demo on the start and pause screens
run.py            Local development server (Python standard library only)
```

The scripts are plain `<script src>` files, not JavaScript modules, so the game still runs from a file opened directly in the browser. `js/rules.js` can also be loaded in Node with `require`, for tests.

## How it was made

Nogatron was built together with Claude, Anthropic's AI assistant. Claude wrote most of the code. The author set the direction: the game idea, the rules, the technical constraints (plain JavaScript, no framework, offline, no build step) and the design decisions. Every commit made with Claude's help carries a `Co-Authored-By: Claude` line.

## License

MIT. See [LICENSE](LICENSE). You are free to use, change and share the code, as long as you keep the license notice.
