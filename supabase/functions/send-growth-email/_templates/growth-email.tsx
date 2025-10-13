import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface Resource {
  title: string;
  description: string;
  url: string;
  type: string;
}

interface GrowthEmailProps {
  userName: string;
  subject: string;
  openingMessage: string;
  mainContent: string;
  actionableChallenge: string;
  resources: Resource[];
  closingMessage: string;
}

export const GrowthEmail = ({
  userName,
  subject,
  openingMessage,
  mainContent,
  actionableChallenge,
  resources,
  closingMessage,
}: GrowthEmailProps) => (
  <Html>
    <Head />
    <Preview>{subject}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Good morning, {userName}</Heading>
        
        <Text style={paragraph}>{openingMessage}</Text>
        
        <Section style={contentSection}>
          <Text style={paragraph}>{mainContent}</Text>
        </Section>

        <Section style={challengeSection}>
          <Text style={challengeLabel}>Today's Challenge:</Text>
          <Text style={challengeText}>{actionableChallenge}</Text>
        </Section>

        <Hr style={divider} />

        <Section style={playlistSection}>
          <Heading style={h2}>Your Growth Playlist</Heading>
          <Text style={playlistIntro}>I've handpicked these resources specifically for you:</Text>
          
          {resources.map((resource, index) => (
            <Section key={index} style={resourceCard}>
              <Text style={resourceType}>{resource.type.toUpperCase()}</Text>
              <Text style={resourceTitle}>{resource.title}</Text>
              <Text style={resourceDescription}>{resource.description}</Text>
              <Link href={resource.url} style={resourceLink}>
                Access Resource →
              </Link>
            </Section>
          ))}
        </Section>

        <Hr style={divider} />

        <Section style={closingSection}>
          <Text style={paragraph}>{closingMessage}</Text>
          <Text style={signature}>
            — Jericho<br />
            Your Growth Coach
          </Text>
        </Section>

        <Section style={footer}>
          <Text style={footerText}>
            <Link href={`${Deno.env.get('SUPABASE_URL')}/dashboard`} style={footerLink}>
              View Dashboard
            </Link>
            {' • '}
            <Link href={`${Deno.env.get('SUPABASE_URL')}/settings`} style={footerLink}>
              Email Preferences
            </Link>
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default GrowthEmail

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
}

const h1 = {
  color: '#1a1a1a',
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '40px 20px 20px',
  padding: '0',
  lineHeight: '1.3',
}

const h2 = {
  color: '#1a1a1a',
  fontSize: '22px',
  fontWeight: 'bold',
  margin: '30px 0 15px',
  padding: '0',
}

const paragraph = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '16px 20px',
}

const contentSection = {
  padding: '0 20px',
}

const challengeSection = {
  backgroundColor: '#f0f7ff',
  borderLeft: '4px solid #0066cc',
  padding: '20px',
  margin: '30px 20px',
  borderRadius: '4px',
}

const challengeLabel = {
  color: '#0066cc',
  fontSize: '14px',
  fontWeight: 'bold',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 8px',
}

const challengeText = {
  color: '#1a1a1a',
  fontSize: '18px',
  fontWeight: '600',
  lineHeight: '1.5',
  margin: '0',
}

const divider = {
  borderColor: '#e6e6e6',
  margin: '30px 20px',
}

const playlistSection = {
  padding: '0 20px',
}

const playlistIntro = {
  color: '#666',
  fontSize: '15px',
  margin: '0 0 20px',
}

const resourceCard = {
  backgroundColor: '#fafafa',
  border: '1px solid #e6e6e6',
  borderRadius: '8px',
  padding: '20px',
  marginBottom: '16px',
}

const resourceType = {
  color: '#0066cc',
  fontSize: '12px',
  fontWeight: 'bold',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 8px',
}

const resourceTitle = {
  color: '#1a1a1a',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0 0 8px',
  lineHeight: '1.4',
}

const resourceDescription = {
  color: '#666',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0 0 12px',
}

const resourceLink = {
  backgroundColor: '#0066cc',
  borderRadius: '4px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: '600',
  padding: '10px 20px',
  textDecoration: 'none',
}

const closingSection = {
  padding: '0 20px',
  marginTop: '30px',
}

const signature = {
  color: '#1a1a1a',
  fontSize: '16px',
  fontWeight: '600',
  margin: '30px 20px 0',
  lineHeight: '1.5',
}

const footer = {
  padding: '20px',
  textAlign: 'center' as const,
}

const footerText = {
  color: '#999',
  fontSize: '13px',
  lineHeight: '1.5',
}

const footerLink = {
  color: '#0066cc',
  textDecoration: 'underline',
}
