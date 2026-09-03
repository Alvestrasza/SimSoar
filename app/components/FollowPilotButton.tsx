import {updatePilotFollowAction} from "@/app/[locale]/pilots/actions";

type FollowPilotButtonProps = {
  pilotUserId: string;
  locale: "de" | "en";
  isFollowing: boolean;
  returnTo: string;
  followLabel: string;
  unfollowLabel: string;
};

export default function FollowPilotButton({
  pilotUserId,
  locale,
  isFollowing,
  returnTo,
  followLabel,
  unfollowLabel
}: FollowPilotButtonProps) {
  return (
    <form action={updatePilotFollowAction}>
      <input type="hidden" name="pilotUserId" value={pilotUserId} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input
        type="hidden"
        name="intent"
        value={isFollowing ? "unfollow" : "follow"}
      />
      <button
        className={`btn ${isFollowing ? "btnSecondary" : "btnPrimary"}`}
        type="submit"
      >
        {isFollowing ? unfollowLabel : followLabel}
      </button>
    </form>
  );
}
