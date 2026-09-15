/**
 * Terminal prompts, including the masked one.
 *
 * Secrets are never taken as command-line arguments. An argument lands in shell
 * history, and on Linux it is visible in `ps` output to every other user on the
 * machine for as long as the process runs. A prompt is the only acceptable way
 * to accept a password, and it must not echo.
 *
 * Raw mode is handled manually rather than by overriding readline's private
 * `_writeToOutput`, which is the usual trick and breaks whenever Node changes
 * its internals.
 */

import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';

export function isInteractive(): boolean {
  return Boolean(stdin.isTTY && stdout.isTTY);
}

export async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

export async function confirm(question: string): Promise<boolean> {
  const answer = (await ask(`${question} [y/N] `)).toLowerCase();
  return answer === 'y' || answer === 'yes';
}

/**
 * Read a line without echoing it.
 *
 * Prints one `•` per character so the typist can see the keyboard is working —
 * revealing the length, which is a fair trade for not having people retype a
 * 20-character passphrase because they lost their place. Ctrl-C aborts.
 */
export async function askSecret(question: string): Promise<string> {
  if (!isInteractive()) {
    throw new Error(
      'A password cannot be read from a pipe. Run this command in a terminal; it will not take a secret as an argument.',
    );
  }

  stdout.write(question);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');

  return new Promise<string>((resolve, reject) => {
    let value = '';

    const finish = (fn: () => void) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      stdout.write('\n');
      fn();
    };

    const onData = (chunk: string) => {
      for (const character of chunk) {
        switch (character) {
          case '\r':
          case '\n':
          case '': // Ctrl-D
            return finish(() => resolve(value));
          case '': // Ctrl-C
            return finish(() => reject(new Error('Cancelled.')));
          case '': // Backspace
          case '\b':
            if (value.length > 0) {
              value = value.slice(0, -1);
              stdout.write('\b \b');
            }
            break;
          default:
            // Ignore the rest of the control range; an arrow key would
            // otherwise insert escape sequences into the password.
            if (character >= ' ') {
              value += character;
              stdout.write('•');
            }
        }
      }
    };

    stdin.on('data', onData);
  });
}

/** Ask twice and insist they match, so a typo does not become the password. */
export async function askSecretTwice(question: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const first = await askSecret(question);
    const second = await askSecret('Type it again to confirm:      ');
    if (first === second) return first;
    stdout.write('  They did not match. Try again.\n\n');
  }
  throw new Error('Passwords did not match three times. Nothing was written.');
}
