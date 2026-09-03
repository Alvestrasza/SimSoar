import {
  createFlightCommentAction,
  deleteFlightCommentAction,
  reportFlightCommentAction,
  toggleFlightLikeAction
} from "@/app/[locale]/flights/[id]/community-actions";
import {Link} from "@/i18n/navigation";
import {getTranslations} from "next-intl/server";

type CommunityComment = {
  id: string;
  content: string;
  author: string;
  createdAt: Date;
  deletedAt: Date | null;
  canDelete: boolean;
  canReport: boolean;
  reportedByViewer: boolean;
};

type FlightCommunitySectionProps = {
  locale: string;
  flightId: string;
  likeCount: number;
  likedByViewer: boolean;
  isAuthenticated: boolean;
  comments: CommunityComment[];
};

export default async function FlightCommunitySection({
  locale,
  flightId,
  likeCount,
  likedByViewer,
  isAuthenticated,
  comments
}: FlightCommunitySectionProps) {
  const supportedLocale = locale === "en" ? "en" : "de";
  const t = await getTranslations({locale, namespace: "FlightCommunity"});
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  });

  return (
    <section className="wrap flightCommunityWrap" id="community">
      <div className="card">
        <div className="cardHead flightCommunityHead">
          <span className="cardTitle">{t("title")}</span>
          {isAuthenticated ? (
            <form action={toggleFlightLikeAction}>
              <input type="hidden" name="flightId" value={flightId} />
              <input type="hidden" name="locale" value={supportedLocale} />
              <button
                className={`btn ${likedByViewer ? "btnPrimary" : "btnSecondary"}`}
                type="submit"
              >
                {likedByViewer ? t("unlike") : t("like")} · {likeCount}
              </button>
            </form>
          ) : (
            <span className="muted">{t("likes", {count: likeCount})}</span>
          )}
        </div>

        <div className="cardBody flightCommunityBody">
          {isAuthenticated ? (
            <form className="communityCommentForm" action={createFlightCommentAction}>
              <input type="hidden" name="flightId" value={flightId} />
              <input type="hidden" name="locale" value={supportedLocale} />
              <label htmlFor="flight-comment">{t("addComment")}</label>
              <textarea
                id="flight-comment"
                name="content"
                required
                minLength={1}
                maxLength={2000}
                placeholder={t("commentPlaceholder")}
              />
              <button className="btn btnSuccess" type="submit">
                {t("submitComment")}
              </button>
            </form>
          ) : (
            <p className="muted">
              {t("signInPrompt")} <Link href="/login">{t("signIn")}</Link>
            </p>
          )}

          <div className="communityComments">
            <h3>{t("comments", {count: comments.length})}</h3>
            {comments.length === 0 ? (
              <p className="muted">{t("noComments")}</p>
            ) : (
              comments.map((comment) => (
                <article className="communityComment" key={comment.id}>
                  {comment.deletedAt ? (
                    <p className="muted">{t("deletedComment")}</p>
                  ) : (
                    <>
                      <div className="communityCommentMeta">
                        <strong>{comment.author}</strong>
                        <span className="muted">
                          {dateFormatter.format(comment.createdAt)}
                        </span>
                      </div>
                      <p className="communityCommentText">{comment.content}</p>
                      {isAuthenticated ? (
                        <div className="communityCommentActions">
                          {comment.canDelete ? (
                            <form action={deleteFlightCommentAction}>
                              <input type="hidden" name="flightId" value={flightId} />
                              <input type="hidden" name="commentId" value={comment.id} />
                              <input type="hidden" name="locale" value={supportedLocale} />
                              <button className="btn btnDanger" type="submit">
                                {t("deleteComment")}
                              </button>
                            </form>
                          ) : null}
                          {comment.canReport ? (
                            comment.reportedByViewer ? (
                              <span className="muted">{t("reported")}</span>
                            ) : (
                              <form className="communityReportForm" action={reportFlightCommentAction}>
                                <input type="hidden" name="flightId" value={flightId} />
                                <input type="hidden" name="commentId" value={comment.id} />
                                <input type="hidden" name="locale" value={supportedLocale} />
                                <input
                                  name="reason"
                                  maxLength={500}
                                  placeholder={t("reportReason")}
                                  aria-label={t("reportReason")}
                                />
                                <button className="btn btnSecondary" type="submit">
                                  {t("reportComment")}
                                </button>
                              </form>
                            )
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  )}
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
