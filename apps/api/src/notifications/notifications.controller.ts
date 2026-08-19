import { Controller, Get, Param, Patch, Query, Req } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get()
  list(
    @Req() req: { user: { userId: string } },
    @Query("unreadOnly") unreadOnly?: string,
  ) {
    return this.notifications.list(req.user.userId, unreadOnly === "true");
  }

  @Get("unread-count")
  unread(@Req() req: { user: { userId: string } }) {
    return this.notifications.unreadCount(req.user.userId).then((count) => ({ count }));
  }

  @Patch("read-all")
  readAll(@Req() req: { user: { userId: string } }) {
    return this.notifications.markAllRead(req.user.userId);
  }

  @Patch(":id/read")
  read(@Param("id") id: string, @Req() req: { user: { userId: string } }) {
    return this.notifications.markRead(id, req.user.userId);
  }
}
