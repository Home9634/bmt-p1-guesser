import { readFile, writeFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import path from 'node:path';

const subtle = globalThis.crypto?.subtle ?? webcrypto.subtle;
const getRandomValues = (arr) =>
  (globalThis.crypto ?? webcrypto).getRandomValues(arr);

const ITERATIONS = 200_000;

function toBase64(buffer) {
  return Buffer.from(buffer).toString('base64');
}

async function encryptData(plaintext, password) {
  const enc = new TextEncoder();
  const salt = getRandomValues(new Uint8Array(16));
  const iv = getRandomValues(new Uint8Array(12));

  const keyMaterial = await subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const key = await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );

  return {
    v: 1,
    iterations: ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertext),
  };
}

async function main() {
  const inputPath = path.resolve(process.argv[2] ?? 'people.json');
  const outputPath = path.resolve(process.argv[3] ?? 'data.enc');

  let rawJson;
  try {
    rawJson = await readFile(inputPath, 'utf8');
    JSON.parse(rawJson); // Validate JSON before encrypting
  } catch (err) {
    console.error(`Failed to read valid JSON from ${inputPath}:`, err.message);
    process.exit(1);
  }

  const rl = createInterface({ input, output });
  const password = (await rl.question('Enter encryption passphrase: ')).trim();
  rl.close();

  if (!password) {
    console.error('Passphrase cannot be empty.');
    process.exit(1);
  }

  const payload = await encryptData(rawJson, password);
  await writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Encrypted ${inputPath} -> ${outputPath}`);
}

main();