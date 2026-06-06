'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Info } from 'lucide-react';
import {
  SCHOLARSHIP_SCHOOLS,
  SCHOOL_NAMES,
  ALL_COURSES,
  OTHER_SCHOOL_VALUE,
  OTHER_COURSE_VALUE,
  findSchool,
} from '@/lib/scholarship-schools';
import { submitScholarshipApplication } from '@/app/actions';

const SEX_OPTIONS = ['Male', 'Female', 'Prefer not to say'] as const;
const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Widowed', 'Separated'] as const;
const RELATIONSHIP_OPTIONS = ['Mother', 'Father', 'Guardian', 'Sibling', 'Spouse', 'Other'] as const;
const INCOME_BRACKETS = [
  'Below ₱10,000',
  '₱10,000–₱20,000',
  '₱20,001–₱40,000',
  '₱40,001–₱80,000',
  'Above ₱80,000',
] as const;
const YEAR_LEVELS = [
  'Incoming 1st Year',
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
  '5th Year',
  'Graduating',
] as const;

const GRAD_YEARS = Array.from({ length: 10 }, (_, i) => 2026 + i);

const clientSchema = z
  .object({
    lastName: z.string().trim().min(1, 'Last name is required.'),
    firstName: z.string().trim().min(1, 'First name is required.'),
    middleName: z.string().trim().optional().default(''),
    suffix: z.string().trim().optional().default(''),
    dateOfBirth: z.string().trim().min(1, 'Date of birth is required.'),
    sex: z.enum(SEX_OPTIONS, { errorMap: () => ({ message: 'Please select.' }) }),
    civilStatus: z.enum(CIVIL_STATUS_OPTIONS, { errorMap: () => ({ message: 'Please select.' }) }),

    homeAddress: z.string().trim().min(1, 'Home address is required.'),
    city: z.string().trim().min(1, 'City/Municipality is required.'),
    province: z.string().trim().min(1, 'Province is required.'),
    postalCode: z.string().trim().optional().default(''),
    mobile: z.string().trim().min(1, 'Mobile number is required.'),
    email: z.string().trim().email('A valid email is required.'),

    parentName: z.string().trim().min(1, "Parent/Guardian name is required."),
    parentRelationship: z.enum(RELATIONSHIP_OPTIONS, { errorMap: () => ({ message: 'Please select.' }) }),
    parentContact: z.string().trim().min(1, 'Contact number is required.'),
    incomeBracket: z.enum(INCOME_BRACKETS, { errorMap: () => ({ message: 'Please select.' }) }),

    school: z.string().trim().min(1, 'Please select a school.'),
    schoolOther: z.string().trim().optional().default(''),
    course: z.string().trim().min(1, 'Please select a course.'),
    courseOther: z.string().trim().optional().default(''),
    yearLevel: z.enum(YEAR_LEVELS, { errorMap: () => ({ message: 'Please select.' }) }),
    expectedGraduationYear: z.coerce.number().int().min(2026).max(2035),

    consentGiven: z
      .boolean()
      .refine((v) => v === true, { message: 'You must give your consent to submit.' }),
  })
  .superRefine((data, ctx) => {
    if (data.school === OTHER_SCHOOL_VALUE && !data.schoolOther) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['schoolOther'], message: 'Please specify your school.' });
    }
    if (data.course === OTHER_COURSE_VALUE && !data.courseOther) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['courseOther'], message: 'Please specify your course.' });
    }
  });

type FormValues = z.infer<typeof clientSchema>;

export default function ScholarshipApplyPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      lastName: '',
      firstName: '',
      middleName: '',
      suffix: '',
      dateOfBirth: '',
      sex: undefined as unknown as FormValues['sex'],
      civilStatus: undefined as unknown as FormValues['civilStatus'],
      homeAddress: '',
      city: '',
      province: 'Batangas',
      postalCode: '',
      mobile: '',
      email: '',
      parentName: '',
      parentRelationship: undefined as unknown as FormValues['parentRelationship'],
      parentContact: '',
      incomeBracket: undefined as unknown as FormValues['incomeBracket'],
      school: '',
      schoolOther: '',
      course: '',
      courseOther: '',
      yearLevel: undefined as unknown as FormValues['yearLevel'],
      expectedGraduationYear: 2026,
      consentGiven: false,
    },
  });

  const watchedSchool = form.watch('school');
  const watchedSchoolOther = form.watch('schoolOther');
  const watchedCourse = form.watch('course');
  const isOtherSchool = watchedSchool === OTHER_SCHOOL_VALUE;
  const isOtherCourse = watchedCourse === OTHER_COURSE_VALUE;

  const courseOptions: string[] = useMemo(() => {
    if (!watchedSchool || isOtherSchool) return [];
    return findSchool(watchedSchool)?.courses ?? [];
  }, [watchedSchool, isOtherSchool]);

  // Typeahead suggestions for the "Specify Course" field. If the applicant
  // typed a school that matches the official list, suggest that school's
  // courses; otherwise fall back to the union of all approved courses.
  const courseSuggestions: string[] = useMemo(() => {
    if (isOtherSchool) {
      const matched = findSchool(watchedSchoolOther);
      return matched?.courses ?? ALL_COURSES;
    }
    return findSchool(watchedSchool)?.courses ?? ALL_COURSES;
  }, [isOtherSchool, watchedSchool, watchedSchoolOther]);

  // When the school changes, reset course to a sensible default.
  const handleSchoolChange = (value: string) => {
    form.setValue('school', value, { shouldValidate: true });
    form.setValue('course', '');
    form.setValue('courseOther', '');
    if (value !== OTHER_SCHOOL_VALUE) {
      form.setValue('schoolOther', '');
    }
  };

  const handleCourseChange = (value: string) => {
    form.setValue('course', value, { shouldValidate: true });
    if (value !== OTHER_COURSE_VALUE) {
      form.setValue('courseOther', '');
    }
  };

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true);
    try {
      const result = await submitScholarshipApplication(values);
      if (!result.success) {
        toast({
          variant: 'destructive',
          title: 'Submission failed',
          description: result.error ?? 'Please review the form and try again.',
        });
        setIsSubmitting(false);
        return;
      }
      router.push(`/scholarship/thank-you?ref=${encodeURIComponent(result.referenceNo)}`);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Unexpected error',
        description: err?.message ?? 'Please try again.',
      });
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Scholarship Application</h2>
        <p className="text-sm text-muted-foreground">
          Please complete all required fields (marked with <span className="text-destructive">*</span>).
          Submitted applications are reviewed by the Office of Hon. Ryan Christian S. Recto.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* 1. Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">1. Personal Information</CardTitle>
              <CardDescription>Tell us who you are.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="middleName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Middle Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="suffix"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Suffix</FormLabel>
                    <FormControl><Input {...field} placeholder="Jr., III, etc." /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sex"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sex <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SEX_OPTIONS.map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="civilStatus"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Civil Status <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CIVIL_STATUS_OPTIONS.map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 2. Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">2. Contact Information</CardTitle>
              <CardDescription>How can we reach you?</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="homeAddress"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Home Address <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input {...field} placeholder="Street and Barangay" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City / Municipality <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="province"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Province <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="postalCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postal Code</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mobile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input {...field} placeholder="09XXXXXXXXX" inputMode="tel" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Email <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input type="email" {...field} placeholder="name@example.com" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 3. Parent / Guardian */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">3. Parent / Guardian Information</CardTitle>
              <CardDescription>Your parent or guardian's details.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="parentName"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Parent / Guardian Name <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="parentRelationship"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relationship <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {RELATIONSHIP_OPTIONS.map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="parentContact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent Contact No. <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input {...field} inputMode="tel" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="incomeBracket"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Monthly Household Income Bracket <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select bracket" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {INCOME_BRACKETS.map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 4. Educational Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">4. Educational Information</CardTitle>
              <CardDescription>School and program details.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="school"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>School / Institution <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={handleSchoolChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a school" /></SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-72">
                        {SCHOLARSHIP_SCHOOLS.map((s) => (
                          <SelectItem key={s.school} value={s.school}>{s.school}</SelectItem>
                        ))}
                        <SelectItem value={OTHER_SCHOOL_VALUE}>Other (please specify)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isOtherSchool && (
                <FormField
                  control={form.control}
                  name="schoolOther"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Specify School <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          list="school-suggestions"
                          autoComplete="off"
                          placeholder="Start typing your school name"
                        />
                      </FormControl>
                      <datalist id="school-suggestions">
                        {SCHOOL_NAMES.map((name) => (
                          <option key={name} value={name} />
                        ))}
                      </datalist>
                      <FormDescription>
                        Start typing — if your school is on the official list, select it from the
                        suggestions and it will be recognized automatically. Schools not on the list
                        will not be shortlisted automatically.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="course"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Course / Program <span className="text-destructive">*</span></FormLabel>
                    <Select
                      onValueChange={handleCourseChange}
                      value={field.value}
                      disabled={!watchedSchool}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={watchedSchool ? 'Select a course' : 'Select a school first'} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-72">
                        {isOtherSchool ? (
                          <SelectItem value={OTHER_COURSE_VALUE}>Other (please specify)</SelectItem>
                        ) : (
                          <>
                            {courseOptions.map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                            <SelectItem value={OTHER_COURSE_VALUE}>Other (please specify)</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isOtherCourse && (
                <FormField
                  control={form.control}
                  name="courseOther"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Specify Course <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          list="course-suggestions"
                          autoComplete="off"
                          placeholder="Start typing your course title"
                        />
                      </FormControl>
                      <datalist id="course-suggestions">
                        {courseSuggestions.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                      <FormDescription>
                        Start typing — if your course is on the official list, select it from the
                        suggestions and it will be recognized automatically. Courses not on the list
                        will not be shortlisted automatically.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="yearLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year Level <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {YEAR_LEVELS.map((y) => (
                          <SelectItem key={y} value={y}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expectedGraduationYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Year of Graduation <span className="text-destructive">*</span></FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(Number(v))}
                      value={field.value ? String(field.value) : undefined}
                    >
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {GRAD_YEARS.map((y) => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 5. Data Privacy Consent */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">5. Data Privacy Consent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert
                className="border-l-4"
                style={{ borderLeftColor: '#00A8E8', backgroundColor: 'rgba(0, 168, 232, 0.08)' }}
              >
                <Info className="h-4 w-4" style={{ color: '#00A8E8' }} />
                <AlertTitle>Data Privacy Notice (R.A. 10173)</AlertTitle>
                <AlertDescription className="text-sm leading-relaxed">
                  In compliance with the Data Privacy Act of 2012 (R.A. 10173), the Office of
                  Hon. Ryan Christian S. Recto will collect, process, store, and use the
                  personal information you provide solely for the evaluation and administration
                  of the Recto Tulong Dunong Scholarship Program. Your information will be
                  treated with strict confidentiality and will only be shared with authorized
                  personnel and partner institutions when necessary for program implementation.
                  You may withdraw your consent or request correction of your data at any time
                  by contacting the office.
                </AlertDescription>
              </Alert>

              <FormField
                control={form.control}
                name="consentGiven"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start gap-3 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label="Consent"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-tight">
                      <FormLabel className="font-normal">
                        I have read and understood the Data Privacy Notice above, and I voluntarily
                        give my consent to the collection, processing, storage, and use of my
                        personal information for the purposes stated. <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-end">
            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="text-white"
              style={{ backgroundColor: '#00A8E8' }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit My Application'
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
