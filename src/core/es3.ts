export const DEFAULT_PASSWORD = "emuMqG3bLYJ938ZDCfieWJ";

const IV_SIZE = 16;
const PBKDF2_ITERATIONS = 100;

const WRONG_PASSWORD =
  "Decryption failed: wrong password or not a TaskbarHero save. " +
  "The password can change after a game update.";

export class Es3Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Es3Error";
  }
}

async function deriveKey(password: string, iv: ArrayBuffer): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const keyBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: iv,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-1",
    },
    keyMaterial,
    128,
  );
  return crypto.subtle.importKey("raw", keyBits, { name: "AES-CBC", length: 128 }, false, [
    "decrypt",
  ]);
}

/** Web Crypto AES-CBC decrypt already validates and removes PKCS7 padding. */
export async function decrypt(data: ArrayBuffer, password = DEFAULT_PASSWORD): Promise<ArrayBuffer> {
  if (!data || data.byteLength <= IV_SIZE) {
    throw new Es3Error("File is too small to be an .es3 save.");
  }

  const iv = data.slice(0, IV_SIZE);
  const ciphertext = data.slice(IV_SIZE);

  if (ciphertext.byteLength % 16 !== 0) {
    throw new Es3Error(
      "Ciphertext length is not a multiple of the AES block size (save may be mid-write).",
    );
  }

  const key = await deriveKey(password, iv);

  try {
    return await crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, ciphertext);
  } catch {
    throw new Es3Error(WRONG_PASSWORD);
  }
}

export async function decryptToText(data: ArrayBuffer, password = DEFAULT_PASSWORD): Promise<string> {
  const plain = await decrypt(data, password);
  const text = new TextDecoder("utf-8", { fatal: true }).decode(plain);
  if (!text.trimStart().startsWith("{")) {
    throw new Es3Error(WRONG_PASSWORD);
  }
  return text;
}
