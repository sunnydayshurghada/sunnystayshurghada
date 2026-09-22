import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

import {
  brand,
  button,
  card,
  container,
  darkModeCss,
  eyebrow,
  footer,
  h1,
  header,
  main,
  text,
} from './brand'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="de" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>Dein Login-Link für {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={eyebrow}>Hurghada · Red Sea</Text>
          <Heading style={brand}>{siteName}</Heading>
        </Section>
        <Section style={card}>
          <Heading style={h1}>Dein Login-Link</Heading>
          <Text style={text}>
            Klicke auf den Button, um dich bei {siteName} anzumelden. Der Link
            ist nur kurze Zeit gültig.
          </Text>
          <Button className="dm-btn" style={button} href={confirmationUrl}>
            Jetzt anmelden
          </Button>
          <Text style={footer}>
            Wenn du diese Anmeldung nicht angefordert hast, ignoriere diese
            E-Mail einfach.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail
