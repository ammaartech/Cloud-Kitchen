import { ImageResponse } from 'next/og';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The share card: what a link to any page on the site looks like in WhatsApp,
 * iMessage, Slack and the social networks.
 *
 * One card for the whole site rather than one per page. The pages differ in
 * copy, and the copy already travels as the link's title and description;
 * what the picture has to do is say whose link this is, and the mark does
 * that. Generated at build from the same PNG the header uses, so the card
 * and the site can never carry two different logos.
 *
 * `next/og` draws it, which means no image editor in the loop and no binary
 * to keep in sync with the brand colours in `globals.css`. The three colours
 * below are `--ck-bg`, `--ck-text` and `--ck-brand` from that file.
 */
export const alt = 'Infinity Kitchens: home-style meals on subscription';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  // Synchronous on purpose. Under Cache Components an *async* file read is
  // uncached data and turns the route dynamic -- the card would be rendered
  // on every share. A synchronous read is deterministic, so the image is
  // generated once at build and served as a static file.
  const mark = readFileSync(join(process.cwd(), 'public/brand/mark-green.png'));
  const markSrc = `data:image/png;base64,${mark.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f6f9f8',
          color: '#0d1714',
        }}
      >
        <img src={markSrc} width={420} height={187} alt="" style={{ marginBottom: 40 }} />
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            letterSpacing: 6,
            color: '#386155',
          }}
        >
          INFINITY KITCHENS
        </div>
        <div style={{ marginTop: 20, fontSize: 32, color: '#48605a' }}>
          Home-style meals, on subscription
        </div>
      </div>
    ),
    size,
  );
}
