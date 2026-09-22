import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
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
  link,
  main,
  text,
} from './brand'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="de" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>Bitte bestätige deine E-Mail-Adresse für {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={eyebrow}>Hurghada · Red Sea</Text>
          <Heading style={brand}>{siteName}</Heading>
        </Section>
        <Section style={card}>
          <Heading style={h1}>E-Mail bestätigen</Heading>
          <Text style={text}>
            Willkommen bei{' '}
            <Link href={siteUrl} style={link}>
              <strong>{siteName}</strong>
            </Link>
            . Bitte bestätige deine Adresse ({recipient}), um dein Konto zu
            aktivieren.
          </Text>
          <Button className="dm-btn" style={button} href={confirmationUrl}>
            E-Mail bestätigen
          </Button>
          <Text style={footer}>
            Falls du dich nicht registriert hast, kannst du diese E-Mail
            einfach ignorieren.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail
