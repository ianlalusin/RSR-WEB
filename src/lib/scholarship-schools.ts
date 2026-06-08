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

/**
 * Flat, de-duplicated, alphabetically sorted union of every course across all
 * qualified schools. Used as the typeahead suggestion pool for the course
 * "Other" field when the school could not be narrowed to a single institution.
 */
export const ALL_COURSES: string[] = Array.from(
  new Set(SCHOLARSHIP_SCHOOLS.flatMap((s) => s.courses.map((c) => c.trim()))),
).sort((a, b) => a.localeCompare(b));

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

export interface ResolvedSchool {
  /** Canonical school name, or OTHER_SCHOOL_VALUE when it is genuinely off-list. */
  school: string;
  /** Free-text school name, only when genuinely off-list; '' otherwise. */
  schoolOther: string;
  /** True when the applicant chose "Other" but their text matched a listed school. */
  routedBack: boolean;
}

/**
 * Resolves a school selection back to the canonical list where possible.
 *
 * Applicants sometimes pick "Other" and then type a school that IS on the
 * official list (they just missed it in the dropdown). When their typed value
 * matches a qualified school (case-insensitive), we route the selection back to
 * the canonical school so it stores cleanly and shortlists normally — instead
 * of being treated as an off-list "Other".
 */
export function resolveSchoolInput(school: string, schoolOther?: string): ResolvedSchool {
  if (school !== OTHER_SCHOOL_VALUE) {
    return { school, schoolOther: '', routedBack: false };
  }
  const typed = (schoolOther ?? '').trim();
  const match = findSchool(typed);
  if (match) {
    return { school: match.school, schoolOther: '', routedBack: true };
  }
  return { school: OTHER_SCHOOL_VALUE, schoolOther: typed, routedBack: false };
}

export interface ResolvedCourse {
  /** Canonical course name, or OTHER_COURSE_VALUE when it is genuinely off-list. */
  course: string;
  /** Free-text course title, only when genuinely off-list; '' otherwise. */
  courseOther: string;
  /** True when the applicant chose "Other" but their text matched a listed course. */
  routedBack: boolean;
}

/**
 * Resolves a course selection back to the (already-resolved) school's approved
 * course list where possible. Mirrors {@link resolveSchoolInput} for the
 * course/program field, so a typed-in course that matches the school's list is
 * stored canonically rather than as an off-list "Other".
 */
export function resolveCourseInput(
  resolvedSchoolName: string,
  course: string,
  courseOther?: string,
): ResolvedCourse {
  if (course !== OTHER_COURSE_VALUE) {
    return { course, courseOther: '', routedBack: false };
  }
  const typed = (courseOther ?? '').trim();
  const school = findSchool(resolvedSchoolName);
  if (school) {
    const match = school.courses.find((c) => c.trim().toLowerCase() === typed.toLowerCase());
    if (match) {
      return { course: match, courseOther: '', routedBack: true };
    }
  }
  return { course: OTHER_COURSE_VALUE, courseOther: typed, routedBack: false };
}

/** The priority locality for the Recto/CHED Tulong Dunong program. */
export const PRIORITY_CITY = 'Lipa City';

/** True when the given city is the priority locality (Lipa City), case-insensitive. */
export function isLipaCity(city?: string | null): boolean {
  return (city ?? '').trim().toLowerCase() === PRIORITY_CITY.toLowerCase();
}

export interface PriorityBreakdown {
  shortlisted: boolean;
  lipaCity: boolean;
  idUploaded: boolean;
  noOtherScholarship: boolean;
}

export interface PriorityResult {
  score: number; // 0–4
  breakdown: PriorityBreakdown;
}

/**
 * Priority score (0–4) for ranking applicants. One point each for:
 *  - school AND course on the official list (isShortlisted),
 *  - residing in Lipa City,
 *  - a government-issued ID uploaded (proof of residency),
 *  - NOT being a beneficiary of another scholarship grant.
 *
 * `hasOtherScholarship === undefined` (older records that predate the field)
 * scores 0 for the last factor.
 */
export function computePriorityScore(input: {
  isShortlisted: boolean;
  city?: string | null;
  hasProof: boolean;
  hasOtherScholarship?: boolean;
}): PriorityResult {
  const breakdown: PriorityBreakdown = {
    shortlisted: input.isShortlisted === true,
    lipaCity: isLipaCity(input.city),
    idUploaded: input.hasProof === true,
    noOtherScholarship: input.hasOtherScholarship === false,
  };
  const score =
    (breakdown.shortlisted ? 1 : 0) +
    (breakdown.lipaCity ? 1 : 0) +
    (breakdown.idUploaded ? 1 : 0) +
    (breakdown.noOtherScholarship ? 1 : 0);
  return { score, breakdown };
}
