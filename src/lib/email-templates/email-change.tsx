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

interface EmailChangeEmailProps {
  siteName: string
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail to read
  // "from OLD to NEW" instead of "from NEW to NEW".
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="de" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>Bestätige deine neue E-Mail-Adresse für {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={eyebrow}>Hurghada · Red Sea</Text>
          <Heading style={brand}>{siteName}</Heading>
        </Section>
        <Section style={card}>
          <Heading style={h1}>Neue E-Mail bestätigen</Heading>
          <Text style={text}>
            Für dein Konto bei {siteName} wurde eine Änderung der
            E-Mail-Adresse angefordert: von {oldEmail || email} zu{' '}
            {newEmail || email}.
          </Text>
          <Button className="dm-btn" style={button} href={confirmationUrl}>
            Änderung bestätigen
          </Button>
          <Text style={footer}>
            Wenn du diese Änderung nicht angefordert hast, ignoriere diese
            E-Mail. Deine Adresse bleibt dann unverändert.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail
