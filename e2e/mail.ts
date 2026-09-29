const MAILPIT = "http://127.0.0.1:54324/api/v1";
const ACCESS_SUBJECT = "Tu acceso a Clínica LUMIA";

export async function latestLinkFor(
  email: string,
  path: string,
): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const { messages } = await (
      await fetch(
        `${MAILPIT}/search?query=${encodeURIComponent(`to:"${email}"`)}`,
      )
    ).json();
    for (const message of messages) {
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

export async function latestCodeFor(email: string): Promise<string> {
  const query = `to:"${email}" subject:"${ACCESS_SUBJECT}"`;
  for (let attempt = 0; attempt < 20; attempt++) {
    const { messages } = await (
      await fetch(`${MAILPIT}/search?query=${encodeURIComponent(query)}`)
    ).json();
    if (messages.length > 0) {
      const { HTML } = await (
        await fetch(`${MAILPIT}/message/${messages[0].ID}`)
      ).json();
      const code = />\s*(\d{6})\s*</.exec(HTML)?.[1];
      if (code) return code;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No ha llegado el código a ${email}`);
}

export async function latestEmailFor(
  email: string,
  subject: string,
): Promise<string> {
  const query = `to:"${email}" subject:"${subject}"`;
  for (let attempt = 0; attempt < 20; attempt++) {
    const { messages } = await (
      await fetch(`${MAILPIT}/search?query=${encodeURIComponent(query)}`)
    ).json();
    if (messages.length > 0) {
      const { HTML } = await (
        await fetch(`${MAILPIT}/message/${messages[0].ID}`)
      ).json();
      return HTML;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No ha llegado "${subject}" a ${email}`);
}

export async function latestEmailAttachments(
  email: string,
  subject: string,
): Promise<string[]> {
  const query = `to:"${email}" subject:"${subject}"`;
  for (let attempt = 0; attempt < 20; attempt++) {
    const { messages } = await (
      await fetch(`${MAILPIT}/search?query=${encodeURIComponent(query)}`)
    ).json();
    if (messages.length > 0) {
      const { Attachments } = await (
        await fetch(`${MAILPIT}/message/${messages[0].ID}`)
      ).json();
      return Attachments.map(
        (attachment: { FileName: string }) => attachment.FileName,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No ha llegado "${subject}" a ${email}`);
}

export async function latestEmailIcs(
  email: string,
  subject: string,
): Promise<string> {
  const query = `to:"${email}" subject:"${subject}"`;
  for (let attempt = 0; attempt < 20; attempt++) {
    const { messages } = await (
      await fetch(`${MAILPIT}/search?query=${encodeURIComponent(query)}`)
    ).json();
    if (messages.length > 0) {
      const { ID, Attachments } = await (
        await fetch(`${MAILPIT}/message/${messages[0].ID}`)
      ).json();
      const attachment = Attachments.find(
        (candidate: { FileName: string }) => candidate.FileName === "cita.ics",
      );
      if (attachment) {
        const response = await fetch(
          `${MAILPIT}/message/${ID}/part/${attachment.PartID}`,
        );
        return response.text();
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No ha llegado "${subject}" a ${email} con cita.ics`);
}
