import {auth} from "@/auth";
import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {redirect} from "next/navigation";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction
} from "./actions";

export const dynamic = "force-dynamic";

type NotificationsPageProps = {
  params: Promise<{locale: string}>;
};

export default async function NotificationsPage({params}: NotificationsPageProps) {
  const {locale} = await params;
  const supportedLocale = locale === "en" ? "en" : "de";
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect(`/${supportedLocale}/login`);

  const t = await getTranslations({locale, namespace: "Notifications"});
  const notifications = await prisma.notification.findMany({
    where: {userId: session.user.id},
    orderBy: {createdAt: "desc"},
    take: 100,
    include: {
      actor: {select: {name: true, profile: {select: {callsign: true}}}},
      flight: {select: {id: true, title: true}}
    }
  });
  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  });

  function notificationText(notification: (typeof notifications)[number]) {
    const actor =
      notification.actor?.profile?.callsign ??
      notification.actor?.name ??
      t("systemActor");
    const flight = notification.flight?.title ?? t("unknownFlight");

    if (notification.type === "FLIGHT_LIKE") {
      return t("flightLike", {actor, flight});
    }
    if (notification.type === "FLIGHT_COMMENT") {
      return t("flightComment", {actor, flight});
    }
    if (notification.type === "FOLLOWED_PILOT_FLIGHT") {
      return t("followedFlight", {actor, flight});
    }
    return t("flightModeration", {
      flight,
      status: notification.moderationStatus ?? t("unknownStatus")
    });
  }

  return (
    <main className="wrap">
      <section className="card">
        <div className="cardHead">
          <div>
            <span className="cardTitle">{t("pageTitle")}</span>
            <span className="muted notificationCount">
              {t("unreadCount", {count: unreadCount})}
            </span>
          </div>
          {unreadCount > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <input type="hidden" name="locale" value={supportedLocale} />
              <button className="btn btnSecondary" type="submit">
                {t("markAllRead")}
              </button>
            </form>
          ) : null}
        </div>

        <div className="cardBody notificationList">
          {notifications.length === 0 ? (
            <p className="muted">{t("empty")}</p>
          ) : (
            notifications.map((notification) => (
              <article
                className={`notificationItem ${notification.readAt ? "isRead" : "isUnread"}`}
                key={notification.id}
              >
                <div>
                  <p>{notificationText(notification)}</p>
                  <span className="muted">
                    {dateFormatter.format(notification.createdAt)}
                  </span>
                </div>
                <div className="notificationActions">
                  {notification.flight?.id ? (
                    <Link className="btn btnSecondary" href={`/flights/${notification.flight.id}`}>
                      {t("openFlight")}
                    </Link>
                  ) : null}
                  {!notification.readAt ? (
                    <form action={markNotificationReadAction}>
                      <input type="hidden" name="notificationId" value={notification.id} />
                      <input type="hidden" name="locale" value={supportedLocale} />
                      <button className="btn btnSecondary" type="submit">
                        {t("markRead")}
                      </button>
                    </form>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
