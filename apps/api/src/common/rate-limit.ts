import { HttpException, HttpStatus, Injectable } from "@nestjs/common";

type Bucket = { count: number; resetAt: number };

@Injectable()
export class LoginRateLimiter {
  private readonly attempts = new Map<string, Bucket>();
  private readonly max = 8;
  private readonly windowMs = 15 * 60 * 1000;

  check(key: string) {
    const now = Date.now();
    const rec = this.attempts.get(key);
    if (!rec || rec.resetAt <= now) {
      this.attempts.set(key, { count: 1, resetAt: now + this.windowMs });
      return;
    }
    rec.count += 1;
    if (rec.count > this.max) {
      throw new HttpException(
        "Çok fazla hatalı giriş. 15 dakika sonra tekrar deneyin",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  reset(key: string) {
    this.attempts.delete(key);
  }
}

export function clientKey(ip: string | undefined, username: string): string {
  return `${ip || "unknown"}:${username.toLowerCase()}`;
}
