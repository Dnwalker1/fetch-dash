// A stand-in for wix-secrets-backend.
export const secrets = new Map();
export async function getSecret(name) {
  if (!secrets.has(name)) throw new Error(`secret ${name} not found`);
  return secrets.get(name);
}
