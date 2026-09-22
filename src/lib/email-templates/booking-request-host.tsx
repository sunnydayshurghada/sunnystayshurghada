import React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  guestName?: string
  guestEmail?: string
  guestPhone?: string
  checkin?: string
  checkout?: string
  guests?: number
  message?: string
}

const Email = ({
  guestName,
  guestEmail,
  guestPhone,
  checkin,
  checkout,
  guests,
  message,
}: Props) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>
      Neue Buchungsanfrage von {guestName || 'einem Gast'} ({checkin} – {checkout})
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>SUNNY STAYS HURGHADA</Text>
        <Heading style={heading}>Neue Buchungsanfrage</Heading>
        <Text style={text}>
          Eine neue Anfrage ist eingegangen. Sie ist noch nicht bestätigt und blockiert
          den Kalender nicht.
        </Text>
        <Hr style={hr} />
        <Section>
          <Row label="Name" value={guestName} />
          <Row label="E-Mail" value={guestEmail} />
          <Row label="Telefon" value={guestPhone} />
          <Row label="Anreise" value={checkin} />
          <Row label="Abreise" value={checkout} />
          <Row label="Gäste" value={guests ? String(guests) : undefined} />
          <Row label="Nachricht" value={message} />
        </Section>
        <Hr style={hr} />
        <Text style={muted}>
          Bestätigen oder ablehnen kannst du die Anfrage im internen Bereich der Website.
        </Text>
      </Container>
    </Body>
  </Html>
)

const Row = ({ label, value }: { label: string; value?: string }) =>
  value ? (
    <Text style={row}>
      <span style={rowLabel}>{label}: </span>
      {value}
    </Text>
  ) : null

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Neue Buchungsanfrage: ${data['checkin'] ?? ''} – ${data['checkout'] ?? ''}`,
  displayName: 'Buchungsanfrage (Gastgeber)',
  previewData: {
    guestName: 'Anna Beispiel',
    guestEmail: 'anna@example.com',
    guestPhone: '+49 170 1234567',
    checkin: '2026-10-10',
    checkout: '2026-10-15',
    guests: 2,
    message: 'Wir reisen spät an.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const eyebrow = {
  fontSize: '11px',
  letterSpacing: '3px',
  color: '#C8A15A',
  margin: '0 0 8px',
  fontFamily: 'Arial, sans-serif',
}
const heading = { fontSize: '24px', color: '#173B63', margin: '0 0 12px' }
const text = { fontSize: '15px', color: '#3d4a5a', lineHeight: '24px', fontFamily: 'Arial, sans-serif' }
const row = { fontSize: '15px', color: '#173B63', margin: '0 0 8px', fontFamily: 'Arial, sans-serif' }
const rowLabel = { color: '#8a929c' }
const hr = { borderColor: '#e8e2d7', margin: '20px 0' }
const muted = { fontSize: '13px', color: '#8a929c', fontFamily: 'Arial, sans-serif' }
