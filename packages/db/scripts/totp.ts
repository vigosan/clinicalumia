import { TOTP } from "otpauth";

export const DEV_TOTP_SECRET = "JBSWY3DPEHPK3PXP";

export function currentTotp(secret: string, at: Date = new Date()): string {
  return new TOTP({ secret }).generate({ timestamp: at.getTime() });
}

function main() {
  const totp = new TOTP({ secret: DEV_TOTP_SECRET });
  const remainingSeconds = Math.ceil(totp.remaining() / 1000);
  console.log(`Código: ${totp.generate()} (caduca en ${remainingSeconds}s)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
