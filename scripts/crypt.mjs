import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const encryptTargets = ['.env', '.env.development', '.env.staging'];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const [keyHex, ivHex] = fs.readFileSync(path.resolve(__dirname, '../secure.key'), { encoding: 'utf-8' }).split('\n');
const key = Buffer.from(keyHex, 'hex');
const iv = Buffer.from(ivHex, 'hex');

function decrypt() {
  // Get encrypted files from the project root
  for (const filepath of fs.readdirSync(path.resolve(__dirname, '../'))) {
    if (!filepath.endsWith('.enc')) continue;

    const input = fs.createReadStream(filepath);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    const outputPath = filepath.replace(/\.enc$/, '');
    const output = fs.createWriteStream(outputPath);

    input.pipe(decipher).pipe(output);
    output.on('finish', () => {
      console.log(`Decrypted file saved as: ${outputPath}`);
    });
  }
}

function encrypt() {
  for (const filepath of fs.readdirSync(path.resolve(__dirname, '../'))) {
    const basename = path.basename(filepath);
    if (!encryptTargets.includes(basename)) continue;

    const input = fs.createReadStream(filepath);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    const outputPath = `${filepath}.enc`;
    const output = fs.createWriteStream(outputPath);

    input.pipe(cipher).pipe(output);
    output.on('finish', () => {
      console.log(`Encrypted file saved as: ${outputPath}`);
    });
  }
}

switch (process.argv[2]) {
  case 'encrypt':
    encrypt();
    break;
  case 'decrypt':
    decrypt();
    break;
  default:
    console.log('Usage: node crypt.mjs [encrypt|decrypt]');
    break;
}
