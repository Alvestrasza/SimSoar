export function shouldCreateNotification(
  recipientUserId: string,
  actorUserId?: string | null
) {
  return Boolean(recipientUserId) && recipientUserId !== actorUserId;
}
