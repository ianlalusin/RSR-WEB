import schoolsJson from './data/scholarship-schools.json';
import type { ScholarshipSchool, ShortlistResult } from './types/scholarship';

/**
 * The official list of 56 schools qualified under the Recto Tulong Dunong
 * Scholarship Program. Imported from the canonical JSON in src/lib/data/.
 *
 * Each school carries its specific approved course list. The list is
 * pre-sorted alphabetically (by school name) so callers can render the
 * dropdown directly.
 */
export const SCHOLARSHIP_SCHOOLS: ScholarshipSchool[] = (schoolsJson as ScholarshipSchool[])
  .slice()
  .sort((a, b) => a.school.localeCompare(b.school));

export const SCHOOL_NAMES: string[] = SCHOLARSHIP_SCHOOLS.map((s) => s.school);

const SCHOOL_BY_NAME: Record<string, ScholarshipSchool> = SCHOLARSHIP_SCHOOLS.reduce(
  (acc, s) => {
    acc[s.school.trim().toLowerCase()] = s;
    return acc;
  },
  {} as Record<string, ScholarshipSchool>,
);

export const OTHER_SCHOOL_VALUE = '__other__';
export const OTHER_COURSE_VALUE = '__other__';

export function findSchool(name: string | undefined | null): ScholarshipSchool | null {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  return SCHOOL_BY_NAME[key] ?? null;
}

export function schoolHasCourse(schoolName: string, courseName: string): boolean {
  const school = findSchool(schoolName);
  if (!school) return false;
  const target = courseName.trim().toLowerCase();
  return school.courses.some((c) => c.trim().toLowerCase() === target);
}

/**
 * Eligibility / shortlisting rule for the Recto Tulong Dunong program.
 *
 * An applicant is shortlisted if and only if BOTH:
 *   - the selected school is one of the 56 qualified schools (not "Other"),
 *   - the selected course is in that school's approved course list.
 *
 * Anything else (Other school, Other course, school+course mismatch) is
 * not shortlisted — with a human-readable reason captured for auditing.
 */
export function evaluateShortlist(input: {
  school: string;
  schoolOther?: string;
  course: string;
  courseOther?: string;
}): ShortlistResult {
  const isOtherSchool = input.school === OTHER_SCHOOL_VALUE;
  const isOtherCourse = input.course === OTHER_COURSE_VALUE;

  if (isOtherSchool) {
    return {
      isShortlisted: false,
      reason: 'School not in the list of 56 qualified schools.',
    };
  }

  const school = findSchool(input.school);
  if (!school) {
    return {
      isShortlisted: false,
      reason: 'School could not be matched to the qualified-school list.',
    };
  }

  if (isOtherCourse) {
    return {
      isShortlisted: false,
      reason: `Course not in the approved course list for ${school.school}.`,
    };
  }

  if (!schoolHasCourse(school.school, input.course)) {
    return {
      isShortlisted: false,
      reason: `Course "${input.course}" is not on the approved list for ${school.school}.`,
    };
  }

  return {
    isShortlisted: true,
    reason: `School and course matched the qualified list for ${school.school}.`,
  };
}
