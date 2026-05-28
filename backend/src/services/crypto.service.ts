/// <reference types="node" />
import crypto from 'crypto';

const ALGO = 'aes-256-cbc';
const SECRET_KEY = (process.env.ENCRYPTION_KEY || 'brimble-default-32-char-secret!!').substring(0, 32);
const IV_LENGTH = 16;

export function encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGO, Buffer.from(SECRET_KEY), iv);
    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(text: string): string {
    try {
        const [ivHex, encryptedHex] = text.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const encryptedText = Buffer.from(encryptedHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGO, Buffer.from(SECRET_KEY), iv);
        const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
        return decrypted.toString();
    } catch {
        // Return as-is if not encrypted (migration path for old values)
        return text;
    }
}
