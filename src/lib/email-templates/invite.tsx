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

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="de" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>Du wurdest zu {siteName} eingeladen</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={eyebrow}>Hurghada · Red Sea</Text>
          <Heading style={brand}>{siteName}</Heading>
        </Section>
        <Section style={card}>
          <Heading style={h1}>Du bist eingeladen</Heading>
          <Text style={text}>
            Du wurdest eingeladen, {' '}
            <Link href={siteUrl} style={link}>
              <strong>{siteName}</strong>
            </Link>{' '}
            beizutreten. Nimm die Einladung an, um dein Konto einzurichten.
          </Text>
          <Button className="dm-btn" style={button} href={confirmationUrl}>
            Einladung annehmen
          </Button>
          <Text style={footer}>
            Wenn du diese Einladung nicht erwartest, kannst du diese E-Mail
            ignorieren.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail
