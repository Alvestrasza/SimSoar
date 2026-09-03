import {auth} from "@/auth";
import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {getTranslations} from "next-intl/server";

type NotificationNavProps = {
  locale: string;
};

export async function NotificationNav({locale}: NotificationNavProps) {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const [nav, unreadNotifications] = await Promise.all([
    getTranslations({locale, namespace: "Nav"}),
    prisma.notification.count({
      where: {userId: session.user.id, readAt: null}
    })
  ]);

  return (
    <Link
      className="btn btnSecondary notificationNavLink"
      href="/notifications"
      aria-label={nav("notifications", {count: unreadNotifications})}
    >
      <span aria-hidden="true">🔔</span>
      {unreadNotifications > 0 ? (
        <span className="notificationBadge">
          {unreadNotifications > 99 ? "99+" : unreadNotifications}
        </span>
      ) : null}
    </Link>
  );
}
