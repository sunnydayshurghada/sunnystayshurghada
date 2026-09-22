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
import { main, container, header, brand, card, h1, text, eyebrow } from './brand'

interface Props {
  /** Already rendered plain text (placeholders resolved). Never HTML. */
  bodyText?: string
  heading?: string
  propertyName?: string
  language?: string
  previewText?: string
}

/**
 * Generic branded shell for property guest emails. The body arrives as plain
 * text and is rendered through React text nodes, so any HTML or script markup
 * inside a template is escaped and can never execute.
 */
const Email = ({ bodyText, heading, propertyName, language, previewText }: Props) => {
  const rtl = (language ?? 'de').startsWith('ar')
  const paragraphs = (bodyText ?? '').split(/\n{2,}/).filter(Boolean)
  return (
    <Html lang={language ?? 'de'} dir={rtl ? 'rtl' : 'ltr'}>
      <Head />
      <Preview>{previewText || heading || 'Sunny Stays Hurghada'}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={eyebrow}>SUNNY STAYS HURGHADA</Text>
            <Heading style={brand}>{propertyName || 'Sunny Stays Hurghada'}</Heading>
          </Section>
          <Section style={{ ...card, textAlign: rtl ? ('right' as const) : ('left' as const) }}>
            {heading ? <Heading style={h1}>{heading}</Heading> : null}
            {paragraphs.map((para, i) => (
              <Text key={i} style={{ ...text, whiteSpace: 'pre-line' as const }}>
                {para}
              </Text>
            ))}
            <Hr style={hr} />
            <Text style={footer}>Sunny Stays Hurghada</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => data['subject'] || 'Sunny Stays Hurghada',
  displayName: 'Gast-Nachricht (Wohnung)',
  previewData: {
    heading: 'Ihre Anfrage ist angekommen',
    propertyName: 'Madaris Apartment',
    bodyText: 'Hallo Jana,\n\nwir haben Ihre Anfrage erhalten. Dies ist noch keine verbindliche Buchungsbestätigung.',
    language: 'de',
  },
} satisfies TemplateEntry

const hr = { borderColor: '#e3d9c6', margin: '28px 0 16px' }
const footer = {
  fontSize: '12px',
  color: '#8a8378',
  fontFamily: 'Arial, sans-serif',
  margin: '0',
}
