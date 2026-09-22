import * as React from 'react'

import {
  Body,
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
  card,
  code,
  container,
  darkModeCss,
  eyebrow,
  footer,
  h1,
  header,
  main,
  text,
} from './brand'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({
  token,
}: ReauthenticationEmailProps) => (
  <Html lang="de" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>Dein Bestätigungscode</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={eyebrow}>Hurghada · Red Sea</Text>
          <Heading style={brand}>Sunny Stays Hurghada</Heading>
        </Section>
        <Section style={card}>
          <Heading style={h1}>Dein Bestätigungscode</Heading>
          <Text style={text}>
            Gib diesen Code ein, um deine Identität zu bestätigen:
          </Text>
          <Text style={code}>{token}</Text>
          <Text style={footer}>
            Wenn du diesen Code nicht angefordert hast, ignoriere diese E-Mail.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail
