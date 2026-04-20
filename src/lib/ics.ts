type ICSEvent = {
  uid: string;
  summary: string;
  description?: string | null;
  start: Date;
  end: Date;
  url?: string | null;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatICSDate(d: Date) {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeText(text: string) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function buildICS(calendarName: string, events: ICSEvent[]) {
  const now = formatICSDate(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pushnik//Pushnik Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    "X-WR-TIMEZONE:UTC",
  ];

  for (const ev of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.uid}@pushnik`,
      `DTSTAMP:${now}`,
      `DTSTART:${formatICSDate(ev.start)}`,
      `DTEND:${formatICSDate(ev.end)}`,
      `SUMMARY:${escapeText(ev.summary)}`
    );
    if (ev.description) {
      lines.push(`DESCRIPTION:${escapeText(ev.description)}`);
    }
    if (ev.url) {
      lines.push(`URL:${ev.url}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
