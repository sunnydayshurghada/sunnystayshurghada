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

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="de" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>Passwort zurücksetzen für {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={eyebrow}>Hurghada · Red Sea</Text>
          <Heading style={brand}>{siteName}</Heading>
        </Section>
        <Section style={card}>
          <Heading style={h1}>Passwort zurücksetzen</Heading>
          <Text style={text}>
            Wir haben eine Anfrage erhalten, dein Passwort für {siteName}
            zurückzusetzen. Klicke auf den Button, um ein neues Passwort zu
            wählen.
          </Text>
          <Button className="dm-btn" style={button} href={confirmationUrl}>
            Neues Passwort wählen
          </Button>
          <Text style={footer}>
            Wenn du das nicht angefordert hast, ignoriere diese E-Mail. Dein
            Passwort bleibt unverändert.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail
