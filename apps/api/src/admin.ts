import { createInterface, Interface } from 'node:readline';
import { Writable } from 'node:stream';
import { createDb } from './db.js';
import { passwordHash } from './auth.js';

/** Read one prompt; hidden input is suppressed rather than echoed. */
async function prompt(label: string, hidden = false): Promise<string> {
  let mute = false;
  const output = new Writable({
    /** Never write the interactive password back to the terminal. */
    write(chunk, _encoding, callback) {
      if (!mute) process.stdout.write(chunk);
      callback();
    },
  });
  const rl: Interface = createInterface({ input: process.stdin, output, terminal: true });
  return new Promise(
    /** Resolve input and immediately release the reader. */
    (resolve) => {
      rl.question(
        label,
        /** Complete a single interactive prompt. */ (answer) => {
          mute = false;
          rl.close();
          if (hidden) process.stdout.write('\n');
          resolve(answer);
        },
      );
      mute = hidden;
    },
  );
}

const db = createDb();
try {
  if (!process.stdin.isTTY) throw new Error('Interactive terminal required');
  const username = (await prompt('Benutzername: ')).trim();
  if (!username || username.length > 100) throw new Error('Invalid username');
  const password = await prompt('Passwort (mindestens 12 Zeichen): ', true);
  if (password !== (await prompt('Passwort wiederholen: ', true))) throw new Error('Passwords differ');
  await db.user.create({ data: { username, passwordHash: await passwordHash(password), singleton: 1 } });
  process.stdout.write('Benutzer angelegt.\n');
} catch {
  process.stderr.write('Benutzeranlage fehlgeschlagen. Eingaben und vorhandenen Benutzer prüfen.\n');
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
