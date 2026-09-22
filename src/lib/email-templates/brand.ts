// Shared brand styling for Sunny Stays Hurghada auth emails.
// Navy #173B63, Gold #C8A15A, Sand #F7F2EA.

export const main = {
  backgroundColor: '#ffffff',
  fontFamily: 'Georgia, Times New Roman, serif',
}

export const container = {
  padding: '0',
  maxWidth: '560px',
  margin: '0 auto',
}

export const header = {
  backgroundColor: '#173B63',
  padding: '28px 32px',
  borderRadius: '12px 12px 0 0',
}

export const brand = {
  color: '#ffffff',
  fontSize: '20px',
  letterSpacing: '1px',
  margin: '0',
  fontWeight: 'normal' as const,
}

export const eyebrow = {
  color: '#C8A15A',
  fontSize: '11px',
  letterSpacing: '3px',
  textTransform: 'uppercase' as const,
  margin: '0 0 8px',
  fontFamily: 'Arial, sans-serif',
}

export const card = {
  backgroundColor: '#F7F2EA',
  padding: '32px',
  borderRadius: '0 0 12px 12px',
}

export const h1 = {
  fontSize: '24px',
  fontWeight: 'normal' as const,
  color: '#173B63',
  margin: '0 0 20px',
}

export const text = {
  fontSize: '15px',
  color: '#3d4754',
  lineHeight: '1.6',
  margin: '0 0 22px',
  fontFamily: 'Arial, sans-serif',
}

export const link = { color: '#173B63', textDecoration: 'underline' }

export const button = {
  backgroundColor: '#C8A15A',
  color: '#173B63',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  border: '1px solid #C8A15A',
  borderRadius: '999px',
  padding: '14px 28px',
  textDecoration: 'none',
  fontFamily: 'Arial, sans-serif',
  letterSpacing: '0.5px',
}

export const code = {
  fontSize: '30px',
  letterSpacing: '8px',
  color: '#173B63',
  fontWeight: 'bold' as const,
  margin: '0 0 24px',
}

export const footer = {
  fontSize: '12px',
  color: '#8a8378',
  margin: '28px 0 0',
  lineHeight: '1.6',
  fontFamily: 'Arial, sans-serif',
}

// Rendered as a text child, which React may HTML-escape: keep this CSS free of >, &, and quotes.
export const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    .dm-btn { background-color: #C8A15A !important; color: #173B63 !important; }
  }
  [data-ogsc] .dm-btn { background-color: #C8A15A !important; color: #173B63 !important; }
  [data-ogsb] .dm-btn { background-color: #C8A15A !important; color: #173B63 !important; }
`
