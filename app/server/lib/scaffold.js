/* Starter sources for repositories created from the Redfox console.

   These are real files committed to the new repository's default branch, so the
   first deployment has something genuine to build and serve. They are plain
   HTML and CSS: no framework, no build step, nothing simulated. */
import { commitFile } from '../routes/repos.js';

const page = (name) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${name}</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <main>
      <p class="eyebrow">Deployed with Redfox</p>
      <h1>${name}</h1>
      <p class="lede">
        This page was committed to your new repository and built by the Redfox
        runner. Edit <code>index.html</code>, commit, and the next deployment
        publishes your change.
      </p>
      <dl>
        <div><dt>Framework</dt><dd>Static</dd></div>
        <div><dt>Build step</dt><dd>None</dd></div>
        <div><dt>Output</dt><dd>Repository root</dd></div>
      </dl>
    </main>
  </body>
</html>
`;

const styles = `:root {
  color-scheme: dark;
  --bg: #0b0b0d;
  --panel: #101013;
  --line: #23232a;
  --fg: #ededf0;
  --muted: #9b9ba4;
  --accent: #e4593b;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 32px;
  background: var(--bg);
  color: var(--fg);
  font: 15px/1.6 ui-sans-serif, -apple-system, "Segoe UI", system-ui, sans-serif;
}

main {
  width: min(640px, 100%);
  padding: 40px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel);
}

.eyebrow {
  margin: 0 0 12px;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
}

h1 {
  margin: 0 0 12px;
  font-size: 28px;
  letter-spacing: -0.02em;
}

.lede { margin: 0 0 28px; color: var(--muted); }

code {
  padding: 1px 5px;
  border: 1px solid var(--line);
  border-radius: 4px;
  font-size: 12.5px;
  color: var(--fg);
}

dl {
  display: grid;
  gap: 1px;
  margin: 0;
  border-top: 1px solid var(--line);
}

dl > div {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
  font-size: 13px;
}

dt { color: var(--muted); }
dd { margin: 0; }
`;

export function scaffoldRepository({ repoId, branch, name, author }) {
  const files = [
    { path: 'index.html', content: page(name) },
    { path: 'styles.css', content: styles },
    {
      path: 'README.md',
      content: [
        `# ${name}`,
        '',
        'Created from the Redfox console with a static starter page.',
        '',
        '- `index.html` is served at the root of every deployment preview.',
        '- There is no build step: the repository root is the output directory.',
        '- Change the framework, install or build command in project settings when you add real source.',
        '',
      ].join('\n'),
    },
  ];

  let last = null;
  for (const file of files) {
    last = commitFile({
      repoId,
      branch,
      path: file.path,
      content: file.content,
      message: files.indexOf(file) === 0 ? 'chore: scaffold project' : `chore: add ${file.path}`,
      author,
      status: 'added',
    });
  }
  return last;
}
