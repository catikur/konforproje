import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import {
  ChangePasswordSchema,
  LoginSchema,
  RefreshSchema,
} from "@konfor/shared";
import { AuthService } from "./auth.service";
import { Public } from "../common/guards";
import { zodPipe } from "../common/zod-pipe";
import { LoginRateLimiter, clientKey } from "../common/rate-limit";

@Controller("auth")
export class AuthController {
  constructor(
    private auth: AuthService,
    private limiter: LoginRateLimiter,
  ) {}

  @Public()
  @Post("login")
  async login(
    @Body(zodPipe(LoginSchema)) body: { username: string; password: string },
    @Req() req: { ip?: string; headers?: Record<string, string> },
  ) {
    const key = clientKey(req.ip || req.headers?.["x-forwarded-for"], body.username);
    this.limiter.check(key);
    try {
      const result = await this.auth.login(body.username, body.password);
      this.limiter.reset(key);
      return result;
    } catch (err) {
      throw err;
    }
  }

  @Public()
  @Post("refresh")
  refresh(@Body(zodPipe(RefreshSchema)) body: { refreshToken: string }) {
    return this.auth.refresh(body.refreshToken);
  }

  @Public()
  @Post("logout")
  logout(@Body(zodPipe(RefreshSchema.partial())) body: { refreshToken?: string }) {
    return this.auth.logout(body.refreshToken);
  }

  @Get("me")
  me(@Req() req: { user: { userId: string } }) {
    return this.auth.me(req.user.userId);
  }

  @Post("password")
  changePassword(
    @Body(zodPipe(ChangePasswordSchema))
    body: { currentPassword: string; newPassword: string },
    @Req() req: { user: { userId: string } },
  ) {
    return this.auth.changePassword(
      req.user.userId,
      body.currentPassword,
      body.newPassword,
    );
  }
}
