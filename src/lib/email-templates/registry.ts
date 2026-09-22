import type { ComponentType } from 'react'
import { template as bookingRequestHostTemplate } from './booking-request-host'
import { template as bookingRequestGuestTemplate } from './booking-request-guest'
import { template as propertyGuestNoticeTemplate } from './property-guest-notice'
import { template as internalNoticeTemplate } from './internal-notice'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'booking-request-host': bookingRequestHostTemplate,
  'booking-request-guest': bookingRequestGuestTemplate,
  'property-guest-notice': propertyGuestNoticeTemplate,
  'internal-notice': internalNoticeTemplate,
}
