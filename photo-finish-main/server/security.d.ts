export function verifyAdminLogin(password: string, clientIp: string): { success: boolean; status: number; error?: string; adminToken?: string; token?: string };
export function verifyAdminToken(token: string): boolean;
export function generateEd25519License(tier: string, expiryDateStr: string, deviceId?: string): string;
export function verifyEd25519Signature(payload: string, signatureBuffer: Buffer): boolean;
export function getPublicKeyBase64(): string;
export function buildCheckpointCanonical(params: { cid: string; cpid: string; code: string; km: number; iat: number; exp: number }): string;
export function signCheckpointQr(params: { cid: string; cpid: string; code: string; km: number; iat: number; exp: number }): string;
export function verifyCheckpointQrSignature(params: { cid: string; cpid: string; code: string; km: number; iat: number; exp: number }, sigBase64Url: string): boolean;
export const PUB_KEY_RAW: Buffer;
export const PRIV_KEY_RAW: Buffer;

declare const _default: {
  verifyAdminLogin: typeof verifyAdminLogin;
  verifyAdminToken: typeof verifyAdminToken;
  generateEd25519License: typeof generateEd25519License;
  verifyEd25519Signature: typeof verifyEd25519Signature;
  getPublicKeyBase64: typeof getPublicKeyBase64;
  buildCheckpointCanonical: typeof buildCheckpointCanonical;
  signCheckpointQr: typeof signCheckpointQr;
  verifyCheckpointQrSignature: typeof verifyCheckpointQrSignature;
  PUB_KEY_RAW: Buffer;
  PRIV_KEY_RAW: Buffer;
};
export default _default;
