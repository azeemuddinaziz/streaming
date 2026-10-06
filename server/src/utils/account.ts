// What the API tells a signed-in person about themselves. A Channel is named
// after its User, so it carries no name of its own.
export function toAccount(user: {
  id: string;
  email: string;
  name: string;
  channel: { id: string } | null;
}) {
  if (!user.channel) {
    throw new Error(`User ${user.id} has no Channel`);
  }

  return {
    user: { id: user.id, email: user.email, name: user.name },
    channel: { id: user.channel.id, name: user.name },
  };
}
