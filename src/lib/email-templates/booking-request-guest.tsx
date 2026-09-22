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
  checkin?: string
  checkout?: string
  guests?: number
}

const Email = ({ guestName, checkin, checkout, guests }: Props) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Wir haben deine Anfrage erhalten — Sunny Stays Hurghada</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>SUNNY STAYS HURGHADA</Text>
        <Heading style={heading}>Deine Anfrage ist angekommen</Heading>
        <Text style={text}>
          {guestName ? `Hallo ${guestName},` : 'Hallo,'} vielen Dank für deine
          Anfrage für das Madaris Apartment. Wir melden uns persönlich bei dir,
          sobald wir deine Daten geprüft haben.
        </Text>
        <Hr style={hr} />
        <Section>
          {checkin ? (
            <Text style={row}>
              <span style={rowLabel}>Anreise: </span>
              {checkin}
            </Text>
          ) : null}
          {checkout ? (
            <Text style={row}>
              <span style={rowLabel}>Abreise: </span>
              {checkout}
            </Text>
          ) : null}
          {guests ? (
            <Text style={row}>
              <span style={rowLabel}>Gäste: </span>
              {guests}
            </Text>
          ) : null}
        </Section>
        <Hr style={hr} />
        <Text style={muted}>
          Hinweis: Diese Anfrage ist noch keine bestätigte Buchung. Der Zeitraum
          bleibt bis zur Bestätigung durch uns verfügbar.
        </Text>
        <Text style={muted}>Wafaa &amp; Alex — Your Home by the Red Sea</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Deine Anfrage bei Sunny Stays Hurghada',
  displayName: 'Anfragebestätigung (Gast)',
  previewData: {
    guestName: 'Anna',
    checkin: '2026-10-10',
    checkout: '2026-10-15',
    guests: 2,
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
