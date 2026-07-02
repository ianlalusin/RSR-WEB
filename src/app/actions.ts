'use server';

import {
  generateBarangayProfiles as generateBarangayProfilesFlow,
  type GenerateBarangayProfilesInput,
} from '@/ai/flows/generate-barangay-profiles';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { ProjectRecord, Barangay, BarangayCycle, BarangayCycleStats, CaptainProfile, UserProfile, Department, Role, MedicalRecord, Hospital, RequestRecord, RequestStatus, TaskRecord, TaskStatus, AuditLog, AnalyticsData } from '@/lib/types';
import type { Query } from 'firebase-admin/firestore';
import type {
  ScholarshipApplication,
  ScholarshipSex,
  ScholarshipCivilStatus,
  ScholarshipRelationship,
  ScholarshipIncomeBracket,
  ScholarshipYearLevel,
  ScholarshipFormConfig,
  ScholarshipFormStatus,
  ScholarshipFormStatusMode,
} from '@/lib/types/scholarship';
import { evaluateShortlist, resolveSchoolInput, resolveCourseInput, computePriorityScore, yearLevelPriorityPoints, computeFormStatus, DEFAULT_SCHOLARSHIP_FORM_CONFIG, OTHER_SCHOOL_VALUE, OTHER_COURSE_VALUE } from '@/lib/scholarship-schools';
import { canViewPage, canDo } from '@/lib/access';
import { logAudit } from '@/lib/audit';
import { assertActor, type VerifiedActor } from '@/lib/server-auth';
import { randomBytes } from 'crypto';
import { z } from 'zod';

type ActorToken = string;

async function resolveActor(token: ActorToken): Promise<VerifiedActor> {
  return assertActor(token);
}

export async function generateBarangayProfiles(input: GenerateBarangayProfilesInput, actorToken: ActorToken) {
  try {
    const actor = await resolveActor(actorToken);
    const result = await generateBarangayProfilesFlow(input);

    await logAudit({
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: 'generate_ai_profile',
      entityType: 'barangay',
      entityId: input.barangayName,
      details: { input, profileCount: result.profiles.length }
    });

    if (!result || !result.profiles) {
      throw new Error("AI failed to generate profiles.");
    }
    return { success: true, data: result.profiles };
  } catch (error) {
    console.error('Error generating barangay profiles:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { success: false, error: `Failed to generate profiles: ${errorMessage}` };
  }
}

export interface AddBarangayInput {
    name: string;
    districtId: string;
    districtName: string;
    population: number;
    congVisitCount?: number;
    coordinatorUids?: string[];
    cycleYear: string;
    cycleStats: BarangayCycleStats;
}

function buildListItem(brgy: { name: string; districtId: string; districtName: string; population: number }, cycleYear: string, stats: BarangayCycleStats) {
    return {
        name: brgy.name,
        districtId: brgy.districtId,
        districtName: brgy.districtName,
        population: brgy.population,
        currentCycle: cycleYear,
        votingPopulation: stats.votingPopulation,
        rsrVotes: stats.rsrVotes,
        favoredVotePct: stats.favoredVotePct,
        isWin: stats.isWin,
    };
}

export async function addBarangay(data: AddBarangayInput, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const batch = adminDb.batch();
        const newBrgyRef = adminDb.collection('barangays').doc();

        batch.set(newBrgyRef, {
            name: data.name,
            districtId: data.districtId,
            districtName: data.districtName,
            population: data.population,
            congVisitCount: data.congVisitCount ?? 0,
            coordinatorUids: data.coordinatorUids ?? [],
            currentCycle: data.cycleYear,
            currentStats: data.cycleStats,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        const cycleRef = newBrgyRef.collection('cycles').doc(data.cycleYear);
        batch.set(cycleRef, {
            year: data.cycleYear,
            ...data.cycleStats,
            captain: { name: '' },
            secretary: {},
            councilors: [],
            createdAt: FieldValue.serverTimestamp(),
            createdByUid: actor.uid,
            createdByEmail: actor.email,
            updatedAt: FieldValue.serverTimestamp(),
            updatedByUid: actor.uid,
            updatedByEmail: actor.email,
        });

        const listDocRef = adminDb.collection('lists').doc('barangays');
        batch.set(listDocRef, {
            barangays: {
                [newBrgyRef.id]: buildListItem(data, data.cycleYear, data.cycleStats),
            }
        }, { merge: true });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'create',
            entityType: 'barangay',
            entityId: newBrgyRef.id,
            districtId: data.districtId,
            details: data,
        });

        await batch.commit();
        return { success: true, id: newBrgyRef.id };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export type UpdateBarangayInput = Partial<Pick<Barangay, 'name' | 'districtId' | 'districtName' | 'population' | 'congVisitCount' | 'coordinatorUids'>>;

export async function updateBarangay(id: string, data: UpdateBarangayInput, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const batch = adminDb.batch();
        const brgyDoc = adminDb.collection('barangays').doc(id);

        batch.update(brgyDoc, {
            ...data,
            updatedAt: FieldValue.serverTimestamp(),
        });

        const listUpdateData: Record<string, any> = {};
        if (data.name !== undefined) listUpdateData[`barangays.${id}.name`] = data.name;
        if (data.districtId !== undefined) listUpdateData[`barangays.${id}.districtId`] = data.districtId;
        if (data.districtName !== undefined) listUpdateData[`barangays.${id}.districtName`] = data.districtName;
        if (data.population !== undefined) listUpdateData[`barangays.${id}.population`] = data.population;

        if (Object.keys(listUpdateData).length > 0) {
            const listDocRef = adminDb.collection('lists').doc('barangays');
            batch.update(listDocRef, listUpdateData);
        }

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'update',
            entityType: 'barangay',
            entityId: id,
            details: data,
        });

        await batch.commit();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteBarangay(id: string, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const batch = adminDb.batch();
        const brgyDoc = adminDb.collection('barangays').doc(id);
        batch.delete(brgyDoc);

        const listDocRef = adminDb.collection('lists').doc('barangays');
        batch.update(listDocRef, {
            [`barangays.${id}`]: FieldValue.delete()
        });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'delete',
            entityType: 'barangay',
            entityId: id,
        });

        await batch.commit();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function bulkAddBarangays(data: AddBarangayInput[], actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const batch = adminDb.batch();

        const listUpdates: Record<string, any> = {};

        data.forEach(brgyData => {
            const docRef = adminDb.collection('barangays').doc();
            batch.set(docRef, {
                name: brgyData.name,
                districtId: brgyData.districtId,
                districtName: brgyData.districtName,
                population: brgyData.population,
                congVisitCount: brgyData.congVisitCount ?? 0,
                coordinatorUids: brgyData.coordinatorUids ?? [],
                currentCycle: brgyData.cycleYear,
                currentStats: brgyData.cycleStats,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });

            const cycleRef = docRef.collection('cycles').doc(brgyData.cycleYear);
            batch.set(cycleRef, {
                year: brgyData.cycleYear,
                ...brgyData.cycleStats,
                captain: { name: '' },
                secretary: {},
                councilors: [],
                createdAt: FieldValue.serverTimestamp(),
                createdByUid: actor.uid,
                createdByEmail: actor.email,
                updatedAt: FieldValue.serverTimestamp(),
                updatedByUid: actor.uid,
                updatedByEmail: actor.email,
            });

            listUpdates[docRef.id] = buildListItem(brgyData, brgyData.cycleYear, brgyData.cycleStats);
        });

        const listDocRef = adminDb.collection('lists').doc('barangays');
        batch.set(listDocRef, { barangays: listUpdates }, { merge: true });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'bulk_update',
            entityType: 'system',
            entityId: 'barangays_collection',
            details: { operation: 'bulkAddBarangays', count: data.length },
        });

        await batch.commit();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export type UpsertCycleInput = Partial<{
    votingPopulation: number;
    rsrVotes: number;
    favoredVotePct: number;
    isWin: boolean;
    captain: BarangayCycle['captain'];
    secretary: BarangayCycle['secretary'];
    councilors: BarangayCycle['councilors'];
}>;

export async function upsertBarangayCycle(brgyId: string, year: string, data: UpsertCycleInput, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const batch = adminDb.batch();

        const brgyRef = adminDb.collection('barangays').doc(brgyId);
        const cycleRef = brgyRef.collection('cycles').doc(year);

        const brgySnap = await brgyRef.get();
        if (!brgySnap.exists) {
            return { success: false, error: 'Barangay not found.' };
        }
        const brgyData = brgySnap.data() as Barangay;
        const cycleSnap = await cycleRef.get();
        const isCreating = !cycleSnap.exists;

        const updateData: Record<string, any> = {
            ...data,
            year,
            updatedAt: FieldValue.serverTimestamp(),
            updatedByUid: actor.uid,
            updatedByEmail: actor.email,
        };

        if (isCreating) {
            batch.set(cycleRef, {
                votingPopulation: 0,
                rsrVotes: 0,
                favoredVotePct: 0,
                isWin: false,
                captain: { name: '' },
                secretary: {},
                councilors: [],
                ...updateData,
                createdAt: FieldValue.serverTimestamp(),
                createdByUid: actor.uid,
                createdByEmail: actor.email,
            });
        } else {
            batch.update(cycleRef, updateData);
        }

        const touchedStats = data.votingPopulation !== undefined || data.rsrVotes !== undefined || data.favoredVotePct !== undefined || data.isWin !== undefined;
        if (touchedStats && brgyData.currentCycle === year) {
            const existing = (cycleSnap.exists ? cycleSnap.data() : {}) as Partial<BarangayCycle>;
            const nextStats: BarangayCycleStats = {
                votingPopulation: data.votingPopulation ?? existing.votingPopulation ?? 0,
                rsrVotes: data.rsrVotes ?? existing.rsrVotes ?? 0,
                favoredVotePct: data.favoredVotePct ?? existing.favoredVotePct ?? 0,
                isWin: data.isWin ?? existing.isWin ?? false,
            };
            batch.update(brgyRef, {
                currentStats: nextStats,
                updatedAt: FieldValue.serverTimestamp(),
            });
            const listDocRef = adminDb.collection('lists').doc('barangays');
            batch.update(listDocRef, {
                [`barangays.${brgyId}.votingPopulation`]: nextStats.votingPopulation,
                [`barangays.${brgyId}.rsrVotes`]: nextStats.rsrVotes,
                [`barangays.${brgyId}.favoredVotePct`]: nextStats.favoredVotePct,
                [`barangays.${brgyId}.isWin`]: nextStats.isWin,
                [`barangays.${brgyId}.currentCycle`]: year,
            });
        }

        await batch.commit();

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: isCreating ? 'create' : 'update',
            entityType: 'barangayCycle',
            entityId: `${brgyId}/${year}`,
            details: { year, ...data },
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function setCurrentCycle(brgyId: string, year: string, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);

        const brgyRef = adminDb.collection('barangays').doc(brgyId);
        const cycleRef = brgyRef.collection('cycles').doc(year);
        const cycleSnap = await cycleRef.get();
        if (!cycleSnap.exists) {
            return { success: false, error: 'Cycle does not exist for this barangay.' };
        }
        const cycle = cycleSnap.data() as BarangayCycle;
        const stats: BarangayCycleStats = {
            votingPopulation: cycle.votingPopulation ?? 0,
            rsrVotes: cycle.rsrVotes ?? 0,
            favoredVotePct: cycle.favoredVotePct ?? 0,
            isWin: cycle.isWin ?? false,
        };

        const batch = adminDb.batch();
        batch.update(brgyRef, {
            currentCycle: year,
            currentStats: stats,
            updatedAt: FieldValue.serverTimestamp(),
        });

        const listDocRef = adminDb.collection('lists').doc('barangays');
        batch.update(listDocRef, {
            [`barangays.${brgyId}.currentCycle`]: year,
            [`barangays.${brgyId}.votingPopulation`]: stats.votingPopulation,
            [`barangays.${brgyId}.rsrVotes`]: stats.rsrVotes,
            [`barangays.${brgyId}.favoredVotePct`]: stats.favoredVotePct,
            [`barangays.${brgyId}.isWin`]: stats.isWin,
        });

        await batch.commit();

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'update',
            entityType: 'barangay',
            entityId: brgyId,
            details: { action: 'setCurrentCycle', year },
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}


export async function updateUserAccess(uid: string, data: Partial<UserProfile>, actorToken: ActorToken, originalData: Partial<UserProfile>) {
    try {
        const actor = await resolveActor(actorToken);
        const userDoc = adminDb.collection('users').doc(uid);
        await userDoc.update({ ...data, updatedAt: FieldValue.serverTimestamp() });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'access_update',
            entityType: 'user',
            entityId: uid,
            details: { before: originalData, after: data },
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateSelfProfile(uid: string, data: { displayName: string, photoURL: string }, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        if (actor.uid !== uid) {
            return { success: false, error: 'Permission denied. You can only update your own profile.' };
        }

        const userDoc = adminDb.collection('users').doc(uid);
        await userDoc.update({
            displayName: data.displayName,
            photoURL: data.photoURL,
            updatedAt: FieldValue.serverTimestamp(),
        });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'update',
            entityType: 'user',
            entityId: uid,
            details: { self_profile_update: data },
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Legacy entry point — routes captain/secretary/councilors updates into the
 * current cycle subcollection. New callers should use `upsertBarangayCycle`.
 */
export async function updateCaptainProfile(brgyId: string, _isCreating: boolean, data: Partial<Omit<CaptainProfile, 'createdAt'>>, actorToken: ActorToken) {
    try {
        const brgySnap = await adminDb.collection('barangays').doc(brgyId).get();
        if (!brgySnap.exists) return { success: false, error: 'Barangay not found.' };
        const currentCycle = (brgySnap.data() as Barangay).currentCycle;
        if (!currentCycle) return { success: false, error: 'No current cycle set for this barangay.' };

        const cycleUpdate: UpsertCycleInput = {};
        if (data.captain !== undefined) cycleUpdate.captain = data.captain as BarangayCycle['captain'];
        if (data.secretary !== undefined) cycleUpdate.secretary = data.secretary;
        if (data.councilors !== undefined) cycleUpdate.councilors = data.councilors;

        return upsertBarangayCycle(brgyId, currentCycle, cycleUpdate, actorToken);
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

type AddProjectData = Omit<ProjectRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdByUid'>;

export async function addProjectRecord(data: AddProjectData, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const newRecordRef = adminDb.collection('projectRecords').doc();
        await newRecordRef.set({
            ...data,
            createdByUid: actor.uid,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'create',
            entityType: 'projectRecord',
            entityId: newRecordRef.id,
            details: data,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateProjectRecord(id: string, data: Partial<Omit<ProjectRecord, 'id'>>, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const recordDoc = adminDb.collection('projectRecords').doc(id);
        await recordDoc.update({
            ...data,
            updatedAt: FieldValue.serverTimestamp(),
        });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'update',
            entityType: 'projectRecord',
            entityId: id,
            details: data,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteProjectRecord(id: string, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        await adminDb.collection('projectRecords').doc(id).delete();

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'delete',
            entityType: 'projectRecord',
            entityId: id,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

type AddDepartmentData = Omit<Department, 'id' | 'createdAt' | 'updatedAt'>;

export async function addDepartment(data: AddDepartmentData, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const newDeptId = adminDb.collection('_').doc().id;
        const listDocRef = adminDb.collection('lists').doc('departments');

        const newItemData = {
            ...data,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        await listDocRef.set({
            departments: { [newDeptId]: newItemData }
        }, { merge: true });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'create',
            entityType: 'department',
            entityId: newDeptId,
            details: data,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateDepartment(id: string, data: Partial<Omit<Department, 'id' | 'createdAt' | 'updatedAt'>>, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const listDocRef = adminDb.collection('lists').doc('departments');

        const updatePayload: Record<string, any> = {
            [`departments.${id}.updatedAt`]: FieldValue.serverTimestamp()
        };
        if (data.name !== undefined) updatePayload[`departments.${id}.name`] = data.name;
        if (data.description !== undefined) updatePayload[`departments.${id}.description`] = data.description;
        if (data.pageVisibility !== undefined) updatePayload[`departments.${id}.pageVisibility`] = data.pageVisibility;

        await listDocRef.update(updatePayload);

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'update',
            entityType: 'department',
            entityId: id,
            details: data,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteDepartment(id: string, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const listDocRef = adminDb.collection('lists').doc('departments');
        await listDocRef.update({ [`departments.${id}`]: FieldValue.delete() });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'delete',
            entityType: 'department',
            entityId: id,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}


type AddRoleData = { name: string };

export async function addRole(data: AddRoleData, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const newRoleId = adminDb.collection('_').doc().id;
        const listDocRef = adminDb.collection('lists').doc('roles');

        const newItemData = {
            name: data.name,
            rank: 20,
            scopeBreadth: 'own_districts',
            isBuiltIn: false,
            status: 'active',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        await listDocRef.set({ roles: { [newRoleId]: newItemData } }, { merge: true });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'create',
            entityType: 'role',
            entityId: newRoleId,
            details: data,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateRole(id: string, data: Partial<Omit<Role, 'id' | 'createdAt' | 'updatedAt'>>, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const listDocRef = adminDb.collection('lists').doc('roles');

        const snap = await listDocRef.get();
        const existing = snap.exists ? (snap.data() as any)?.roles?.[id] : null;
        if (existing?.isBuiltIn && (data.rank !== undefined || data.scopeBreadth !== undefined || data.isBuiltIn !== undefined)) {
            throw new Error('Cannot change rank, scopeBreadth, or isBuiltIn on a built-in role.');
        }

        const updatePayload: Record<string, any> = {
            [`roles.${id}.updatedAt`]: FieldValue.serverTimestamp()
        };
        if (data.name !== undefined) updatePayload[`roles.${id}.name`] = data.name;
        if (data.rank !== undefined && !existing?.isBuiltIn) updatePayload[`roles.${id}.rank`] = data.rank;
        if (data.scopeBreadth !== undefined && !existing?.isBuiltIn) updatePayload[`roles.${id}.scopeBreadth`] = data.scopeBreadth;
        if (data.status !== undefined) updatePayload[`roles.${id}.status`] = data.status;
        if (data.preset !== undefined) updatePayload[`roles.${id}.preset`] = data.preset;

        await listDocRef.update(updatePayload);

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'update',
            entityType: 'role',
            entityId: id,
            details: data,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteRole(id: string, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const listDocRef = adminDb.collection('lists').doc('roles');

        const snap = await listDocRef.get();
        const existing = snap.exists ? (snap.data() as any)?.roles?.[id] : null;
        if (existing?.isBuiltIn) throw new Error('Built-in roles cannot be deleted.');

        await listDocRef.update({ [`roles.${id}`]: FieldValue.delete() });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'delete',
            entityType: 'role',
            entityId: id,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

type AddMedicalRecordData = Omit<MedicalRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdByUid' | 'projectId'>;

export async function addMedicalRecord(data: AddMedicalRecordData, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const newRecordRef = adminDb.collection('medicalRecords').doc();

        const projectId = `MED-${newRecordRef.id.substring(0, 8).toUpperCase()}`;

        await newRecordRef.set({
            ...data,
            projectId,
            createdByUid: actor.uid,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'create',
            entityType: 'medicalRecord',
            entityId: newRecordRef.id,
            districtId: data.districtId,
            details: data,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateMedicalRecord(id: string, data: Partial<Omit<MedicalRecord, 'id'>>, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const recordDoc = adminDb.collection('medicalRecords').doc(id);
        await recordDoc.update({
            ...data,
            updatedAt: FieldValue.serverTimestamp(),
        });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'update',
            entityType: 'medicalRecord',
            entityId: id,
            districtId: data.districtId,
            details: data,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteMedicalRecord(id: string, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        await adminDb.collection('medicalRecords').doc(id).delete();

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'delete',
            entityType: 'medicalRecord',
            entityId: id,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

type AddHospitalData = Omit<Hospital, 'id' | 'createdAt' | 'updatedAt'>;

export async function addHospital(data: AddHospitalData, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const newId = adminDb.collection('_').doc().id;
        const listDocRef = adminDb.collection('lists').doc('hospitals');
        const newItemData = { ...data, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
        await listDocRef.set({ hospitals: { [newId]: newItemData } }, { merge: true });
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'create', entityType: 'hospital', entityId: newId, details: data });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateHospital(id: string, data: Partial<Omit<Hospital, 'id' | 'createdAt' | 'updatedAt'>>, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const listDocRef = adminDb.collection('lists').doc('hospitals');
        const updatePayload: Record<string, any> = { [`hospitals.${id}.updatedAt`]: FieldValue.serverTimestamp() };
        if (data.name !== undefined) updatePayload[`hospitals.${id}.name`] = data.name;
        if (data.address !== undefined) updatePayload[`hospitals.${id}.address`] = data.address;
        await listDocRef.update(updatePayload);
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'update', entityType: 'hospital', entityId: id, details: data });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteHospital(id: string, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const listDocRef = adminDb.collection('lists').doc('hospitals');
        await listDocRef.update({ [`hospitals.${id}`]: FieldValue.delete() });
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'delete', entityType: 'hospital', entityId: id });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ---- Request / Receiving Actions ----

// Date fields are received as plain ISO strings, not client Timestamps: a
// client-SDK Timestamp does not survive the server-action serialization
// boundary — it arrives as a plain map and Firestore stores it as a nested
// object rather than a native Timestamp, which later crashes date rendering.
type AddRequestData = Omit<
    RequestRecord,
    'id' | 'createdAt' | 'updatedAt' | 'createdByUid' | 'status' | 'reviewNotes' | 'reviewedByUid' | 'reviewedAt' | 'dateReceived' | 'dateFiled'
> & {
    dateReceived: string;
    dateFiled: string;
};

/**
 * Coerce a date value into a native Firestore (Admin) Timestamp.
 * Accepts ISO strings / epoch millis (the current client contract) and also
 * tolerates a serialized client Timestamp map ({seconds, nanoseconds} or the
 * {_seconds, _nanoseconds} admin shape) so a mid-rollout client can't corrupt data.
 * Returns null when the value cannot be parsed to a valid date.
 */
function toAdminTimestamp(value: unknown): Timestamp | null {
    if (value == null) return null;
    if (value instanceof Timestamp) return value;
    if (typeof value === 'object') {
        const v = value as { seconds?: unknown; _seconds?: unknown; nanoseconds?: unknown; _nanoseconds?: unknown };
        if (typeof v.seconds === 'number') return new Timestamp(v.seconds, typeof v.nanoseconds === 'number' ? v.nanoseconds : 0);
        if (typeof v._seconds === 'number') return new Timestamp(v._seconds, typeof v._nanoseconds === 'number' ? v._nanoseconds : 0);
    }
    const d = new Date(value as string | number | Date);
    return isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
}

export async function addRequest(data: AddRequestData, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const dateReceived = toAdminTimestamp(data.dateReceived);
        const dateFiled = toAdminTimestamp(data.dateFiled);
        if (!dateReceived || !dateFiled) {
            return { success: false, error: 'Date Received and Date Filed must be valid dates.' };
        }
        const newRef = adminDb.collection('requests').doc();
        await newRef.set({
            ...data,
            dateReceived,
            dateFiled,
            status: 'pending' as RequestStatus,
            createdByUid: actor.uid,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'create', entityType: 'request', entityId: newRef.id, districtId: data.districtId });
        return { success: true, id: newRef.id };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateRequest(id: string, data: Partial<Omit<RequestRecord, 'id'>>, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const docRef = adminDb.collection('requests').doc(id);
        await docRef.update({ ...data, updatedAt: FieldValue.serverTimestamp() });
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'update', entityType: 'request', entityId: id });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteRequest(id: string, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        await adminDb.collection('requests').doc(id).delete();
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'delete', entityType: 'request', entityId: id });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateRequestStatus(
    id: string,
    newStatus: RequestStatus,
    actorToken: ActorToken,
    reviewNotes?: string
) {
    try {
        const actor = await resolveActor(actorToken);
        const docRef = adminDb.collection('requests').doc(id);
        const updateData: Record<string, any> = {
            status: newStatus,
            updatedAt: FieldValue.serverTimestamp(),
        };
        if (newStatus === 'approved' || newStatus === 'rejected') {
            updateData.reviewedByUid = actor.uid;
            updateData.reviewedAt = FieldValue.serverTimestamp();
            if (reviewNotes) updateData.reviewNotes = reviewNotes;
        }
        if (newStatus === 'pending') {
            updateData.reviewedByUid = null;
            updateData.reviewedAt = null;
            updateData.reviewNotes = null;
        }
        await docRef.update(updateData);
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'status_change', entityType: 'request', entityId: id, details: { newStatus, reviewNotes } });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ---- Tasker Actions ----

type AddTaskData = Omit<TaskRecord, 'id' | 'createdAt' | 'updatedAt'>;

export async function addTask(data: AddTaskData, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const newRef = adminDb.collection('tasks').doc();
        await newRef.set({
            ...data,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'create', entityType: 'task', entityId: newRef.id });
        return { success: true, id: newRef.id };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateTask(id: string, data: Partial<Omit<TaskRecord, 'id'>>, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        await adminDb.collection('tasks').doc(id).update({ ...data, updatedAt: FieldValue.serverTimestamp() });
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'update', entityType: 'task', entityId: id });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateTaskStatus(id: string, newStatus: TaskStatus, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        await adminDb.collection('tasks').doc(id).update({ status: newStatus, updatedAt: FieldValue.serverTimestamp() });
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'status_change', entityType: 'task', entityId: id, details: { newStatus } });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteTask(id: string, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        await adminDb.collection('tasks').doc(id).delete();
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'delete', entityType: 'task', entityId: id });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ============================================================================
// Scholarship — Recto Tulong Dunong
// ============================================================================

/**
 * PUBLIC — returns the barangay names from the office's `lists/barangays` doc
 * for the public scholarship form's Lipa City dropdown. The office's barangay
 * list currently *is* Lipa City's barangays, so all names are returned (the
 * districtName labels are placeholders, not localities). Names only — no
 * population/electoral fields are exposed. Read via Admin SDK (the public form
 * is unauthenticated and cannot read `lists` directly).
 */
export async function getLipaCityBarangays(): Promise<
    { success: true; barangays: string[] } | { success: false; error: string }
> {
    try {
        const snap = await adminDb.collection('lists').doc('barangays').get();
        if (!snap.exists) return { success: true, barangays: [] };
        const data = snap.data() as { barangays?: Record<string, { name?: string }> } | undefined;
        const names = Object.values(data?.barangays ?? {})
            .map((b) => (b?.name ?? '').trim())
            .filter((n) => n.length > 0);
        const unique = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
        return { success: true, barangays: unique };
    } catch (error: any) {
        console.error('getLipaCityBarangays error:', error);
        return { success: false, error: error?.message ?? 'Failed to load barangays.' };
    }
}

// ---------------------------------------------------------------------------
// Dashboard summary (stat cards + value-by-district chart + recent activity)
// ---------------------------------------------------------------------------

export interface DashboardDistrictDatum {
    name: string;
    value: number;   // total disbursed (sum of projectRecords.valueAmount)
    records: number; // project records touching this district
}

export interface DashboardActivityItem {
    id: string;
    type: string;        // human entity label, e.g. "Barangay"
    description: string; // e.g. "admin@... created a barangay"
    atMs: number;        // event time in epoch millis (serializable)
}

export interface DashboardData {
    totalBarangays: number;
    totalCoordinators: number;
    assistanceRecords: number; // medicalRecords + projectRecords
    totalDisbursed: number;    // sum of projectRecords.valueAmount
    districts: DashboardDistrictDatum[];
    recentActivity: DashboardActivityItem[];
}

const DASHBOARD_ENTITY_LABELS: Record<string, string> = {
    user: 'User', barangay: 'Barangay', barangayCycle: 'Barangay Cycle',
    captainProfile: 'Captain Profile', projectRecord: 'Project', medicalRecord: 'Medical Record',
    department: 'Department', role: 'Role', hospital: 'Hospital', request: 'Request',
    task: 'Task', system: 'System', scholarshipApplication: 'Scholarship Application',
};

const DASHBOARD_ACTION_VERBS: Record<string, string> = {
    access_update: 'updated access for', create: 'created', update: 'updated',
    delete: 'deleted', bulk_update: 'bulk-updated', generate_ai_profile: 'generated AI profiles for',
    status_change: 'changed the status of', view: 'viewed', export: 'exported',
};

function dashboardEntityLabel(t?: string): string {
    return (t && DASHBOARD_ENTITY_LABELS[t]) || 'Activity';
}

function describeAuditLog(a: Partial<AuditLog>): string {
    const who = a.actorEmail || 'A user';
    const verb = (a.action && DASHBOARD_ACTION_VERBS[a.action]) || 'updated';
    const what = dashboardEntityLabel(a.entityType).toLowerCase();
    return `${who} ${verb} a ${what}`;
}

async function readRecentActivity(): Promise<DashboardActivityItem[]> {
    const snap = await adminDb.collection('auditLogs').orderBy('timestamp', 'desc').limit(8).get();
    return snap.docs.map((d) => {
        const a = d.data() as Partial<AuditLog>;
        const ts = a.timestamp as { toMillis?: () => number } | undefined;
        return {
            id: d.id,
            type: dashboardEntityLabel(a.entityType),
            description: describeAuditLog(a),
            atMs: typeof ts?.toMillis === 'function' ? ts.toMillis() : 0,
        };
    });
}

/**
 * READ — aggregated dashboard summary. Uses cheap count() aggregation for the
 * stat cards and a slim (.select) projectRecords read for the per-district chart
 * and total disbursed. District-scoped for non-admins (mirrors the barangays page):
 * platformAdmin/OIC see everything; everyone else is limited to their assigned
 * districtIds, and a scoped user with no districts sees zeroes.
 */
export async function getDashboardData(
    actorToken: ActorToken,
): Promise<{ success: true; data: DashboardData } | { success: false; error: string }> {
    try {
        const actor = await resolveActor(actorToken);

        if (!canViewPage(actor.profile, 'dashboard', { isPlatformAdminClaim: actor.isPlatformAdmin })) {
            return { success: false, error: 'You do not have permission to view the dashboard.' };
        }

        const profile = actor.profile;
        const seesAll =
            actor.isPlatformAdmin || profile?.roleId === 'platformAdmin' || profile?.roleId === 'oic';
        const districtIds = profile?.access?.districtIds ?? [];
        const scoped = !seesAll;

        // Coordinators are an org-wide count, not district-scoped.
        const totalCoordinators = (
            await adminDb.collection('users').where('roleId', '==', 'coordinator').count().get()
        ).data().count;

        // A scoped user with no assigned districts has nothing to summarise.
        if (scoped && districtIds.length === 0) {
            return {
                success: true,
                data: {
                    totalBarangays: 0,
                    totalCoordinators,
                    assistanceRecords: 0,
                    totalDisbursed: 0,
                    districts: [],
                    recentActivity: await readRecentActivity(),
                },
            };
        }

        // district id -> name map from the denormalized barangay list.
        const listSnap = await adminDb.collection('lists').doc('barangays').get();
        const listItems = (listSnap.data()?.barangays ?? {}) as Record<
            string,
            { districtId?: string; districtName?: string }
        >;
        const districtNames = new Map<string, string>();
        for (const item of Object.values(listItems)) {
            if (item?.districtId && !districtNames.has(item.districtId)) {
                districtNames.set(item.districtId, item.districtName || item.districtId);
            }
        }

        // --- Barangays count ---
        let barangaysQ: Query = adminDb.collection('barangays');
        if (scoped) barangaysQ = barangaysQ.where('districtId', 'in', districtIds);
        const totalBarangays = (await barangaysQ.count().get()).data().count;

        // --- Medical records count ---
        let medicalQ: Query = adminDb.collection('medicalRecords');
        if (scoped) medicalQ = medicalQ.where('districtId', 'in', districtIds);
        const medicalCount = (await medicalQ.count().get()).data().count;

        // --- Project records: slim read drives count + total + per-district ---
        let projectQ: Query = adminDb.collection('projectRecords');
        if (scoped) projectQ = projectQ.where('districtIds', 'array-contains-any', districtIds);
        const projectSnap = await projectQ.select('districtIds', 'valueAmount').get();

        let totalDisbursed = 0;
        const perDistrict = new Map<string, { value: number; records: number }>();
        for (const docSnap of projectSnap.docs) {
            const d = docSnap.data() as { districtIds?: string[]; valueAmount?: number };
            const value = typeof d.valueAmount === 'number' ? d.valueAmount : 0;
            totalDisbursed += value; // each project counted once toward the headline total
            const ids = Array.isArray(d.districtIds) ? d.districtIds : [];
            for (const id of ids) {
                if (scoped && !districtIds.includes(id)) continue; // only the actor's districts
                const cur = perDistrict.get(id) ?? { value: 0, records: 0 };
                cur.value += value;
                cur.records += 1;
                perDistrict.set(id, cur);
            }
        }
        const projectCount = projectSnap.size;

        const districts: DashboardDistrictDatum[] = Array.from(perDistrict.entries())
            .map(([id, agg]) => ({ name: districtNames.get(id) ?? id, value: agg.value, records: agg.records }))
            .sort((a, b) => b.value - a.value);

        return {
            success: true,
            data: {
                totalBarangays,
                totalCoordinators,
                assistanceRecords: medicalCount + projectCount,
                totalDisbursed,
                districts,
                recentActivity: await readRecentActivity(),
            },
        };
    } catch (error: any) {
        console.error('getDashboardData error:', error);
        return { success: false, error: error?.message ?? 'Failed to load dashboard data.' };
    }
}

// ---------------------------------------------------------------------------
// Analytics summary (period-scoped projects + cumulative org metrics + chart)
// ---------------------------------------------------------------------------

export type AnalyticsPeriod = 'daily' | 'weekly' | 'yearly';

// App Hosting runs in UTC; the office operates in PH time (UTC+8, no DST).
// Compute period boundaries against PH wall-clock so "today"/"this year" align.
const PH_OFFSET_MS = 8 * 60 * 60 * 1000;

function analyticsPeriodStart(period: AnalyticsPeriod): Timestamp {
    const nowPh = new Date(Date.now() + PH_OFFSET_MS); // shift so UTC getters read PH wall-clock
    let startPhWall: Date;
    if (period === 'daily') {
        startPhWall = new Date(Date.UTC(nowPh.getUTCFullYear(), nowPh.getUTCMonth(), nowPh.getUTCDate()));
    } else if (period === 'weekly') {
        startPhWall = new Date(Date.UTC(nowPh.getUTCFullYear(), nowPh.getUTCMonth(), nowPh.getUTCDate() - 6));
    } else {
        startPhWall = new Date(Date.UTC(nowPh.getUTCFullYear(), 0, 1));
    }
    return Timestamp.fromDate(new Date(startPhWall.getTime() - PH_OFFSET_MS)); // back to the real UTC instant
}

/**
 * READ — analytics overview for the /analytics page. Org-wide (not district-scoped):
 * the page is admin/OIC/office-admin only. The `period` scopes the Projects count
 * (records with an eventDate inside the Today / past-7-days / this-year window);
 * users, departments and "brgys w/ profile" are current cumulative totals.
 */
export async function getAnalyticsData(
    actorToken: ActorToken,
    period: AnalyticsPeriod,
): Promise<{ success: true; data: AnalyticsData } | { success: false; error: string }> {
    try {
        const actor = await resolveActor(actorToken);

        if (!canViewPage(actor.profile, 'analytics', { isPlatformAdminClaim: actor.isPlatformAdmin })) {
            return { success: false, error: 'You do not have permission to view analytics.' };
        }

        // Barangays with a filled-in profile (current cycle + stats entered).
        const brgyListSnap = await adminDb.collection('lists').doc('barangays').get();
        const brgyItems = Object.values(
            (brgyListSnap.data()?.barangays ?? {}) as Record<
                string,
                { currentCycle?: string; votingPopulation?: number; rsrVotes?: number }
            >,
        );
        const brgyWithProfileCount = brgyItems.filter(
            (b) => !!b?.currentCycle && (Number(b?.votingPopulation) > 0 || Number(b?.rsrVotes) > 0),
        ).length;

        // Departments (cumulative) from the denormalized list doc.
        const deptListSnap = await adminDb.collection('lists').doc('departments').get();
        const deptItems = (deptListSnap.data()?.departments ?? {}) as Record<string, { name?: string }>;
        const departmentCount = Object.keys(deptItems).length;

        // Active users — one slim read drives both the user count and the per-department chart.
        const usersSnap = await adminDb
            .collection('users')
            .where('isActive', '==', true)
            .select('departmentId')
            .get();
        const userCount = usersSnap.size;
        const memberCounts = new Map<string, number>();
        for (const docSnap of usersSnap.docs) {
            const dep = (docSnap.data() as { departmentId?: string }).departmentId;
            if (!dep) continue;
            memberCounts.set(dep, (memberCounts.get(dep) ?? 0) + 1);
        }
        const departments = Object.entries(deptItems)
            .map(([id, info]) => ({ name: info?.name ?? id, memberCount: memberCounts.get(id) ?? 0 }))
            .sort((a, b) => b.memberCount - a.memberCount);

        // Projects in the selected period (by eventDate).
        const projectCount = (
            await adminDb
                .collection('projectRecords')
                .where('eventDate', '>=', analyticsPeriodStart(period))
                .count()
                .get()
        ).data().count;

        return {
            success: true,
            data: { brgyWithProfileCount, userCount, departmentCount, projectCount, departments },
        };
    } catch (error: any) {
        console.error('getAnalyticsData error:', error);
        return { success: false, error: error?.message ?? 'Failed to load analytics data.' };
    }
}

// ---------------------------------------------------------------------------
// Scholarship form acceptance window (open / max responses / deadline / closed)
// ---------------------------------------------------------------------------

const SCHOLARSHIP_CONFIG_DOC = adminDb.collection('scholarshipConfig').doc('form');

function normalizeFormConfig(raw: any): ScholarshipFormConfig {
    const status: ScholarshipFormStatusMode =
        raw?.status === 'maxResponses' || raw?.status === 'deadline' || raw?.status === 'closed'
            ? raw.status
            : 'open';
    return {
        status,
        maxResponses: typeof raw?.maxResponses === 'number' ? raw.maxResponses : 0,
        closesAtMs: typeof raw?.closesAtMs === 'number' ? raw.closesAtMs : null,
        suspended: raw?.suspended === true,
        currentBatch: typeof raw?.currentBatch === 'number' && raw.currentBatch >= 1 ? raw.currentBatch : 1,
        batches: Array.isArray(raw?.batches) ? raw.batches : [],
    };
}

async function readFormConfig(): Promise<ScholarshipFormConfig> {
    const snap = await SCHOLARSHIP_CONFIG_DOC.get();
    return snap.exists ? normalizeFormConfig(snap.data()) : DEFAULT_SCHOLARSHIP_FORM_CONFIG;
}

/** Count applications, optionally scoped to a single batch (current-batch counting). */
async function countScholarshipApplications(batchNo?: number): Promise<number> {
    const base = adminDb.collection('scholarshipApplications');
    const q = typeof batchNo === 'number' ? base.where('batchNo', '==', batchNo) : base;
    const c = await q.count().get();
    return c.data().count;
}

/** ADMIN — current form config + current-batch response count, for the settings UI / banner. */
export async function getScholarshipFormConfig(actorToken: ActorToken): Promise<
    { success: true; config: ScholarshipFormConfig; responseCount: number } | { success: false; error: string }
> {
    try {
        const actor = await resolveActor(actorToken);
        assertCanViewScholarship(actor);
        const config = await readFormConfig();
        const responseCount = await countScholarshipApplications(config.currentBatch ?? 1);
        return { success: true, config, responseCount };
    } catch (error: any) {
        return { success: false, error: error?.message ?? 'Failed to load form settings.' };
    }
}

/** ADMIN — update the acceptance window. Deadline is given as days + hours from now. */
export async function updateScholarshipFormConfig(
    input: { status: ScholarshipFormStatusMode; maxResponses?: number; deadlineDays?: number; deadlineHours?: number },
    actorToken: ActorToken,
): Promise<{ success: true; config: ScholarshipFormConfig } | { success: false; error: string }> {
    try {
        const actor = await resolveActor(actorToken);
        assertCanViewScholarship(actor);
        if (!actor.isPlatformAdmin && actor.profile && !canDo(actor.profile, 'scholarship_applications', 'update')) {
            return { success: false, error: 'You do not have permission to change form settings.' };
        }

        const status = (['open', 'maxResponses', 'deadline', 'closed'] as const).includes(input.status as any)
            ? input.status
            : 'open';

        let maxResponses = 0;
        let closesAtMs: number | null = null;

        if (status === 'maxResponses') {
            maxResponses = Math.floor(Number(input.maxResponses));
            if (!Number.isFinite(maxResponses) || maxResponses < 1) {
                return { success: false, error: 'Enter a valid maximum number of responses (at least 1).' };
            }
        }
        if (status === 'deadline') {
            const days = Math.max(0, Math.floor(Number(input.deadlineDays) || 0));
            const hours = Math.max(0, Math.floor(Number(input.deadlineHours) || 0));
            const durationMs = days * 86_400_000 + hours * 3_600_000;
            if (durationMs <= 0) {
                return { success: false, error: 'Enter a deadline of at least 1 hour.' };
            }
            closesAtMs = Date.now() + durationMs;
        }

        const config: ScholarshipFormConfig = { status, maxResponses, closesAtMs };
        await SCHOLARSHIP_CONFIG_DOC.set(
            { ...config, updatedAt: FieldValue.serverTimestamp(), updatedByUid: actor.uid, updatedByEmail: actor.email },
            { merge: true },
        );

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'update',
            entityType: 'system',
            entityId: 'scholarshipFormConfig',
            details: config,
        });

        return { success: true, config };
    } catch (error: any) {
        return { success: false, error: error?.message ?? 'Failed to save form settings.' };
    }
}

/** ADMIN — instantly pause or resume acceptance (manual override on top of the rule). */
export async function setScholarshipFormSuspended(
    suspended: boolean,
    actorToken: ActorToken,
): Promise<{ success: true } | { success: false; error: string }> {
    try {
        const actor = await resolveActor(actorToken);
        assertCanViewScholarship(actor);
        if (!actor.isPlatformAdmin && actor.profile && !canDo(actor.profile, 'scholarship_applications', 'update')) {
            return { success: false, error: 'You do not have permission to change form settings.' };
        }
        await SCHOLARSHIP_CONFIG_DOC.set(
            { suspended: !!suspended, updatedAt: FieldValue.serverTimestamp(), updatedByUid: actor.uid, updatedByEmail: actor.email },
            { merge: true },
        );
        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'update',
            entityType: 'system',
            entityId: 'scholarshipFormConfig',
            details: { suspended: !!suspended },
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error?.message ?? 'Failed to update suspension.' };
    }
}

/**
 * ADMIN — "Save this list as batch": locks the current batch and starts the next
 * one. New submissions are stamped with the new batch; the form is paused so the
 * admin can deliberately re-open it for the new batch. Past batches are kept.
 */
export async function finalizeScholarshipBatch(
    actorToken: ActorToken,
): Promise<{ success: true; finalizedBatch: number; count: number; newBatch: number } | { success: false; error: string }> {
    try {
        const actor = await resolveActor(actorToken);
        assertCanViewScholarship(actor);
        if (!actor.isPlatformAdmin && actor.profile && !canDo(actor.profile, 'scholarship_applications', 'update')) {
            return { success: false, error: 'You do not have permission to save batches.' };
        }
        const config = await readFormConfig();
        const current = config.currentBatch ?? 1;
        const count = await countScholarshipApplications(current);
        const newBatch = current + 1;
        const batches = (Array.isArray(config.batches) ? config.batches.slice() : []).filter((b) => b.no !== current);
        batches.push({ no: current, finalizedAtMs: Date.now(), count });
        batches.sort((a, b) => a.no - b.no);

        await SCHOLARSHIP_CONFIG_DOC.set(
            {
                currentBatch: newBatch,
                batches,
                suspended: true,
                updatedAt: FieldValue.serverTimestamp(),
                updatedByUid: actor.uid,
                updatedByEmail: actor.email,
            },
            { merge: true },
        );

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'update',
            entityType: 'system',
            entityId: 'scholarshipFormConfig',
            details: { finalizedBatch: current, count, newBatch },
        });

        return { success: true, finalizedBatch: current, count, newBatch };
    } catch (error: any) {
        return { success: false, error: error?.message ?? 'Failed to save batch.' };
    }
}

/**
 * PUBLIC — whether the registration form is accepting answers right now. Fails
 * OPEN on error so a transient glitch never blocks applicants; the submit gate
 * is the authoritative enforcement.
 */
export async function getScholarshipFormStatus(): Promise<ScholarshipFormStatus> {
    try {
        const config = await readFormConfig();
        const count = config.status === 'maxResponses'
            ? await countScholarshipApplications(config.currentBatch ?? 1)
            : 0;
        return computeFormStatus(config, count, Date.now());
    } catch (error) {
        console.error('getScholarshipFormStatus error:', error);
        return computeFormStatus(DEFAULT_SCHOLARSHIP_FORM_CONFIG, 0, Date.now());
    }
}

const SEX_VALUES: ScholarshipSex[] = ['Male', 'Female', 'Prefer not to say'];
const CIVIL_STATUS_VALUES: ScholarshipCivilStatus[] = ['Single', 'Married', 'Widowed', 'Separated'];
const RELATIONSHIP_VALUES: ScholarshipRelationship[] = ['Mother', 'Father', 'Guardian', 'Sibling', 'Spouse', 'Other'];
const INCOME_BRACKET_VALUES: ScholarshipIncomeBracket[] = [
    'Below ₱10,000',
    '₱10,000–₱20,000',
    '₱20,001–₱40,000',
    '₱40,001–₱80,000',
    'Above ₱80,000',
];
const YEAR_LEVEL_VALUES: ScholarshipYearLevel[] = [
    'Incoming 1st Year', '1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', 'Graduating',
];

const scholarshipApplicationSchema = z.object({
    lastName: z.string().trim().min(1, 'Last name is required.').max(100),
    firstName: z.string().trim().min(1, 'First name is required.').max(100),
    middleName: z.string().trim().max(100).optional().default(''),
    suffix: z.string().trim().max(20).optional().default(''),
    dateOfBirth: z.string().trim().min(1, 'Date of birth is required.'),
    sex: z.enum(SEX_VALUES as [ScholarshipSex, ...ScholarshipSex[]]),
    civilStatus: z.enum(CIVIL_STATUS_VALUES as [ScholarshipCivilStatus, ...ScholarshipCivilStatus[]]),

    homeAddress: z.string().trim().min(1, 'Home address is required.').max(300),
    city: z.string().trim().min(1, 'City/Municipality is required.').max(100),
    province: z.string().trim().min(1, 'Province is required.').max(100),
    postalCode: z.string().trim().max(20).optional().default(''),
    mobile: z.string().trim().min(1, 'Mobile number is required.').max(30),
    email: z.string().trim().email('A valid email is required.').max(200),

    parentName: z.string().trim().min(1, 'Parent/Guardian name is required.').max(200),
    parentRelationship: z.enum(RELATIONSHIP_VALUES as [ScholarshipRelationship, ...ScholarshipRelationship[]]),
    parentContact: z.string().trim().min(1, 'Parent/Guardian contact number is required.').max(30),
    incomeBracket: z.enum(INCOME_BRACKET_VALUES as [ScholarshipIncomeBracket, ...ScholarshipIncomeBracket[]]),

    school: z.string().trim().min(1, 'School is required.'),
    schoolOther: z.string().trim().max(200).optional().default(''),
    course: z.string().trim().min(1, 'Course is required.'),
    courseOther: z.string().trim().max(200).optional().default(''),
    yearLevel: z.enum(YEAR_LEVEL_VALUES as [ScholarshipYearLevel, ...ScholarshipYearLevel[]]),
    expectedGraduationYear: z.coerce.number().int().min(2026).max(2035),

    // Proof of residency — the file is uploaded to Storage client-side; only the
    // resulting Storage path + light metadata reach the server.
    proofOfResidency: z.object({
        storagePath: z.string().trim().min(1).max(500).startsWith('Tulong Dunong/', {
            message: 'Invalid proof-of-residency upload.',
        }),
        fileName: z.string().trim().max(255).optional().default(''),
        contentType: z.string().trim().max(100).optional().default('image/jpeg'),
    }, { errorMap: () => ({ message: 'Proof of residency (government-issued ID) is required.' }) }),

    // A.Y. 2025–2026 registration / enrollment form.
    registrationForm: z.object({
        storagePath: z.string().trim().min(1).max(500).startsWith('Tulong Dunong/', {
            message: 'Invalid registration form upload.',
        }),
        fileName: z.string().trim().max(255).optional().default(''),
        contentType: z.string().trim().max(100).optional().default(''),
    }, { errorMap: () => ({ message: 'A.Y. 2025–2026 registration form is required.' }) }),

    // Barangay — only meaningful when city is Lipa City; '' otherwise.
    barangay: z.string().trim().max(100).optional().default(''),

    // Other scholarship grant.
    hasOtherScholarship: z.boolean(),
    otherScholarshipDetails: z.string().trim().max(500).optional().default(''),

    consentGiven: z.literal(true, { errorMap: () => ({ message: 'You must give your consent to submit.' }) }),
}).superRefine((data, ctx) => {
    if (data.school === OTHER_SCHOOL_VALUE && !data.schoolOther) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['schoolOther'], message: 'Please specify your school.' });
    }
    if (data.course === OTHER_COURSE_VALUE && !data.courseOther) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['courseOther'], message: 'Please specify your course.' });
    }
    if (data.hasOtherScholarship && !data.otherScholarshipDetails) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['otherScholarshipDetails'], message: 'Please specify the other scholarship grant.' });
    }
});

export type SubmitScholarshipApplicationInput = z.infer<typeof scholarshipApplicationSchema>;

function generateScholarshipReferenceNo(): string {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const rand = randomBytes(3).toString('hex').toUpperCase();
    return `RTD-${yyyy}${mm}${dd}-${rand}`;
}

/**
 * PUBLIC — accepts a scholarship application from the unauthenticated
 * /scholarship/apply form. Does NOT call assertActor. Validates fully
 * server-side using zod, computes shortlisting, and writes the record
 * via the Admin SDK (firestore rules deny client writes to this
 * collection).
 */
export async function submitScholarshipApplication(input: unknown) {
    try {
        // Gate: refuse if the acceptance window is closed (authoritative,
        // server-side enforcement of the max-responses / deadline / closed rule).
        // Max-responses counting is scoped to the current batch.
        const gateConfig = await readFormConfig();
        const currentBatch = gateConfig.currentBatch ?? 1;
        const gateCount = gateConfig.status === 'maxResponses' ? await countScholarshipApplications(currentBatch) : 0;
        const gate = computeFormStatus(gateConfig, gateCount, Date.now());
        if (!gate.open) {
            return { success: false as const, error: gate.reason || 'Registration is closed.' };
        }

        const parsed = scholarshipApplicationSchema.safeParse(input);
        if (!parsed.success) {
            const firstIssue = parsed.error.issues[0];
            return {
                success: false as const,
                error: firstIssue?.message ?? 'Invalid submission.',
                fieldErrors: parsed.error.flatten().fieldErrors,
            };
        }
        const data = parsed.data;

        // Duplicate guard: reject if any existing application (across all batches) shares
        // the same email, mobile number, or full name (firstName + lastName).
        const colRef = adminDb.collection('scholarshipApplications');
        const [emailSnap, mobileSnap, lastNameSnap] = await Promise.all([
            colRef.where('email', '==', data.email).limit(1).get(),
            colRef.where('mobile', '==', data.mobile).limit(1).get(),
            colRef.where('lastName', '==', data.lastName).limit(20).get(),
        ]);
        if (!emailSnap.empty) {
            return { success: false as const, error: 'An application with this email address has already been submitted. Each person may only apply once.' };
        }
        if (!mobileSnap.empty) {
            return { success: false as const, error: 'An application with this mobile number has already been submitted. Each person may only apply once.' };
        }
        const lowerFirst = data.firstName.toLowerCase().trim();
        const nameExists = lastNameSnap.docs.some((doc) => {
            const d = doc.data();
            return typeof d.firstName === 'string' && d.firstName.toLowerCase().trim() === lowerFirst;
        });
        if (nameExists) {
            return { success: false as const, error: 'An application with this name has already been submitted. Each person may only apply once.' };
        }

        // Route "Other" selections back to the canonical list where the typed
        // value actually matches a qualified school/course — applicants often
        // pick "Other" only because they missed the entry in the dropdown.
        const resolvedSchool = resolveSchoolInput(data.school, data.schoolOther);
        const resolvedCourse = resolveCourseInput(resolvedSchool.school, data.course, data.courseOther);

        const shortlist = evaluateShortlist({
            school: resolvedSchool.school,
            schoolOther: resolvedSchool.schoolOther,
            course: resolvedCourse.course,
            courseOther: resolvedCourse.courseOther,
        });

        const referenceNo = generateScholarshipReferenceNo();
        const docRef = adminDb.collection('scholarshipApplications').doc();

        // Resolve display values: if still genuinely "Other", store the typed-in
        // value; otherwise store the canonical school/course name.
        const schoolDisplay = resolvedSchool.school === OTHER_SCHOOL_VALUE
            ? (resolvedSchool.schoolOther || 'Other')
            : resolvedSchool.school;
        const courseDisplay = resolvedCourse.course === OTHER_COURSE_VALUE
            ? (resolvedCourse.courseOther || 'Other')
            : resolvedCourse.course;

        const priority = computePriorityScore({
            isShortlisted: shortlist.isShortlisted,
            city: data.city,
            hasProof: !!data.proofOfResidency?.storagePath,
            hasOtherScholarship: data.hasOtherScholarship,
            yearLevel: data.yearLevel,
        });

        const record = {
            referenceNo,
            lastName: data.lastName,
            firstName: data.firstName,
            middleName: data.middleName ?? '',
            suffix: data.suffix ?? '',
            dateOfBirth: data.dateOfBirth,
            sex: data.sex,
            civilStatus: data.civilStatus,

            homeAddress: data.homeAddress,
            city: data.city,
            province: data.province,
            postalCode: data.postalCode ?? '',
            mobile: data.mobile,
            email: data.email,

            parentName: data.parentName,
            parentRelationship: data.parentRelationship,
            parentContact: data.parentContact,
            incomeBracket: data.incomeBracket,

            school: schoolDisplay,
            schoolOther: resolvedSchool.school === OTHER_SCHOOL_VALUE ? (resolvedSchool.schoolOther ?? '') : '',
            course: courseDisplay,
            courseOther: resolvedCourse.course === OTHER_COURSE_VALUE ? (resolvedCourse.courseOther ?? '') : '',
            yearLevel: data.yearLevel,
            expectedGraduationYear: data.expectedGraduationYear,

            proofOfResidency: {
                storagePath: data.proofOfResidency.storagePath,
                fileName: data.proofOfResidency.fileName ?? '',
                contentType: data.proofOfResidency.contentType ?? 'image/jpeg',
            },

            registrationForm: {
                storagePath: data.registrationForm.storagePath,
                fileName: data.registrationForm.fileName ?? '',
                contentType: data.registrationForm.contentType ?? '',
            },

            barangay: data.barangay ?? '',
            hasOtherScholarship: data.hasOtherScholarship,
            otherScholarshipDetails: data.hasOtherScholarship ? (data.otherScholarshipDetails ?? '') : '',
            priorityScore: priority.score,

            batchNo: currentBatch,

            consentGiven: true,

            isShortlisted: shortlist.isShortlisted,
            shortlistReason: shortlist.reason,

            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        await docRef.set(record);

        // Audit the submission with a system actor — the applicant is unauthenticated.
        await logAudit({
            actorUid: 'public',
            actorEmail: data.email,
            action: 'create',
            entityType: 'scholarshipApplication',
            entityId: docRef.id,
            details: {
                referenceNo,
                isShortlisted: shortlist.isShortlisted,
                shortlistReason: shortlist.reason,
                school: schoolDisplay,
                course: courseDisplay,
            },
        });

        return { success: true as const, id: docRef.id, referenceNo };
    } catch (error: any) {
        console.error('submitScholarshipApplication error:', error);
        return { success: false as const, error: error?.message ?? 'Failed to submit application.' };
    }
}

function assertCanViewScholarship(actor: VerifiedActor) {
    if (actor.isPlatformAdmin) return;
    if (!actor.profile) throw new Error('Permission denied.');
    if (!canViewPage(actor.profile, 'scholarship_applications')) {
        throw new Error('Permission denied. You do not have access to scholarship applications.');
    }
}

export type ScholarshipApplicationListItem = Omit<ScholarshipApplication, 'createdAt' | 'updatedAt'> & {
    createdAt: string | null;
    updatedAt: string | null;
};

function serializeTimestamp(value: any): string | null {
    if (!value) return null;
    if (typeof value?.toDate === 'function') {
        return value.toDate().toISOString();
    }
    if (value instanceof Date) return value.toISOString();
    return null;
}

/**
 * ADMIN — lists every scholarship application for users with
 * scholarship_applications page access. Audited.
 */
export async function getScholarshipApplications(actorToken: ActorToken, batchNo?: number): Promise<
    | { success: true; data: ScholarshipApplicationListItem[] }
    | { success: false; error: string }
> {
    try {
        const actor = await resolveActor(actorToken);
        assertCanViewScholarship(actor);

        const base = adminDb.collection('scholarshipApplications');
        // Batch case uses an equality filter only (single-field index) and sorts in
        // memory, avoiding a composite (batchNo + createdAt) index.
        const snap = typeof batchNo === 'number'
            ? await base.where('batchNo', '==', batchNo).get()
            : await base.orderBy('createdAt', 'desc').get();

        const items: ScholarshipApplicationListItem[] = snap.docs.map((d) => {
            const raw = d.data() as any;
            return {
                id: d.id,
                referenceNo: raw.referenceNo,
                lastName: raw.lastName,
                firstName: raw.firstName,
                middleName: raw.middleName ?? '',
                suffix: raw.suffix ?? '',
                dateOfBirth: raw.dateOfBirth,
                sex: raw.sex,
                civilStatus: raw.civilStatus,
                homeAddress: raw.homeAddress,
                city: raw.city,
                province: raw.province,
                postalCode: raw.postalCode ?? '',
                mobile: raw.mobile,
                email: raw.email,
                parentName: raw.parentName,
                parentRelationship: raw.parentRelationship,
                parentContact: raw.parentContact,
                incomeBracket: raw.incomeBracket,
                school: raw.school,
                schoolOther: raw.schoolOther ?? '',
                course: raw.course,
                courseOther: raw.courseOther ?? '',
                yearLevel: raw.yearLevel,
                expectedGraduationYear: raw.expectedGraduationYear,
                proofOfResidency: raw.proofOfResidency
                    ? {
                          storagePath: raw.proofOfResidency.storagePath ?? '',
                          fileName: raw.proofOfResidency.fileName ?? '',
                          contentType: raw.proofOfResidency.contentType ?? 'image/jpeg',
                      }
                    : null,
                registrationForm: raw.registrationForm
                    ? {
                          storagePath: raw.registrationForm.storagePath ?? '',
                          fileName: raw.registrationForm.fileName ?? '',
                          contentType: raw.registrationForm.contentType ?? '',
                      }
                    : null,
                barangay: raw.barangay ?? '',
                hasOtherScholarship: typeof raw.hasOtherScholarship === 'boolean' ? raw.hasOtherScholarship : undefined,
                otherScholarshipDetails: raw.otherScholarshipDetails ?? '',
                priorityScore: computePriorityScore({
                    isShortlisted: raw.isShortlisted === true,
                    city: raw.city,
                    hasProof: !!raw.proofOfResidency?.storagePath,
                    hasOtherScholarship: typeof raw.hasOtherScholarship === 'boolean' ? raw.hasOtherScholarship : undefined,
                    yearLevel: raw.yearLevel,
                }).score,
                batchNo: typeof raw.batchNo === 'number' ? raw.batchNo : 1,
                consentGiven: raw.consentGiven === true,
                isShortlisted: raw.isShortlisted === true,
                shortlistReason: raw.shortlistReason ?? '',
                createdAt: serializeTimestamp(raw.createdAt),
                updatedAt: serializeTimestamp(raw.updatedAt),
            };
        });

        // Newest first (batch case is fetched without an orderBy to avoid a composite index).
        items.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'view',
            entityType: 'scholarshipApplication',
            entityId: 'list',
            details: { count: items.length },
        });

        return { success: true, data: items };
    } catch (error: any) {
        console.error('getScholarshipApplications error:', error);
        return { success: false, error: error?.message ?? 'Failed to load applications.' };
    }
}

function csvCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    const s = String(value);
    if (/[",\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

/**
 * ADMIN — exports applications as CSV. Accepts an optional filter so the
 * client can ship "All / Shortlisted / Not Shortlisted" without a second
 * round-trip. Audited.
 */
export async function exportScholarshipApplicationsCSV(
    actorToken: ActorToken,
    filter: 'all' | 'shortlisted' | 'not_shortlisted' = 'all',
): Promise<{ success: true; csv: string; filename: string } | { success: false; error: string }> {
    try {
        const actor = await resolveActor(actorToken);
        assertCanViewScholarship(actor);
        if (!actor.isPlatformAdmin && actor.profile && !canDo(actor.profile, 'scholarship_applications', 'read')) {
            return { success: false, error: 'Permission denied.' };
        }

        const snap = await adminDb
            .collection('scholarshipApplications')
            .orderBy('createdAt', 'desc')
            .get();

        const rows = snap.docs
            .map((d) => d.data() as any)
            .filter((r) => {
                if (filter === 'shortlisted') return r.isShortlisted === true;
                if (filter === 'not_shortlisted') return r.isShortlisted !== true;
                return true;
            });

        const header = [
            'Date Submitted', 'Reference No.', 'Last Name', 'First Name', 'Middle Name', 'Suffix',
            'Date of Birth', 'Sex', 'Civil Status',
            'Home Address', 'Barangay', 'City/Municipality', 'Province', 'Postal Code', 'Mobile', 'Email',
            'Parent/Guardian', 'Relationship', 'Parent Contact', 'Income Bracket',
            'Other Scholarship Grant', 'Other Grant Details',
            'School', 'Course', 'Year Level', 'Expected Graduation Year',
            'Proof of Residency', 'Has Proof of Residency ID', 'Has Registration Form',
            'Year Level Points', 'Priority Score', 'Batch', 'Shortlisted', 'Shortlist Reason',
        ];

        const lines: string[] = [header.map(csvCell).join(',')];
        for (const r of rows) {
            const submittedIso = serializeTimestamp(r.createdAt) ?? '';
            const otherGrant = r.hasOtherScholarship === true ? 'Yes' : r.hasOtherScholarship === false ? 'No' : '';
            const priorityScore = computePriorityScore({
                isShortlisted: r.isShortlisted === true,
                city: r.city,
                hasProof: !!r.proofOfResidency?.storagePath,
                hasOtherScholarship: typeof r.hasOtherScholarship === 'boolean' ? r.hasOtherScholarship : undefined,
                yearLevel: r.yearLevel,
            }).score;
            lines.push([
                submittedIso, r.referenceNo, r.lastName, r.firstName, r.middleName ?? '', r.suffix ?? '',
                r.dateOfBirth, r.sex, r.civilStatus,
                r.homeAddress, r.barangay ?? '', r.city, r.province, r.postalCode ?? '', r.mobile, r.email,
                r.parentName, r.parentRelationship, r.parentContact, r.incomeBracket,
                otherGrant, r.otherScholarshipDetails ?? '',
                r.school, r.course, r.yearLevel, r.expectedGraduationYear,
                r.proofOfResidency?.storagePath ? 'Uploaded' : 'Missing',
                !!r.proofOfResidency?.storagePath,
                !!r.registrationForm?.storagePath,
                yearLevelPriorityPoints(r.yearLevel),
                priorityScore, r.batchNo ?? 1, r.isShortlisted ? 'YES' : 'NO', r.shortlistReason ?? '',
            ].map(csvCell).join(','));
        }

        const csv = lines.join('\r\n');
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `recto-tulong-dunong-${filter}-${stamp}.csv`;

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'export',
            entityType: 'scholarshipApplication',
            entityId: 'list',
            details: { filter, count: rows.length },
        });

        return { success: true, csv, filename };
    } catch (error: any) {
        console.error('exportScholarshipApplicationsCSV error:', error);
        return { success: false, error: error?.message ?? 'Failed to export CSV.' };
    }
}

/**
 * ADMIN — logs a "view detail" audit event. Called from the client when
 * a user opens a submission's detail dialog. The underlying record is
 * already on the client thanks to getScholarshipApplications, so we
 * only need to record that the human looked at it.
 */
export async function logScholarshipApplicationView(applicationId: string, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        assertCanViewScholarship(actor);
        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'view',
            entityType: 'scholarshipApplication',
            entityId: applicationId,
        });
        return { success: true as const };
    } catch (error: any) {
        return { success: false as const, error: error?.message ?? 'Failed to log view.' };
    }
}
