import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { IsString, MinLength } from "class-validator";
import { AuthService } from "./auth.service";
import { Public } from "../common/guards";

class LoginDto {
  @IsString()
  @MinLength(1)
  username!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

@Controller("auth")
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post("login")
  login(@Body() body: LoginDto) {
    return this.auth.login(body.username, body.password);
  }

  @Get("me")
  me(@Req() req: { user: { userId: string } }) {
    return this.auth.me(req.user.userId);
  }
}
