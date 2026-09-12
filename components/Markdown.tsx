"use client";

import React from "react";

/**
 * Just enough markdown for tutor replies: paragraphs, bullets, numbered lists,
 * **bold**, *italic* and `code`. Tokenised into React nodes rather than injected
 * as HTML, so model output can never become markup.
 */

function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;

  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyBase}-i${i++}`;

    if (tok.startsWith("**")) out.push(<strong key={k}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={k}>{tok.slice(1, -1)}</code>);
    else out.push(<em key={k}>{tok.slice(1, -1)}</em>);

    last = m.index + tok.length;
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];

  let para: string[] = [];
  let bullets: string[] = [];
  let numbers: string[] = [];
  let n = 0;

  const flushPara = () => {
    if (!para.length) return;
    const body = para.join(" ");
    blocks.push(<p key={`p${n++}`}>{inline(body, `p${n}`)}</p>);
    para = [];
  };
  const flushBullets = () => {
    if (!bullets.length) return;
    const items = bullets;
    blocks.push(
      <ul key={`u${n++}`}>
        {items.map((b, i) => (
          <li key={i}>{inline(b, `u${n}-${i}`)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };
  const flushNumbers = () => {
    if (!numbers.length) return;
    const items = numbers;
    blocks.push(
      <ol key={`o${n++}`}>
        {items.map((b, i) => (
          <li key={i}>{inline(b, `o${n}-${i}`)}</li>
        ))}
      </ol>,
    );
    numbers = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!line.trim()) {
      flushPara();
      flushBullets();
      flushNumbers();
      continue;
    }

    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const heading = line.match(/^#{1,4}\s+(.*)$/);

    if (bullet) {
      flushPara();
      flushNumbers();
      bullets.push(bullet[1]);
    } else if (numbered) {
      flushPara();
      flushBullets();
      numbers.push(numbered[1]);
    } else if (heading) {
      flushPara();
      flushBullets();
      flushNumbers();
      blocks.push(
        <p key={`h${n++}`}>
          <strong>{inline(heading[1], `h${n}`)}</strong>
        </p>,
      );
    } else {
      flushBullets();
      flushNumbers();
      para.push(line.trim());
    }
  }

  flushPara();
  flushBullets();
  flushNumbers();

  return <>{blocks}</>;
}
