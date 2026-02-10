/**
 * Shared constants for component names and mappings
 * Centralizes component name strings to avoid duplication and typos
 */

/**
 * Component names used for routing and rendering
 */
export const COMPONENT_NAMES = {
  ACADEMIC_OVERVIEW: 'AcademicOverviewPage',
  PERSONAL_PROJECTS_OVERVIEW: 'PersonalProjectsOverviewPage',
  PROFESSIONAL_PROJECTS_OVERVIEW: 'ProfessionalProjectsOverviewPage',
  CONTACT_FORM: 'ContactForm',
} as const;

/**
 * Type for component names
 */
export type ComponentName = typeof COMPONENT_NAMES[keyof typeof COMPONENT_NAMES];

/**
 * Maps data type strings to their corresponding component names
 * Used by ContentRepository for shareable link resolution
 */
export const DATA_TYPE_TO_COMPONENT: Record<string, ComponentName> = {
  'academic': COMPONENT_NAMES.ACADEMIC_OVERVIEW,
  'work': COMPONENT_NAMES.PROFESSIONAL_PROJECTS_OVERVIEW,
  'projects': COMPONENT_NAMES.PERSONAL_PROJECTS_OVERVIEW,
} as const;
