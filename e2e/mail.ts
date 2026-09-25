const MAILPIT = "http://127.0.0.1:54324/api/v1";

export async function latestLinkFor(
  email: string,
  path: string,
): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const { messages } = await (await fetch(`${MAILPIT}/messages`)).json();
    const message = messages.find((m: { To: { Address: string }[] }) =>
      m.To.some((to) => to.Address === email),
    );
    if (message) {
      const { HTML } = await (
        await fetch(`${MAILPIT}/message/${message.ID}`)
      ).json();
      const href = /href="([^"]+)"/.exec(HTML)?.[1];
      if (href?.includes(path)) return href.replaceAll("&amp;", "&");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No ha llegado el email a ${email}`);
}
