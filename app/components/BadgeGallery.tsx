import {getTranslations} from "next-intl/server";
import {pilotLevel} from "@/lib/badge-policy";

type BadgeGalleryProps = {
  locale: string;
  badges: Array<{
    awardedAt: Date;
    badge: {code: string; icon: string};
  }>;
};

export default async function BadgeGallery({locale, badges}: BadgeGalleryProps) {
  const t = await getTranslations({locale, namespace: "Badges"});
  const level = pilotLevel(badges.length);
  return <section className="badgeGallery" aria-label={t("title")}>
    <div className="badgeGalleryHead">
      <h3>{t("title")}</h3>
      <span className="badgeLevel">{t("level", {level: t(`level_${level}`)})}</span>
    </div>
    {badges.length === 0 ? <p className="muted">{t("empty")}</p> : <div className="badgeGrid">
      {badges.map(({badge, awardedAt}) => <article className="achievementBadge" key={badge.code} title={t(`badge_${badge.code}_description`)}>
        <span className="achievementBadgeIcon" aria-hidden="true">{badge.icon}</span>
        <span><strong>{t(`badge_${badge.code}_name`)}</strong><small>{t("awarded", {date: awardedAt.toLocaleDateString(locale)})}</small></span>
      </article>)}
    </div>}
  </section>;
}
