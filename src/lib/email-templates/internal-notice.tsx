import React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'
import { main, container, header, brand, card, h1, text, eyebrow, link } from './brand'

export interface InternalRow {
  label: string
  value?: string | null
}

interface Props {
  heading?: string
  intro?: string
  rows?: InternalRow[]
  adminUrl?: string
  adminLabel?: string
  note?: string
}

/** Internal notification for the central booking desk and property owners. */
const Email = ({ heading, intro, rows = [], adminUrl, adminLabel, note }: Props) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>{heading || 'Sunny Stays Hurghada'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={eyebrow}>SUNNY STAYS HURGHADA</Text>
          <Heading style={brand}>{heading || 'Benachrichtigung'}</Heading>
        </Section>
        <Section style={card}>
          {intro ? <Text style={text}>{intro}</Text> : null}
          <Hr style={hr} />
          {rows
            .filter((r) => r.value)
            .map((r) => (
              <Text key={r.label} style={row}>
                <span style={rowLabel}>{r.label}: </span>
                <span style={{ whiteSpace: 'pre-line' as const }}>{r.value}</span>
              </Text>
            ))}
          <Hr style={hr} />
          {adminUrl ? (
            <Text style={text}>
              <Link href={adminUrl} style={link}>
                {adminLabel || 'Im Adminbereich öffnen'}
              </Link>
            </Text>
          ) : null}
          {note ? <Text style={muted}>{note}</Text> : null}
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => data['subject'] || 'Sunny Stays Hurghada',
  displayName: 'Interne Benachrichtigung',
  previewData: {
    heading: 'Neue Buchungsanfrage',
    rows: [
      { label: 'Wohnung', value: 'Madaris Apartment' },
      { label: 'Anreise', value: '2026-10-02' },
    ],
  },
} satisfies TemplateEntry

const hr = { borderColor: '#e3d9c6', margin: '20px 0' }
const row = {
  fontSize: '14px',
  color: '#3d4754',
  lineHeight: '1.6',
  margin: '0 0 6px',
  fontFamily: 'Arial, sans-serif',
}
const rowLabel = { color: '#173B63', fontWeight: 'bold' as const }
const muted = {
  fontSize: '12px',
  color: '#8a8378',
  fontFamily: 'Arial, sans-serif',
  margin: '8px 0 0',
}
const h1Unused = h1
void h1Unused
